
## 사용 목적

외부 API 또는 내부 서비스에서 수집되는 데이터가 반복 저장되는 것을 방지하고, 기존 데이터와 신규 데이터를 일관된 기준으로 관리하기 위한 기준을 정리한다.

이 문서는 공공데이터포털 복지 API, 경찰청 Safe182 API, RAG 문서 저장 과정에서 사용하는 중복 처리 기준을 설명한다.

## 기본 원칙

DB에는 원본 응답 전체를 무조건 저장하지 않는다.

서비스 제공에 필요한 필드만 선별하여 저장한다.

중복 여부는 각 데이터의 성격에 맞는 고유 식별자를 기준으로 판단한다.

고유 식별자가 없는 경우에는 여러 필드를 조합하여 대체 중복 키를 만든다.

## 공통 처리 흐름

1. API 또는 내부 서비스에서 데이터 수신
    
2. 필요한 필드 추출
    
3. 중복 판단 기준 키 생성
    
4. DB에서 기존 데이터 조회
    
5. 기존 데이터가 있으면 update
    
6. 기존 데이터가 없으면 insert
    
7. 저장 또는 갱신 시간 기록
    
8. RAG 대상 데이터인 경우 raw_hash 비교
    
9. 변경된 문서만 재임베딩
    

## 중복 처리 방식

```txt
기존 데이터 있음 → 기존 데이터 갱신
기존 데이터 없음 → 새 데이터 저장
```

중복 데이터가 들어와도 같은 내용이 반복 insert되지 않도록 한다.

## 공통 저장 기준

|기준|설명|
|---|---|
|고유 식별자 우선 사용|API에서 제공하는 ID가 있으면 우선 사용|
|대체 키 사용|고유 ID가 없으면 주요 필드를 조합|
|원본 전체 저장 지양|XML, JSON 원본 전체보다 필요한 필드 중심 저장|
|최신성 관리|syncedAt, updatedAt, collectedAt 등 갱신 시간 기록|
|RAG 문서 분리|사용자 질문에 필요한 설명형 문서만 RAG에 저장|
|인증키 저장 금지|serviceKey, authKey 등은 DB와 문서에 저장하지 않음|

## 복지서비스 데이터 중복 기준

대상 API:

```txt
한국사회보장정보원_지자체복지서비스
```

## 복지서비스 기본 중복 기준

복지서비스는 `servId`를 기준으로 중복 여부를 판단한다.

```txt
중복 기준 = servId
```

`servId`는 지자체 복지서비스 목록 조회 결과에서 가져오는 서비스 ID다.

## 복지서비스 대체 중복 기준

servId가 없거나 비어 있는 경우에는 아래 값을 조합하여 중복 여부를 판단한다.

```txt
대체 중복 기준 = 서비스명 + 소관 기관명 + 담당 기관명 + 상세 링크
```

예시:

```txt
servNm + jurMnofNm + jurOrgNm + servDtlLink
```

## 복지서비스 저장 필드 기준

DB 또는 RAG 문서 저장소에 저장할 수 있는 주요 필드는 다음과 같다.

|필드|의미|저장 기준|
|---|---|---|
|servId|서비스 ID|중복 기준|
|servNm|서비스명|저장|
|servDgst|서비스 요약|저장|
|jurMnofNm|소관 기관명|저장|
|jurOrgNm|담당 기관명|저장|
|inqNum|문의처|저장|
|servDtlLink|상세 링크|저장|
|sprtCycNm|지원 주기|저장|
|srvPvsnNm|제공 유형|저장|
|lifeNmArray|생애주기|저장|
|trgterIndvdlNmArray|가구 유형|저장|
|intrsThemaNmArray|관심 주제|저장|

## 복지서비스 저장 방식

현재 복지서비스 전용 테이블이 없다면, 우선 RAG 문서로 변환하여 `rag_documents` 테이블에 저장한다.

추후 화면에서 복지서비스 목록, 상세, 필터링 기능을 직접 제공해야 한다면 별도 테이블을 추가할 수 있다.

예상 테이블:

```txt
welfare_services
welfare_service_details
```

## 복지시설 데이터 중복 기준

대상 API:

```txt
한국사회보장정보원_사회복지시설정보서비스
```

## 복지시설 기본 중복 기준

사회복지시설 데이터는 `fcltCd`를 기준으로 중복 여부를 판단한다.

```txt
중복 기준 = fcltCd
```

