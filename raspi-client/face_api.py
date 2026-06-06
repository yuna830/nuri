import os
import tempfile
from typing import List

import cv2
import numpy as np
import requests
from fastapi import FastAPI, File, Form, UploadFile
from insightface.app import FaceAnalysis


ARCFACE_SIMILARITY_THRESHOLD = 0.65
SPRING_SERVER_URL = os.getenv("SPRING_SERVER_URL", "http://localhost:8080")
KNOWN_FACE_DIR = os.getenv("KNOWN_FACE_DIR", "known_faces")

app = FastAPI()

face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(480, 480))

known_embeddings = []

# 한글 경로 읽기 함수 추가 
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


def post_camera_alert(senior_id: int, similarity: float):
    try:
        requests.post(
            f"{SPRING_SERVER_URL}/api/alerts/camera",
            json={
                "seniorId": senior_id,
                "type": "FACE_MATCH",
                "message": f"등록된 얼굴과 일치합니다. 유사도 {similarity:.2f}",
            },
            timeout=10,
        )
    except requests.RequestException as error:
        print(f"spring alert failed: {error}")

@app.post("/api/face/verify")
async def verify_faces(
    seniorId: int = Form(...),
    faces: List[UploadFile] = File(...),
):
    if not known_embeddings:
        return {
            "matched": False,
            "status": "NO_KNOWN_FACE",
            "message": "등록 얼굴 임베딩이 없습니다.",
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

        os.makedirs("debug_uploads", exist_ok=True)

        debug_path = os.path.join("debug_uploads", f"received_face_{index}.jpg")
        cv2.imwrite(debug_path, image)

        print(f"received face saved: {debug_path}")

        if image is None:
            results.append({
                "index": index,
                "matched": False,
                "status": "INVALID_IMAGE",
                "similarity": 0,
            })
            continue

        detected_faces = face_app.get(image)

        if not detected_faces:
            results.append({
                "index": index,
                "matched": False,
                "status": "NO_FACE",
                "similarity": 0,
            })
            continue

        largest_face = max(
            detected_faces,
            key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
        )

        best_match = None
        best_similarity = 0.0

        for known in known_embeddings:
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
            "seniorId": best_match["senior_id"] if matched and best_match else None,
            "seniorName": best_match["senior_name"] if matched and best_match else None,
        })

    if final_matched:
        post_camera_alert(seniorId, best_overall_similarity)

    matched_face = next((face for face in results if face["matched"]), None)

    return {
        "matched": final_matched,
        "status": "MATCH" if final_matched else "NO_MATCH",
        "bestSimilarity": round(best_overall_similarity, 4),
        "seniorId": matched_face["seniorId"] if matched_face else None,
        "seniorName": matched_face["seniorName"] if matched_face else None,
        "faces": results,
    }