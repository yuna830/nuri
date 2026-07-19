from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    document_ai_enabled: bool = True
    document_ai_allowed_sources: str = "GUARDIAN_WEB"
    google_cloud_project: str = ""
    google_cloud_location: str = "us"
    google_document_ai_processor_id: str = ""
    document_ai_history_db: str = "document_ai_history.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_sources(self) -> set[str]:
        return {value.strip() for value in self.document_ai_allowed_sources.split(",") if value.strip()}


settings = Settings()

