from sqlalchemy import create_engine, text

from app.core.config import settings


class MetadataService:
    def __init__(self):
        self.engine = create_engine(
            settings.neon_database_url,
            pool_pre_ping=True,
        )

    def create_document(
        self,
        document_id: str,
        filename: str,
        title: str | None,
        source: str | None,
        status: str,
        qdrant_collection: str,
    ) -> None:
        sql = text("""
            insert into rag_documents (
                document_id,
                filename,
                title,
                source,
                status,
                qdrant_collection
            )
            values (
                :document_id,
                :filename,
                :title,
                :source,
                :status,
                :qdrant_collection
            )
            on conflict (document_id)
            do update set
                filename = excluded.filename,
                title = excluded.title,
                source = excluded.source,
                status = excluded.status,
                qdrant_collection = excluded.qdrant_collection,
                updated_at = current_timestamp
        """)

        with self.engine.begin() as connection:
            connection.execute(sql, {
                "document_id": document_id,
                "filename": filename,
                "title": title,
                "source": source,
                "status": status,
                "qdrant_collection": qdrant_collection,
            })

    def update_document_result(
        self,
        document_id: str,
        status: str,
        text_length: int,
        chunk_count: int,
    ) -> None:
        sql = text("""
            update rag_documents
            set
                status = :status,
                text_length = :text_length,
                chunk_count = :chunk_count,
                updated_at = current_timestamp
            where document_id = :document_id
        """)

        with self.engine.begin() as connection:
            connection.execute(sql, {
                "document_id": document_id,
                "status": status,
                "text_length": text_length,
                "chunk_count": chunk_count,
            })

    def create_job(
        self,
        job_id: str,
        document_id: str,
        filename: str,
        status: str,
    ) -> None:
        sql = text("""
            insert into rag_ingest_jobs (
                job_id,
                document_id,
                filename,
                status
            )
            values (
                :job_id,
                :document_id,
                :filename,
                :status
            )
            on conflict (job_id)
            do update set
                document_id = excluded.document_id,
                filename = excluded.filename,
                status = excluded.status,
                updated_at = current_timestamp
        """)

        with self.engine.begin() as connection:
            connection.execute(sql, {
                "job_id": job_id,
                "document_id": document_id,
                "filename": filename,
                "status": status,
            })

    def update_job(
        self,
        job_id: str,
        status: str,
        total_chunks: int,
        processed_chunks: int,
        saved_count: int,
        cache_hit_count: int,
        cache_miss_count: int,
        error_message: str | None = None,
    ) -> None:
        sql = text("""
            update rag_ingest_jobs
            set
                status = :status,
                total_chunks = :total_chunks,
                processed_chunks = :processed_chunks,
                saved_count = :saved_count,
                cache_hit_count = :cache_hit_count,
                cache_miss_count = :cache_miss_count,
                error_message = :error_message,
                updated_at = current_timestamp
            where job_id = :job_id
        """)

        with self.engine.begin() as connection:
            connection.execute(sql, {
                "job_id": job_id,
                "status": status,
                "total_chunks": total_chunks,
                "processed_chunks": processed_chunks,
                "saved_count": saved_count,
                "cache_hit_count": cache_hit_count,
                "cache_miss_count": cache_miss_count,
                "error_message": error_message,
            })