from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    """
    Python의 snake_case 필드명을
    Spring/Jackson에서 사용하는 camelCase로 변환한다.

    예:
    senior_id -> seniorId
    requested_at -> requestedAt
    """
    parts = value.split("_")

    return parts[0] + "".join(
        part[:1].upper() + part[1:]
        for part in parts[1:]
    )


class CamelCaseModel(BaseModel):
    """
    Spring과 통신할 때 camelCase JSON을 사용하기 위한
    공통 Pydantic 모델.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
        str_strip_whitespace=True,
    )


class CheckInStatus(str, Enum):
    """
    안부 요청 상태.
    """

    PENDING = "PENDING"
    RESPONDED = "RESPONDED"
    MISSED = "MISSED"


class CheckInAnalysisLevel(str, Enum):
    """
    최근 안부 기록의 규칙 기반 위험 단계.
    """

    INSUFFICIENT = "INSUFFICIENT"
    NORMAL = "NORMAL"
    CAUTION = "CAUTION"
    URGENT = "URGENT"


class CheckInSummarySource(str, Enum):
    """
    보호자용 안내문 생성 출처.
    """

    GEMINI = "GEMINI"
    RULE_BASED = "RULE_BASED"


class CheckInAnalysisRecordRequest(CamelCaseModel):
    """
    Spring에서 FastAPI로 전달하는 개별 안부 기록.
    """

    check_in_id: int = Field(
        description="안부 요청 ID"
    )

    status: CheckInStatus = Field(
        description="PENDING, RESPONDED 또는 MISSED"
    )

    requested_at: datetime = Field(
        description="안부 요청 시각"
    )

    responded_at: Optional[datetime] = Field(
        default=None,
        description="어르신 응답 시각"
    )


class CheckInAnalysisRequest(CamelCaseModel):
    """
    Spring에서 FastAPI로 전달하는 안부 분석 요청.
    """

    senior_id: int = Field(
        description="분석 대상 어르신 ID"
    )

    period_days: int = Field(
        default=7,
        ge=1,
        le=30,
        description="분석 기간"
    )

    period_start: datetime = Field(
        description="분석 시작 시각"
    )

    period_end: datetime = Field(
        description="분석 종료 시각"
    )

    check_ins: list[CheckInAnalysisRecordRequest] = Field(
        default_factory=list,
        description="최근 안부 요청 기록"
    )


class MissedCheckInResponse(CamelCaseModel):
    """
    미응답으로 종료된 안부 요청.
    """

    check_in_id: int

    requested_at: datetime


class CheckInAnalysisCore(CamelCaseModel):
    """
    Gemini 호출 전 규칙 기반 분석 결과.
    """

    senior_id: int

    period_days: int

    period_start: datetime

    period_end: datetime

    has_data: bool

    has_closed_data: bool

    request_count: int

    closed_request_count: int

    responded_count: int

    missed_count: int

    pending_count: int

    response_rate: Optional[float]

    average_response_minutes: Optional[float]

    consecutive_missed_count: int

    missed_records: list[MissedCheckInResponse]

    latest_status: Optional[str]

    latest_requested_at: Optional[datetime]

    latest_responded_at: Optional[datetime]

    risk_level: CheckInAnalysisLevel

    risk_label: str

    risk_reasons: list[str]

    calculated_at: datetime


class CheckInAnalysisResponse(CheckInAnalysisCore):
    """
    Spring과 React에 최종 반환하는 안부 분석 결과.
    """

    guardian_summary: str = Field(
        description="보호자에게 보여줄 안내문"
    )

    summary_source: CheckInSummarySource = Field(
        description="GEMINI 또는 RULE_BASED"
    )


class GeminiSummaryOutput(BaseModel):
    """
    Gemini 구조화 출력 형식.

    위험도는 Gemini가 반환하지 않는다.
    Gemini는 이미 계산된 분석 결과를 설명하는 문장만 생성한다.
    """

    guardian_summary: str = Field(
        min_length=1,
        max_length=500,
        description=(
            "최근 안부 현황 요약과 보호자 행동 안내를 "
            "포함한 자연스러운 한국어 1~2문장"
        ),
    )