from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    product_label_ocr_enabled: bool = True
    product_label_ocr_allowed_sources: str = "GUARDIAN_WEB"
    document_ai_history_db: str = "document_ai_history.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_sources(self) -> set[str]:
        return {value.strip() for value in self.product_label_ocr_allowed_sources.split(",") if value.strip()}


settings = Settings()
