from __future__ import annotations

import logging

from dataclasses import dataclass

from app.check_in_analysis.gemini_service import (
    GeminiSummaryService,
)
from app.check_in_analysis.models import (
    CheckInAnalysisCore,
    CheckInAnalysisLevel,
    CheckInAnalysisRequest,
    CheckInSummarySource,
)
from app.check_in_analysis.summary_cache import (
    build_analysis_signature,
    summary_cache,
)


logger = logging.getLogger(
    __name__,
)


@dataclass(frozen=True)
class GuardianSummaryResult:
    """
    보호자 안내문 조회 또는 생성 결과.
    """

    summary: str

    source: CheckInSummarySource

    cache_hit: bool


class CachedGuardianSummaryService:
    """
    동일한 안부 기록이면 저장된 Gemini 안내문을 반환한다.

    실제 안부 기록이나 규칙 기반 판정 결과가 달라졌을 때만
    Gemini를 다시 호출한다.
    """

    def __init__(
        self,
        gemini_summary_service: GeminiSummaryService,
    ) -> None:
        self.gemini_summary_service = (
            gemini_summary_service
        )

    def get_or_create(
        self,
        *,
        request: CheckInAnalysisRequest,
        analysis: CheckInAnalysisCore,
        fallback_summary: str,
    ) -> GuardianSummaryResult:
        """
        캐시가 있으면 저장된 안내문을 반환한다.

        캐시가 없고 Gemini를 사용할 수 있으면 새로 생성한다.
        Gemini를 사용할 수 없거나 실패하면 규칙 안내문을 반환한다.
        """
        model_name = (
            self.gemini_summary_service.model
        )

        signature = (
            build_analysis_signature(
                request=request,
                analysis=analysis,
                model_name=model_name,
            )
        )

        cached = summary_cache.get(
            senior_id=request.senior_id,
            signature=signature,
        )

        if cached is not None:
            logger.info(
                "Gemini check-in summary cache hit. "
                "seniorId=%s signature=%s",
                request.senior_id,
                signature[:12],
            )

            return GuardianSummaryResult(
                summary=cached[
                    "guardian_summary"
                ],

                source=(
                    CheckInSummarySource.GEMINI
                ),

                cache_hit=True,
            )

        if not self._should_generate(
            analysis=analysis,
        ):
            logger.info(
                "Using rule-based check-in summary. "
                "seniorId=%s reason=not-generatable",
                request.senior_id,
            )

            return GuardianSummaryResult(
                summary=fallback_summary,

                source=(
                    CheckInSummarySource
                    .RULE_BASED
                ),

                cache_hit=False,
            )

        senior_lock = (
            summary_cache.get_senior_lock(
                request.senior_id,
            )
        )

        with senior_lock:
            # 첫 번째 요청이 Gemini를 호출하는 동안
            # 두 번째 요청이 기다렸을 수 있으므로
            # 잠금을 얻은 뒤 캐시를 다시 확인한다.
            cached = summary_cache.get(
                senior_id=request.senior_id,
                signature=signature,
            )

            if cached is not None:
                logger.info(
                    "Gemini check-in summary cache hit "
                    "after lock. "
                    "seniorId=%s signature=%s",
                    request.senior_id,
                    signature[:12],
                )

                return GuardianSummaryResult(
                    summary=cached[
                        "guardian_summary"
                    ],

                    source=(
                        CheckInSummarySource
                        .GEMINI
                    ),

                    cache_hit=True,
                )

            generated_summary = (
                self.gemini_summary_service
                .generate_summary(
                    analysis=analysis,
                )
            )

            if generated_summary is None:
                logger.info(
                    "Using rule-based check-in summary. "
                    "seniorId=%s reason=gemini-failed",
                    request.senior_id,
                )

                # Gemini 실패 결과는 저장하지 않는다.
                # 다음 요청에서 다시 Gemini 호출을 시도할 수 있다.
                return GuardianSummaryResult(
                    summary=fallback_summary,

                    source=(
                        CheckInSummarySource
                        .RULE_BASED
                    ),

                    cache_hit=False,
                )

            summary_cache.save(
                senior_id=request.senior_id,

                signature=signature,

                guardian_summary=(
                    generated_summary
                ),

                summary_source=(
                    CheckInSummarySource
                    .GEMINI
                    .value
                ),

                model_name=model_name,
            )

            logger.info(
                "Gemini check-in summary generated "
                "and cached. "
                "seniorId=%s signature=%s",
                request.senior_id,
                signature[:12],
            )

            return GuardianSummaryResult(
                summary=generated_summary,

                source=(
                    CheckInSummarySource
                    .GEMINI
                ),

                cache_hit=False,
            )

    def _should_generate(
        self,
        *,
        analysis: CheckInAnalysisCore,
    ) -> bool:
        """
        Gemini를 호출할 수 있는 상태인지 확인한다.
        """
        if not (
            self.gemini_summary_service
            .is_configured()
        ):
            return False

        if not analysis.has_data:
            return False

        if not analysis.has_closed_data:
            return False

        # 종료된 기록이 2건 미만이면
        # 규칙 기반 안내문만 사용한다.
        if (
            analysis.risk_level
            == CheckInAnalysisLevel.INSUFFICIENT
        ):
            return False

        return True