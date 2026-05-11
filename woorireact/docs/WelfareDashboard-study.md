# WelfareDashboard 코드 공부용 설명

이 문서는 `src/pages/Common/WelfareDashboard.jsx`를 다시 공부할 때 보기 좋게 섹션별로 정리한 설명입니다. 실제 화면 파일에 주석을 너무 많이 넣으면 유지보수가 어려워질 수 있어서, 공부용 설명은 별도 문서로 분리했습니다.

## 1. import 구문

```jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { WELFARE_DEMO_SENIORS } from "../../data/welfareSeniorDemoData";
```

- `useState`: 화면에서 바뀌는 값을 저장하는 React Hook입니다. 값이 바뀌면 화면이 다시 렌더링됩니다.
- `useEffect`: 컴포넌트가 처음 열렸을 때 API 호출, localStorage 읽기 같은 작업을 실행할 때 사용합니다.
- `Link`: 페이지 이동을 할 때 새로고침 없이 이동하게 해주는 React Router 컴포넌트입니다.
- `useNavigate`: 버튼 클릭 같은 이벤트에서 코드로 페이지를 이동할 때 사용합니다.
- `Bell`: 알림 버튼에 사용하는 아이콘입니다.
- `WELFARE_DEMO_SENIORS`: 백엔드 API가 없거나 실패했을 때 보여줄 임시 대상자 데이터입니다.

## 2. 상수 선언

```jsx
const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";
const SOS_REQUESTS_STORAGE_KEY = "welfareSosRequests";
const WELFARE_DECISION_STORAGE_KEY = "welfareDecisions";
const LAST_ACCESS_ALERT_HOURS = 4;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;
```

- `WELFARE_SENIOR_API_URL`: Spring 백엔드에서 대상자 목록을 받아오는 주소입니다.
- `SOS_REQUESTS_STORAGE_KEY`: SOS 조치 내역을 브라우저 localStorage에 저장할 때 쓰는 이름입니다.
- `WELFARE_DECISION_STORAGE_KEY`: 복지사 판단값을 localStorage에 저장할 때 쓰는 이름입니다.
- `LAST_ACCESS_ALERT_HOURS`: 마지막 접속 시간이 몇 시간 초과일 때 알림을 줄지 정하는 기준입니다. 현재는 `4시간 초과`입니다.
- `NIGHT_START_HOUR`, `NIGHT_END_HOUR`: 밤 시간대에는 접속 지연 알림을 막기 위한 기준입니다. 현재는 22시부터 06시까지입니다.

## 3. 필터 그룹

```jsx
const FILTER_GROUPS = [
    { key : "healthStatus", label : "건강 상태", options : ["양호", "주의", "위험"] },
    { key : "locationStatus", label : "위치 상태", options : ["정상", "안전구역 이탈"] },
    { key : "alertStatus", label : "알림 상태", options : ["없음", "미복용"] },
    { key : "jobStatus", label : "일자리 상태", options : ["추천 완료", "지원 중", "미추천"] },
    { key : "welfareDecision", label : "복지사 판단", options : ["미검토", "적합", "보류", "부적합"] },
];
```

이 배열은 필터 UI를 자동으로 만들기 위한 설정값입니다.

- `key`: 실제 대상자 데이터의 필드명입니다.
- `label`: 화면에 보이는 필터 제목입니다.
- `options`: 체크박스로 보여줄 세부 항목입니다.

즉 `FILTER_GROUPS`를 기준으로 필터 탭과 체크박스가 반복 출력됩니다. 나중에 필터를 추가할 때 이 배열에 한 줄만 추가하면 화면도 같이 늘어납니다.

## 4. 빈 필터 만들기

```jsx
const createEmptyFilters = () => ({
    healthStatus : [],
    locationStatus : [],
    alertStatus : [],
    jobStatus : [],
    welfareDecision : [],
});
```

각 필터의 선택값을 빈 배열로 초기화하는 함수입니다.

- 빈 배열 `[]`은 아무 조건도 선택하지 않았다는 뜻입니다.
- 이 코드에서는 아무것도 선택하지 않으면 전체가 보이도록 처리합니다.

## 5. localStorage 읽기

