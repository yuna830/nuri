import re
import time
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import settings


class QdrantService:
    def __init__(self):
        self.client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            timeout=120,
        )

    def save_chunks(
        self,
        document_id: str,
        chunks: list[str],
        vectors: list[list[float]],
        source_type: str,
        metadata: dict | None = None,
    ) -> int:
        points = []
        metadata = metadata or {}

        for index, chunk in enumerate(chunks):
            payload = {
                "source_type": source_type,
                "document_id": document_id,
                "chunk_index": index,
                "content": chunk,
                **metadata,
            }

            points.append(
                PointStruct(
                    id=str(uuid4()),
                    vector=vectors[index],
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=settings.qdrant_collection,
            points=points,
        )

        return len(points)

    def search_chunks(
        self,
        query_vector: list[float],
        limit: int = 5,
    ) -> list[dict]:
        results = self.client.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector,
            limit=limit,
            with_payload=True,
        )

        chunks = []

        for point in results.points:
            payload = point.payload or {}

            chunks.append({
                "score": point.score,
                "source_type": payload.get("source_type"),
                "document_id": payload.get("document_id"),
                "filename": payload.get("filename"),
                "service_id": payload.get("service_id"),
                "service_name": payload.get("service_name"),
                "region": payload.get("region"),
                "department": payload.get("department"),
                "source": payload.get("source"),
                "chunk_index": payload.get("chunk_index"),
                "content": payload.get("content"),
            })

        return chunks

    def count_by_document_id(self, document_id: str) -> int:
        document_id = document_id.strip()

        if not document_id:
            return 0

        result = self.client.count(
            collection_name=settings.qdrant_collection,
            count_filter=self._build_document_ids_filter([document_id]),
            exact=True,
        )

        return result.count

    def count_by_document_ids(self, document_ids: list[str]) -> int:
        normalized_document_ids = self._normalize_document_ids(document_ids)

        if not normalized_document_ids:
            return 0

        result = self.client.count(
            collection_name=settings.qdrant_collection,
            count_filter=self._build_document_ids_filter(normalized_document_ids),
            exact=True,
        )

        return result.count

    def delete_by_document_id(self, document_id: str) -> int:
        result = self.delete_by_document_ids([document_id], batch_size=1)

        return result["deleted_chunk_count"]

    def delete_by_document_ids(
        self,
        document_ids: list[str],
        batch_size: int = 50,
    ) -> dict:
        normalized_document_ids = self._normalize_document_ids(document_ids)

        if not normalized_document_ids:
            return {
                "requested_document_count": len(document_ids),
                "target_document_count": 0,
                "deleted_chunk_count": 0,
                "batch_count": 0,
                "batches": [],
            }

        safe_batch_size = max(1, min(batch_size, 100))

        total_deleted_chunk_count = 0
        batches = []

        for start_index in range(0, len(normalized_document_ids), safe_batch_size):
            batch_document_ids = normalized_document_ids[start_index:start_index + safe_batch_size]

            batch_result = self._delete_document_id_batch_with_retry(
                batch_document_ids=batch_document_ids,
                batch_number=(start_index // safe_batch_size) + 1,
            )

            total_deleted_chunk_count += batch_result["deleted_chunk_count"]
            batches.append(batch_result)

        return {
            "requested_document_count": len(document_ids),
            "target_document_count": len(normalized_document_ids),
            "deleted_chunk_count": total_deleted_chunk_count,
            "batch_count": len(batches),
            "batches": batches,
        }

    def recreate_collection(self) -> None:
        self.client.recreate_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=3072,
                distance=Distance.COSINE,
            ),
        )

    def create_payload_indexes(self) -> None:
        self.client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="document_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )

        self.client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="source_type",
            field_schema=PayloadSchemaType.KEYWORD,
        )

    def _delete_document_id_batch_with_retry(
        self,
        batch_document_ids: list[str],
        batch_number: int,
    ) -> dict:
        max_retries = 3
        last_error_message = None

        for attempt in range(1, max_retries + 1):
            try:
                before_count = self.count_by_document_ids(batch_document_ids)

                if before_count == 0:
                    return {
                        "batch_number": batch_number,
                        "requested_document_count": len(batch_document_ids),
                        "deleted_chunk_count": 0,
                        "status": "NO_MATCH",
                    }

                self.client.delete(
                    collection_name=settings.qdrant_collection,
                    points_selector=FilterSelector(
                        filter=self._build_document_ids_filter(batch_document_ids),
                    ),
                    wait=True,
                )

                return {
                    "batch_number": batch_number,
                    "requested_document_count": len(batch_document_ids),
                    "deleted_chunk_count": before_count,
                    "status": "DELETED",
                }

            except ResponseHandlingException as error:
                last_error_message = str(error)

                if attempt == max_retries:
                    break

                time.sleep(3 * attempt)

            except Exception as error:
                last_error_message = str(error)

                if attempt == max_retries:
                    break

                time.sleep(3 * attempt)

        return {
            "batch_number": batch_number,
            "requested_document_count": len(batch_document_ids),
            "deleted_chunk_count": 0,
            "status": "FAILED",
            "error_message": last_error_message,
        }

    def _build_document_ids_filter(self, document_ids: list[str]) -> Filter:
        return Filter(
            should=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
                for document_id in document_ids
            ]
        )

    def _normalize_document_ids(self, document_ids: list[str]) -> list[str]:
        normalized_document_ids = []

        for document_id in document_ids:
            if document_id is None:
                continue

            normalized_document_id = str(document_id).strip()

            if not normalized_document_id:
                continue

            if normalized_document_id not in normalized_document_ids:
                normalized_document_ids.append(normalized_document_id)

        return normalized_document_ids
    
    def hybrid_search_chunks(
        self,
        query_text: str,
        query_vector: list[float],
        limit: int = 5,
        vector_limit: int = 12,
        keyword_limit: int = 12,
    ) -> list[dict]:
        vector_chunks = self.search_chunks(
            query_vector=query_vector,
            limit=vector_limit,
        )

        keyword_chunks = self.keyword_search_chunks(
            query_text=query_text,
            limit=keyword_limit,
        )

        return self._merge_and_rerank_chunks(
            query_text=query_text,
            vector_chunks=vector_chunks,
            keyword_chunks=keyword_chunks,
            limit=limit,
        )

    def keyword_search_chunks(
        self,
        query_text: str,
        limit: int = 12,
        scan_limit: int = 200,
    ) -> list[dict]:
        query_keywords = self._extract_keywords(query_text)

        if not query_keywords:
            return []

        scroll_result = self.client.scroll(
            collection_name=settings.qdrant_collection,
            limit=scan_limit,
            with_payload=True,
            with_vectors=False,
        )

        points = scroll_result[0]
        chunks = []

        for point in points:
            payload = point.payload or {}

            chunk = {
                "score": 0.0,
                "source_type": payload.get("source_type"),
                "document_id": payload.get("document_id"),
                "filename": payload.get("filename"),
                "service_id": payload.get("service_id"),
                "service_name": payload.get("service_name"),
                "region": payload.get("region"),
                "department": payload.get("department"),
                "source": payload.get("source"),
                "chunk_index": payload.get("chunk_index"),
                "content": payload.get("content"),
            }

            keyword_score = self._keyword_score(query_keywords, chunk)

            if keyword_score <= 0:
                continue

            chunk["keyword_score"] = keyword_score
            chunks.append(chunk)

        chunks.sort(key=lambda chunk: chunk.get("keyword_score", 0), reverse=True)

        return chunks[:limit]

    def _merge_and_rerank_chunks(
        self,
        query_text: str,
        vector_chunks: list[dict],
        keyword_chunks: list[dict],
        limit: int,
    ) -> list[dict]:
        query_keywords = self._extract_keywords(query_text)
        merged = {}

        for rank, chunk in enumerate(vector_chunks):
            key = self._chunk_key(chunk)

            if key not in merged:
                merged[key] = {
                    **chunk,
                    "vector_score": float(chunk.get("score") or 0),
                    "keyword_score": 0.0,
                    "vector_rank_score": 1.0 / (rank + 1),
                    "keyword_rank_score": 0.0,
                }
            else:
                merged[key]["vector_score"] = max(
                    merged[key].get("vector_score", 0),
                    float(chunk.get("score") or 0),
                )
                merged[key]["vector_rank_score"] = max(
                    merged[key].get("vector_rank_score", 0),
                    1.0 / (rank + 1),
                )

        for rank, chunk in enumerate(keyword_chunks):
            key = self._chunk_key(chunk)
            keyword_score = float(chunk.get("keyword_score") or 0)

            if key not in merged:
                merged[key] = {
                    **chunk,
                    "vector_score": 0.0,
                    "keyword_score": keyword_score,
                    "vector_rank_score": 0.0,
                    "keyword_rank_score": 1.0 / (rank + 1),
                }
            else:
                merged[key]["keyword_score"] = max(
                    merged[key].get("keyword_score", 0),
                    keyword_score,
                )
                merged[key]["keyword_rank_score"] = max(
                    merged[key].get("keyword_rank_score", 0),
                    1.0 / (rank + 1),
                )

        reranked_chunks = []

        for chunk in merged.values():
            keyword_score = self._keyword_score(query_keywords, chunk)
            service_name_score = self._keyword_score(
                query_keywords,
                {
                    **chunk,
                    "content": " ".join(
                        str(value)
                        for value in [
                            chunk.get("service_name"),
                            chunk.get("filename"),
                            chunk.get("source"),
                            chunk.get("department"),
                        ]
                        if value
                    ),
                },
            )

            final_score = (
                chunk.get("vector_rank_score", 0) * 0.45
                + chunk.get("keyword_rank_score", 0) * 0.25
                + min(keyword_score / 10, 1.0) * 0.20
                + min(service_name_score / 5, 1.0) * 0.10
            )

            chunk["rerank_score"] = final_score
            chunk["score"] = final_score
            reranked_chunks.append(chunk)

        reranked_chunks.sort(
            key=lambda chunk: chunk.get("rerank_score", 0),
            reverse=True,
        )

        return reranked_chunks[:limit]

    def _extract_keywords(self, text: str) -> list[str]:
        normalized = str(text or "").lower()

        synonym_groups = [
            ["기초연금", "노인연금", "65세지원금", "65세연금"],
            ["국민연금", "노령연금", "노후연금"],
            ["중복수급", "같이받", "동시에받", "함께받"],
            ["감액", "줄어드", "깎이"],
            ["장기요양보험", "노인장기요양", "장기요양급여"],
            ["노인맞춤돌봄서비스", "노인맞춤돌봄", "맞춤돌봄"],
            ["장애인활동지원", "활동지원서비스"],
            ["의료급여", "의료비지원"],
            ["주거급여", "주거지원"],
        ]

        compact = re.sub(r"\s+", "", normalized)

        keywords = set(
            token
            for token in re.findall(r"[가-힣a-zA-Z0-9]+", normalized)
            if len(token) >= 2
        )

        for group in synonym_groups:
            if any(word.lower().replace(" ", "") in compact for word in group):
                keywords.update(word.lower().replace(" ", "") for word in group)

        return list(keywords)

    def _keyword_score(self, query_keywords: list[str], chunk: dict) -> float:
        content = " ".join(
            str(value)
            for value in [
                chunk.get("service_name"),
                chunk.get("filename"),
                chunk.get("source"),
                chunk.get("department"),
                chunk.get("content"),
            ]
            if value
        ).lower()

        compact_content = re.sub(r"\s+", "", content)

        score = 0.0

        for keyword in query_keywords:
            compact_keyword = keyword.lower().replace(" ", "")

            if not compact_keyword:
                continue

            if compact_keyword in compact_content:
                score += 3.0

            if compact_content.startswith(compact_keyword):
                score += 1.0

            score += compact_content.count(compact_keyword) * 0.5

        return score

    def _chunk_key(self, chunk: dict) -> str:
        document_id = chunk.get("document_id") or ""
        chunk_index = chunk.get("chunk_index")

        if document_id and chunk_index is not None:
            return f"{document_id}:{chunk_index}"

        return "|".join(
            str(value)
            for value in [
                chunk.get("service_id"),
                chunk.get("service_name"),
                chunk.get("filename"),
                chunk.get("content"),
            ]
            if value
        )