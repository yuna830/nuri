import time

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.public_welfare_job_service import public_welfare_job_service
from app.services.public_welfare_service import PublicWelfareService

router = APIRouter()


class PublicWelfareSyncResponse(BaseModel):
    saved_documents: int
    saved_chunks: int
    processed_items: int


class PublicWelfarePageInfoResponse(BaseModel):
    total_count: int
    num_of_rows: int
    current_page: int
    total_pages: int


class PublicWelfareSyncJobResponse(BaseModel):
    job_id: str
    status: str
    start_page: int
    end_page: int
    num_of_rows: int
    delay_seconds: int


class PublicWelfareJobStatusResponse(BaseModel):
    job_id: str
    status: str
    start_page: int
    end_page: int
    current_page: int
    num_of_rows: int
    delay_seconds: int
    processed_pages: int
    saved_documents: int
    saved_chunks: int
    error_message: str | None
    created_at: str
    updated_at: str


@router.get("/page-info", response_model=PublicWelfarePageInfoResponse)
def get_public_welfare_page_info(num_of_rows: int = 10):
    service = PublicWelfareService()
    result = service.get_page_info(num_of_rows=num_of_rows)

    return PublicWelfarePageInfoResponse(**result)


@router.post("/sync", response_model=PublicWelfareSyncResponse)
def sync_public_welfare(
    start_page: int = 1,
    max_pages: int = 1,
    num_of_rows: int = 10,
    limit_items: int = 5,
):
    service = PublicWelfareService()
    result = service.sync(
        start_page=start_page,
        max_pages=max_pages,
        num_of_rows=num_of_rows,
        limit_items=limit_items,
    )

    return PublicWelfareSyncResponse(**result)


@router.post("/sync-job", response_model=PublicWelfareSyncJobResponse)
def create_public_welfare_sync_job(
    background_tasks: BackgroundTasks,
    start_page: int = 1,
    end_page: int = 3,
    num_of_rows: int = 10,
    delay_seconds: int = 10,
):
    if end_page < start_page:
        raise HTTPException(status_code=400, detail="end_page는 start_page보다 크거나 같아야 합니다.")

    job_id = public_welfare_job_service.create_job(
        start_page=start_page,
        end_page=end_page,
        num_of_rows=num_of_rows,
        delay_seconds=delay_seconds,
    )

    background_tasks.add_task(
        process_public_welfare_sync_job,
        job_id,
        start_page,
        end_page,
        num_of_rows,
        delay_seconds,
    )

    return PublicWelfareSyncJobResponse(
        job_id=job_id,
        status="queued",
        start_page=start_page,
        end_page=end_page,
        num_of_rows=num_of_rows,
        delay_seconds=delay_seconds,
    )


@router.get("/jobs/{job_id}", response_model=PublicWelfareJobStatusResponse)
def get_public_welfare_job(job_id: str):
    job = public_welfare_job_service.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return PublicWelfareJobStatusResponse(**job)


def process_public_welfare_sync_job(
    job_id: str,
    start_page: int,
    end_page: int,
    num_of_rows: int,
    delay_seconds: int,
) -> None:
    job = public_welfare_job_service.get_job(job_id)

    if job is None:
        return

    saved_documents = job["saved_documents"]
    saved_chunks = job["saved_chunks"]
    processed_pages = job["processed_pages"]

    try:
        public_welfare_job_service.update_job(
            job_id,
            status="processing",
            current_page=start_page,
        )

        service = PublicWelfareService()

        for page_no in range(start_page, end_page + 1):
            public_welfare_job_service.update_job(
                job_id,
                current_page=page_no,
            )

            result = service.sync_page(
                page_no=page_no,
                num_of_rows=num_of_rows,
            )

            saved_documents += result["saved_documents"]
            saved_chunks += result["saved_chunks"]
            processed_pages += 1

            public_welfare_job_service.update_job(
                job_id,
                processed_pages=processed_pages,
                saved_documents=saved_documents,
                saved_chunks=saved_chunks,
            )

            if result["processed_items"] == 0:
                break

            if page_no < end_page and delay_seconds > 0:
                time.sleep(delay_seconds)

        public_welfare_job_service.update_job(
            job_id,
            status="completed",
            last_page = start_page,
            processed_pages=processed_pages,
            saved_documents=saved_documents,
            saved_chunks=saved_chunks,
        )
    except Exception as error:
        public_welfare_job_service.update_job(
            job_id,
            status="failed",
            error_message=str(error),
            processed_pages=processed_pages,
            saved_documents=saved_documents,
            saved_chunks=saved_chunks,
        )

@router.post("/jobs/{job_id}/resume", response_model=PublicWelfareSyncJobResponse)
def resume_public_welfare_job(
    background_tasks: BackgroundTasks,
    job_id: str,
):
    job = public_welfare_job_service.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    if job["status"] == "completed":
        raise HTTPException(status_code=400, detail="이미 완료된 작업입니다.")

    resume_page = job["current_page"]

    public_welfare_job_service.update_job(
        job_id,
        status="queued",
        error_message=None,
    )

    background_tasks.add_task(
        process_public_welfare_sync_job,
        job_id,
        resume_page,
        job["end_page"],
        job["num_of_rows"],
        job["delay_seconds"],
    )

    return PublicWelfareSyncJobResponse(
        job_id=job_id,
        status="queued",
        start_page=resume_page,
        end_page=job["end_page"],
        num_of_rows=job["num_of_rows"],
        delay_seconds=job["delay_seconds"],
    )