```jsx
const getSavedSosRequests = () => {
    try {
        return JSON.parse(localStorage.getItem(SOS_REQUESTS_STORAGE_KEY) || "[]");
    } catch (error) {
        return [];
    }
};
```

localStorage는 브라우저에 데이터를 임시 저장하는 공간입니다.

- `localStorage.getItem(...)`: 저장된 문자열을 가져옵니다.
- `JSON.parse(...)`: 문자열을 배열이나 객체로 바꿉니다.
- `try/catch`: 저장된 값이 깨져 있어도 화면이 터지지 않게 막습니다.

`getSavedWelfareDecisions`도 같은 원리로 복지사 판단값을 가져옵니다.

## 6. 저장된 복지사 판단 적용

```jsx
const applySavedWelfareDecisions = (seniors) => {
    const savedDecisions = getSavedWelfareDecisions();

    return seniors.map((senior) => ({
        ...senior,
        welfareDecision : savedDecisions[senior.id] || senior.welfareDecision,
    }));
};
```

대상자 목록에 localStorage에 저장된 복지사 판단값을 덮어씌우는 함수입니다.

- `map`: 배열의 각 항목을 하나씩 바꿔서 새 배열을 만듭니다.
- `{ ...senior }`: 기존 대상자 정보를 복사합니다.
- `savedDecisions[senior.id] || senior.welfareDecision`: 저장된 판단값이 있으면 그 값을 쓰고, 없으면 기존 값을 씁니다.

이 함수 덕분에 상세 페이지에서 `적합`을 누르고 목록으로 돌아와도 판단값이 유지됩니다.

## 7. 마지막 접속 시간 계산

```jsx
const getLastAccessHours = (lastAccess) => {
    const hourMatch = String(lastAccess).match(/(\d+)\s*시간/);
    const minuteMatch = String(lastAccess).match(/(\d+)\s*분/);
};
```

`"5시간 전"`, `"40분 전"` 같은 글자에서 숫자를 뽑아 시간 단위로 바꾸는 함수입니다.

- `"5시간 전"`이면 `5`
- `"40분 전"`이면 `40 / 60`
- 값이 없거나 형식이 다르면 `null`

이 값을 기준으로 마지막 접속 시간을 숨길지, 알림을 줄지 판단합니다.

## 8. 밤 시간 확인

```jsx
const isNightTime = () => {
    const currentHour = new Date().getHours();
    return currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR;
};
```

현재 시간이 밤인지 확인합니다.

- `new Date().getHours()`: 현재 시간을 0부터 23 사이 숫자로 가져옵니다.
- 22시 이상이거나 6시 전이면 밤으로 판단합니다.

밤에는 마지막 접속 지연 알림을 띄우지 않기 위해 사용합니다.

## 9. 마지막 접속 시간 숨김/알림 조건

```jsx
const shouldHideLastAccess = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);
    return lastAccessHours != null && lastAccessHours <= LAST_ACCESS_ALERT_HOURS;
};
```

마지막 접속 시간이 4시간 이하이면 표에서 공란으로 표시합니다.

```jsx
const shouldNotifyLastAccessDelay = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);
    return !isNightTime() && lastAccessHours != null && lastAccessHours > LAST_ACCESS_ALERT_HOURS;
};
```

4시간 초과이고 밤이 아니면 알림을 만듭니다.

## 10. 컴포넌트 시작

```jsx
function WelfareDashboard(){
    const navigate = useNavigate();
    const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
```

`WelfareDashboard`는 복지사 대상자 관리 화면 전체를 담당하는 React 컴포넌트입니다.

- `navigate`: 코드로 페이지 이동할 때 사용합니다.
- `sessionStorage`: 로그인한 복지사 정보를 현재 브라우저 탭 동안만 저장합니다.
- `localStorage`는 브라우저를 껐다 켜도 남고, `sessionStorage`는 탭을 닫으면 사라집니다.

## 11. useState 상태값

```jsx
const [seniors, setSeniors] = useState([]);
const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
const [isNotificationOpen, setIsNotificationOpen] = useState(false);
```

`useState`는 화면에서 바뀌는 데이터를 저장합니다.

