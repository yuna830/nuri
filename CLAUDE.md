# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nuri is a comprehensive elderly care platform with multiple integrated applications:
- Fall Detection & Monitoring: Real-time video processing with face recognition (Python/Raspberry Pi)
- Welfare Benefits Chatbot: RAG-based AI assistant for social welfare information
- Senior Care Apps: Flutter mobile apps for seniors and guardians
- Welfare Management Web: React frontend + Spring Boot backend for social workers

The system spans 8 major projects with multiple tech stacks: React (Vite), Flutter, Spring Boot (Java 17), FastAPI (Python), and Kotlin.

## Project Structure

```
nuri/
├── woorispring/                    # Main Spring Boot backend (Java 17, PostgreSQL)
├── woorireact/                     # Main React frontend (Vite)
├── woori_link/                     # Welfare worker platform (new)
│   ├── woori_link_spring/          # Spring Boot with JWT auth
│   ├── woori_link_react/           # React Vite frontend
│   └── woori_link_flutter/         # Flutter mobile app
├── woori_guardian_app/             # Guardian mobile app (Flutter + Kotlin)
├── woori_senior_app/               # Senior mobile app (Flutter)
├── ai_backend/                     # FastAPI RAG/Chat server (Python 3.11)
│   └── app/
│       ├── api/                    # Endpoints: chat, upload, public_welfare, rag_documents
│       ├── services/               # LLM, embeddings, Qdrant vector DB
│       └── core/config.py          # Environment config via .env
├── raspi-client/                   # Raspberry Pi face detection client (Python OpenCV/YOLO)
└── woori-vault/                    # Obsidian vault with welfare policy docs (RAG source)
```

## Tech Stack by Component

| Component | Language | Framework | Database | Key Libraries |
|-----------|----------|-----------|----------|----------------|
| woorispring | Java 17 | Spring Boot 3.5.12 | PostgreSQL | JPA, Lombok, JWT, Firebase Admin |
| woorireact | JavaScript | React 19 + Vite 8 | N/A | Axios, React Router, Leaflet, Bootstrap |
| woori_link_spring | Java 17 | Spring Boot 3.2.5 | PostgreSQL | JPA, JWT, SpringDoc OpenAPI |
| ai_backend | Python 3.11 | FastAPI + Uvicorn | Redis, Qdrant, PostgreSQL | LangChain, Groq, Gemini, Qdrant Client |
| woori_guardian_app | Dart | Flutter 3.11+ | SQLite | Firebase, camera, geolocator, Google ML Kit |
| raspi-client | Python | OpenCV, YOLO11 | N/A | face_recognition, numpy, scipy |

## Build & Run Commands

### Spring Boot (woorispring)

```bash
cd woorispring
mvn clean install          # Build and run tests
mvn spring-boot:run        # Start development server (port 8080)
mvn package                # Create executable JAR
```

Configuration: Uses application.properties with profiles (application-{profile}.properties).
Key Env Vars: OCI_DB_PASSWORD, KMA_SERVICE_KEY, PUBLIC_DATA_SERVICE_KEY, FIREBASE_SERVICE_ACCOUNT_PATH, AI_BACKEND_BASE_URL, FACE_SERVER_URL, APP_UPLOAD_ROOT.

### woori_link Spring

```bash
cd woori_link/woori_link_spring
mvn spring-boot:run        # Port 8080 (or use profile for different port)
```

### React Apps (woorireact, woori_link_react)

```bash
cd woorireact
npm install                # Install dependencies
npm run dev                # Start Vite dev server (port 5173, with HMR)
npm run build              # Build for production (dist/)
npm run lint               # ESLint check
npm run preview            # Preview production build locally
```

Dev Proxy: Vite config proxies /api, /uploads, /weather-api, /kakao-local to Spring backend.
Env: Copy .env.example to .env.local and set VITE_API_BASE_URL, VITE_AI_API_BASE_URL, VITE_KAKAO_REST_API_KEY, etc.

### FastAPI Backend (ai_backend)

```bash
cd ai_backend
python -m venv .venv       # Create virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001  # Dev server
```

Endpoints: POST /api/chat/stream, POST /api/upload, GET /api/public-welfare, POST /api/rag-documents/embed-document.
Setup: Create .env file with GEMINI_API_KEY, GROQ_API_KEY, QDRANT_URL, QDRANT_API_KEY, DATABASE_URL.

### Embed Welfare Docs to RAG

```bash
cd ai_backend
python embed_welfare_docs.py               # Embed all markdown files from woori-vault/복지정책/
python embed_welfare_docs.py --file 당뇨병_관련복지.md  # Single file
python embed_welfare_docs.py --delete      # Delete and re-embed
```

### Flutter Apps

