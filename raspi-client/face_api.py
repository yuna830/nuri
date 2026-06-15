import asyncio
import os
import tempfile
import time
from typing import List

import cv2
import numpy as np
import requests
from fastapi import FastAPI, File, Form, UploadFile
from insightface.app import FaceAnalysis
from pydantic import BaseModel


MATCH_THRESHOLD = 0.62
CANDIDATE_THRESHOLD = 0.55
FACE_ALERT_COOLDOWN_SECONDS = 60
KNOWN_FACE_QUALITY_MIN_SCORE = 0.45
LIVE_FACE_QUALITY_MIN_SCORE = 0.45
MIN_FACE_SIZE = 100

SPRING_SERVER_URL = os.getenv("SPRING_SERVER_URL", "http://localhost:8080")
KNOWN_FACE_DIR = os.getenv("KNOWN_FACE_DIR", "known_faces")

app = FastAPI()

face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(640, 640))

known_embeddings = []
last_alert_time_by_senior_id = {}

# 이미지 URL별 임베딩 캐시 — reload 때마다 전체 사진을 재임베딩하지 않도록 한다.
# (재임베딩이 verify와 CPU를 경쟁하면 앱 쪽 타임아웃이 발생한다)
embedding_cache_by_url = {}


def read_image(path: str):
    data = np.fromfile(path, dtype=np.uint8)

    if data.size == 0:
        return None

    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def read_image_from_url(url: str):
    if not url:
        return None

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = np.frombuffer(response.content, dtype=np.uint8)

        if data.size == 0:
            return None

        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except requests.RequestException as error:
        print(f"missing report image download failed: {url}, error={error}")
        return None


def resolve_spring_url(value: str):
    if not value:
        return None

    value = value.strip()

    if value.startswith("http://") or value.startswith("https://"):
        return value

    if value.startswith("/"):
        return f"{SPRING_SERVER_URL}{value}"

    return f"{SPRING_SERVER_URL}/{value}"


def cosine_similarity(left, right):
    left_norm = np.linalg.norm(left)
    right_norm = np.linalg.norm(right)

    if left_norm == 0 or right_norm == 0:
        return 0.0

    return float(np.dot(left, right) / (left_norm * right_norm))


def parse_known_face_filename(file_name: str):
    name_without_ext = os.path.splitext(file_name)[0]
    parts = name_without_ext.split("_")

    if len(parts) < 2:
        return None, None

    try:
        senior_id = int(parts[0])
    except ValueError:
        return None, None

    senior_name = parts[1].strip()

    if not senior_name:
        return None, None

    return senior_id, senior_name


def estimate_upload_face_quality(image, face):
    left, top, right, bottom = map(int, face.bbox)
    height, width = image.shape[:2]

    left = max(0, left)
    top = max(0, top)
    right = min(width, right)
    bottom = min(height, bottom)

    face_width = right - left
    face_height = bottom - top

    if face_width <= 0 or face_height <= 0:
        return 0.0, ["INVALID_BOX"]

    crop = image[top:bottom, left:right]

    if crop.size == 0:
        return 0.0, ["EMPTY_CROP"]

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blur_value = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = float(np.mean(gray))

    size_score = min(1.0, min(face_width, face_height) / MIN_FACE_SIZE)
    blur_score = min(1.0, blur_value / 120.0)
    brightness_score = 1.0 if 45 <= brightness <= 210 else 0.0

    landmark_score = 0.5
    pose_score = 0.5

    kps = getattr(face, "kps", None)

    if kps is not None and len(kps) >= 5:
        kps = np.array(kps)
        inside_count = 0

        for x, y in kps:
            if left <= x <= right and top <= y <= bottom:
                inside_count += 1

        landmark_score = inside_count / len(kps)

        left_eye = kps[0]
        right_eye = kps[1]
        nose = kps[2]
        eye_distance = np.linalg.norm(right_eye - left_eye)

        if eye_distance > 0:
            eye_mid_x = (left_eye[0] + right_eye[0]) / 2
            yaw_ratio = abs(nose[0] - eye_mid_x) / eye_distance
            eye_level_diff = abs(left_eye[1] - right_eye[1]) / eye_distance
            pose_score = 1.0 if yaw_ratio <= 0.45 and eye_level_diff <= 0.35 else 0.0

    quality_score = (
        size_score * 0.30
        + blur_score * 0.25
        + brightness_score * 0.20
        + landmark_score * 0.15
        + pose_score * 0.10
    )

    reasons = []

    if size_score < 1.0:
        reasons.append("SMALL_FACE")
    if blur_score < 0.5:
        reasons.append("BLURRY_FACE")
    if brightness_score == 0.0:
        reasons.append("BAD_BRIGHTNESS")
    if landmark_score < 0.8:
        reasons.append("UNSTABLE_LANDMARKS")
    if pose_score == 0.0:
        reasons.append("SIDE_FACE")

    return quality_score, reasons