- `seniors`: 대상자 목록
- `isLoadingSeniors`: 데이터를 불러오는 중인지 여부
- `seniorLoadError`: API 오류 메시지
- `isNotificationOpen`: 알림 창 열림 여부
- `sosRequests`: SOS 조치 내역
- `currentPage`: 현재 페이지 번호
- `activeFilterKey`: 현재 선택된 필터 탭
- `filters`: 검색 버튼을 눌러 실제 적용된 필터
- `draftFilters`: 체크박스에서 선택 중이지만 아직 적용되지 않은 필터
- `searchKeyword`: 실제 적용된 검색어
- `draftSearchKeyword`: 입력칸에 쓰는 중인 검색어

`draft`가 붙은 값은 아직 화면 목록에 반영되지 않은 임시값입니다. 검색 버튼을 눌러야 실제 필터로 적용됩니다.

## 12. useEffect로 데이터 불러오기

```jsx
useEffect(() => {
    const loadSeniors = async () => {
        const response = await fetch(WELFARE_SENIOR_API_URL);
        const data = await response.json();
        setSeniors(applySavedWelfareDecisions(data.length > 0 ? data : WELFARE_DEMO_SENIORS));
    };

    loadSeniors();
    setSosRequests(getSavedSosRequests());
}, []);
```

이 코드는 화면이 처음 열릴 때 한 번 실행됩니다.

- `fetch`: API를 호출합니다.
- `await`: API 응답이 올 때까지 기다립니다.
- API 성공 시 Spring 데이터 사용
- API 실패 시 임시 데이터 사용
- 가져온 데이터에 저장된 복지사 판단값을 다시 적용
- SOS 조치 내역도 localStorage에서 가져옴

마지막의 `[]`는 이 효과를 처음 한 번만 실행하겠다는 의미입니다.

## 13. 필터링 로직

```jsx
const filteredSeniors = seniors.filter((senior) => {
    const matchHealth = isFilterMatched(filters.healthStatus, senior.healthStatus);
    const matchKeyword = normalizedKeyword === "" || searchableValues.some(...);

    return matchHealth && matchLocation && matchAlert && matchJob && matchDecision && matchKeyword;
});
```

`filter`는 조건에 맞는 항목만 남기는 배열 함수입니다.

여기서는 대상자 한 명씩 확인하면서 다음 조건을 모두 만족하는지 봅니다.

- 건강 상태 필터
- 위치 상태 필터
- 알림 상태 필터
- 일자리 상태 필터
- 복지사 판단 필터
- 검색어

모든 조건이 `true`인 대상자만 표에 남습니다.

## 14. 검색 로직

```jsx
const searchableValues = [
    senior.id,
    `ID ${String(senior.id).padStart(4, "0")}`,
    senior.name,
    senior.region,
    senior.healthStatus,
];
```

검색어가 이름만 보는 게 아니라 여러 칼럼을 같이 보도록 만든 배열입니다.

- ID
- 이름
- 나이
- 성별
- 거주 지역
- 건강 상태
- 알림 상태
- 일자리 상태
- 복지사 판단

`some`은 배열 중 하나라도 조건을 만족하면 `true`를 반환합니다.

## 15. 페이지 계산

```jsx
const totalPages = Math.max(1, Math.ceil(filteredSeniors.length / itemPerPage));
const startIndex = (currentPage - 1) * itemPerPage;
const endIndex = startIndex + itemPerPage;
```

페이지네이션을 위한 계산입니다.

- `itemPerPage`: 한 페이지에 보여줄 개수
- `totalPages`: 전체 페이지 수
- `startIndex`: 현재 페이지의 시작 위치
- `endIndex`: 현재 페이지의 끝 위치

예를 들어 한 페이지에 10명씩이면 2페이지의 시작 위치는 10입니다.

## 16. 우선순위 정렬

```jsx
const getPriorityRank = (senior) => {
    if (senior.locationStatus === "안전구역 이탈") return 1;
    if (senior.healthStatus === "위험") return 2;
    if (senior.alertStatus === "미복용") return 3;
    if (senior.healthStatus === "주의") return 4;
    return 5;
};
```

확인이 급한 대상자를 위로 올리기 위한 함수입니다.

숫자가 작을수록 더 먼저 보입니다.

1. 안전구역 이탈
2. 건강 위험
3. 미복용
4. 건강 주의
5. 특이사항 없음

