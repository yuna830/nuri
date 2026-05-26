from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.rag_service import RagService

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    search_query: str | None = None
    limit: int = 5


class ChatSource(BaseModel):
    score: float | None = None
    document_id: str | None = None
    filename: str | None = None
    chunk_index: int | None = None
    content: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력하세요.")

    rag_service = RagService()
    result = rag_service.ask(
        question=question,
        search_query=request.search_query,
        limit=request.limit,
    )

    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
    )