def extract_largest_face_embedding(image, label: str):
    faces = face_app.get(image)

    if not faces:
        print(f"{label} skipped, no face found")
        return None, None, None

    largest_face = max(
        faces,
        key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
    )

    quality_score, quality_reasons = estimate_upload_face_quality(image, largest_face)

    if quality_score < KNOWN_FACE_QUALITY_MIN_SCORE:
        print(
            f"{label} skipped, low quality, "
            f"quality={quality_score:.2f}, reasons={quality_reasons}"
        )
        return None, quality_score, quality_reasons

    return largest_face.embedding, quality_score, quality_reasons


def load_known_embeddings():
    embeddings = []

    if not os.path.isdir(KNOWN_FACE_DIR):
        print(f"known face dir not found: {KNOWN_FACE_DIR}")
        return embeddings

    for file_name in os.listdir(KNOWN_FACE_DIR):
        if not file_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue

        senior_id, senior_name = parse_known_face_filename(file_name)

        if senior_id is None or senior_name is None:
            print(f"known face skipped, invalid filename: {file_name}")
            continue

        path = os.path.join(KNOWN_FACE_DIR, file_name)
        image = read_image(path)

        if image is None:
            print(f"known face skipped, cannot read image: {file_name}")
            continue

        embedding, _, _ = extract_largest_face_embedding(image, f"known face {file_name}")

        if embedding is None:
            continue

        embeddings.append({
            "source": "KNOWN_FACE",
            "missing_report_id": None,
            "senior_id": senior_id,
            "senior_name": senior_name,
            "description": None,
            "image_url": None,
            "file_name": file_name,
            "embedding": embedding,
        })

    print(f"known embeddings loaded: {len(embeddings)}")
    return embeddings


def load_missing_report_embeddings():
    embeddings = []

    try:
        response = requests.get(
            f"{SPRING_SERVER_URL}/api/missing-reports/face-targets",
            timeout=10,
        )
        response.raise_for_status()
        reports = response.json()
    except requests.RequestException as error:
        print(f"missing report targets load failed: {error}")
        return embeddings

    for report in reports:
        raw_image_urls = report.get("imageUrls") or []

        if not raw_image_urls and report.get("imageUrl"):
            raw_image_urls = [report.get("imageUrl")]

        missing_report_id = report.get("missingReportId") or report.get("id")

        for image_index, raw_image_url in enumerate(raw_image_urls):
            image_url = resolve_spring_url(raw_image_url)

            embedding = embedding_cache_by_url.get(image_url)

            if embedding is None:
                image = read_image_from_url(image_url)

                if image is None:
                    print(f"missing report skipped, cannot read image: {image_url}")
                    continue

                embedding, _, _ = extract_largest_face_embedding(
                    image,
                    f"missing report {missing_report_id} image {image_index}",
                )

                if embedding is None:
                    continue

                embedding_cache_by_url[image_url] = embedding

            embeddings.append({
                "source": "MISSING_REPORT",
                "missing_report_id": missing_report_id,
                "senior_id": report.get("seniorId"),
                "senior_name": report.get("name") or report.get("description") or "실종 신고",
                "description": report.get("description"),
                "image_url": image_url,
                "file_name": None,
                "embedding": embedding,
            })

    print(f"missing report embeddings loaded: {len(embeddings)}")
    return embeddings


def load_senior_face_embeddings():
    """실종 신고가 ACTIVE인 어르신의 사전 등록 얼굴 사진을 비교 대상으로 불러온다."""
    embeddings = []

    try:
        response = requests.get(
            f"{SPRING_SERVER_URL}/api/seniors/face-photo-targets",
            timeout=10,
        )
        response.raise_for_status()
        targets = response.json()
    except requests.RequestException as error:
        print(f"senior face targets load failed: {error}")
        return embeddings

    for target in targets:
        senior_id = target.get("seniorId")
        senior_name = target.get("seniorName") or "보호 대상자"

        for image_index, raw_image_url in enumerate(target.get("imageUrls") or []):
            image_url = resolve_spring_url(raw_image_url)

            embedding = embedding_cache_by_url.get(image_url)

            if embedding is None:
                image = read_image_from_url(image_url)

                if image is None:
                    print(f"senior face skipped, cannot read image: {image_url}")
                    continue

                embedding, _, _ = extract_largest_face_embedding(
                    image,
                    f"senior {senior_id} face {image_index}",
                )

                if embedding is None:
                    continue

                embedding_cache_by_url[image_url] = embedding

            embeddings.append({
                "source": "SENIOR_FACE",
                "missing_report_id": None,
                "senior_id": senior_id,
                "senior_name": senior_name,
                "description": None,
                "image_url": image_url,
                "file_name": None,
                "embedding": embedding,
            })

    print(f"senior face embeddings loaded: {len(embeddings)}")
    return embeddings


