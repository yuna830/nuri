# Document AI backend

보호자 웹 전용 제품 라벨 분석 서버입니다. 제품 등록이나 리콜 판정은 수행하지 않습니다.

```powershell
cd document_ai_backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8002
```

Google Cloud에서 Document AI OCR/Form Parser 프로세서를 만든 뒤 `.env`에 프로젝트, 위치, 프로세서 ID와 서비스 계정 경로를 설정합니다.
