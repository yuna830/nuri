from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str
    groq_api_key: str

    gemini_embedding_model: str = "models/gemini-embedding-001"
    groq_model: str = "llama-3.1-8b-instant"
    gemini_timeout_seconds: float = 15
    groq_timeout_seconds: float = 25
    qdrant_timeout_seconds: float = 15
    embedding_max_retries: int = 2
    embedding_max_retry_delay_seconds: int = 5

    qdrant_url: str
    qdrant_api_key: str
    qdrant_collection: str = "welfare_documents"

    database_url: str
    spring_upload_root: str = "C:/github/nuri/woorispring/uploads"
    cors_allowed_origins: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    public_welfare_service_key: str
    public_welfare_list_url: str
    public_welfare_detail_url: str

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
