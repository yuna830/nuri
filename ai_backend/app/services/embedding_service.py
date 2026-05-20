import re
import time

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.core.config import settings


class EmbeddingService:
    def __init__(self):
        self.embedding_model = GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            google_api_key=settings.gemini_api_key,
        )

    def embed_text(self, text: str) -> list[float]:
        return self._retry_embedding_call(
            lambda: self.embedding_model.embed_query(text)
        )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self._retry_embedding_call(
            lambda: self.embedding_model.embed_documents(texts)
        )

    def _retry_embedding_call(self, callback):
        max_retries = 5

        for attempt in range(max_retries):
            try:
                return callback()
            except Exception as error:
                if not self._is_quota_error(error) or attempt == max_retries - 1:
                    raise

                wait_seconds = self._extract_retry_delay_seconds(error)

                if wait_seconds is None:
                    wait_seconds = min(60 * (attempt + 1), 300)

                time.sleep(wait_seconds)

    def _is_quota_error(self, error: Exception) -> bool:
        message = str(error).lower()

        return (
            "resource_exhausted" in message
            or "quota" in message
            or "429" in message
        )

    def _extract_retry_delay_seconds(self, error: Exception) -> int | None:
        message = str(error)
        match = re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+)s", message)

        if not match:
            return None

        return int(match.group(1))