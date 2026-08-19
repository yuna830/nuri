# document_ai_backend — Google Cloud Vision 제품 라벨 OCR API

제품 라벨 이미지를 Google Cloud Vision OCR로 분석하고,  
규칙 기반 필드 추출 로직을 통해 제품명, 브랜드, 제조사, 모델번호, 인증번호 등을 구조화하는 FastAPI 서버입니다.

---

## 주요 기능

- 제품 라벨 이미지 OCR 분석
- Google Cloud Vision API 연동
- OCR 원문 텍스트 추출
- 제품명 추출
- 브랜드 및 제조사 추출
- 모델번호 추출
- KC 인증번호 등 인증 정보 추출
- 분석 결과 사용자 확인 및 보정
- 보호자 웹 제품 등록 기능과 연동

---

## 기술 스택

| 역할 | 기술 |
| --- | --- |
| Web Framework | FastAPI |
| Server | Uvicorn |
| OCR | Google Cloud Vision |
| Field Parsing | Python Rule-based Parsing |
| Image Upload | Multipart Form Data |
| Deployment | Render |

---

## 처리 흐름

```text
제품 라벨 이미지 업로드
        ↓
FastAPI
        ↓
Google Cloud Vision OCR
        ↓
OCR 원문 텍스트 추출
        ↓
규칙 기반 필드 분석
        ↓
제품명 / 브랜드 / 제조사
모델번호 / 인증번호 추출
        ↓
사용자 확인 및 수정
        ↓
제품 등록 데이터로 활용
```

---

## 주요 API

### 서버 상태 확인

```http
GET /health
```

응답 예시:

```json
{
  "status": "ok",
  "engine": "GOOGLE_CLOUD_VISION",
  "enabled": true,
  "port": 8002
}
```

---

### 제품 라벨 분석

```http
POST /api/document-ai/product-label/analyze
```

요청 형식:

```text
multipart/form-data
```

필드:

```text
image       제품 라벨 이미지
source      등록 경로
seniorId    어르신 ID
```

지원 이미지 형식:

```text
JPEG
PNG
WEBP
```

최대 이미지 크기:

```text
10MB
```

분석 결과에는 다음 정보가 포함됩니다.

```text
analysisId
rawText
fields
missingFields
warnings
requiresUserReview
```

---

### 분석 결과 확인 저장

```http
PATCH /api/document-ai/product-label/analyses/{analysisId}/confirmation
```

사용자가 OCR 결과를 확인하거나 수정한 뒤  
최종 필드 값을 저장할 때 사용합니다.

---

## 로컬 실행

### 1. 프로젝트 이동

Windows PowerShell 기준:

```powershell
cd document_ai_backend
```

---

### 2. 가상환경 생성

```powershell
python -m venv .venv
```

---

### 3. 패키지 설치

```powershell
.\.venv\Scripts\pip.exe install -r requirements.txt
```

---

### 4. 환경변수 파일 생성

```powershell
Copy-Item .env.example .env
```

Google Cloud 서비스 계정 JSON 파일을 준비한 뒤  
`.env`의 `GOOGLE_APPLICATION_CREDENTIALS` 값을 실제 파일 경로로 설정합니다.

예시:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\keys\google-vision-service-account.json

PRODUCT_LABEL_OCR_ENABLED=true

PRODUCT_LABEL_OCR_ALLOWED_SOURCES=GUARDIAN_WEB

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

### 5. 서버 실행

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8002
```

로컬 서버:

```text
http://127.0.0.1:8002
```

Swagger:

```text
http://127.0.0.1:8002/docs
```

---

## Render 배포 설정

Render 서비스:

```text
woori-document-ai-backend
```

### Secret File

Render에서:

```text
Environment
→ Secret Files
```

다음 파일 추가:

```text
google-vision-service-account.json
```

Render에서는 해당 파일이 다음 경로로 제공됩니다.

```text
/etc/secrets/google-vision-service-account.json
```

---

### Environment Variables

```env
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/google-vision-service-account.json

PRODUCT_LABEL_OCR_ENABLED=true

PRODUCT_LABEL_OCR_ALLOWED_SOURCES=GUARDIAN_WEB

CORS_ALLOWED_ORIGINS=https://woori-link-react.vercel.app,https://woori-link-user.vercel.app
```

---

## CORS

로컬 개발 환경과 배포 환경의 프론트엔드 주소를  
허용 목록으로 관리합니다.

예시:

```text
Local
http://localhost:5173
http://127.0.0.1:5173

Production
https://woori-link-react.vercel.app
```

배포 환경에서 허용되지 않은 Origin으로 요청할 경우  
브라우저 CORS 정책에 의해 요청이 차단될 수 있습니다.

---

## Google Cloud 설정

Google Cloud Console에서 다음 설정 필요:

1. Google Cloud 프로젝트 생성
2. Cloud Vision API 활성화
3. 서비스 계정 생성
4. 서비스 계정 키 JSON 발급
5. 로컬 또는 Render Secret File로 등록

서비스 계정 키는 GitHub 저장소에 업로드하지 않습니다.

---

## 보안

- Google Cloud 서비스 계정 JSON Git 제외
- `.env` Git 제외
- Google API 인증정보 Secret으로 관리
- 업로드 이미지 크기 제한
- 허용된 이미지 타입만 처리
- 허용된 등록 경로만 OCR 요청 가능
- 사용자 확인 전 OCR 결과를 최종 데이터로 확정하지 않도록 구성

---

## 관련 프로젝트

- [NURI Root](../README.md)
- [Woori Link](../woori_link/)
