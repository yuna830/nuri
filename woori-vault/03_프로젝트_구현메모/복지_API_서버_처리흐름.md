
## 사용 목적

공공데이터포털에서 제공하는 복지 관련 API 데이터를 서버에서 수집하고, 필요한 필드를 추출하여 DB 또는 RAG 문서 저장소에 저장한 뒤 사용자 상황에 맞는 복지제도 추천, 주변 복지시설 안내, RAG 기반 Q&A에 활용한다.

이 문서는 공공데이터 API 자체의 명세가 아니라, 우리 Spring Boot 서버에서 복지 API 데이터를 어떻게 호출하고, 가공하고, 저장하고, RAG에 연결하는지 정리하기 위한 구현 메모다.

## 대상 API

| API 문서                | Endpoint                                                                                                                                 | 설명                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 한국사회보장정보원_지자체복지서비스    | [https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations](https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations) | 지자체 복지서비스 목록 및 상세 조회          |
| 한국사회보장정보원_사회복지시설정보서비스 | [https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1](https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1)             | 사회복지시설 목록, 기본정보, 행사, 구인 정보 조회 |

## 관련 Obsidian 문서

```txt
01_복지_API/한국사회보장정보원_지자체복지서비스.md
01_복지_API/한국사회보장정보원_사회복지시설정보서비스.md
04_RAG_변환규칙/복지서비스_Markdown_변환규칙.md
04_RAG_변환규칙/복지시설_Markdown_변환규칙.md
```

## 관련 DB 테이블

현재 복지 API 원본 데이터를 저장하는 전용 테이블이 없다면, 우선 RAG 문서 저장 구조를 사용한다.

```txt
rag_documents
rag_ingest_jobs
```

추후 복지서비스와 복지시설 데이터를 화면에서 목록, 상세, 필터링 형태로 직접 제공해야 한다면 별도 테이블을 추가할 수 있다.

예상 추가 테이블:

```txt
welfare_services
welfare_service_details
welfare_facilities
welfare_facility_events
welfare_facility_jobs
```

## 전체 처리 흐름

1. 서버에서 공공데이터포털 복지 API를 호출한다.
    
2. XML 응답을 수신한다.
    
3. 응답 결과 코드와 메시지를 확인한다.
    
4. 목록 조회 응답에서 필요한 식별자를 추출한다.
    
5. 필요한 경우 상세 조회 API를 추가 호출한다.
    
6. 복지서비스명, 지원 대상, 지원 내용, 신청 방법, 시설명, 주소, 연락처 등 필요한 필드를 추출한다.
    
7. 서비스 제공에 필요한 데이터는 DB에 저장한다.
    
8. RAG 검색에 필요한 데이터는 Markdown 문서로 변환한다.
    
9. 변환된 Markdown 문자열을 기준으로 raw_hash를 계산한다.
    
10. 기존 raw_hash와 비교하여 변경 여부를 확인한다.
    
11. 변경된 문서만 Qdrant에 재임베딩한다.
    
12. 수집 작업 결과를 rag_ingest_jobs에 기록한다.
    

## 인증 방식

공공데이터포털 일반 인증키를 사용한다.

```txt
serviceKey={SERVICE_KEY}
```

주의: 실제 인증키 원문은 Obsidian, GitHub, README, 프론트엔드 코드에 작성하지 않는다.

## 인증 정보 관리

인증키는 서버 환경변수 또는 설정 파일에서 관리한다.

예시:

```properties
data.go.kr.service-key=${DATA_GO_KR_SERVICE_KEY}
```

## 공통 요청 파라미터

|파라미터|의미|사용 방식|
|---|---|---|
|serviceKey|공공데이터포털 인증키|환경변수 또는 설정 파일에서 읽음|
|pageNo|페이지 번호|목록 조회 시 사용|
|numOfRows|한 페이지 결과 수|목록 조회 시 사용|

## 지자체복지서비스 처리 흐름

지자체복지서비스는 목록 조회와 상세 조회를 함께 사용한다.

## 지자체복지서비스 목록 조회

목록 조회 API:

```txt
https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist
```

목록 조회에서는 지역, 생애주기, 가구 상황, 관심 주제, 검색어 등을 기준으로 복지서비스 목록을 가져온다.

