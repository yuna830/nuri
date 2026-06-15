# -*- coding: utf-8 -*-
import threading

import numpy as np
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from app.services.face_service import FaceService, _lock

router = APIRouter()

_face_service: FaceService | None = None
_init_lock = threading.Lock()

POLICE_MATCH_THRESHOLD = 0.30
POLICE_TOP_N = 5


def get_face_service() -> FaceService:
    global _face_service
    if _face_service is None:
        with _init_lock:
            if _face_service is None:
                _face_service = FaceService()
    return _face_service


def preload_police_embeddings():
    """서버 시작 시 경찰청 임베딩 + DeepFace 모델을 미리 로드해 첫 요청 지연을 없앤다."""
    try:
        import cv2
        import numpy as np

        svc = get_face_service()

        # 1) DeepFace 모델 워밍업 — 1×1 더미 이미지로 모델 파일 다운로드·로드
        dummy = np.zeros((100, 100, 3), dtype=np.uint8)
        svc._embed(dummy)
        print("[face] deepface model warm-up done")

        # 2) 경찰청 사진 임베딩 캐시
        svc.reload_police_embeddings()
    except Exception as e:
        print(f"[face] preload failed: {e}")


# ──────────────────────────────────────────────────────────────────
# 엔드포인트
# ──────────────────────────────────────────────────────────────────

class ComparePoliceRequest(BaseModel):
    seniorId: int


@router.post("/compare-police")
def compare_police(body: ComparePoliceRequest):
    """어르신 등록 사진과 경찰청 실종자 사진 전체를 비교해 유사도를 반환 (웹용)."""
    svc = get_face_service()
    scores = svc.compare_senior_to_police(body.seniorId)
    if scores is None:
        raise HTTPException(status_code=404, detail="등록된 얼굴 사진이 없습니다.")
    sorted_scores = dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))
    return {"scores": sorted_scores}


@router.post("/verify-against-police")
async def verify_against_police(image: UploadFile = File(...)):
    """
    업로드된 이미지와 경찰청 실종자 사진을 비교 (앱용).
    상위 N개 매치를 이름·유사도와 함께 반환한다.
    """
    import cv2

    svc = get_face_service()

    image_bytes = await image.read()
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img_array = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img_array is None:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    embedding = svc._embed(img_array)
    if embedding is None:
        return {"matches": [], "message": "얼굴을 인식할 수 없습니다."}

    with _lock:
        police_cache = dict(svc._police_cache)

    if not police_cache:
        svc.reload_police_embeddings()
        with _lock:
            police_cache = dict(svc._police_cache)

    scores = {
        alert_id: FaceService._cosine(embedding, emb)
        for alert_id, emb in police_cache.items()
    }

    top_matches = sorted(
        [(aid, score) for aid, score in scores.items() if score >= POLICE_MATCH_THRESHOLD],
        key=lambda x: x[1],
        reverse=True,
    )[:POLICE_TOP_N]

    if not top_matches:
        return {"matches": [], "message": "일치하는 경찰청 실종자가 없습니다."}

    # DB에서 이름 조회
    alert_ids = [aid for aid, _ in top_matches]
    try:
        with svc.engine.connect() as conn:
            rows = conn.execute(
                text(f"SELECT id, name, gender, age_now FROM police_missing_alerts WHERE id IN ({','.join(str(i) for i in alert_ids)})")
            ).fetchall()
        name_map = {row[0]: {"name": row[1], "gender": row[2], "ageNow": row[3]} for row in rows}
    except Exception:
        name_map = {}

    matches = []
    for alert_id, score in top_matches:
        info = name_map.get(alert_id, {})
        matches.append({
            "alertId": alert_id,
            "similarity": round(score, 4),
            "name": info.get("name") or "이름 미상",
            "gender": info.get("gender"),
            "ageNow": info.get("ageNow"),
        })

    return {"matches": matches, "topScore": round(top_matches[0][1], 4)}


@router.post("/reload")
def reload_embeddings(background_tasks: BackgroundTasks):
    """Spring이 어르신 사진 변경 시 호출 → 경찰청 임베딩 캐시 갱신."""
    background_tasks.add_task(_reload_task)
    return {"status": "reload scheduled"}


def _reload_task():
    try:
        svc = get_face_service()
        count = svc.reload_police_embeddings()
        print(f"[face] reload complete: {count} entries")
    except Exception as e:
        print(f"[face] reload failed: {e}")
