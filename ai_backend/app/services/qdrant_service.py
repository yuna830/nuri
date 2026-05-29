from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Distance, PayloadSchemaType, VectorParams

from app.core.config import settings


class QdrantService:
    def __init__(self):
        self.client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
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
        result = self.client.count(
            collection_name=settings.qdrant_collection,
            count_filter={
                "must": [
                    {
                        "key": "document_id",
                        "match": {
                            "value": document_id,
                        },
                    }
                ]
            },
            exact=True,
        )

        return result.count
    
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