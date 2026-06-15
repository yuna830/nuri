# -*- coding: utf-8 -*-
import base64
import json
import os
import threading
from pathlib import Path

import numpy as np
from deepface import DeepFace
from sqlalchemy import create_engine, text

from app.core.config import settings

FACE_MODEL = "ArcFace"
DETECTOR = "opencv"
CACHE_FILE = Path(__file__).parent.parent / ".cache" / "face_embeddings.json"

_lock = threading.Lock()


class FaceService:
    def __init__(self):
        self.engine = create_engine(settings.database_url, pool_pre_ping=True)
        self._police_cache: dict[int, list[float]] = {}
        self._load_cache_from_disk()

    # ──────────────────────────────────────────────
    # 이미지 → numpy array
    # ──────────────────────────────────────────────

    def _resolve_image(self, source: str) -> np.ndarray | None:
        """파일 경로, data URI, base64 문자열을 numpy array로 변환."""
        try:
            import cv2

            if source.startswith("data:"):
                # data:image/jpeg;base64,/9j/...
                header, b64 = source.split(",", 1)
                img_bytes = base64.b64decode(b64)
            elif source.startswith("/uploads/"):
                rel = source.lstrip("/")
                full_path = os.path.join(settings.spring_upload_root, rel.removeprefix("uploads/"))
                with open(full_path, "rb") as f:
                    img_bytes = f.read()
            else:
                # 순수 base64
                img_bytes = base64.b64decode(source)

            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            print(f"[face] resolve_image failed: {e}")
            return None

    # ──────────────────────────────────────────────
    # 임베딩 계산
    # ──────────────────────────────────────────────

    def _embed(self, img: np.ndarray) -> list[float] | None:
        try:
            result = DeepFace.represent(
                img_path=img,
                model_name=FACE_MODEL,
                enforce_detection=False,
                detector_backend=DETECTOR,
            )
            if result:
                return result[0]["embedding"]
        except Exception as e:
            print(f"[face] embed failed: {e}")
        return None

    # ──────────────────────────────────────────────
    # 코사인 유사도
    # ──────────────────────────────────────────────

    @staticmethod
    def _cosine(a: list[float], b: list[float]) -> float:
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        denom = np.linalg.norm(va) * np.linalg.norm(vb)
        if denom == 0:
            return 0.0
        return float(np.dot(va, vb) / denom)

    # ──────────────────────────────────────────────
    # 캐시 디스크 저장/로드
    # ──────────────────────────────────────────────

    def _load_cache_from_disk(self):
        if CACHE_FILE.exists():
            try:
                data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
                self._police_cache = {int(k): v for k, v in data.items()}
                print(f"[face] loaded {len(self._police_cache)} police embeddings from cache")
            except Exception as e:
                print(f"[face] cache load failed: {e}")

    def _save_cache_to_disk(self):
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            CACHE_FILE.write_text(
                json.dumps({str(k): v for k, v in self._police_cache.items()}, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as e:
            print(f"[face] cache save failed: {e}")

    # ──────────────────────────────────────────────
    # 경찰청 사진 임베딩 로드
    # ──────────────────────────────────────────────

    def reload_police_embeddings(self) -> int:
        """DB에서 경찰청 사진을 읽어 임베딩을 (재)계산한다."""
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id, photo_url FROM police_missing_alerts WHERE photo_url IS NOT NULL AND photo_url != ''")
            ).fetchall()

        new_cache: dict[int, list[float]] = {}
        for row in rows:
            alert_id, photo_url = row
            if alert_id in self._police_cache:
                # 이미 캐시된 항목은 재사용
                new_cache[alert_id] = self._police_cache[alert_id]
                continue

            img = self._resolve_image(photo_url)
            if img is None:
                continue
            embedding = self._embed(img)
            if embedding:
                new_cache[alert_id] = embedding
                print(f"[face] embedded police alert {alert_id}")

        with _lock:
            self._police_cache = new_cache
        self._save_cache_to_disk()
        print(f"[face] police cache ready: {len(new_cache)} entries")
        return len(new_cache)

    # ──────────────────────────────────────────────
    # 어르신 vs 경찰청 비교
    # ──────────────────────────────────────────────

    def compare_senior_to_police(self, senior_id: int) -> dict[int, float]:
        """어르신 사전 등록 사진과 경찰청 실종자 사진을 비교해 유사도를 반환."""
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("SELECT image_url FROM senior_face_photos WHERE senior_id = :sid ORDER BY id ASC"),
                {"sid": senior_id},
            ).fetchall()

        if not rows:
            return {}

        # 어르신 사진 전체 임베딩 평균 (최대 4장)
        senior_embeddings: list[list[float]] = []
        for (image_url,) in rows:
            if not image_url:
                continue
            img = self._resolve_image(image_url)
            if img is None:
                continue
            emb = self._embed(img)
            if emb:
                senior_embeddings.append(emb)

        if not senior_embeddings:
            return {}

        avg_senior = np.mean([np.array(e, dtype=np.float32) for e in senior_embeddings], axis=0).tolist()

        with _lock:
            police_cache = dict(self._police_cache)

        if not police_cache:
            # 캐시가 비어 있으면 즉시 로드 시도
            self.reload_police_embeddings()
            with _lock:
                police_cache = dict(self._police_cache)

        return {
            alert_id: round(self._cosine(avg_senior, emb), 4)
            for alert_id, emb in police_cache.items()
        }
