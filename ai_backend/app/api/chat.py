from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.rag_service import RagService

router = APIRouter()


class JobApplicationProfile(BaseModel):
    jobTitle: Any = None
    organization: Any = None
    status: Any = None
    location: Any = None
    requestedAt: Any = None
    applicationType: Any = None


class WelfareProfile(BaseModel):
    name: Any = None
    age: Any = None
    gender: Any = None
    height: Any = None
    weight: Any = None
    smoking: Any = None
    drinking: Any = None
    allergies: Any = None
    medicineCount: Any = None
    medications: list[Any] = []
    mobilityInfo: list[Any] = []
    workLimitations: list[Any] = []
    jobPreference: dict[str, Any] = {}
    region: Any = None
    address: Any = None
    incomeLevel: Any = None
    householdType: Any = None
    livingAlone: Any = None
    diseases: list[Any] = []
    medicationInfo: Any = None
    basicLivelihoodStatus: Any = None
    nearPovertyStatus: Any = None
    disabilityStatus: Any = None
    longTermCareGrade: Any = None
    jobRequestStatus: Any = None
    currentBenefits: list[Any] = []
    welfareMemo: Any = None
    jobApplications: list[JobApplicationProfile] = []

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

def infer_question_mode(question: str, requested_mode: str) -> str:
    normalized = question.replace(" ", "")

    relation_patterns = [
        "중복수급",
        "중복으로받",
        "같이받",
        "동시에받",
        "함께받",
        "받고있는데",
        "받는중인데",
        "이미받고",
        "감액",
        "줄어드",
        "깎이",
        "제외되",
        "탈락",
        "유지되",
    ]

    if any(pattern in normalized for pattern in relation_patterns):
        return "qa"

    recommend_patterns = [
        "추천",
        "받을수있는복지",
        "받을만한복지",
        "가능한복지",
        "지원받을수있는",
        "혜택알려",
        "제도알려",
        "뭐가있",
        "목록",
        "관련복지",
        "복지알려",
        "맞는복지",
        "받을복지",
        "해당하는복지",
        "복지추천",
    ]

    if any(pattern in normalized for pattern in recommend_patterns):
        return "recommend"

    yes_no_patterns = [
        "받아도돼",
        "가능해",
        "가능한가",
        "되나요",
        "되나",
    ]

    if any(pattern in normalized for pattern in yes_no_patterns):
        return "qa"

    return requested_mode

@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력해 주세요.")

    resolved_mode = infer_question_mode(question, request.mode)

    rag_service = RagService()
    result = rag_service.ask(
        question=question,
        mode=resolved_mode,
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
