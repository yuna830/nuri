import hashlib
import json
import threading
import time
from pathlib import Path
from uuid import uuid4


class EmbeddingCacheService:
    _lock = threading.Lock()

    def __init__(self):
        project_root = Path(__file__).resolve().parents[2]
        self.cache_dir = project_root / ".cache"
        self.cache_file = self.cache_dir / "embeddings.json"
        self.cache_dir.mkdir(exist_ok=True)
        self.cache = self._load_cache()

    def _load_cache(self) -> dict:
        if not self.cache_file.exists():
            return {}

        try:
            return json.loads(self.cache_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def get_key(self, text: str) -> str:
        normalized_text = " ".join(text.split())
        return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> list[float] | None:
        key = self.get_key(text)

        with self._lock:
            self.cache = self._load_cache()
            return self.cache.get(key)

    def set(self, text: str, vector: list[float]) -> None:
        key = self.get_key(text)

        with self._lock:
            self.cache = self._load_cache()
            self.cache[key] = vector

            temp_file = self.cache_dir / f"embeddings.{uuid4()}.tmp"
            temp_file.write_text(
                json.dumps(self.cache, ensure_ascii=False),
                encoding="utf-8",
            )

            for attempt in range(5):
                try:
                    temp_file.replace(self.cache_file)
                    return
                except PermissionError:
                    if attempt == 4:
                        raise
                    time.sleep(0.2)

            if temp_file.exists():
                temp_file.unlink()