## 17. 정렬 후 현재 페이지 데이터 자르기

```jsx
const sortedSeniors = [...filteredSeniors].sort((a, b) => {
    return getPriorityRank(a) - getPriorityRank(b);
});

const currentSeniors = sortedSeniors.slice(startIndex, endIndex);
```

- `sort`: 배열을 정렬합니다.
- `[...filteredSeniors]`: 원본 배열을 직접 바꾸지 않기 위해 복사합니다.
- `slice`: 현재 페이지에 보여줄 부분만 잘라냅니다.

흐름은 `필터링 -> 우선순위 정렬 -> 현재 페이지 데이터 추출`입니다.

## 18. 필터 적용과 초기화

```jsx
const applyFilters = () => {
    setFilters(cloneFilters(draftFilters));
    setSearchKeyword(draftSearchKeyword.trim());
    setCurrentPage(1);
};
```

검색 버튼을 눌렀을 때 임시 필터와 임시 검색어를 실제 값으로 바꿉니다.

```jsx
const resetFilters = () => {
    setDraftFilters(createEmptyFilters());
    setFilters(createEmptyFilters());
    setDraftSearchKeyword("");
    setSearchKeyword("");
    setActiveFilterKey("healthStatus");
    setCurrentPage(1);
};
```

초기화 버튼을 누르면 필터, 검색어, 페이지를 모두 처음 상태로 되돌립니다.

## 19. 요약 카드

```jsx
const summaryCounts = {
    total : seniors.length,
    sos : sosRequests.length,
    danger : seniors.filter((senior) => senior.healthStatus === "위험").length,
    alert : seniors.filter((senior) => senior.alertStatus !== "없음").length,
};
```

상단 카드에 보여줄 숫자를 계산합니다.

- 전체 대상자 수
- SOS 조치 수
- 건강 위험 대상자 수
- 알림 있음 대상자 수

## 20. 알림 목록 만들기

```jsx
const welfareNotifications = seniors.flatMap((senior) => {
    const notifications = [];

    if (senior.locationStatus === "안전구역 이탈") {
        notifications.push(...);
    }

    return notifications;
});
```

대상자 상태를 보고 알림 목록을 만듭니다.

- 안전구역 이탈
- 건강 위험
- 미복용
- 4시간 초과 미접속

`flatMap`은 각 대상자마다 여러 개의 알림이 나올 수 있을 때 사용하기 좋습니다.

## 21. styles 객체

```jsx
const styles = {
    page : {
        minHeight : "100vh",
        backgroundColor : "var(--bg-color)",
    },
};
```

이 컴포넌트는 CSS 파일 대신 JavaScript 객체로 스타일을 관리합니다.

- `styles.page`: 전체 페이지 스타일
- `styles.topHeader`: 상단 헤더
- `styles.filterBox`: 필터 영역
- `styles.tableBox`: 표 영역
- `styles.badge`: 상태 배지
- `styles.notificationPanel`: 알림 패널

JSX에서는 `style={styles.page}`처럼 연결합니다.

## 22. 배지 색상 함수

```jsx
const getBadgeStyle = (type, value) => {
    const badgeColors = {
        health : {
            "양호" : {...},
            "주의" : {...},
            "위험" : {...},
        },
        decision : {
            "미검토" : {...},
            "적합" : {...},
            "보류" : {...},
            "부적합" : {...},
        },
    };
};
```

건강 상태와 복지사 판단 상태에 따라 색을 다르게 보여주는 함수입니다.

- 건강 상태 `위험`: 붉은색 계열
- 건강 상태 `주의`: 노란색 계열
- 복지사 판단 `적합`: 하늘색 계열
- 복지사 판단 `부적합`: 붉은색 계열

## 23. 로그아웃

```jsx
const handleLogout = () => {
    sessionStorage.removeItem("currentWelfareWorker");
    navigate("/welfare-login");
};
```

로그아웃 버튼을 누르면 로그인 정보를 지우고 로그인 페이지로 이동합니다.

## 24. return JSX 구조

```jsx
return (
    <div style={styles.page}>
        <header>...</header>
        <div style={styles.content}>...</div>
    </div>
);
```

`return` 안의 JSX가 실제 브라우저 화면입니다.

