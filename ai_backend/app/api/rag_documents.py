from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.embedding_service import EmbeddingService
from app.services.qdrant_service import QdrantService

router = APIRouter()


class RagDocumentEmbedRequest(BaseModel):
    document_id: str
    title: str | None = None
    filename: str | None = None
    source_type: str
    source_id: str | None = None
    source: str | None = None
    qdrant_collection: str | None = None
    content: str


class RagDocumentEmbedResponse(BaseModel):
    document_id: str
    status: str
    saved_chunks: int
    existing_chunks: int
    skipped: bool
    message: str


class RagDocumentDeleteRequest(BaseModel):
    document_ids: list[str]


class RagDocumentDeleteBatchResponse(BaseModel):
    batch_number: int
    requested_document_count: int
    deleted_chunk_count: int
    status: str
    error_message: str | None = None


class RagDocumentDeleteResponse(BaseModel):
    requested_document_count: int
    target_document_count: int
    deleted_chunk_count: int
    batch_count: int
    batches: list[RagDocumentDeleteBatchResponse]


class RagDocumentCountResponse(BaseModel):
    document_id: str
    chunk_count: int


@router.post("/embed-document", response_model=RagDocumentEmbedResponse)
def embed_rag_document(request: RagDocumentEmbedRequest):
    if not request.document_id.strip():
        raise HTTPException(status_code=400, detail="document_id가 비어 있습니다.")

    if not request.source_type.strip():
        raise HTTPException(status_code=400, detail="source_type이 비어 있습니다.")

    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content가 비어 있습니다.")

    qdrant_service = QdrantService()

    existing_chunks = qdrant_service.count_by_document_id(request.document_id)

    if existing_chunks > 0:
        return RagDocumentEmbedResponse(
            document_id=request.document_id,
            status="SKIPPED_EXISTS",
            saved_chunks=0,
            existing_chunks=existing_chunks,
            skipped=True,
            message="이미 Qdrant에 저장된 document_id입니다.",
        )

    chunks = split_text_into_chunks(request.content)

    if not chunks:
        raise HTTPException(status_code=400, detail="생성된 chunk가 없습니다.")

    embedding_service = EmbeddingService()
    vectors = embedding_service.embed_texts(chunks)

    metadata = {
        "filename": request.filename,
        "title": request.title,
        "service_id": request.source_id,
        "service_name": request.title,
        "source": request.source,
        "qdrant_collection": request.qdrant_collection,
    }

    saved_chunks = qdrant_service.save_chunks(
        document_id=request.document_id,
        chunks=chunks,
        vectors=vectors,
        source_type=request.source_type,
        metadata=metadata,
    )

    return RagDocumentEmbedResponse(
        document_id=request.document_id,
        status="EMBEDDED",
        saved_chunks=saved_chunks,
        existing_chunks=0,
        skipped=False,
        message="Qdrant 저장 완료",
    )


@router.get("/count-by-document-id", response_model=RagDocumentCountResponse)
def count_rag_document_by_document_id(document_id: str):
    if not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id가 비어 있습니다.")

    qdrant_service = QdrantService()
    chunk_count = qdrant_service.count_by_document_id(document_id.strip())

    return RagDocumentCountResponse(
        document_id=document_id.strip(),
        chunk_count=chunk_count,
    )


@router.post("/delete-documents", response_model=RagDocumentDeleteResponse)
def delete_rag_documents(
    request: RagDocumentDeleteRequest,
    batch_size: int = Query(default=50, ge=1, le=100),
):
    document_ids = [
        document_id.strip()
        for document_id in request.document_ids
        if document_id and document_id.strip()
    ]

    if not document_ids:
        raise HTTPException(status_code=400, detail="삭제할 document_id가 없습니다.")

    qdrant_service = QdrantService()
    result = qdrant_service.delete_by_document_ids(
        document_ids=document_ids,
        batch_size=batch_size,
    )

    return RagDocumentDeleteResponse(**result)


def split_text_into_chunks(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 150,
) -> list[str]:
    normalized_text = text.strip()

    if not normalized_text:
        return []

    if len(normalized_text) <= chunk_size:
        return [normalized_text]

    chunks = []
    start = 0

    while start < len(normalized_text):
        end = start + chunk_size
        chunk = normalized_text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(normalized_text):
            break

        start = end - overlap

        if start < 0:
            start = 0

    return chunks