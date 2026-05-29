from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.rag_service import RagService

router = APIRouter()


class WelfareProfile(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    region: str | None = None
    address: str | None = None
    incomeLevel: str | None = None
    householdType: str | None = None
    livingAlone: str | None = None
    diseases: list[str] = []
    medicationInfo: str | None = None
    basicLivelihoodStatus: str | None = None
    nearPovertyStatus: str | None = None
    disabilityStatus: str | None = None
    longTermCareGrade: str | None = None
    jobRequestStatus: str | None = None
    currentBenefits: list[str] = []
    welfareMemo: str | None = None


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    question: str
    mode: Literal["qa", "recommend"] = "qa"
    audience: Literal["worker", "guardian"] = "worker"
    profile: WelfareProfile | None = None
    history: list[ChatHistoryMessage] = []
    search_query: str | None = None
    limit: int = 5


class ChatSource(BaseModel):
    score: float | None = None
    source_type: str | None = None
    document_id: str | None = None
    filename: str | None = None
    service_id: str | None = None
    service_name: str | None = None
    region: str | None = None
    department: str | None = None
    source: str | None = None
    chunk_index: int | None = None
    content: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력해 주세요.")

    rag_service = RagService()
    result = rag_service.ask(
        question=question,
        mode=request.mode,
        audience=request.audience,
        profile=request.profile.model_dump() if request.profile else None,
        history=[message.model_dump() for message in request.history],
        search_query=request.search_query,
        limit=request.limit,
    )

    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
    )
