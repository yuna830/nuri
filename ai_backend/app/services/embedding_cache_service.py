import hashlib
import json
from pathlib import Path


class EmbeddingCacheService:
    def __init__(self):
        project_root = Path(__file__).resolve().parents[2]
        self.cache_dir = project_root / ".cache"
        self.cache_file = self.cache_dir / "embeddings.json"
        self.cache_dir.mkdir(exist_ok=True)

        if self.cache_file.exists():
            try:
                self.cache = json.loads(self.cache_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                self.cache = {}
        else:
            self.cache = {}

    def get_key(self, text: str) -> str:
        normalized_text = " ".join(text.split())
        return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> list[float] | None:
        key = self.get_key(text)
        return self.cache.get(key)

    def set(self, text: str, vector: list[float]) -> None:
        key = self.get_key(text)
        self.cache[key] = vector

        temp_file = self.cache_file.with_suffix(".tmp")
        temp_file.write_text(
            json.dumps(self.cache, ensure_ascii=False),
            encoding="utf-8",
        )
        temp_file.replace(self.cache_file)