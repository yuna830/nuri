# raspi-client — 누리 얼굴 인식 클라이언트

실종 어르신 감지를 위한 얼굴 인식 모듈.
카메라에서 촬영된 얼굴을 InsightFace 임베딩으로 분석하고,
등록된 어르신/실종 신고 사진과 비교하여 Spring 서버에 알림을 전송한다.

## 두 가지 실행 모드

### 모드 1: face_api.py (API 서버)
Spring 백엔드가 HTTP로 얼굴 비교를 요청하는 방식.
카메라는 Spring이 직접 받아서 이미지를 전송한다.

\`\`\`bash
uvicorn face_api:app --host 0.0.0.0 --port 8001
\`\`\`

비교 대상은 서버 시작 시 자동 로드:
- `known_faces/` 폴더 내 로컬 사진 (`{seniorId}_{이름}.jpg`)
- Spring 서버 실종 신고 사진 (`/api/missing-reports/face-targets`)
- 실종 신고 중인 어르신 등록 사진 (`/api/seniors/face-photo-targets`)

| 엔드포인트 | 설명 |
|---|---|
| `POST /api/face/verify` | 이미지 파일 업로드 → 매치 결과 반환 |
| `POST /api/face/reload` | 등록 얼굴 임베딩 재로드 |
| `POST /api/face/compare-police` | 어르신 사진 ↔ 경찰 실종 신고 비교 |

### 모드 2: laptop_client.py (카메라 직접 실행)
기기에 연결된 카메라를 직접 캡처해서 로컬에서 처리.

\`\`\`bash
# 단일 얼굴 사진 등록
python laptop_client.py \
  --senior-id 1 \
  --center-lat 37.5665 --center-lng 126.9780 \
  --known-face ./test_photo.jpg \
  --camera-index 0

# 폴더로 여러 장 등록
python laptop_client.py \
  --senior-id 1 \
  --center-lat 37.5665 --center-lng 126.9780 \
  --known-face-dir ./known_faces/kimnari \
  --camera-index 0
\`\`\`

> 웹캠이 먼저 잡히면 `--camera-index 1` 또는 `2` 시도

## 매치 판정 기준

| 상태 | 코사인 유사도 | 의미 |
|------|-------------|------|
| `MATCH` | ≥ 0.62 | 동일인으로 판정, 알림 발송 |
| `CANDIDATE` | ≥ 0.55 | 후보, 보호자 확인 필요 |
| `BODY_CANDIDATE` | - | 얼굴 불일치지만 의복 색상 일치 |
| `NO_MATCH` | < 0.55 | 미일치 |

알림 쿨다운: 동일 어르신은 **10분(600초)** 간격으로만 전송

## 환경 변수

\`\`\`
SPRING_SERVER_URL=http://localhost:8080
KNOWN_FACE_DIR=known_faces
\`\`\`

## 로컬 얼굴 사진 등록 규칙

`known_faces/` 폴더에 이미지를 넣을 때 파일명 형식:
\`\`\`
{seniorId}_{이름}.jpg
예: 1_홍길동.jpg
\`\`\`
