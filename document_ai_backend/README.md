# PaddleOCR product label backend

보호자 웹 전용 로컬 PaddleOCR 제품 라벨 분석 서버입니다. Google Cloud 결제나 인증이 필요하지 않으며 제품 등록이나 리콜 판정은 수행하지 않습니다.

```powershell
cd document_ai_backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8002
```

최초 분석 때 한국어 OCR 모델을 내려받기 때문에 인터넷 연결이 필요합니다. 이후 모델은 로컬 캐시에서 실행됩니다.
