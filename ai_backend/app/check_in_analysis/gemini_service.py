from __future__ import annotations

import logging
import os
from typing import Optional

from google import genai
from google.genai import types

from app.check_in_analysis.models import (
    CheckInAnalysisCore,
    GeminiSummaryOutput,
)


logger = logging.getLogger(__name__)


class GeminiSummaryService:
    """
    규칙 기반 안부 분석 결과를
    보호자가 이해하기 쉬운 문장으로 변환한다.

    Gemini는 위험 단계를 계산하거나 변경하지 않는다.
    """

    def __init__(self) -> None:
        self.enabled = self._read_boolean(
            os.getenv(
                "GEMINI_ENABLED",
                "true",
            )
        )

        self.api_key = os.getenv(
            "GEMINI_API_KEY",
            "",
        ).strip()

        self.model = os.getenv(
            "GEMINI_MODEL",
            "gemini-3.1-flash-lite",
        ).strip()

        self.timeout_ms = self._read_positive_integer(
            os.getenv(
                "GEMINI_TIMEOUT_MS",
                "10000",
            ),
            default_value=10000,
        )

    def is_configured(self) -> bool:
        return (
            self.enabled
            and bool(self.api_key)
            and bool(self.model)
        )

    def generate_summary(
        self,
        analysis: CheckInAnalysisCore,
    ) -> Optional[str]:
        """
        Gemini 호출에 성공하면 보호자 안내문을 반환한다.

        설정 누락이나 호출 실패 시 None을 반환하고,
        router에서 규칙 기반 안내문으로 대체한다.
        """

        if not self.is_configured():
            logger.info(
                "Gemini summary is disabled "
                "or API key is not configured."
            )
            return None

        if not analysis.has_data:
            return None

        prompt = self._create_prompt(analysis)

        client: Optional[genai.Client] = None

        try:
            client = genai.Client(
                api_key=self.api_key,
                http_options={
                    "timeout": self.timeout_ms,
                },
            )

            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=250,
                    response_mime_type="application/json",
                    response_schema=GeminiSummaryOutput,
                ),
            )

            parsed_response = self._parse_response(
                response=response
            )

            if parsed_response is None:
                logger.warning(
                    "Gemini returned an empty "
                    "check-in summary."
                )
                return None

            summary = (
                parsed_response.guardian_summary
                .replace("\n", " ")
                .strip()
            )

            if not summary:
                return None

            return summary

        except Exception as exception:
            # API 키, 프롬프트, 응답 전문은 로그로 남기지 않는다.
            logger.warning(
                "Gemini check-in summary failed. "
                "errorType=%s",
                type(exception).__name__,
            )

            return None

        finally:
            if client is not None:
                try:
                    client.close()
                except Exception:
                    logger.debug(
                        "Gemini client close failed.",
                        exc_info=False,
                    )

    def _parse_response(
        self,
        response: object,
    ) -> Optional[GeminiSummaryOutput]:
        """
        SDK의 parsed 결과를 우선 사용하고,
        없으면 response.text JSON을 직접 검증한다.
        """

        parsed = getattr(
            response,
            "parsed",
            None,
        )

        if isinstance(
            parsed,
            GeminiSummaryOutput,
        ):
            return parsed

        if isinstance(parsed, dict):
            return GeminiSummaryOutput.model_validate(
                parsed
            )

        response_text = getattr(
            response,
            "text",
            None,
        )

        if not response_text:
            return None

        return GeminiSummaryOutput.model_validate_json(
            response_text
        )

    def _create_prompt(
        self,
        analysis: CheckInAnalysisCore,
    ) -> str:
        reasons = (
            " / ".join(analysis.risk_reasons)
            if analysis.risk_reasons
            else "별도 판정 근거 없음"
        )

        response_rate = (
            f"{analysis.response_rate:.1f}%"
            if analysis.response_rate is not None
            else "계산되지 않음"
        )

        average_response_minutes = (
            f"{analysis.average_response_minutes:.1f}분"
            if analysis.average_response_minutes
            is not None
            else "계산되지 않음"
        )

        return f"""
당신은 고령자 돌봄 서비스에서 보호자에게
최근 안부 확인 결과를 설명하는 안내 도우미입니다.

아래 값은 서버의 규칙 엔진이 계산한 확정 결과입니다.
위험 등급을 변경하거나 새로 판정하지 마세요.
질병, 사고 또는 의학적 상태를 추측하지 마세요.
입력되지 않은 사실을 만들어내지 마세요.

보호자가 바로 이해할 수 있는 자연스러운 한국어로
1~2문장을 작성하세요.

첫 문장:
최근 안부 요청과 응답 현황을 요약하세요.

두 번째 문장:
확정 위험 단계에 맞춰 보호자가 취할 행동을 안내하세요.

NORMAL이면 기존 안부 확인을 유지하도록 안내하세요.
CAUTION이면 오늘 중 전화 확인을 권장하세요.
URGENT이면 가능한 한 빠른 전화 또는 방문 확인을 권장하세요.
INSUFFICIENT이면 기록이 더 필요하다고 안내하세요.

제목, 글머리표, 마크다운은 사용하지 마세요.
어르신의 이름, 전화번호, 주소는 언급하지 마세요.

분석 기간: 최근 {analysis.period_days}일
전체 요청: {analysis.request_count}회
종료된 요청: {analysis.closed_request_count}회
응답 완료: {analysis.responded_count}회
미응답: {analysis.missed_count}회
대기 중: {analysis.pending_count}회
응답률: {response_rate}
평균 응답 시간: {average_response_minutes}
연속 미응답: {analysis.consecutive_missed_count}회
확정 위험 단계: {analysis.risk_level.value}
확정 상태 문구: {analysis.risk_label}
판정 근거: {reasons}
""".strip()

    def _read_boolean(
        self,
        value: str,
    ) -> bool:
        return value.strip().lower() in {
            "true",
            "1",
            "yes",
            "y",
            "on",
        }

    def _read_positive_integer(
        self,
        value: str,
        default_value: int,
    ) -> int:
        try:
            parsed_value = int(value)

            if parsed_value <= 0:
                return default_value

            return parsed_value

        except (TypeError, ValueError):
            return default_value