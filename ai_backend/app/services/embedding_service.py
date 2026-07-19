import logging
import re
import time

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self.embedding_model = GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            google_api_key=settings.gemini_api_key,
            request_options={"timeout": settings.gemini_timeout_seconds},
        )

    def embed_text(self, text: str) -> list[float]:
        started_at = time.perf_counter()
        try:
            return self._retry_embedding_call(
                lambda: self.embedding_model.embed_query(text)
            )
        finally:
            logger.info("RAG Gemini embedding completed in %.3fs", time.perf_counter() - started_at)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self._retry_embedding_call(
            lambda: self.embedding_model.embed_documents(texts)
        )

    def _retry_embedding_call(self, callback):
        max_retries = settings.embedding_max_retries

        for attempt in range(max_retries):
            try:
                return callback()
            except Exception as error:
                if not self._is_quota_error(error) or attempt == max_retries - 1:
                    raise

                wait_seconds = self._extract_retry_delay_seconds(error)

                if wait_seconds is None:
                    wait_seconds = min(
                        attempt + 1,
                        settings.embedding_max_retry_delay_seconds,
                    )

                wait_seconds = min(
                    wait_seconds,
                    settings.embedding_max_retry_delay_seconds,
                )

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
