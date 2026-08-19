# ai_backend — 누리 복지 RAG API

복지 정책 문서를 벡터 DB에 임베딩하고,  
사용자 질문에 RAG(Retrieval-Augmented Generation) 방식으로 답변하는 FastAPI 기반 AI 백엔드입니다.

---

## 주요 기능

- 복지정책 문서 임베딩
- Qdrant 기반 벡터 검색
- BM25 키워드 검색을 결합한 Hybrid Search
- Gemini Embedding 기반 문서 벡터화
- Groq LLM 기반 최종 응답 생성
- PDF 문서 업로드 및 임베딩
- 공공 복지서비스 정보 조회
- 문서별 메타데이터 관리

---

## 기술 스택

| 역할 | 도구 |
| --- | --- |
| 웹 프레임워크 | FastAPI, Uvicorn |
| 임베딩 모델 | Gemini `gemini-embedding-001` |
| LLM | Groq `llama-3.1-8b-instant` |
| 벡터 DB | Qdrant Cloud |
| 메타데이터 DB | PostgreSQL |
| 검색 방식 | Hybrid Search (Vector + BM25) |
| PDF 파싱 | PyMuPDF |

---

## RAG 처리 흐름

```text
사용자 질문
    ↓
FastAPI
    ↓
질문 전처리
    ↓
Gemini Embedding
    ↓
Hybrid Search
(Vector + BM25)
    ↓
Qdrant 관련 문서 검색
    ↓
관련 문서 Context 구성
    ↓
Groq LLM
    ↓
최종 답변 생성
```

---

## 디렉터리 구조

```text
ai_backend/
├── app/
│   ├── api/
│   │   ├── chat.py
│   │   ├── upload.py
│   │   ├── public_welfare.py
│   │   └── rag_documents.py
│   │
│   ├── core/
│   │   └── config.py
│   │
│   └── services/
│       ├── rag_service.py
│       ├── embedding_service.py
│       ├── qdrant_service.py
│       ├── groq_service.py
│       └── ...
│
├── embed_welfare_docs.py
├── requirements.txt
├── .env.example
└── README.md
```

### 주요 서비스 역할

- `rag_service.py`
  - RAG 전체 처리 흐름 관리
  - 검색 결과와 LLM 응답 연결

- `embedding_service.py`
  - Gemini Embedding 생성
  - 문서 및 사용자 질문 벡터화

- `qdrant_service.py`
  - Qdrant 컬렉션 관리
  - 벡터 저장 및 검색
  - Hybrid Search 처리

- `groq_service.py`
  - 검색된 문서를 기반으로 LLM 응답 생성

- `embed_welfare_docs.py`
  - `woori-vault` 복지정책 문서 일괄 임베딩

---

## 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일 생성

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux / macOS

```bash
cp .env.example .env
```

필수 환경변수:

```env
GEMINI_API_KEY=...
GROQ_API_KEY=...

QDRANT_URL=...
QDRANT_API_KEY=...

DATABASE_URL=postgresql+psycopg://...

PUBLIC_WELFARE_SERVICE_KEY=...
```

API Key 및 DB 접속 정보는 Git에 포함하지 않고  
환경변수 또는 배포 환경의 Secret 설정으로 관리합니다.

---

## 실행 방법

### 1. 가상환경 생성

Windows PowerShell 기준:

```powershell
python -m venv .venv
```

가상환경 활성화:

```powershell
.\.venv\Scripts\Activate.ps1
```

---

### 2. 패키지 설치

```powershell
pip install -r requirements.txt
```

---

### 3. 서버 실행

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

로컬 API 주소:

```text
http://127.0.0.1:8001
```

Swagger:

```text
http://127.0.0.1:8001/docs
```

---

## 초기 설정

최초 실행 시 Qdrant 컬렉션과 인덱스를 생성합니다.

### Qdrant 컬렉션 생성

```http
POST /setup/qdrant
```

### Payload Index 생성

```http
POST /setup/qdrant/indexes
```

초기 설정은 Qdrant 환경이 새로 생성된 경우에만 수행합니다.

---

## 복지정책 문서 임베딩

`woori-vault/복지정책/` 폴더의 Markdown 문서를  
Qdrant Vector DB에 임베딩합니다.

### 전체 문서 임베딩

```powershell
python embed_welfare_docs.py
```

### 특정 문서만 임베딩

```powershell
python embed_welfare_docs.py --file "파일명.md"
```

### 기존 데이터 삭제 후 재임베딩

```powershell
python embed_welfare_docs.py --delete
```

---

## 주요 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health` | 서버 상태 확인 |
| POST | `/api/chat` | RAG 질의응답 |
| POST | `/api/upload` | PDF 문서 업로드 및 임베딩 |
| GET | `/api/public-welfare` | 공공 복지서비스 목록 조회 |
| POST | `/api/rag-documents/embed-document` | 문서 직접 임베딩 |

---

## Chat API

### Endpoint

```http
POST /api/chat
```

### 주요 모드

- `qa`
  - 사용자의 질문에 관련 복지정책을 검색하여 답변 생성

- `recommend`
  - 사용자 상황을 기반으로 관련 복지서비스 추천

처리 흐름:

```text
질문 입력
↓
Gemini Embedding
↓
Qdrant Vector Search
+
BM25 Keyword Search
↓
검색 결과 결합
↓
관련 문서 Context 생성
↓
Groq LLM
↓
최종 답변
```

---

## PDF 문서 업로드

### Endpoint

```http
POST /api/upload
```

처리 과정:

```text
PDF 업로드
↓
PyMuPDF 텍스트 추출
↓
텍스트 Chunk 분리
↓
Gemini Embedding
↓
Qdrant 저장
↓
PostgreSQL 메타데이터 저장
```

---

## 데이터 저장 구조

### PostgreSQL

문서 자체의 관리 정보 및 메타데이터 저장

예:

```text
문서 ID
파일명
문서 유형
업로드 일시
출처
처리 상태
```

### Qdrant

검색에 사용되는 실제 문서 Chunk와 Vector 저장

예:

```text
vector
chunk_text
document_id
source
category
metadata
```

---

## 검색 방식

단순 벡터 검색만 사용하지 않고  
Vector Search와 BM25 Keyword Search를 결합한 Hybrid Search 방식 사용

```text
사용자 질문
   │
   ├─ Vector Search
   │      ↓
   │  의미 기반 검색
   │
   └─ BM25 Search
          ↓
      키워드 기반 검색
          
          ↓
      결과 결합
          ↓
      최종 Context
```

의미가 비슷하지만 표현이 다른 문서와  
정확한 정책명·지원사업명 등 키워드가 중요한 문서를 함께 검색하기 위한 구조

---

## 보안

- API Key는 `.env` 또는 배포 Secret으로 관리
- `.env` 파일 Git 제외
- 외부 AI로 전달되는 개인정보 최소화
- 사용자 개인정보보다 복지정책 문서를 중심으로 RAG Context 구성
- AI 응답은 최종 행정 판단이 아닌 정보 제공 및 의사결정 보조 용도로 사용

---

## 관련 프로젝트

- [NURI Root](../README.md)
- [Woori Vault](../woori-vault/)
