# ai_backend — 누리 복지 RAG API

복지 정책 문서를 벡터 DB에 임베딩하고, 사용자 질문에 RAG 방식으로 답변하는 FastAPI 백엔드.

## 기술 스택

| 역할 | 도구 |
|------|------|
| 웹 프레임워크 | FastAPI + Uvicorn |
| 임베딩 모델 | Gemini (`gemini-embedding-001`) |
| LLM | Groq (`llama-3.1-8b-instant`) |
| 벡터 DB | Qdrant Cloud |
| 메타데이터 DB | PostgreSQL |
| 검색 방식 | Hybrid Search (벡터 + BM25 키워드) |
| PDF 파싱 | PyMuPDF |

## 디렉토리 구조

ai_backend/
├── app/
│   ├── api/          # 라우터 (chat, upload, public-welfare, rag-documents)
│   ├── core/         # 설정 (config.py)
│   └── services/     # 비즈니스 로직
│       ├── rag_service.py          # RAG 메인 흐름
│       ├── embedding_service.py    # Gemini 임베딩
│       ├── qdrant_service.py       # 벡터 DB CRUD + 하이브리드 검색
│       ├── groq_service.py         # LLM 응답 생성
│       └── ...
├── embed_welfare_docs.py  # woori-vault 복지정책 문서 일괄 임베딩 스크립트
└── requirements.txt

## 환경 변수 설정

.env.example 파일을 복사하여 .env 생성:

\`\`\`bash
cp .env.example .env
\`\`\`

필수 항목:

\`\`\`
GEMINI_API_KEY=...
GROQ_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
DATABASE_URL=postgresql+psycopg://...
PUBLIC_WELFARE_SERVICE_KEY=...
\`\`\`

## 실행 방법

\`\`\`bash
pip install -r requirements.txt
uvicorn app.main:app --reload
\`\`\`

## 초기 세팅 (최초 1회)

\`\`\`bash
# Qdrant 컬렉션 생성
POST /setup/qdrant

# 페이로드 인덱스 생성
POST /setup/qdrant/indexes
\`\`\`

## 복지정책 문서 임베딩

woori-vault/복지정책/ 폴더의 마크다운 파일을 Qdrant에 업로드:

\`\`\`bash
python embed_welfare_docs.py               # 전체 임베딩
python embed_welfare_docs.py --file 파일명.md  # 특정 파일만
python embed_welfare_docs.py --delete      # 기존 삭제 후 재임베딩
\`\`\`

## 주요 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /health | 서버 상태 확인 |
| POST | /api/chat | RAG 질의응답 (qa / recommend 모드) |
| POST | /api/upload | PDF 문서 업로드 및 임베딩 |
| GET | /api/public-welfare | 공공 복지 서비스 목록 조회 |
| POST | /api/rag-documents/embed-document | 문서 직접 임베딩 |
