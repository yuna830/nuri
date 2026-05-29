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