`fcltCd`는 시설 코드이며, 시설 목록 조회와 시설별 기본정보 조회를 연결하는 기준으로 사용한다.

## 복지시설 대체 중복 기준

fcltCd가 없거나 비어 있는 경우에는 아래 값을 조합하여 중복 여부를 판단한다.

```txt
대체 중복 기준 = 시설명 + 주소 + 시설 종류
```

예시:

```txt
fcltNm + addr + fcltKindNm
```

## 복지시설 저장 필드 기준

|필드|의미|저장 기준|
|---|---|---|
|fcltCd|시설 코드|중복 기준|
|fcltNm|시설명|저장|
|fcltKindNm|시설 종류명|저장|
|fcltKindCd|시설 종류 코드|저장|
|ctpvNm|시도명|저장|
|sggNm|시군구명|저장|
|addr|주소|저장|
|telNo|전화번호|저장|
|hmpgAddr|홈페이지 주소|선택 저장|
|lat|위도|지도 기능 사용 시 저장|
|lot|경도|지도 기능 사용 시 저장|
|certYn|대상시설 여부|선택 저장|
|fcltStatus|시설 상태 코드|선택 저장|

## 복지시설 저장 방식

현재 복지시설 전용 테이블이 없다면, 우선 RAG 문서로 변환하여 `rag_documents` 테이블에 저장한다.

추후 화면에서 시설 목록, 상세 조회, 지역 필터링, 지도 표시 기능을 직접 제공해야 한다면 별도 테이블을 추가할 수 있다.

예상 테이블:

```txt
welfare_facilities
welfare_facility_events
welfare_facility_jobs
```

## 복지시설 행사 정보 중복 기준

시설 행사 정보는 시설 기본정보와 성격이 다르므로 별도 기준으로 관리한다.

기본 중복 기준:

```txt
중복 기준 = 시설 코드 + 행사명 + 행사 시작일
```

대체 중복 기준:

```txt
대체 중복 기준 = 시설명 + 행사명 + 행사 기간
```

행사 정보는 최신성이 중요하므로 종료된 행사는 RAG 문서에서 제외하거나 만료 처리한다.

## 복지시설 구인 정보 중복 기준

시설 구인 정보도 시설 기본정보와 분리해서 관리한다.

기본 중복 기준:

```txt
중복 기준 = 시설 코드 + 구인 제목 + 등록일
```

대체 중복 기준:

```txt
대체 중복 기준 = 시설명 + 구인 제목 + 모집 기간
```

구인 정보는 시간이 지나면 오래된 정보가 될 수 있으므로 모집 종료일 또는 등록일 기준으로 만료 처리한다.

## 경찰청 실종자 데이터 중복 기준

대상 API:

```txt
경찰청_실종경보_API
경찰청_실종자검색_API
```

## 경찰청 기본 중복 기준

경찰청 API 응답에는 우리 서비스에서 바로 사용할 내부 ID가 없을 수 있으므로, 주요 필드를 조합하여 `externalKey`를 만든다.

```txt
중복 기준 = externalKey
```

externalKey 구성:

```txt
externalKey = 이름 + 발생일자 + 발생주소 + 성별
```

예시:

```txt
nm + occrde + occrAdres + sexdstnDscd
```

## 경찰청 저장 테이블

```txt
police_missing_alerts
```

현재 서버 코드에서도 `externalKey`를 기준으로 기존 데이터를 찾고, 있으면 갱신하고 없으면 새로 저장하는 방식으로 처리한다. 사진은 Base64 원문을 DB에 저장하지 않고 이미지 파일로 저장한 뒤 `photoUrl` 경로만 저장한다.

## 경찰청 저장 필드 기준

|API 필드|DB 필드|의미|
|---|---|---|
|nm|name|이름|
|sexdstnDscd|gender|성별|
|writngTrgetDscd|targetType|대상 유형|
|occrde|occurredDate|발생일자|
|occrAdres|occurredAddress|발생 주소|
|age|age|당시 나이|
|ageNow|ageNow|현재 나이|
|height|height|키|
|bdwgh|weight|몸무게|
|frmDscd|bodyType|체형|
|faceshpeDscd|faceShape|얼굴형|
|hairshpeDscd|hairShape|머리 형태|
|haircolrDscd|hairColor|머리 색상|
|alldressingDscd|clothing|착의사항|
|etcSpfeatr|feature|기타 특징|
|tknphotoFile|photoUrl|사진 저장 경로|
|syncedAt|syncedAt|동기화 시간|

