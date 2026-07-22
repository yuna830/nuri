from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import threading

from contextlib import contextmanager
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any, Iterator


# Gemini 프롬프트 내용을 수정하면
# v2, v3처럼 버전을 올려 기존 캐시를 무효화한다.
PROMPT_VERSION = "check-in-summary-v1"


DEFAULT_CACHE_DB_PATH = (
    Path.cwd()
    / "data"
    / "check_in_summary_cache.sqlite3"
)


CACHE_DB_PATH = Path(
    os.getenv(
        "CHECK_IN_SUMMARY_CACHE_DB",
        str(DEFAULT_CACHE_DB_PATH),
    ),
).resolve()


def _to_snake_case(
    value: str,
) -> str:
    """
    camelCase 문자열을 snake_case로 변환한다.

    예:
    seniorId -> senior_id
    checkIns -> check_ins
    """
    return re.sub(
        r"(?<!^)(?=[A-Z])",
        "_",
        value,
    ).lower()


def _to_camel_case(
    value: str,
) -> str:
    """
    snake_case 문자열을 camelCase로 변환한다.

    예:
    senior_id -> seniorId
    check_ins -> checkIns
    """
    parts = value.split("_")

    return parts[0] + "".join(
        part[:1].upper() + part[1:]
        for part in parts[1:]
    )


def read_value(
    target: Any,
    field_name: str,
    default: Any = None,
) -> Any:
    """
    dict, Pydantic 모델, 일반 객체를 모두 지원한다.

    snake_case와 camelCase 필드명을 모두 확인한다.
    """
    if target is None:
        return default

    candidate_names = (
        field_name,
        _to_snake_case(field_name),
        _to_camel_case(field_name),
    )

    if isinstance(target, dict):
        for candidate_name in candidate_names:
            if candidate_name in target:
                return target[candidate_name]

        return default

    for candidate_name in candidate_names:
        if hasattr(
            target,
            candidate_name,
        ):
            return getattr(
                target,
                candidate_name,
            )

    return default


def normalize_scalar(
    value: Any,
) -> Any:
    """
    Enum은 실제 value 문자열로 변환한다.
    """
    if isinstance(value, Enum):
        return value.value

    return value


def normalize_datetime(
    value: Any,
) -> str | None:
    """
    날짜 값을 캐시 키에 사용할 수 있는 문자열로 변환한다.
    """
    if value is None:
        return None

    if isinstance(
        value,
        (datetime, date),
    ):
        return value.isoformat()

    return str(value)


def normalize_check_in(
    check_in: Any,
) -> dict[str, Any]:
    """
    개별 안부 기록을 캐시 키 생성용 형식으로 변환한다.
    """
    raw_status = read_value(
        check_in,
        "status",
        "",
    )

    normalized_status = normalize_scalar(
        raw_status,
    )

    return {
        "checkInId": read_value(
            check_in,
            "check_in_id",
        ),

        "status": str(
            normalized_status
            or ""
        ).upper(),

        "requestedAt": normalize_datetime(
            read_value(
                check_in,
                "requested_at",
            ),
        ),

        "respondedAt": normalize_datetime(
            read_value(
                check_in,
                "responded_at",
            ),
        ),
    }


def build_analysis_signature(
    request: Any,
    analysis: Any,
    model_name: str,
) -> str:
    """
    동일한 안부 기록인지 판단할 SHA-256 서명을 만든다.

    새로고침 때마다 달라지는 다음 값은 제외한다.

    - period_start
    - period_end
    - calculated_at

    다음 값이 달라지면 새로운 서명을 만든다.

    - 어르신 ID
    - 최근 안부 기록
    - 요청 상태
    - 응답 시각
    - 규칙 기반 분석 결과
    - Gemini 모델
    - 프롬프트 버전
    """
    raw_check_ins = (
        read_value(
            request,
            "check_ins",
            [],
        )
        or []
    )

    normalized_check_ins = [
        normalize_check_in(
            check_in,
        )
        for check_in in raw_check_ins
    ]

    normalized_check_ins.sort(
        key=lambda item: (
            item["requestedAt"] or "",
            item["checkInId"] or 0,
        ),
    )

    latest_check_in = (
        normalized_check_ins[-1]
        if normalized_check_ins
        else None
    )

    raw_risk_level = read_value(
        analysis,
        "risk_level",
        "",
    )

    normalized_risk_level = (
        normalize_scalar(
            raw_risk_level,
        )
    )

    signature_payload = {
        "promptVersion": (
            PROMPT_VERSION
        ),

        "model": model_name,

        "seniorId": read_value(
            request,
            "senior_id",
        ),

        "periodDays": read_value(
            request,
            "period_days",
        ),

        "latestCheckIn": (
            latest_check_in
        ),

        "checkIns": (
            normalized_check_ins
        ),

        "analysis": {
            "hasData": read_value(
                analysis,
                "has_data",
            ),

            "hasClosedData": read_value(
                analysis,
                "has_closed_data",
            ),

            "requestCount": read_value(
                analysis,
                "request_count",
            ),

            "closedRequestCount": read_value(
                analysis,
                "closed_request_count",
            ),

            "respondedCount": read_value(
                analysis,
                "responded_count",
            ),

            "missedCount": read_value(
                analysis,
                "missed_count",
            ),

            "pendingCount": read_value(
                analysis,
                "pending_count",
            ),

            "responseRate": read_value(
                analysis,
                "response_rate",
            ),

            "averageResponseMinutes": (
                read_value(
                    analysis,
                    "average_response_minutes",
                )
            ),

            "consecutiveMissedCount": (
                read_value(
                    analysis,
                    "consecutive_missed_count",
                )
            ),

            "latestStatus": normalize_scalar(
                read_value(
                    analysis,
                    "latest_status",
                ),
            ),

            "riskLevel": (
                normalized_risk_level
            ),

            "riskLabel": read_value(
                analysis,
                "risk_label",
            ),

            "riskReasons": read_value(
                analysis,
                "risk_reasons",
                [],
            ),
        },
    }

    canonical_json = json.dumps(
        signature_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(
            ",",
            ":",
        ),
        default=str,
    )

    return hashlib.sha256(
        canonical_json.encode(
            "utf-8",
        ),
    ).hexdigest()