주요 처리 흐름:

1. 목록 조회 API 호출
    
2. XML 응답 수신
    
3. resultCode 또는 result 값 확인
    
4. 복지서비스 목록 추출
    
5. 각 복지서비스의 servId 추출
    
6. servId를 이용하여 상세 조회 API 호출 준비
    

## 지자체복지서비스 상세 조회

상세 조회 API:

```txt
https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed
```

상세 조회에서는 목록 조회에서 받은 servId를 사용한다.

주요 처리 흐름:

1. 목록 조회에서 servId 추출
    
2. 상세 조회 API에 servId 전달
    
3. XML 응답 수신
    
4. 지원 대상, 지원 내용, 신청 방법, 문의처 등 상세 필드 추출
    
5. RAG 문서로 변환
    
6. raw_hash 계산
    
7. 변경된 경우에만 저장 및 재임베딩
    

## 지자체복지서비스 주요 필드

|API 필드|의미|사용 방식|
|---|---|---|
|servId|서비스 ID|중복 기준|
|servNm|서비스명|RAG 포함|
|jurMnofNm|소관 기관명|RAG 포함|
|jurOrgNm|담당 기관명|RAG 포함|
|inqNum|문의처|RAG 포함|
|servDgst|서비스 요약|RAG 포함|
|servDtlLink|상세 링크|RAG 포함|
|sprtCycNm|지원 주기|RAG 포함|
|srvPvsnNm|제공 유형|RAG 포함|
|lifeNmArray|생애주기|RAG 포함|
|trgterIndvdlNmArray|가구 유형|RAG 포함|
|intrsThemaNmArray|관심 주제|RAG 포함|

## 지자체복지서비스 중복 처리 기준

복지서비스는 servId를 기준으로 중복 여부를 판단한다.

```txt
중복 기준 = servId
```

servId가 없는 경우에는 서비스명, 소관 기관명, 담당 기관명, 상세 링크를 조합하여 중복 여부를 판단한다.

```txt
대체 중복 기준 = 서비스명 + 소관 기관명 + 담당 기관명 + 상세 링크
```

## 사회복지시설정보서비스 처리 흐름

사회복지시설정보서비스는 시설 목록 조회, 시설별 기본정보 조회, 행사 정보 조회, 구인 정보 조회로 나누어 처리한다.

## 사회복지시설 목록 조회

목록 조회 API:

```txt
https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire
```

주요 처리 흐름:

1. 시설 목록 조회 API 호출
    
2. XML 응답 수신
    
3. 시설 목록 추출
    
4. 시설 코드 fcltCd 추출
    
5. 지역 정보, 시설 종류, 주소, 전화번호 등 기본 필드 추출
    
6. 필요 시 시설별 기본정보 조회 API 호출
    

## 사회복지시설 기본정보 조회

기본정보 조회 API:

```txt
https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltByBassInfoInqire
```

주요 처리 흐름:

1. 목록 조회에서 fcltCd 추출
    
2. 시설별 기본정보 조회 API 호출
    
3. 시설명, 시설 종류, 주소, 연락처, 홈페이지 등 상세 정보 추출
    
4. DB 또는 RAG 문서 저장소에 저장
    

## 사회복지시설 행사 정보 조회

행사 정보 조회 API:

```txt
https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltByEvntInfo
```

행사 정보는 최신성이 중요하므로 별도 갱신 기준이 필요하다.

처리 기준:

1. 행사 정보 조회
    
2. 현재 날짜 기준으로 유효한 행사만 선별
    
3. 오래된 행사 정보는 RAG 문서에서 제외하거나 만료 처리
    
4. 필요 시 별도 테이블 또는 별도 RAG 문서로 관리
    

## 사회복지시설 구인 정보 조회

구인 정보 조회 API:

```txt
https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltByJobInfo
```

구인 정보도 최신성이 중요하므로 별도 관리가 필요하다.

처리 기준:

1. 구인 정보 조회
    
2. 모집 상태 또는 등록일 기준으로 최신 데이터 선별
    
3. 오래된 구인 정보는 제외
    
4. 필요 시 별도 테이블 또는 별도 RAG 문서로 관리
    