## 경찰청 사진 중복 처리 기준

사진 데이터는 `tknphotoFile` 값으로 전달될 수 있다.

Base64 원문은 DB에 저장하지 않는다.

처리 방식:

1. Base64 데이터 확인
    
2. 비어 있으면 사진 없음으로 처리
    
3. Base64 디코딩
    
4. 이미지 파일로 저장
    
5. DB에는 파일 경로만 저장
    

저장 위치:

```txt
uploads/police-missing
```

파일명 기준:

```txt
externalKey hash + .jpg
```

## 경찰청 데이터 갱신 기준

같은 externalKey의 데이터가 다시 수집되면 기존 행을 갱신한다.

갱신 대상:

```txt
이름
성별
대상 유형
발생일자
발생 주소
나이
신체 정보
착의사항
특징
사진 경로
syncedAt
```

## RAG 문서 중복 기준

대상 테이블:

```txt
rag_documents
```

RAG 문서는 원본 데이터가 아니라 Markdown으로 변환된 최종 문서를 기준으로 중복 여부를 판단한다.

## RAG 기본 중복 기준

```txt
중복 기준 = source_type + source_id
```

예시:

```txt
source_type = welfare_service
source_id = servId
```

```txt
source_type = welfare_facility
source_id = fcltCd
```

## RAG 대체 중복 기준

source_id가 없는 경우에는 문서 제목과 출처 정보를 조합한다.

```txt
대체 중복 기준 = source_type + title + source_url
```

## raw_hash 기준

RAG 문서는 최종 Markdown 문자열을 기준으로 `raw_hash`를 계산한다.

처리 흐름:

1. API 응답 수신
    
2. 필요한 필드 추출
    
3. Markdown 문서 생성
    
4. raw_hash 계산
    
5. 기존 문서의 raw_hash와 비교
    
6. 같으면 저장 및 재임베딩 생략
    
7. 다르면 DB 갱신
    
8. Qdrant 재임베딩
    

## raw_hash가 같은 경우

```txt
기존 raw_hash == 신규 raw_hash
```

처리:

```txt
DB 문서 내용 변경 없음
Qdrant 재임베딩 안 함
updatedAt만 필요 시 갱신
```

## raw_hash가 다른 경우

```txt
기존 raw_hash != 신규 raw_hash
```

처리:

```txt
rag_documents 내용 갱신
raw_hash 갱신
Qdrant 재임베딩 대상에 포함
```

## RAG 수집 작업 중복 기준

대상 테이블:

```txt
rag_ingest_jobs
```

수집 작업은 같은 작업이 동시에 여러 번 실행되지 않도록 관리한다.

중복 기준:

```txt
source_type + status
```

예시:

```txt
source_type = welfare_service
status = running
```

이미 실행 중인 작업이 있으면 새 작업을 중복 실행하지 않는다.

## rag_ingest_jobs 저장 기준

|필드|의미|
|---|---|
|job_id|수집 작업 ID|
|source_type|수집 대상 유형|
|source_name|수집 대상 이름|
|status|running, success, failed|
|started_at|시작 시간|
|finished_at|종료 시간|
|total_count|전체 처리 수|
|success_count|성공 수|
|failed_count|실패 수|
|error_message|오류 메시지|

## alerts 중복 기준

대상 테이블:

```txt
alerts
```

알림 데이터는 같은 사건이 반복 생성되지 않도록 관리한다.

## 일반 알림 중복 기준

```txt
중복 기준 = seniorId + type + message + createdDate
```

같은 사용자에게 같은 유형과 같은 메시지의 알림이 같은 날 반복 생성되지 않도록 한다.

## SOS 알림 기준

SOS는 실제 긴급 상황일 수 있으므로 일반 알림보다 보수적으로 처리한다.

```txt
중복 기준 = seniorId + type + createdTimeWindow
```

예시:

```txt
같은 seniorId가 5분 안에 SOS를 여러 번 누른 경우 중복 처리 또는 최신 상태 갱신
```

## 안전구역 이탈 알림 기준

```txt
중복 기준 = seniorId + safeZoneId + type + 상태
```

안전구역 밖에 계속 머무는 동안 같은 이탈 알림이 반복 생성되지 않도록 한다.

상태가 다시 안전구역 안으로 들어왔다가 다시 이탈하면 새로운 알림으로 처리할 수 있다.