class CheckInSummaryCache:
    """
    어르신별 최신 Gemini 안내문을 SQLite에 저장한다.

    한 어르신당 최신 캐시 한 건만 보관한다.
    """

    def __init__(
        self,
        database_path: Path = CACHE_DB_PATH,
    ) -> None:
        self.database_path = (
            database_path
        )

        self.database_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        self._database_lock = (
            threading.RLock()
        )

        self._senior_locks_guard = (
            threading.Lock()
        )

        self._senior_locks: dict[
            int,
            threading.Lock,
        ] = {}

        self._initialize_database()

    @contextmanager
    def _connect(
        self,
    ) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(
            str(
                self.database_path,
            ),
            timeout=10,
            check_same_thread=False,
        )

        connection.row_factory = (
            sqlite3.Row
        )

        try:
            yield connection
            connection.commit()

        except Exception:
            connection.rollback()
            raise

        finally:
            connection.close()

    def _initialize_database(
        self,
    ) -> None:
        """
        캐시 테이블과 인덱스를 생성한다.
        """
        with self._database_lock:
            with self._connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS
                    check_in_summary_cache (
                        senior_id INTEGER
                            PRIMARY KEY,

                        signature TEXT
                            NOT NULL,

                        guardian_summary TEXT
                            NOT NULL,

                        summary_source TEXT
                            NOT NULL,

                        model_name TEXT
                            NOT NULL,

                        prompt_version TEXT
                            NOT NULL,

                        created_at TEXT
                            NOT NULL,

                        updated_at TEXT
                            NOT NULL
                    )
                    """,
                )

                connection.execute(
                    """
                    CREATE INDEX IF NOT EXISTS
                    idx_check_in_summary_signature
                    ON check_in_summary_cache (
                        signature
                    )
                    """,
                )

    def get(
        self,
        senior_id: int,
        signature: str,
    ) -> dict[str, Any] | None:
        """
        어르신 ID와 분석 서명이 모두 일치하는 캐시를 조회한다.
        """
        with self._database_lock:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT
                        senior_id,
                        signature,
                        guardian_summary,
                        summary_source,
                        model_name,
                        prompt_version,
                        created_at,
                        updated_at
                    FROM check_in_summary_cache
                    WHERE senior_id = ?
                      AND signature = ?
                    """,
                    (
                        senior_id,
                        signature,
                    ),
                ).fetchone()

        if row is None:
            return None

        return dict(row)

    def save(
        self,
        *,
        senior_id: int,
        signature: str,
        guardian_summary: str,
        summary_source: str,
        model_name: str,
    ) -> None:
        """
        Gemini 안내문을 저장한다.

        같은 어르신의 기존 캐시는 최신 결과로 교체한다.
        """
        now = datetime.now().isoformat()

        with self._database_lock:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO
                    check_in_summary_cache (
                        senior_id,
                        signature,
                        guardian_summary,
                        summary_source,
                        model_name,
                        prompt_version,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    ON CONFLICT (
                        senior_id
                    )
                    DO UPDATE SET
                        signature =
                            excluded.signature,

                        guardian_summary =
                            excluded.guardian_summary,

                        summary_source =
                            excluded.summary_source,

                        model_name =
                            excluded.model_name,

                        prompt_version =
                            excluded.prompt_version,

                        created_at =
                            excluded.created_at,

                        updated_at =
                            excluded.updated_at
                    """,
                    (
                        senior_id,
                        signature,
                        guardian_summary,
                        summary_source,
                        model_name,
                        PROMPT_VERSION,
                        now,
                        now,
                    ),
                )

    def delete_for_senior(
        self,
        senior_id: int,
    ) -> None:
        """
        특정 어르신의 캐시만 삭제한다.
        """
        with self._database_lock:
            with self._connect() as connection:
                connection.execute(
                    """
                    DELETE FROM
                    check_in_summary_cache
                    WHERE senior_id = ?
                    """,
                    (
                        senior_id,
                    ),
                )

    def clear(
        self,
    ) -> None:
        """
        전체 캐시를 삭제한다.
        """
        with self._database_lock:
            with self._connect() as connection:
                connection.execute(
                    """
                    DELETE FROM
                    check_in_summary_cache
                    """,
                )

    def get_senior_lock(
        self,
        senior_id: int,
    ) -> threading.Lock:
        """
        동일한 어르신 요청이 동시에 여러 번 들어와도
        Gemini를 한 번만 호출하도록 잠금을 반환한다.
        """
        with self._senior_locks_guard:
            lock = self._senior_locks.get(
                senior_id,
            )

            if lock is None:
                lock = threading.Lock()

                self._senior_locks[
                    senior_id
                ] = lock

            return lock


summary_cache = CheckInSummaryCache()