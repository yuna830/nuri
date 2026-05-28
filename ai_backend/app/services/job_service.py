from datetime import datetime
from typing import Literal
from uuid import uuid4


JobStatus = Literal["queued", "processing", "completed", "failed"]


class JobService:
    def __init__(self):
        self.jobs = {}

    def create_job(self, filename: str) -> str:
        job_id = str(uuid4())

        self.jobs[job_id] = {
            "job_id": job_id,
            "filename": filename,
            "status": "queued",
            "total_chunks": 0,
            "processed_chunks": 0,
            "saved_count": 0,
            "cache_hit_count": 0,
            "cache_miss_count": 0,
            "error_message": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        return job_id

    def get_job(self, job_id: str) -> dict | None:
        return self.jobs.get(job_id)

    def update_job(self, job_id: str, **kwargs) -> None:
        if job_id not in self.jobs:
            return

        self.jobs[job_id].update(kwargs)
        self.jobs[job_id]["updated_at"] = datetime.now().isoformat()


job_service = JobService()