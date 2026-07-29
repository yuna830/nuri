# nuri — 취약 계층 기반 웹 서비스

어르신 안전 모니터링, 복지 정보 제공, 얼굴 인식 기반 실종자 감지를 통합한 돌봄 서비스다.

## 구성 요소

| 폴더 | 설명 | 기술 |
|---|---|---|
| `woorispring` | 메인 백엔드 API 서버 | Spring Boot 3, PostgreSQL |
| `woorireact` | 웹 프론트엔드 (어르신/보호자/복지사/관리자) | React 19, Vite |
| `woori_senior_app` | 어르신용 모바일 앱 | Flutter |
| `woori_guardian_app` | 보호자용 모바일 앱 | Flutter |
| `ai_backend` | RAG 복지 챗봇 서버 | FastAPI, Qdrant, Gemini |
| `raspi-client` | 얼굴 인식 카메라 클라이언트 | Python, InsightFace |
| `woori-vault` | 복지정책 문서 및 API 설계 문서 | Obsidian Markdown |

## 시스템 구조
```
[Flutter 앱 / React 웹]
↓
[Spring Boot :8080] ←→ [PostgreSQL (Oracle Cloud)]
↓
[ai_backend :8001] — RAG 복지 챗봇 (Qdrant)
[face_api :8003] — 얼굴 인식 (InsightFace)
↑
[raspi-client] — 카메라 → 얼굴 감지 → Spring 알림
```

## 각 서비스 실행
각 폴더의 README를 참고한다.
- [woorispring/README.md](woorispring/README.md)
- [ai_backend/README.md](ai_backend/README.md)
- [raspi-client/README.md](raspi-client/README.md)
- [woorireact/README.md](woorireact/README.md)
- [woori_senior_app/README.md](woori_senior_app/README.md)
- [woori_guardian_app/README.md](woori_guardian_app/README.md)
  
## 포트 정리
| 서비스 | 포트 |
|---|---|
| Spring (woorispring) | 8080 |
| RAG API (ai_backend) | 8001 |
| face_api (raspi-client) | 8003 |
| Chat/STT/TTS 서버 | 8002 |
| 낙상 감지 서버 | 8000 |

## 개인정보 보호 및 AI 안전성

WOORI는 고령자의 복지, 건강, 위치 및 안전 관련 정보를 처리할 수 있으므로 개인정보 최소수집, 역할과 관계에 기반한 접근제어, 외부 AI 전송 최소화 및 사람의 최종 검토를 설계 원칙으로 둡니다.

- [개인정보 처리 목록](docs/privacy/PERSONAL_DATA_INVENTORY.md)
- 데이터 흐름, 보관·삭제 정책 및 AI 재검토 절차는 구현 검증과 함께 순차적으로 문서화할 예정입니다.
