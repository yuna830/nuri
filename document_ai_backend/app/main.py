from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.analyzer import analyze_product_label
from app.config import settings
from app.history import confirm_analysis, initialize_history, save_analysis


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_history()
    yield


app = FastAPI(title="Nuri Product Label Google Vision OCR", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConfirmationRequest(BaseModel):
    fields: dict
    registeredProductId: int | None = None


@app.get("/health")
def health():
    return {"status": "ok", "engine": "GOOGLE_CLOUD_VISION", "enabled": settings.product_label_ocr_enabled, "port": 8002}


@app.post("/api/document-ai/product-label/analyze")
async def analyze(image: UploadFile = File(...), source: str = Form(...), seniorId: int = Form(...)):
    if not settings.product_label_ocr_enabled:
        raise HTTPException(status_code=503, detail="제품 라벨 OCR 기능이 비활성화되어 있습니다.")
    if source not in settings.allowed_sources:
        raise HTTPException(status_code=403, detail="허용되지 않은 등록 경로입니다.")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="JPG, PNG 또는 WEBP 이미지만 사용할 수 있습니다.")

    content = await image.read()
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="이미지는 10MB 이하여야 합니다.")

    analysis_id = f"analysis-{uuid4()}"
    try:
        raw_text, fields, warnings = analyze_product_label(content, image.content_type)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Google Cloud Vision 제품 라벨 분석에 실패했습니다: {error}") from error

    payload = {
        "analysisId": analysis_id, "engine": "GOOGLE_CLOUD_VISION", "documentType": "PRODUCT_LABEL", "seniorId": seniorId,
        "source": source, "rawText": raw_text, "fields": fields,
        "missingFields": [key for key, field in fields.items() if not field["value"]],
        "warnings": warnings, "requiresUserReview": True, "success": True,
    }
    save_analysis(payload)
    return payload


@app.patch("/api/document-ai/product-label/analyses/{analysis_id}/confirmation")
def save_confirmation(analysis_id: str, request: ConfirmationRequest):
    if not confirm_analysis(analysis_id, request.fields, request.registeredProductId):
        raise HTTPException(status_code=404, detail="분석 이력을 찾을 수 없습니다.")
    return {"analysisId": analysis_id, "confirmed": True}