## 사회복지시설 주요 필드

|API 필드|의미|사용 방식|
|---|---|---|
|fcltCd|시설 코드|중복 기준|
|fcltNm|시설명|RAG 포함|
|fcltKindNm|시설 종류명|RAG 포함|
|fcltKindCd|시설 종류 코드|필터링에 사용|
|ctpvNm|시도명|지역 검색에 사용|
|sggNm|시군구명|지역 검색에 사용|
|addr|주소|RAG 포함|
|telNo|전화번호|RAG 포함|
|hmpgAddr|홈페이지 주소|선택 포함|
|lat|위도|지도 기능에 사용 가능|
|lot|경도|지도 기능에 사용 가능|

## 사회복지시설 중복 처리 기준

시설 데이터는 fcltCd를 기준으로 중복 여부를 판단한다.

```txt
중복 기준 = fcltCd
```

fcltCd가 없는 경우에는 시설명, 주소, 시설 종류를 조합하여 중복 여부를 판단한다.

```txt
대체 중복 기준 = 시설명 + 주소 + 시설 종류
```

## DB 저장 기준

복지 API 데이터는 원본 XML 전체를 그대로 저장하지 않는다.

서비스 제공에 필요한 필드만 선별하여 저장한다.

복지서비스 전용 테이블이 있는 경우:

```txt
welfare_services
welfare_service_details
```

사회복지시설 전용 테이블이 있는 경우:

```txt
welfare_facilities
welfare_facility_events
welfare_facility_jobs
```

전용 테이블이 없는 경우:

```txt
rag_documents
rag_ingest_jobs
```

## rag_documents 저장 기준

RAG 검색에 사용되는 Markdown 문서는 rag_documents 테이블에 저장한다.

저장 대상:

```txt
복지서비스 요약 문서
복지시설 요약 문서
복지시설 행사 요약 문서
복지시설 구인 요약 문서
```

저장하지 않는 대상:

```txt
serviceKey
원본 XML 전체
내부 DB ID
중복 코드
불필요한 시스템 필드
비어 있는 응답 필드
```

## raw_hash 처리 기준

API 응답을 Markdown으로 변환한 최종 문자열을 기준으로 raw_hash를 계산한다.

처리 흐름:

1. API 응답 수신
    
2. 필요한 필드 추출
    
3. Markdown 문자열 생성
    
4. raw_hash 계산
    
5. 기존 문서의 raw_hash와 비교
    
6. 동일하면 재임베딩하지 않음
    
7. 다르면 rag_documents 갱신
    
8. Qdrant에 재임베딩
    

## RAG 변환 기준

복지서비스 API는 RAG 변환 대상으로 사용한다.

사회복지시설 API는 일부 필드만 RAG 변환 대상으로 사용한다.

## 복지서비스 RAG 포함 정보

```txt
서비스명
서비스 요약
지원 대상
지원 내용
신청 방법
문의처
소관 기관
담당 기관
상세 링크
생애주기
가구 유형
관심 주제
```

## 복지시설 RAG 포함 정보

```txt
시설명
시설 종류
주소
전화번호
홈페이지
지역 정보
주요 서비스
이용 대상
행사 정보
구인 정보
```

## RAG에서 제외할 정보

```txt
serviceKey
원본 XML 전체
내부 DB ID
중복 코드
대량 목록 원문 전체
불필요한 시스템 필드
비어 있는 응답 필드
오래된 행사 정보
오래된 구인 정보
```

## Markdown 변환 예시: 복지서비스

```md
# 복지서비스명

## 서비스 요약
서비스 요약 내용

## 지원 대상
지원 대상 내용

## 지원 내용
지원 내용

## 신청 방법
신청 방법

## 문의처
문의처

## 담당 기관
담당 기관

## 상세 링크
상세 링크

## 우리 서비스 활용
사용자 상황에 맞는 복지제도 추천에 활용한다.
```

## Markdown 변환 예시: 복지시설

```md
# 시설명

## 시설 종류
노인복지시설

## 주소
시설 주소

## 전화번호
전화번호

## 홈페이지
홈페이지 주소

## 주요 서비스
제공 서비스 요약

## 지역 정보
시도명 / 시군구명

## 우리 서비스 활용
사용자 주변 복지시설 안내에 활용한다.
```

