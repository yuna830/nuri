import json
import sqlite3
from datetime import datetime, timezone

from app.config import settings


def initialize_history() -> None:
    with sqlite3.connect(settings.document_ai_history_db) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS wl_product_label_analyses (
                analysis_id TEXT PRIMARY KEY,
                senior_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                extracted_fields TEXT NOT NULL,
                warnings TEXT NOT NULL,
                success INTEGER NOT NULL,
                confirmed_fields TEXT,
                registered_product_id INTEGER,
                analyzed_at TEXT NOT NULL,
                confirmed_at TEXT
            )
        """)


def save_analysis(payload: dict) -> None:
    with sqlite3.connect(settings.document_ai_history_db) as connection:
        connection.execute(
            """INSERT INTO wl_product_label_analyses
            (analysis_id, senior_id, source, raw_text, extracted_fields, warnings, success, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                payload["analysisId"], payload["seniorId"], payload["source"], payload["rawText"],
                json.dumps(payload["fields"], ensure_ascii=False),
                json.dumps(payload["warnings"], ensure_ascii=False),
                int(payload["success"]), datetime.now(timezone.utc).isoformat(),
            ),
        )


def confirm_analysis(analysis_id: str, fields: dict, registered_product_id: int | None) -> bool:
    with sqlite3.connect(settings.document_ai_history_db) as connection:
        cursor = connection.execute(
            """UPDATE wl_product_label_analyses
            SET confirmed_fields = ?, registered_product_id = ?, confirmed_at = ?
            WHERE analysis_id = ?""",
            (json.dumps(fields, ensure_ascii=False), registered_product_id,
             datetime.now(timezone.utc).isoformat(), analysis_id),
        )
        return cursor.rowcount > 0

