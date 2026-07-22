from __future__ import annotations

from fastapi import APIRouter

from app.check_in_analysis.cached_summary_service import (
    CachedGuardianSummaryService,
)
from app.check_in_analysis.gemini_service import (
    GeminiSummaryService,
)
from app.check_in_analysis.models import (
    CheckInAnalysisRequest,
    CheckInAnalysisResponse,
)
from app.check_in_analysis.rule_engine import (
    CheckInRuleEngine,
)


router = APIRouter(
    prefix="/api/ai",
    tags=["AI 안부 분석"],
)


rule_engine = CheckInRuleEngine()


gemini_summary_service = (
    GeminiSummaryService()
)


cached_guardian_summary_service = (
    CachedGuardianSummaryService(
        gemini_summary_service=(
            gemini_summary_service
        ),
    )
)


@router.post(
    "/check-in-analysis",
    response_model=CheckInAnalysisResponse,
    response_model_by_alias=True,
    summary="최근 안부 기록 분석",
)
def analyze_check_ins(
    request: CheckInAnalysisRequest,
) -> CheckInAnalysisResponse:
    """
    Spring에서 전달한 최근 안부 기록을 분석한다.

    처리 순서:

    1. 안부 요청 통계 계산
    2. 규칙 기반 위험 단계 확정
    3. 같은 기록이면 저장된 Gemini 안내문 재사용
    4. 기록이 달라졌을 때만 Gemini 호출
    5. Gemini 실패 시 규칙 기반 안내문 사용
    """
    analysis = rule_engine.analyze(
        request=request,
    )

    fallback_summary = (
        rule_engine.create_fallback_summary(
            analysis=analysis,
        )
    )

    summary_result = (
        cached_guardian_summary_service
        .get_or_create(
            request=request,
            analysis=analysis,
            fallback_summary=fallback_summary,
        )
    )

    return CheckInAnalysisResponse(
        **analysis.model_dump(),

        guardian_summary=(
            summary_result.summary
        ),

        summary_source=(
            summary_result.source
        ),
    )


@router.get(
    "/check-in-analysis/health",
    summary="안부 분석 기능 상태 확인",
)
def get_check_in_analysis_health() -> dict[str, object]:
    """
    API 키 값은 노출하지 않고
    Gemini 사용 가능 여부만 반환한다.
    """
    return {
        "status": "UP",

        "geminiEnabled": (
            gemini_summary_service.enabled
        ),

        "geminiConfigured": (
            gemini_summary_service
            .is_configured()
        ),

        "geminiModel": (
            gemini_summary_service.model
        ),
    }