
## 사용 목적

경찰청 Safe182 API에서 실종 경보 및 실종자 검색 데이터를 가져와 서비스 DB에 저장하고, 사용자·보호자·복지사 화면에서 실종자 정보를 확인할 수 있도록 처리한다.

이 문서는 경찰청 API 자체의 명세가 아니라, 우리 Spring Boot 서버에서 경찰청 API 데이터를 어떻게 호출하고, 파싱하고, 저장하는지 정리하기 위한 구현 메모다.

## 대상 API

|API 문서|Endpoint|설명|
|---|---|---|
|경찰청_실종경보_API|[https://www.safe182.go.kr/api/lcm/amberList.do](https://www.safe182.go.kr/api/lcm/amberList.do)|실종 경보 목록 조회|
|경찰청_실종자검색_API|[https://www.safe182.go.kr/api/lcm/findChildList.do](https://www.safe182.go.kr/api/lcm/findChildList.do)|실종자 검색 목록 조회|

## 서버 구현 위치

```txt
src/main/java/com/nuri/woori/service/PoliceMissingAlertService.java
```

## 관련 DB 테이블

```txt
police_missing_alerts
```

## 전체 처리 흐름

1. 서버에서 경찰청 Safe182 API 호출
    
2. POST 방식으로 요청 파라미터 전송
    
3. XML 응답 수신
    
4. 한글 인코딩 문제 보정
    
5. XML에서 실종자 정보 목록 추출
    
6. 각 실종자 정보를 PoliceMissingAlert 엔티티로 변환
    
7. 사진 Base64 데이터가 있으면 이미지 파일로 저장
    
8. DB에는 사진 원문이 아니라 파일 경로만 저장
    
9. externalKey 기준으로 중복 여부 확인
    
10. 기존 데이터가 있으면 갱신하고, 없으면 새로 저장
    
11. syncedAt 값을 현재 시간으로 갱신
    

## API 호출 방식

경찰청 API는 `POST` 방식으로 호출한다.

요청 시 `application/x-www-form-urlencoded` 형식으로 파라미터를 전송한다.

## 공통 요청 파라미터

|파라미터|의미|사용 방식|
|---|---|---|
|esntlId|경찰청 API 고유 아이디|환경변수 또는 설정 파일에서 읽음|
|authKey|경찰청 API 인증키|환경변수 또는 설정 파일에서 읽음|
|rowSize|한 페이지 게시물 수|현재 서버 코드에서는 100 사용|
|page|페이지 번호|1부터 반복 조회|
|xmlUseYN|XML 사용 여부|Y|

## 실종경보 API 요청 파라미터

실종경보 API는 발생일자 기준으로 조회한다.

|파라미터|의미|사용 방식|
|---|---|---|
|occrde|발생일자|YYYYMMDD 형식으로 전달|

예시 흐름:

```txt
LocalDate date
↓
date.format(DateTimeFormatter.BASIC_ISO_DATE)
↓
occrde=20260529
```

## 실종자검색 API 요청 파라미터

실종자검색 API는 날짜 조건 없이 실종자 목록을 조회하는 데 사용한다.

현재 서버 코드에서는 기본적으로 아래 파라미터를 사용한다.

|파라미터|의미|
|---|---|
|esntlId|고유 아이디|
|authKey|인증키|
|rowSize|한 페이지 게시물 수|
|page|페이지 번호|
|xmlUseYN|XML 사용 여부|

## 동기화 메서드 기준

### syncTodayAlerts

오늘 날짜 기준으로 실종경보 API를 동기화한다.

```txt
syncTodayAlerts()
↓
syncAlerts(LocalDate.now())
↓
syncPages(date)
```

## syncAlerts(LocalDate date)

특정 날짜의 실종경보 데이터를 동기화한다.

```txt
syncAlerts(date)
↓
API 키 검증
↓
해당 날짜 기준 페이지 반복 조회
↓
DB 저장
```

## syncAlerts(LocalDate from, LocalDate to)

시작일과 종료일 사이의 실종경보 데이터를 날짜별로 동기화한다.

```txt
syncAlerts(from, to)
↓
from부터 to까지 날짜 반복
↓
각 날짜마다 syncPages(date) 실행
```

## syncAllAlerts

실종자검색 API를 이용해 전체 실종자 목록을 동기화한다.

```txt
syncAllAlerts()
↓
requestPageWithoutDate(page)
↓
findChildList.do 호출
↓
DB 저장
```

## 페이지 처리 기준

한 번에 가져오는 데이터 수는 `ROW_SIZE` 기준으로 처리한다.

```txt
ROW_SIZE = 100
MAX_PAGES = 4
```

현재 설정 기준으로 최대 4페이지까지 조회한다.

즉, 한 번의 동기화에서 최대 400건까지 조회할 수 있다.

## 페이지 반복 종료 조건

다음 조건 중 하나에 해당하면 페이지 반복을 종료한다.

1. 응답 목록이 비어 있는 경우
    
2. 현재 페이지까지 조회한 수가 전체 개수 이상인 경우
    
3. 응답 목록 수가 ROW_SIZE보다 작은 경우
    
4. MAX_PAGES에 도달한 경우
    

## XML 응답 처리 흐름

1. API 응답을 byte 배열로 받는다.
    
2. UTF-8, MS949, EUC-KR 방식으로 각각 디코딩 후보를 만든다.
    
3. 한글이 가장 정상적으로 보이는 문자열을 선택한다.
    
4. XML Document로 파싱한다.
    
5. totalCount, result, msg 값을 읽는다.
    
6. list 태그 안에서 실종자 데이터 항목을 찾는다.
    
7. 각 항목을 PoliceMissingAlert 엔티티로 변환한다.
    

## 인코딩 보정 기준

경찰청 API 응답은 한글이 깨질 수 있으므로 서버에서 인코딩 보정 로직을 사용한다.

처리 후보:

```txt
UTF-8
MS949
EUC-KR
mojibake 보정 문자열
```

가장 한글 점수가 높은 문자열을 선택하여 XML 파싱에 사용한다.

## 주요 필드 매핑

|API 필드|엔티티 필드|의미|
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

## 중복 저장 기준

경찰청 API 응답에는 우리 서비스에서 바로 사용할 내부 ID가 없을 수 있으므로, 주요 정보를 조합하여 `externalKey`를 만든다.

```txt
externalKey = 이름 + 발생일자 + 발생주소 + 성별
```

DB 저장 시 `externalKey`로 기존 데이터가 있는지 먼저 확인한다.

```txt
기존 데이터 있음 → 기존 데이터 갱신
기존 데이터 없음 → 새 데이터 저장
```

## 사진 저장 기준

경찰청 API의 사진 데이터는 Base64 형태로 올 수 있다.

Base64 원문은 DB에 직접 저장하지 않는다.

처리 방식:

1. tknphotoFile 값 확인
    
2. 값이 비어 있으면 사진 없음으로 처리
    
3. Base64 디코딩
    
4. uploads/police-missing 폴더 생성
    
5. externalKey hash 값을 이용해 jpg 파일명 생성
    
6. 이미지 파일 저장
    
7. DB에는 `/uploads/police-missing/파일명.jpg` 경로만 저장
    

## 사진 저장 위치

```txt
uploads/police-missing
```

## DB 저장 시 갱신되는 값

데이터를 저장할 때마다 `syncedAt` 값을 현재 시간으로 갱신한다.

```txt
syncedAt = LocalDateTime.now()
```

## 인증 정보 관리

경찰청 API 인증 정보는 코드에 직접 작성하지 않는다.

아래 설정값에서 읽어온다.

```txt
police.safe182.esntl-id
police.safe182.auth-key
SAFE182_ESNTL_ID
SAFE182_AUTH_KEY
```

## 인증 정보 우선순위

서버에서는 설정 파일 또는 환경변수에서 값을 읽어온다.

```txt
1. police.safe182.esntl-id
2. SAFE182_ESNTL_ID

3. police.safe182.auth-key
4. SAFE182_AUTH_KEY
```

## 인증 정보 검증

API 호출 전에 인증 정보가 비어 있는지 확인한다.

```txt
esntlId가 비어 있음 → 예외 발생
authKey가 비어 있음 → 예외 발생
```

## 로그 출력 기준

동기화할 때마다 아래 정보를 로그로 출력한다.

```txt
조회 날짜
페이지 번호
전체 데이터 수
현재 페이지 목록 수
결과 코드
결과 메시지
```

로그 예시:

```txt
Safe182 date=2026-05-29, page=1, totalCount=201, listCount=100, result=00, msg=OK
```

## RAG 처리 기준

경찰청 실종자 원본 데이터는 RAG 문서로 변환하지 않는다.

이유:

1. 실종자 데이터는 개인정보성 정보가 포함될 수 있다.
    
2. 사진 데이터가 포함될 수 있다.
    
3. 최신성이 중요하다.
    
4. 대량 원본 데이터가 RAG에 들어가면 오래된 정보가 답변에 섞일 수 있다.
    

따라서 RAG에는 아래 정보만 포함한다.

```txt
API 설명
요청 파라미터
응답 필드 의미
서버 처리 흐름
DB 저장 기준
사진 저장 기준
중복 처리 기준
보안 관리 규칙
```

## RAG에서 제외할 정보

```txt
esntlId
authKey
실종자 원본 데이터 전체
Base64 사진 원문
개인정보성 원본 응답
내부 DB ID
불필요한 시스템 필드
```

## 오류 처리 기준

API 호출 또는 XML 파싱 중 오류가 발생할 수 있다.

주요 오류 상황:

|오류 상황|처리 방식|
|---|---|
|인증 정보 없음|API 호출 전 예외 발생|
|API 응답 없음|동기화 실패 처리|
|XML 파싱 실패|RuntimeException 발생|
|한글 인코딩 깨짐|인코딩 보정 로직 적용|
|사진 Base64 디코딩 실패|사진 없이 저장|
|중복 데이터 수신|기존 데이터 갱신|
|응답 목록 없음|페이지 반복 종료|

## 주의사항

경찰청 API 인증키는 Obsidian에 작성하지 않는다.

GitHub에 인증키를 올리지 않는다.

실종자 원본 데이터 전체를 Obsidian에 저장하지 않는다.

사진 Base64 원문을 Obsidian이나 DB에 저장하지 않는다.

경찰청 API 응답은 한글 인코딩 문제가 발생할 수 있으므로 인코딩 보정 로직이 필요하다.

일일 조회 건수 제한이 있으므로 무분별한 반복 호출을 피해야 한다.

실종자 데이터는 최신성이 중요하므로 동기화 주기를 별도로 관리해야 한다.

## 최종 정리

경찰청 API 서버 처리 흐름은 Safe182 API에서 실종 경보 또는 실종자 검색 데이터를 가져와 XML로 파싱하고, 필요한 필드를 추출한 뒤 `police_missing_alerts` 테이블에 저장하는 구조다.

중복 저장은 `externalKey` 기준으로 방지하고, 사진은 Base64 원문이 아니라 이미지 파일로 저장한 뒤 경로만 DB에 저장한다.

RAG에는 실종자 원본 데이터가 아니라 API 구조, 필드 의미, 서버 처리 흐름, DB 저장 기준, 보안 관리 규칙만 포함한다.