def load_registered_embeddings():
    embeddings = []
    embeddings.extend(load_known_embeddings())
    embeddings.extend(load_missing_report_embeddings())
    embeddings.extend(load_senior_face_embeddings())
    print(f"total registered embeddings loaded: {len(embeddings)}")
    return embeddings


@app.on_event("startup")
async def startup():
    global known_embeddings
    known_embeddings = await asyncio.to_thread(load_registered_embeddings)


@app.post("/api/face/reload")
def reload_known_faces():
    global known_embeddings
    known_embeddings = load_registered_embeddings()
    return {"loaded": len(known_embeddings)}


def can_send_alert(senior_id: int):
    if senior_id is None:
        return False

    now = time.time()
    last_alert_at = last_alert_time_by_senior_id.get(senior_id, 0)

    if now - last_alert_at < FACE_ALERT_COOLDOWN_SECONDS:
        return False

    last_alert_time_by_senior_id[senior_id] = now
    return True


def post_camera_alert(senior_id: int, similarity: float):
    if senior_id is None:
        return

    try:
        response = requests.post(
            f"{SPRING_SERVER_URL}/api/alerts/camera",
            json={
                "seniorId": senior_id,
                "type": "AI_CANDIDATE_CONFIRM",
                "message": "유사한 사람이 감지되었습니다. 보호자 확인이 필요합니다.",
            },
            timeout=10,
        )
        response.raise_for_status()
        print(f"spring candidate alert sent: seniorId={senior_id}, similarity={similarity:.3f}")
    except requests.RequestException as error:
        print(f"spring alert failed: {error}")


def make_match_payload(
    best_match,
    matched,
    match_status,
    best_similarity,
    quality_score,
    quality_reasons,
    bbox,
    index,
    source_device,
):
    return {
        "index": index,
        "matched": matched,
        "status": match_status,
        "similarity": round(best_similarity, 4),
        "qualityScore": round(quality_score, 4),
        "qualityReasons": quality_reasons,
        "bbox": bbox,
        "sourceDevice": source_device,
        "source": best_match.get("source") if best_match else None,
        "missingReportId": best_match.get("missing_report_id") if best_match else None,
        "seniorId": best_match.get("senior_id") if best_match else None,
        "seniorName": best_match.get("senior_name") if best_match else None,
        "description": best_match.get("description") if best_match else None,
        "imageUrl": best_match.get("image_url") if best_match else None,
        "fileName": best_match.get("file_name") if best_match else None,
    }


