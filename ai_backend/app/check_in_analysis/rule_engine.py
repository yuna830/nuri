from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.check_in_analysis.models import (
    CheckInAnalysisCore,
    CheckInAnalysisLevel,
    CheckInAnalysisRequest,
    CheckInAnalysisRecordRequest,
    CheckInStatus,
    MissedCheckInResponse,
)


MIN_CLOSED_REQUEST_COUNT = 2

CAUTION_RESPONSE_RATE = 80.0

URGENT_RESPONSE_RATE = 50.0

CAUTION_MISSED_COUNT = 2

CAUTION_AVERAGE_RESPONSE_MINUTES = 20.0

URGENT_CONSECUTIVE_MISSED_COUNT = 2


RISK_LABELS: dict[CheckInAnalysisLevel, str] = {
    CheckInAnalysisLevel.INSUFFICIENT: "분석 데이터 부족",
    CheckInAnalysisLevel.NORMAL: "정상",
    CheckInAnalysisLevel.CAUTION: "확인 필요",
    CheckInAnalysisLevel.URGENT: "빠른 확인 필요",
}


class CheckInRuleEngine:
    """
    최근 안부 기록을 통계화하고
    위험 단계를 규칙으로 판정한다.

    Gemini는 이 클래스가 계산한 위험 단계를 변경하지 않는다.
    """

    def analyze(
        self,
        request: CheckInAnalysisRequest,
    ) -> CheckInAnalysisCore:
        records = sorted(
            request.check_ins,
            key=lambda record: record.requested_at,
            reverse=True,
        )

        request_count = len(records)

        responded_count = sum(
            1
            for record in records
            if record.status == CheckInStatus.RESPONDED
        )

        missed_count = sum(
            1
            for record in records
            if record.status == CheckInStatus.MISSED
        )

        pending_count = sum(
            1
            for record in records
            if record.status == CheckInStatus.PENDING
        )

        closed_request_count = (
            responded_count + missed_count
        )

        response_rate = self._calculate_response_rate(
            responded_count=responded_count,
            closed_request_count=closed_request_count,
        )

        average_response_minutes = (
            self._calculate_average_response_minutes(
                records=records
            )
        )

        consecutive_missed_count = (
            self._calculate_consecutive_missed_count(
                records=records
            )
        )

        missed_records = [
            MissedCheckInResponse(
                check_in_id=record.check_in_id,
                requested_at=record.requested_at,
            )
            for record in records
            if record.status == CheckInStatus.MISSED
        ]

        latest_record = (
            records[0]
            if records
            else None
        )

        latest_closed_record = next(
            (
                record
                for record in records
                if record.status != CheckInStatus.PENDING
            ),
            None,
        )

        risk_level, risk_reasons = self._evaluate_risk(
            closed_request_count=closed_request_count,
            missed_count=missed_count,
            response_rate=response_rate,
            average_response_minutes=(
                average_response_minutes
            ),
            consecutive_missed_count=(
                consecutive_missed_count
            ),
            latest_closed_record=latest_closed_record,
        )

        return CheckInAnalysisCore(
            senior_id=request.senior_id,
            period_days=request.period_days,
            period_start=request.period_start,
            period_end=request.period_end,
            has_data=request_count > 0,
            has_closed_data=closed_request_count > 0,
            request_count=request_count,
            closed_request_count=closed_request_count,
            responded_count=responded_count,
            missed_count=missed_count,
            pending_count=pending_count,
            response_rate=response_rate,
            average_response_minutes=(
                average_response_minutes
            ),
            consecutive_missed_count=(
                consecutive_missed_count
            ),
            missed_records=missed_records,
            latest_status=(
                latest_record.status.value
                if latest_record is not None
                else None
            ),
            latest_requested_at=(
                latest_record.requested_at
                if latest_record is not None
                else None
            ),
            latest_responded_at=(
                latest_record.responded_at
                if latest_record is not None
                else None
            ),
            risk_level=risk_level,
            risk_label=RISK_LABELS[risk_level],
            risk_reasons=risk_reasons,
            calculated_at=datetime.now(),
        )

    def create_fallback_summary(
        self,
        analysis: CheckInAnalysisCore,
    ) -> str:
        """
        Gemini 비활성화, 키 누락, 호출 오류가 발생했을 때
        반환할 규칙 기반 보호자 안내문.
        """

        if analysis.risk_level == (
            CheckInAnalysisLevel.INSUFFICIENT
        ):
            return (
                "최근 안부 기록이 충분하지 않아 "
                "응답 흐름을 판단하기 어렵습니다. "
                "안부 요청을 이어가며 기록을 확인해 주세요."
            )

        if analysis.risk_level == (
            CheckInAnalysisLevel.NORMAL
        ):
            return (
                f"최근 {analysis.period_days}일 안부 응답은 "
                "정상 범위입니다. "
                "기존 방식대로 안부 확인을 이어가 주세요."
            )

        if analysis.risk_level == (
            CheckInAnalysisLevel.CAUTION
        ):
            return (
                f"최근 {analysis.period_days}일 안부 응답에서 "
                "확인이 필요한 항목이 있습니다. "
                "오늘 중 전화로 최근 상태를 확인해 주세요."
            )

        return (
            "최근 안부 요청에서 연속 미응답 또는 "
            "낮은 응답률이 확인되었습니다. "
            "가능한 한 빠르게 전화나 방문으로 "
            "현재 상태를 확인해 주세요."
        )

    def _evaluate_risk(
        self,
        closed_request_count: int,
        missed_count: int,
        response_rate: Optional[float],
        average_response_minutes: Optional[float],
        consecutive_missed_count: int,
        latest_closed_record: Optional[
            CheckInAnalysisRecordRequest
        ],
    ) -> tuple[CheckInAnalysisLevel, list[str]]:
        """
        규칙 기반 위험도 판정.
        """

        if closed_request_count < MIN_CLOSED_REQUEST_COUNT:
            return (
                CheckInAnalysisLevel.INSUFFICIENT,
                [
                    "최근 종료된 안부 기록이 2건 미만이어서 "
                    "상태를 판단하기 어렵습니다."
                ],
            )

        urgent_reasons: list[str] = []

        if (
            consecutive_missed_count
            >= URGENT_CONSECUTIVE_MISSED_COUNT
        ):
            urgent_reasons.append(
                f"최근 {consecutive_missed_count}회 연속으로 "
                "안부 요청에 응답하지 않았습니다."
            )

        if (
            response_rate is not None
            and response_rate < URGENT_RESPONSE_RATE
        ):
            urgent_reasons.append(
                f"최근 응답률이 {response_rate:.1f}%로 "
                "50% 미만입니다."
            )

        if urgent_reasons:
            return (
                CheckInAnalysisLevel.URGENT,
                urgent_reasons,
            )

        caution_reasons: list[str] = []

        if (
            latest_closed_record is not None
            and latest_closed_record.status
            == CheckInStatus.MISSED
        ):
            caution_reasons.append(
                "가장 최근에 종료된 안부 요청이 "
                "미응답입니다."
            )

        if (
            response_rate is not None
            and response_rate < CAUTION_RESPONSE_RATE
        ):
            caution_reasons.append(
                f"최근 응답률이 {response_rate:.1f}%로 "
                "기준인 80%보다 낮습니다."
            )

        if missed_count >= CAUTION_MISSED_COUNT:
            caution_reasons.append(
                f"최근 분석 기간 동안 미응답이 "
                f"{missed_count}회 확인되었습니다."
            )

        if (
            average_response_minutes is not None
            and average_response_minutes
            >= CAUTION_AVERAGE_RESPONSE_MINUTES
        ):
            caution_reasons.append(
                f"평균 응답 시간이 "
                f"{average_response_minutes:.1f}분으로 "
                "20분 이상입니다."
            )

        if caution_reasons:
            return (
                CheckInAnalysisLevel.CAUTION,
                caution_reasons,
            )

        return (
            CheckInAnalysisLevel.NORMAL,
            [
                "최근 안부 응답률과 미응답 기록이 "
                "정상 범위입니다."
            ],
        )

    def _calculate_response_rate(
        self,
        responded_count: int,
        closed_request_count: int,
    ) -> Optional[float]:
        """
        대기 중인 PENDING은 응답률 계산에서 제외한다.
        """

        if closed_request_count == 0:
            return None

        value = (
            responded_count
            * 100.0
            / closed_request_count
        )

        return self._round_one_decimal(value)

    def _calculate_average_response_minutes(
        self,
        records: list[CheckInAnalysisRecordRequest],
    ) -> Optional[float]:
        """
        RESPONDED 기록 중 요청 시각과 응답 시각이
        모두 정상인 기록의 평균 응답 시간을 계산한다.
        """

        response_minutes: list[float] = []

        for record in records:
            if record.status != CheckInStatus.RESPONDED:
                continue

            if record.responded_at is None:
                continue

            elapsed_seconds = (
                record.responded_at
                - record.requested_at
            ).total_seconds()

            if elapsed_seconds < 0:
                continue

            response_minutes.append(
                elapsed_seconds / 60.0
            )

        if not response_minutes:
            return None

        average = (
            sum(response_minutes)
            / len(response_minutes)
        )

        return self._round_one_decimal(average)

    def _calculate_consecutive_missed_count(
        self,
        records: list[CheckInAnalysisRecordRequest],
    ) -> int:
        """
        최신 종료 기록부터 연속된 미응답 횟수를 계산한다.

        아직 대기 중인 PENDING은 건너뛴다.
        RESPONDED가 나오면 계산을 종료한다.
        """

        consecutive_count = 0

        for record in records:
            if record.status == CheckInStatus.PENDING:
                continue

            if record.status == CheckInStatus.MISSED:
                consecutive_count += 1
                continue

            break

        return consecutive_count

    def _round_one_decimal(
        self,
        value: float,
    ) -> float:
        """
        Java Math.round 방식에 가깝게 소수점 첫째 자리에서
        반올림한다.
        """

        rounded = Decimal(str(value)).quantize(
            Decimal("0.1"),
            rounding=ROUND_HALF_UP,
        )

        return float(rounded)