```bash
cd woori_guardian_app
flutter pub get            # Install dependencies
flutter run                # Run on connected device/emulator
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:8080  # Emulator
flutter build apk          # Build Android APK
```

### Raspberry Pi Client (Fall Detection)

```bash
cd raspi-client
python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face .\test_woon.jpg --camera-index 0
```

## Local Development Setup

Prerequisites: Java 17, Node.js 18+, Python 3.11, Flutter 3.11+, PostgreSQL, Qdrant, Redis.

Quick Start:
1. Backend: Copy woorispring/src/main/resources/application-dev.properties, set DB credentials, run mvn spring-boot:run
2. Frontend: cd woorireact && npm install && npm run dev
3. AI Backend: Set .env with API keys, run python -m uvicorn app.main:app --reload --port 8001

Environment Variables:

woorireact/.env.local:
```
VITE_API_BASE_URL=http://localhost:8080
VITE_AI_API_BASE_URL=http://localhost:8001
VITE_FALL_API_BASE=http://localhost:8000
VITE_KAKAO_REST_API_KEY=<your-key>
VITE_GEMINI_API_KEY=<your-key>
```

ai_backend/.env:
```
GEMINI_API_KEY=<your-key>
GROQ_API_KEY=<your-key>
QDRANT_URL=http://localhost:6333
DATABASE_URL=postgresql://woori:password@localhost:5432/woori
```

woorispring/src/main/resources/application-dev.properties:
```
spring.datasource.url=jdbc:postgresql://localhost:5432/woori
spring.datasource.username=woori
spring.datasource.password=<password>
AI_BACKEND_BASE_URL=http://localhost:8001/api
```

## Key Architectural Patterns

### API Ports
- 8080: woorispring main backend
- 8001: ai_backend FastAPI (RAG/chat)
- 8002: Another FastAPI instance (STT/TTS)
- 8003: Face detection server
- 5173: Vite dev server (React)
- 6333: Qdrant vector DB API
- 5432: PostgreSQL

### Authentication
- Spring: Firebase Admin SDK + custom JWT (in woori_link)
- Frontend: JWT in httpOnly cookies (not localStorage)
- Flutter: flutter_secure_storage for tokens

### RAG (Retrieval Augmented Generation)
- Documents: Welfare policy markdown files in woori-vault/복지정책/
- Vector DB: Qdrant with Gemini embeddings
- LLM: Groq (fast inference) or Gemini for chat
- Workflow: Upload PDF → Parse → Embed → Retrieve docs on query → Feed to LLM

### Database Schema
- PostgreSQL at 168.107.27.186:5432/woori (production) or localhost:5432/woori (dev)
- Hibernate DDL via spring.jpa.hibernate.ddl-auto=update
- Schema updates via schema-update.sql

### Frontend Architecture
- React: Component-based, Vite for fast HMR
- Routing: React Router v7 for multi-page navigation
- Maps: Leaflet with React Leaflet for location features
- API: Axios with interceptors for auth and error handling
- Bootstrap 5 for UI components

### File Upload Flow
- Client uploads to Spring /api/upload or /{senior-id}/upload
- Spring stores in APP_UPLOAD_ROOT (default: uploads/)
- RAG backend fetches from Spring to process documents
- Face detection saves snapshots to disk

## Testing

Spring Boot: mvn test or mvn test -Dtest=SomeTest
React: npm test (if jest configured)
Python: pytest (if added)

## Important Notes

1. Multiple Spring Instances: woorispring and woori_link_spring both use port 8080. Use profiles or server.port override to run simultaneously.

2. PostgreSQL Shared DB: Both Spring apps connect to same woori database. Migrations via Hibernate DDL + schema-update.sql.

3. AI Backend Config: FastAPI uses .env file; no spring-like profiles.

4. Flutter .env Files: Not committed (in .gitignore). Copy .env.example or pass API_BASE_URL via --dart-define.

5. Face Detection: Requires webcam + YOLO11 model (~50MB). Known_faces directory holds reference images.

6. RAG Documents: Obsidian vault in woori-vault/ is source of truth. Run embed_welfare_docs.py to sync to vector DB.

7. Vite Compiler: React Compiler enabled in woorireact, may impact build performance.

8. Firebase: woori_guardian_app uses Firebase Messaging for push notifications.

## Quick Commands

| Task | Command |
|------|---------|
| Start all backends | mvn spring-boot:run (woorispring) + python -m uvicorn app.main:app --reload --port 8001 (ai_backend) |
| Start React dev | npm run dev (woorireact) |
| Run Flutter on emulator | flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:8080 |
| Embed docs to RAG | cd ai_backend && python embed_welfare_docs.py |
| API docs | Spring: http://localhost:8080/swagger-ui.html; FastAPI: http://localhost:8001/docs |