## 동기화 주기 기준

복지 API는 데이터 성격에 따라 동기화 주기를 다르게 설정한다.

|데이터|권장 동기화 주기|이유|
|---|---|---|
|지자체 복지서비스 목록|하루 1회 또는 수동 갱신|정책 정보는 자주 바뀌지 않음|
|지자체 복지서비스 상세|하루 1회 또는 수동 갱신|목록 변경 시 상세도 함께 확인|
|사회복지시설 목록|하루 1회 또는 주 1회|시설 정보는 중간 정도의 갱신 주기 필요|
|시설 행사 정보|하루 1회|최신성이 중요함|
|시설 구인 정보|하루 1회|최신성이 중요함|

## 페이지네이션 처리 기준

목록 API는 응답 데이터가 많을 수 있으므로 페이지네이션 처리가 필요하다.

처리 방식:

1. pageNo를 1부터 시작한다.
    
2. numOfRows 기준으로 한 페이지씩 조회한다.
    
3. totalCount를 확인한다.
    
4. 현재까지 조회한 수가 totalCount 이상이면 반복을 종료한다.
    
5. 응답 목록이 비어 있으면 반복을 종료한다.
    

## 오류 처리 기준

|오류 상황|처리 방식|
|---|---|
|인증키 없음|API 호출 전 예외 처리|
|API 응답 없음|수집 실패 처리|
|XML 파싱 실패|해당 요청 실패 처리|
|resultCode 오류|오류 코드와 메시지 기록|
|필수 필드 없음|해당 항목 제외 또는 기본값 처리|
|중복 데이터 수신|기존 데이터 갱신|
|raw_hash 동일|재임베딩하지 않음|
|Qdrant 저장 실패|rag_ingest_jobs에 실패 기록|

## 로그 기록 기준

수집 작업 실행 시 아래 정보를 기록한다.

```txt
API 종류
요청 URL
페이지 번호
전체 데이터 수
현재 페이지 데이터 수
성공 여부
오류 메시지
수집 시작 시간
수집 종료 시간
재임베딩 여부
```

## rag_ingest_jobs 기록 기준

수집 작업 이력은 rag_ingest_jobs 테이블에서 관리할 수 있다.

기록할 정보:

```txt
job_id
source_type
source_name
status
started_at
finished_at
total_count
success_count
failed_count
error_message
```

## 보안 관리 기준

공공데이터포털 인증키는 문서나 코드에 직접 작성하지 않는다.

금지 위치:

```txt
Obsidian
GitHub
README
프론트엔드 코드
공유용 문서
캡처 이미지
```

권장 위치:

```txt
application.properties
application-local.properties
.env
서버 환경변수
```

## 주의사항

인증키 원문은 문서에 저장하지 않는다.

API 응답 필드는 비어 있을 수 있으므로 null 처리가 필요하다.

복지서비스 상세 정보는 목록 조회만으로 부족할 수 있으므로 상세 조회 API와 함께 사용한다.

시설 목록 데이터는 양이 많을 수 있으므로 페이지네이션 처리가 필요하다.

시설 행사 정보와 구인 정보는 시간이 지나면 오래된 정보가 될 수 있으므로 만료 기준을 따로 관리한다.

RAG 문서에는 사용자가 이해할 수 있는 설명 중심으로 변환한다.

원본 XML 전체를 그대로 RAG에 넣지 않는다.

변경되지 않은 문서는 재임베딩하지 않는다.

## 최종 정리

복지 API 서버 처리 흐름은 공공데이터포털에서 지자체 복지서비스와 사회복지시설 데이터를 가져와 필요한 필드만 추출하고, DB 또는 RAG 문서 저장소에 저장하는 구조다.

지자체 복지서비스는 사용자 상황에 맞는 복지제도 추천과 RAG 기반 Q&A에 활용하고, 사회복지시설정보서비스는 주변 시설 안내와 지역 기반 복지 정보 제공에 활용한다.

RAG에는 원본 XML 전체가 아니라 사용자가 이해할 수 있는 Markdown 요약 문서만 저장하며, raw_hash 비교를 통해 변경된 문서만 Qdrant에 재임베딩한다.