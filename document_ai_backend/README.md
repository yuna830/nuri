# Google Cloud Vision product label backend

제품 라벨 이미지를 Google Cloud Vision OCR로 분석하고, 기존 규칙 기반 필드 추출 로직으로
제품명, 브랜드, 제조사, 모델번호, 인증번호 등을 구조화하는 FastAPI 서버입니다.

## 로컬 실행

```powershell
cd document_ai_backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
```

Google Cloud 서비스 계정 JSON 파일을 준비한 뒤 `.env`의
`GOOGLE_APPLICATION_CREDENTIALS`를 실제 파일 경로로 수정합니다.

```powershell
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8002
```

## Render 설정

1. `woori-document-ai-backend`의 **Environment > Secret Files**에
   `google-vision-service-account.json` 파일을 추가합니다.
2. 환경변수에 아래 값을 등록합니다.

```text
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/google-vision-service-account.json
PRODUCT_LABEL_OCR_ENABLED=true
PRODUCT_LABEL_OCR_ALLOWED_SOURCES=GUARDIAN_WEB
CORS_ALLOWED_ORIGINS=https://woori-link-react.vercel.app,https://woori-link-user.vercel.app
```

Google Cloud Vision API를 활성화하고, 서비스 계정 키 JSON은 GitHub에 올리지 마세요.