큰 구조는 다음과 같습니다.

1. 전체 페이지
2. 상단 헤더
3. 로그인 복지사 정보와 알림 버튼
4. 요약 카드
5. 필터 영역
6. 검색어 입력
7. 대상자 테이블
8. 페이지 이동 버튼

## 25. 조건부 렌더링

```jsx
{currentWorker && (
    <div>...</div>
)}
```

`currentWorker`가 있을 때만 복지사 이름, 알림, 로그아웃 버튼을 보여줍니다.

```jsx
{isNotificationOpen && (
    <div style={styles.notificationPanel}>...</div>
)}
```

알림 버튼을 눌러 `isNotificationOpen`이 `true`일 때만 알림창을 보여줍니다.

## 26. 반복 렌더링

```jsx
{FILTER_GROUPS.map((group) => (
    <button key={group.key}>...</button>
))}
```

`map`은 배열을 화면 요소로 바꿀 때 사용합니다.

이 코드에서는 필터 그룹 배열을 버튼들로 바꿉니다.

```jsx
{currentSeniors.map((senior) => (
    <tr key={senior.id}>...</tr>
))}
```

현재 페이지의 대상자 배열을 표의 행으로 바꿉니다.

## 27. controlled input

```jsx
<input
    value={draftSearchKeyword}
    onChange={(event) => {
        setDraftSearchKeyword(event.target.value);
    }}
/>
```

React에서 input 값을 state로 관리하는 방식입니다.

- `value`: 현재 입력값
- `onChange`: 사용자가 입력할 때 state 업데이트

이렇게 하면 React가 입력값을 직접 관리하게 됩니다.

## 28. 테이블 출력

```jsx
<td style={styles.td}>
    {shouldHideLastAccess(senior.lastAccess) ? "" : senior.lastAccess}
</td>
```

마지막 접속 시간이 4시간 이하이면 빈칸으로 보여주고, 4시간 초과이면 시간을 보여줍니다.

```jsx
<td style={styles.td}>{senior.jobStatus}</td>
```

일자리 매칭 상태는 `senior.jobStatus` 값을 그대로 보여줍니다. 진짜 자동 매칭으로 가려면 Spring API가 이 값을 계산해서 내려줘야 합니다.

## 29. 페이지 이동 버튼

```jsx
<button onClick={goToPrevPage} disabled={currentPage === 1}>
    이전
</button>
```

현재 1페이지이면 이전 버튼을 비활성화합니다.

```jsx
{Array.from({ length : totalPages }, (_, index) => index + 1).map(...)}
```

전체 페이지 수만큼 페이지 번호 버튼을 만듭니다.

## 30. 전체 데이터 흐름

```text
화면 처음 열림
  ↓
Spring API에서 대상자 목록 요청
  ↓
실패하면 임시 데이터 사용
  ↓
localStorage에 저장된 복지사 판단값 적용
  ↓
필터/검색 조건 적용
  ↓
위험도 우선순위로 정렬
  ↓
현재 페이지 데이터만 표에 출력
```

## 31. 이 파일에서 꼭 이해해야 하는 React 개념

- `useState`: 화면에서 바뀌는 값을 저장합니다.
- `useEffect`: 화면이 처음 열릴 때 API 호출 같은 부수 작업을 실행합니다.
- `fetch`: 백엔드 API를 호출합니다.
- `localStorage`: 브라우저에 데이터를 계속 저장합니다.
- `sessionStorage`: 현재 탭에서만 로그인 정보를 저장합니다.
- `map`: 배열을 화면 요소로 바꿉니다.
- `filter`: 조건에 맞는 데이터만 남깁니다.
- `sort`: 데이터를 정렬합니다.
- `slice`: 배열의 일부만 자릅니다.
- 조건부 렌더링: 조건이 맞을 때만 화면에 보여줍니다.
- controlled input: input 값을 React state로 관리합니다.

## 32. 발표나 설명할 때 한 문장 요약

이 페이지는 복지사가 대상자 목록을 API 또는 임시 데이터로 불러온 뒤, 필터와 검색으로 필요한 대상자를 찾고, 위험도 우선순위와 알림을 통해 빠르게 조치할 수 있도록 만든 관리 화면입니다.
