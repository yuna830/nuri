from datetime import datetime
from uuid import uuid4

from sqlalchemy import create_engine, text

from app.core.config import settings


class PublicWelfareJobService:
    def __init__(self):
        self.engine = create_engine(
            settings.neon_database_url,
            pool_pre_ping=True,
        )

    def create_job(
        self,
        start_page: int,
        end_page: int,
        num_of_rows: int,
        delay_seconds: int,
    ) -> str:
        job_id = str(uuid4())

        sql = text("""
            insert into rag_public_welfare_jobs (
                job_id,
                status,
                start_page,
                end_page,
                current_page,
                num_of_rows,
                delay_seconds
            )
            values (
                :job_id,
                'queued',
                :start_page,
                :end_page,
                :current_page,
                :num_of_rows,
                :delay_seconds
            )
        """)

        with self.engine.begin() as connection:
            connection.execute(sql, {
                "job_id": job_id,
                "start_page": start_page,
                "end_page": end_page,
                "current_page": start_page,
                "num_of_rows": num_of_rows,
                "delay_seconds": delay_seconds,
            })

        return job_id

    def get_job(self, job_id: str) -> dict | None:
        sql = text("""
            select
                job_id,
                status,
                start_page,
                end_page,
                current_page,
                num_of_rows,
                delay_seconds,
                processed_pages,
                saved_documents,
                saved_chunks,
                error_message,
                created_at,
                updated_at
            from rag_public_welfare_jobs
            where job_id = :job_id
        """)

        with self.engine.begin() as connection:
            row = connection.execute(sql, {"job_id": job_id}).mappings().first()

        if row is None:
            return None

        result = dict(row)
        result["created_at"] = result["created_at"].isoformat()
        result["updated_at"] = result["updated_at"].isoformat()

        return result

    def update_job(self, job_id: str, **kwargs) -> None:
        if not kwargs:
            return

        allowed_fields = {
            "status",
            "current_page",
            "processed_pages",
            "saved_documents",
            "saved_chunks",
            "error_message",
        }

        updates = {
            key: value
            for key, value in kwargs.items()
            if key in allowed_fields
        }

        if not updates:
            return

        set_clause = ", ".join(
            f"{key} = :{key}"
            for key in updates
        )

        sql = text(f"""
            update rag_public_welfare_jobs
            set
                {set_clause},
                updated_at = current_timestamp
            where job_id = :job_id
        """)

        params = {
            "job_id": job_id,
            **updates,
        }

        with self.engine.begin() as connection:
            connection.execute(sql, params)


public_welfare_job_service = PublicWelfareJobService()