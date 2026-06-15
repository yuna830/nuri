from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str
    groq_api_key: str

    gemini_embedding_model: str = "models/gemini-embedding-001"
    groq_model: str = "llama-3.1-8b-instant"

    qdrant_url: str
    qdrant_api_key: str
    qdrant_collection: str = "welfare_documents"

    database_url: str
    spring_upload_root: str = "C:/github/nuri/woorispring/uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    public_welfare_service_key: str
    public_welfare_list_url: str
    public_welfare_detail_url: str


settings = Settings()
