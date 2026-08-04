from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    google_application_credentials: str | None = None
    product_label_ocr_enabled: bool = True

    product_label_ocr_allowed_sources: str = (
        "GUARDIAN_WEB"
    )

    document_ai_history_db: str = (
        "document_ai_history.db"
    )

    cors_allowed_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_sources(
        self,
    ) -> set[str]:
        return {
            value.strip()
            for value
            in self.product_label_ocr_allowed_sources
            .split(",")
            if value.strip()
        }

    @property
    def cors_origins(
        self,
    ) -> list[str]:
        return [
            value.strip()
            for value
            in self.cors_allowed_origins
            .split(",")
            if value.strip()
        ]


settings = Settings()
