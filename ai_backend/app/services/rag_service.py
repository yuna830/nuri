from app.services.embedding_cache_service import EmbeddingCacheService
from app.services.embedding_service import EmbeddingService
from app.services.groq_service import GroqService
from app.services.qdrant_service import QdrantService


class RagService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.cache_service = EmbeddingCacheService()
        self.qdrant_service = QdrantService()
        self.groq_service = GroqService()

    def ask(self, question: str, limit: int = 5, search_query: str | None = None) -> dict:
        retrieval_query = (search_query or question).strip()
        cached_vector = self.cache_service.get(retrieval_query)

        if cached_vector is not None:
            query_vector = cached_vector
        else:
            query_vector = self.embedding_service.embed_text(retrieval_query)
            self.cache_service.set(retrieval_query, query_vector)

        chunks = self.qdrant_service.search_chunks(
            query_vector=query_vector,
            limit=limit,
        )

        if not chunks:
            return {
                "answer": "제공된 자료에서 확인되지 않습니다.",
                "sources": [],
            }

        answer = self.groq_service.answer(
            question=question,
            context_chunks=chunks,
        )

        return {
            "answer": answer,
            "sources": [
                {
                    **chunk,
                    "content": self._limit_text(chunk.get("content") or "", 300),
                }
                for chunk in chunks
            ],
        }
    
    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."