## 위치 데이터 중복 기준

대상 테이블:

```txt
location_status
```

또는 위치 이력 테이블이 있는 경우:

```txt
location_histories
```

## 현재 위치 상태 중복 기준

현재 위치 상태는 사용자별로 하나만 유지한다.

```txt
중복 기준 = seniorId
```

같은 seniorId의 위치가 다시 들어오면 insert가 아니라 update한다.

## 위치 이력 저장 기준

위치 이력은 모든 위치를 무조건 저장하지 않는다.

중복 또는 과도한 저장을 막기 위해 이동 거리와 시간 간격 기준을 사용한다.

예시 기준:

```txt
마지막 저장 위치에서 50m 이상 이동한 경우 저장
또는 마지막 저장 후 일정 시간이 지난 경우 저장
```

## schedules 중복 기준

대상 테이블:

```txt
schedules
```

일정은 같은 사용자에게 같은 날짜, 같은 시간, 같은 내용이 반복 저장되지 않도록 한다.

```txt
중복 기준 = seniorId + scheduleDate + scheduleTime + content
```

같은 일정이 있으면 새로 insert하지 않고 기존 일정을 유지하거나 갱신한다.

## safe_zones 중복 기준

대상 테이블:

```txt
safe_zones
```

안전구역은 같은 사용자에게 같은 위치와 반경의 안전구역이 반복 저장되지 않도록 한다.

```txt
중복 기준 = seniorId + centerLatitude + centerLongitude + radiusMeters
```

좌표는 소수점 오차가 있을 수 있으므로 반올림 기준을 둘 수 있다.

예시:

```txt
위도, 경도를 소수점 5~6자리 기준으로 비교
```

## job_postings_cache 중복 기준

대상 테이블:

```txt
job_postings_cache
```

외부 일자리 공고 캐시는 공고 ID 또는 공고 제목과 기관명을 기준으로 중복 여부를 판단한다.

기본 기준:

```txt
중복 기준 = jobId
```

대체 기준:

```txt
대체 중복 기준 = 제목 + 기관명 + 모집기간
```

## 중복 처리 시 update 기준

기존 데이터가 있는 경우 모든 값을 무조건 덮어쓰지 않는다.

아래 기준으로 갱신한다.

|상황|처리|
|---|---|
|값이 새로 들어옴|기존 값 갱신|
|새 값이 비어 있음|기존 값 유지|
|상태 값이 변경됨|상태 갱신|
|사진 경로가 변경됨|사진 경로 갱신|
|raw_hash가 같음|RAG 재임베딩 안 함|
|raw_hash가 다름|문서 갱신 후 재임베딩|

## null 값 처리 기준

API 응답 필드는 비어 있을 수 있다.

저장 전 아래 기준을 적용한다.

```txt
null → 빈 문자열 또는 기본값 처리
공백 문자열 → 저장 제외 또는 trim 처리
숫자 필드 오류 → 0 또는 null 처리
날짜 형식 오류 → 저장 제외 또는 문자열로 저장
```

## 저장하지 않는 데이터

아래 데이터는 DB 또는 RAG 문서에 저장하지 않는다.

```txt
공공데이터포털 serviceKey
경찰청 esntlId
경찰청 authKey
Base64 이미지 원문
원본 XML 전체
불필요한 시스템 필드
중복 코드 설명 전체
사용자 질문에 필요 없는 대량 원문
```

## 저장 가능하지만 주의가 필요한 데이터

```txt
실종자 이름
실종자 발생장소
실종자 사진 경로
보호자 알림 내용
사용자 위치 정보
건강 정보
```

이 데이터들은 서비스 제공에는 필요할 수 있지만 개인정보성 또는 민감성이 있을 수 있으므로 접근 권한과 노출 범위를 제한해야 한다.

## 최종 정리

DB 저장 중복처리의 핵심은 데이터마다 적절한 고유 기준을 정하는 것이다.

복지서비스는 `servId`, 복지시설은 `fcltCd`, 경찰청 실종자 데이터는 `externalKey`, RAG 문서는 `source_type + source_id`와 `raw_hash`를 기준으로 관리한다.

기존 데이터가 있으면 update하고, 없으면 insert한다.

RAG 문서는 내용이 바뀐 경우에만 재임베딩하여 불필요한 Qdrant 저장과 임베딩 비용을 줄인다.