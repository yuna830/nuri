import json
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # 제품 라벨 OCR 활성화 여부
    product_label_ocr_enabled: bool = True

    # 제품 등록을 허용하는 클라이언트 경로
    allowed_sources_raw: str = (
        "GUARDIAN_WEB,WELFARE_WEB,SENIOR_APP,"
        "GUARDIAN,SENIOR,WELFARE_WORKER"
    )

    # CORS 허용 출처
    cors_origins_raw: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://woori-link-react.vercel.app"
    )

    # Google Cloud 관련 환경변수
    google_cloud_project: str | None = None
    google_application_credentials: str | None = None

    @property
    def allowed_sources(self) -> set[str]:
        return {
            value.strip()
            for value in self.allowed_sources_raw.split(",")
            if value.strip()
        }

    @property
    def cors_origins(self) -> list[str]:
        raw_value = self.cors_origins_raw.strip()

        if not raw_value:
            return []

        # JSON 배열 형식도 지원
        # 예: ["http://localhost:5173", "https://woori-link-react.vercel.app"]
        if raw_value.startswith("["):
            try:
                parsed = json.loads(raw_value)

                if isinstance(parsed, list):
                    return [
                        str(value).strip()
                        for value in parsed
                        if str(value).strip()
                    ]
            except json.JSONDecodeError:
                pass

        # 쉼표 구분 형식 지원
        return [
            value.strip()
            for value in raw_value.split(",")
            if value.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        product_label_ocr_enabled=os.getenv(
            "PRODUCT_LABEL_OCR_ENABLED",
            "true",
        ).lower()
        in {
            "true",
            "1",
            "yes",
            "on",
        },
        allowed_sources_raw=os.getenv(
            "ALLOWED_SOURCES",
            (
                "GUARDIAN_WEB,WELFARE_WEB,SENIOR_APP,"
                "GUARDIAN,SENIOR,WELFARE_WORKER"
            ),
        ),
        cors_origins_raw=os.getenv(
            "CORS_ORIGINS",
            (
                "http://localhost:5173,"
                "http://127.0.0.1:5173,"
                "https://woori-link-react.vercel.app"
            ),
        ),
        google_cloud_project=os.getenv(
            "GOOGLE_CLOUD_PROJECT",
        ),
        google_application_credentials=os.getenv(
            "GOOGLE_APPLICATION_CREDENTIALS",
        ),
    )


settings = get_settings()