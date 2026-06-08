import os
import tempfile
import time
from typing import List

import cv2
import numpy as np
import requests
from fastapi import FastAPI, File, Form, UploadFile
from insightface.app import FaceAnalysis


ARCFACE_SIMILARITY_THRESHOLD = 0.65
FACE_ALERT_COOLDOWN_SECONDS = 60
KNOWN_FACE_QUALITY_MIN_SCORE = 0.45
LIVE_FACE_QUALITY_MIN_SCORE = 0.55
MIN_FACE_SIZE = 100

SPRING_SERVER_URL = os.getenv("SPRING_SERVER_URL", "http://localhost:8080")
KNOWN_FACE_DIR = os.getenv("KNOWN_FACE_DIR", "known_faces")

app = FastAPI()

face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(480, 480))

known_embeddings = []
last_alert_time_by_senior_id = {}


def read_image(path: str):
    data = np.fromfile(path, dtype=np.uint8)

    if data.size == 0:
        return None

    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def cosine_similarity(left, right):
    return float(np.dot(left, right) / (np.linalg.norm(left) * np.linalg.norm(right)))


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

        faces = face_app.get(image)

        if not faces:
            print(f"known face skipped, no face found: {file_name}")
            continue

        largest_face = max(
            faces,
            key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
        )

        quality_score, quality_reasons = estimate_upload_face_quality(image, largest_face)

        if quality_score < KNOWN_FACE_QUALITY_MIN_SCORE:
            print(
                f"known face skipped, low quality: {file_name}, "
                f"quality={quality_score:.2f}, reasons={quality_reasons}"
            )
            continue

        embeddings.append({
            "senior_id": senior_id,
            "senior_name": senior_name,
            "embedding": largest_face.embedding,
            "file_name": file_name,
        })

    print(f"known embeddings loaded: {len(embeddings)}")
    return embeddings


@app.on_event("startup")
def startup():
    global known_embeddings
    known_embeddings = load_known_embeddings()

@app.post("/api/face/reload")
def reload_known_faces():
    global known_embeddings
    known_embeddings = load_known_embeddings()

    return {
        "status": "RELOADED",
        "count": len(known_embeddings),
    }    


def can_send_alert(senior_id: int):
    now = time.time()
    last_alert_at = last_alert_time_by_senior_id.get(senior_id, 0)

    if now - last_alert_at < FACE_ALERT_COOLDOWN_SECONDS:
        return False

    last_alert_time_by_senior_id[senior_id] = now
    return True


def post_camera_alert(senior_id: int, similarity: float):
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
            "faces": [],
        }

    target_embeddings = known_embeddings

    if not target_embeddings:
        return {
            "matched": False,
            "status": "NO_TARGET_FACE",
            "message": "비교할 등록 얼굴이 없습니다.",
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

        os.makedirs("debug_uploads", exist_ok=True)
        debug_path = os.path.join("debug_uploads", f"received_face_{index}.jpg")
        cv2.imwrite(debug_path, image)
        print(f"received face saved: {debug_path}")

        detected_faces = face_app.get(image)

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

        largest_face = max(
            detected_faces,
            key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
        )

        left, top, right, bottom = map(int, largest_face.bbox)
        quality_score, quality_reasons = estimate_upload_face_quality(image, largest_face)

        if quality_score < LIVE_FACE_QUALITY_MIN_SCORE:
            results.append({
                "index": index,
                "matched": False,
                "status": "LOW_QUALITY",
                "similarity": 0,
                "qualityScore": round(quality_score, 4),
                "qualityReasons": quality_reasons,
                "bbox": [left, top, right, bottom],
                "sourceDevice": sourceDevice,
            })
            continue

        best_match = None
        best_similarity = 0.0

        for known in target_embeddings:
            similarity = cosine_similarity(
                known["embedding"],
                largest_face.embedding,
            )

            if similarity > best_similarity:
                best_similarity = similarity
                best_match = known

        matched = best_similarity >= ARCFACE_SIMILARITY_THRESHOLD

        if matched:
            final_matched = True
            best_overall_similarity = max(best_overall_similarity, best_similarity)

        results.append({
            "index": index,
            "matched": matched,
            "status": "MATCH" if matched else "NO_MATCH",
            "similarity": round(best_similarity, 4),
            "qualityScore": round(quality_score, 4),
            "qualityReasons": quality_reasons,
            "bbox": [left, top, right, bottom],
            "sourceDevice": sourceDevice,
            "seniorId": best_match["senior_id"] if matched and best_match else None,
            "seniorName": best_match["senior_name"] if matched and best_match else None,
        })

    matched_face = next((face for face in results if face["matched"]), None)

    if final_matched and matched_face and can_send_alert(matched_face["seniorId"]):
        post_camera_alert(matched_face["seniorId"], best_overall_similarity)

    return {
        "matched": final_matched,
        "status": "MATCH" if final_matched else "NO_MATCH",
        "bestSimilarity": round(best_overall_similarity, 4),
        "missingReportId": matched_face["missingReportId"] if matched_face else None,
        "seniorId": matched_face["seniorId"] if matched_face else None,
        "name": matched_face["name"] if matched_face else None,
        "imageUrl": matched_face["imageUrl"] if matched_face else None,
        "faces": results,
    }
