from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.services.embedding_cache_service import EmbeddingCacheService
from app.services.embedding_service import EmbeddingService
from app.services.job_service import job_service
from app.services.metadata_service import MetadataService
from app.services.pdf_service import PdfService
from app.services.qdrant_service import QdrantService

router = APIRouter()


class PdfPreviewResponse(BaseModel):
    filename: str
    text_length: int
    chunk_count: int
    preview: str
    chunks_preview: list[str]


class PdfIngestJobResponse(BaseModel):
    job_id: str
    document_id: str
    filename: str
    status: str
    chunk_start: int
    chunk_limit: int


class JobStatusResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    total_chunks: int
    processed_chunks: int
    saved_count: int
    cache_hit_count: int
    cache_miss_count: int
    error_message: str | None
    created_at: str
    updated_at: str


@router.post("/pdf/preview", response_model=PdfPreviewResponse)
async def preview_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    file_bytes = await file.read()

    pdf_service = PdfService()
    text = pdf_service.extract_text(file_bytes)
    chunks = pdf_service.chunk_text(text)

    return PdfPreviewResponse(
        filename=file.filename,
        text_length=len(text),
        chunk_count=len(chunks),
        preview=text[:1000],
        chunks_preview=chunks[:3],
    )


@router.post("/pdf/ingest", response_model=PdfIngestJobResponse)
async def ingest_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_id: str | None = None,
    chunk_start: int = 0,
    chunk_limit: int = 10,
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    file_bytes = await file.read()

    if document_id is None:
        document_id = str(uuid4())

    job_id = job_service.create_job(file.filename)

    metadata_service = MetadataService()
    metadata_service.create_document(
        document_id=document_id,
        filename=file.filename,
        title=file.filename,
        source="uploaded_pdf",
        status="queued",
        qdrant_collection=settings.qdrant_collection,
    )
    metadata_service.create_job(
        job_id=job_id,
        document_id=document_id,
        filename=file.filename,
        status="queued",
    )

    background_tasks.add_task(
        process_pdf_ingest_job,
        job_id,
        document_id,
        file.filename,
        file_bytes,
        chunk_start,
        chunk_limit,
    )

    return PdfIngestJobResponse(
        job_id=job_id,
        document_id=document_id,
        filename=file.filename,
        status="queued",
        chunk_start=chunk_start,
        chunk_limit=chunk_limit,
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_upload_job(job_id: str):
    job = job_service.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return JobStatusResponse(**job)


def process_pdf_ingest_job(
    job_id: str,
    document_id: str,
    filename: str,
    file_bytes: bytes,
    chunk_start: int,
    chunk_limit: int,
) -> None:
    metadata_service = MetadataService()

    try:
        job_service.update_job(job_id, status="processing")
        metadata_service.update_job(
            job_id=job_id,
            status="processing",
            total_chunks=0,
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
        )

        pdf_service = PdfService()
        embedding_service = EmbeddingService()
        cache_service = EmbeddingCacheService()
        qdrant_service = QdrantService()

        text = pdf_service.extract_text(file_bytes)
        chunks = pdf_service.chunk_text(text)

        # 무료 Gemini 테스트용 제한입니다. 안정화 후 제거하거나 늘리세요.
        all_chunks = pdf_service.chunk_text(text)
        chunks = all_chunks[chunk_start:chunk_start + chunk_limit]

        job_service.update_job(
            job_id,
            total_chunks=len(all_chunks),
            processed_chunks=0,
        )
        metadata_service.update_job(
            job_id=job_id,
            status="processing",
            total_chunks=len(chunks),
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
        )

        vectors: list[list[float] | None] = []
        missing_indexes = []
        missing_chunks = []
        cache_hit_count = 0

        for index, chunk in enumerate(chunks):
            cached_vector = cache_service.get(chunk)

            if cached_vector is not None:
                vectors.append(cached_vector)
                cache_hit_count += 1
            else:
                vectors.append(None)
                missing_indexes.append(index)
                missing_chunks.append(chunk)

        cache_miss_count = len(missing_chunks)

        if missing_chunks:
            embedded_vectors = embedding_service.embed_texts(missing_chunks)

            for chunk, index, vector in zip(missing_chunks, missing_indexes, embedded_vectors):
                cache_service.set(chunk, vector)
                vectors[index] = vector

                job_service.update_job(
                    job_id,
                    processed_chunks=index + 1,
                    cache_hit_count=cache_hit_count,
                    cache_miss_count=cache_miss_count,
                )
                metadata_service.update_job(
                    job_id=job_id,
                    status="processing",
                    total_chunks=len(chunks),
                    processed_chunks=index + 1,
                    saved_count=0,
                    cache_hit_count=cache_hit_count,
                    cache_miss_count=cache_miss_count,
                )

        final_vectors = [vector for vector in vectors if vector is not None]

        saved_count = qdrant_service.save_chunks(
            document_id=document_id,
            chunks=chunks,
            vectors=final_vectors,
            source_type="pdf",
            metadata={
                "filename": filename,
                "source": "uploaded_pdf",
            },
        )

        job_service.update_job(
            job_id,
            status="completed",
            processed_chunks=len(chunks),
            saved_count=saved_count,
            cache_hit_count=cache_hit_count,
            cache_miss_count=cache_miss_count,
        )
        metadata_service.update_document_result(
            document_id=document_id,
            status="completed",
            text_length=len(text),
            chunk_count=len(all_chunks),
        )
        metadata_service.update_job(
            job_id=job_id,
            status="completed",
            total_chunks=len(chunks),
            processed_chunks=len(chunks),
            saved_count=saved_count,
            cache_hit_count=cache_hit_count,
            cache_miss_count=cache_miss_count,
        )
    except Exception as error:
        job_service.update_job(
            job_id,
            status="failed",
            error_message=str(error),
        )
        metadata_service.update_document_result(
            document_id=document_id,
            status="failed",
            text_length=0,
            chunk_count=0,
        )
        metadata_service.update_job(
            job_id=job_id,
            status="failed",
            total_chunks=0,
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
            error_message=str(error),
        )

@router.post("/markdown/ingest", response_model=PdfIngestJobResponse)
async def ingest_markdown(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_id: str | None = None,
    chunk_start: int = 0,
    chunk_limit: int = 20,
):
    if not file.filename.lower().endswith(".md"):
        raise HTTPException(status_code=400, detail="Markdown 파일만 업로드할 수 있습니다.")

    file_bytes = await file.read()

    if document_id is None:
        document_id = str(uuid4())

    job_id = job_service.create_job(file.filename)

    metadata_service = MetadataService()
    metadata_service.create_document(
        document_id=document_id,
        filename=file.filename,
        title=file.filename.replace(".md", ""),
        source="obsidian_md",
        status="queued",
        qdrant_collection=settings.qdrant_collection,
    )
    metadata_service.create_job(
        job_id=job_id,
        document_id=document_id,
        filename=file.filename,
        status="queued",
    )

    background_tasks.add_task(
        process_markdown_ingest_job,
        job_id,
        document_id,
        file.filename,
        file_bytes,
        chunk_start,
        chunk_limit,
    )

    return PdfIngestJobResponse(
        job_id=job_id,
        document_id=document_id,
        filename=file.filename,
        status="queued",
        chunk_start=chunk_start,
        chunk_limit=chunk_limit,
    )

def process_markdown_ingest_job(
    job_id: str,
    document_id: str,
    filename: str,
    file_bytes: bytes,
    chunk_start: int,
    chunk_limit: int,
) -> None:
    metadata_service = MetadataService()

    try:
        job_service.update_job(job_id, status="processing")
        metadata_service.update_job(
            job_id=job_id,
            status="processing",
            total_chunks=0,
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
        )

        text = file_bytes.decode("utf-8-sig")
        pdf_service = PdfService()
        embedding_service = EmbeddingService()
        cache_service = EmbeddingCacheService()
        qdrant_service = QdrantService()

        all_chunks = pdf_service.chunk_text(text)
        chunks = all_chunks[chunk_start:chunk_start + chunk_limit]

        metadata_service.update_job(
            job_id=job_id,
            status="processing",
            total_chunks=len(chunks),
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
        )

        vectors: list[list[float] | None] = []
        missing_indexes = []
        missing_chunks = []
        cache_hit_count = 0

        for index, chunk in enumerate(chunks):
            cached_vector = cache_service.get(chunk)

            if cached_vector is not None:
                vectors.append(cached_vector)
                cache_hit_count += 1
            else:
                vectors.append(None)
                missing_indexes.append(index)
                missing_chunks.append(chunk)

        cache_miss_count = len(missing_chunks)

        if missing_chunks:
            embedded_vectors = embedding_service.embed_texts(missing_chunks)

            for chunk, index, vector in zip(missing_chunks, missing_indexes, embedded_vectors):
                cache_service.set(chunk, vector)
                vectors[index] = vector

        final_vectors = [vector for vector in vectors if vector is not None]

        saved_count = qdrant_service.save_chunks(
            document_id=document_id,
            chunks=chunks,
            vectors=final_vectors,
            source_type="obsidian_md",
            metadata={
                "filename": filename,
                "source": "obsidian",
                "title": filename.replace(".md", ""),
            },
        )

        job_service.update_job(
            job_id,
            status="completed",
            processed_chunks=len(chunks),
            saved_count=saved_count,
            cache_hit_count=cache_hit_count,
            cache_miss_count=cache_miss_count,
        )
        metadata_service.update_document_result(
            document_id=document_id,
            status="completed",
            text_length=len(text),
            chunk_count=len(all_chunks),
        )
        metadata_service.update_job(
            job_id=job_id,
            status="completed",
            total_chunks=len(chunks),
            processed_chunks=len(chunks),
            saved_count=saved_count,
            cache_hit_count=cache_hit_count,
            cache_miss_count=cache_miss_count,
        )
    except Exception as error:
        job_service.update_job(
            job_id,
            status="failed",
            error_message=str(error),
        )
        metadata_service.update_document_result(
            document_id=document_id,
            status="failed",
            text_length=0,
            chunk_count=0,
        )
        metadata_service.update_job(
            job_id=job_id,
            status="failed",
            total_chunks=0,
            processed_chunks=0,
            saved_count=0,
            cache_hit_count=0,
            cache_miss_count=0,
            error_message=str(error),
        )