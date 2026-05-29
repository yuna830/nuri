from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.api.chat import router as chat_router
from app.api.upload import router as upload_router
from app.api.public_welfare import router as public_welfare_router
from app.api import rag_documents

from app.core.config import settings
from app.services.embedding_service import EmbeddingService
from app.services.qdrant_service import QdrantService


app = FastAPI(
    title="Nuri Welfare RAG API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])
app.include_router(public_welfare_router, prefix="/api/public-welfare", tags=["public-welfare"])
app.include_router(rag_documents.router,prefix="/api/rag-documents",tags=["RAG Documents"],)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "qdrant_collection": settings.qdrant_collection,
        "groq_model": settings.groq_model,
        "gemini_embedding_model": settings.gemini_embedding_model,
    }


@app.post("/setup/qdrant")
def setup_qdrant():
    client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
    )

    collections = client.get_collections()
    collection_names = [collection.name for collection in collections.collections]

    if settings.qdrant_collection not in collection_names:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=3072,
                distance=Distance.COSINE,
            ),
        )

    return {
        "status": "ok",
        "collection": settings.qdrant_collection,
    }


@app.get("/health/qdrant")
def qdrant_health_check():
    client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
    )

    collections = client.get_collections()

    return {
        "status": "ok",
        "collections": [collection.name for collection in collections.collections],
    }


@app.get("/health/embedding")
def embedding_health_check():
    embedding_service = EmbeddingService()
    vector = embedding_service.embed_text("기초연금 신청 자격이 궁금합니다.")

    return {
        "status": "ok",
        "dimension": len(vector),
        "sample": vector[:5],
    }

@app.get("/health/qdrant/documents/{document_id}/count")
def qdrant_document_count(document_id: str):
    qdrant_service = QdrantService()

    return {
        "document_id": document_id,
        "qdrant_chunk_count": qdrant_service.count_by_document_id(document_id),
    }

@app.post("/setup/qdrant/reset")
def reset_qdrant():
    qdrant_service = QdrantService()
    qdrant_service.recreate_collection()

    return {
        "status": "ok",
        "collection": settings.qdrant_collection,
    }

@app.post("/setup/qdrant/indexes")
def setup_qdrant_indexes():
    qdrant_service = QdrantService()
    qdrant_service.create_payload_indexes()

    return {
        "status": "ok",
        "collection": settings.qdrant_collection,
    }