@app.post("/api/face/verify")
async def verify_faces(
    sourceDevice: str = Form("unknown"),
    faces: List[UploadFile] = File(...),
):
    if not known_embeddings:
        return {
            "matched": False,
            "status": "NO_KNOWN_FACE",
            "message": "등록 얼굴 임베딩이 없습니다.",
            "bestSimilarity": 0,
            "bestCandidate": None,
            "matches": [],
            "faces": [],
        }

    results = []
    final_matched = False
    best_overall_similarity = 0.0

    for index, face_file in enumerate(faces):
        suffix = os.path.splitext(face_file.filename or "")[1] or ".jpg"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(await face_file.read())
            temp_path = temp.name

        image = read_image(temp_path)
        os.remove(temp_path)

        if image is None:
            results.append({
                "index": index,
                "matched": False,
                "status": "INVALID_IMAGE",
                "similarity": 0,
                "qualityScore": 0,
                "qualityReasons": ["INVALID_IMAGE"],
                "bbox": None,
                "sourceDevice": sourceDevice,
            })
            continue

        detected_faces = await asyncio.to_thread(face_app.get, image)

        if not detected_faces:
            results.append({
                "index": index,
                "matched": False,
                "status": "NO_FACE",
                "similarity": 0,
                "qualityScore": 0,
                "qualityReasons": ["NO_FACE"],
                "bbox": None,
                "sourceDevice": sourceDevice,
            })
            continue

        # 가장 큰 얼굴 하나만 보면 행인이 가까이 찍혔을 때 실종자를 놓치고,
        # 실종자가 두 명 이상 찍힌 경우도 처리하지 못한다.
        # → 검출된 모든 얼굴(크기순 최대 10명)을 각각 비교한다.
        sorted_faces = sorted(
            detected_faces,
            key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
            reverse=True,
        )[:10]

        for face in sorted_faces:
            left, top, right, bottom = map(int, face.bbox)
            bbox = [left, top, right, bottom]
            quality_score, quality_reasons = estimate_upload_face_quality(image, face)

            if quality_score < LIVE_FACE_QUALITY_MIN_SCORE:
                results.append({
                    "index": index,
                    "matched": False,
                    "status": "LOW_QUALITY",
                    "similarity": 0,
                    "qualityScore": round(quality_score, 4),
                    "qualityReasons": quality_reasons,
                    "bbox": bbox,
                    "sourceDevice": sourceDevice,
                })
                continue

            best_match = None
            best_similarity = 0.0

            for known in known_embeddings:
                similarity = cosine_similarity(
                    known["embedding"],
                    face.embedding,
                )

                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = known

            if best_similarity >= MATCH_THRESHOLD:
                match_status = "MATCH"
                matched = True
            elif best_similarity >= CANDIDATE_THRESHOLD:
                match_status = "CANDIDATE"
                matched = False
            else:
                match_status = "NO_MATCH"
                matched = False

            best_overall_similarity = max(best_overall_similarity, best_similarity)

            if match_status in ("MATCH", "CANDIDATE"):
                final_matched = True

            results.append(
                make_match_payload(
                    best_match=best_match,
                    matched=matched,
                    match_status=match_status,
                    best_similarity=best_similarity,
                    quality_score=quality_score,
                    quality_reasons=quality_reasons,
                    bbox=bbox,
                    index=index,
                    source_device=sourceDevice,
                )
            )

    matched_face = next((face for face in results if face.get("status") == "MATCH"), None)
    candidate_face = next((face for face in results if face.get("status") == "CANDIDATE"), None)
    best_candidate = max(results, key=lambda face: face.get("similarity", 0), default=None)

    final_face = matched_face or candidate_face
    final_status = "MATCH" if matched_face else "CANDIDATE" if candidate_face else "NO_MATCH"

    # 실종자별 최고 유사도 결과 — 한 사진에 실종자가 여러 명 찍힌 경우를 위해
    # 매치/후보로 인식된 실종자를 전부 모은다.
    best_by_senior = {}
    for face in results:
        senior_id = face.get("seniorId")
        if senior_id is None or face.get("status") not in ("MATCH", "CANDIDATE"):
            continue
        previous = best_by_senior.get(senior_id)
        if previous is None or (face.get("similarity") or 0) > (previous.get("similarity") or 0):
            best_by_senior[senior_id] = face

    matches = [
        {
            "seniorId": face.get("seniorId"),
            "seniorName": face.get("seniorName"),
            "similarity": face.get("similarity"),
            "status": face.get("status"),
        }
        for face in sorted(
            best_by_senior.values(),
            key=lambda face: face.get("similarity") or 0,
            reverse=True,
        )
    ]

    if final_matched and matched_face and can_send_alert(matched_face.get("seniorId")):
        post_camera_alert(matched_face.get("seniorId"), best_overall_similarity)

    return {
        "matched": final_status in ("MATCH", "CANDIDATE"),
        "status": final_status,
        "bestSimilarity": round(best_overall_similarity, 4),
        "sourceDevice": sourceDevice,
        "source": final_face.get("source") if final_face else None,
        "missingReportId": final_face.get("missingReportId") if final_face else None,
        "seniorId": final_face.get("seniorId") if final_face else None,
        "seniorName": final_face.get("seniorName") if final_face else None,
        "description": final_face.get("description") if final_face else None,
        "imageUrl": final_face.get("imageUrl") if final_face else None,
        "bestCandidate": best_candidate,
        "matches": matches,
        "faces": results,
    }

class ComparePoliceRequest(BaseModel):
    seniorId: int


@app.post("/api/face/compare-police")
async def compare_police(body: ComparePoliceRequest):
    """어르신 등록 사진과 경찰청 실종 신고 사진 비교 (보호자 앱용)."""
    try:
        resp = requests.get(
            f"{SPRING_SERVER_URL}/api/seniors/{body.seniorId}/face-photos",
            timeout=10,
        )
        resp.raise_for_status()
        photos = resp.json()
    except requests.RequestException:
        return {"scores": {}}

    if not photos:
        return {"scores": {}}

    senior_embeddings = []
    for photo in photos[:4]:
        url = resolve_spring_url(photo.get("imageUrl") or "")
        if not url:
            continue
        image = await asyncio.to_thread(read_image_from_url, url)
        if image is None:
            continue
        emb, _, _ = await asyncio.to_thread(
            extract_largest_face_embedding, image, f"senior {body.seniorId}"
        )
        if emb is not None:
            senior_embeddings.append(emb)

    if not senior_embeddings:
        return {"scores": {}}

    avg_embedding = np.mean(senior_embeddings, axis=0)

    scores = {}
    for known in known_embeddings:
        if known.get("source") != "MISSING_REPORT":
            continue
        mid = known.get("missing_report_id")
        if mid is None:
            continue
        sim = float(cosine_similarity(avg_embedding, known["embedding"]))
        if mid not in scores or sim > scores[mid]:
            scores[mid] = round(sim, 4)

    return {"scores": scores}