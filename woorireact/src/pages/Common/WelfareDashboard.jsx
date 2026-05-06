// React에서 useState 기능을 가져옴
// useState은 화면에서 값이 바뀌었을 때 다시 렌더링되도록 도와주는 기능
// 여기서는 복지사가 누른 "적합 / 부적합" 판단 결과를 화면에 바로 반영하기 위해 사용함
import { useState } from "react";

// WelfareDashboard 컴포넌트
// 복지사가 담당 노인들의 상태를 한눈에 확인할 수 있는 대상자 관리 페이지
function WelfareDashboard(){
    // seniors 배열
    // 복지사가 관리하는 노인 대상자들의 임시 데이터
    // 나중에는 이 데이터를 백엔드(Spring Boot)나 DB(MySQL)에서 받아오게 됨
    const [seniors, setSeniors] = useState([
        {
            id : 1, // 대상자를 구분하기 위한 고유 번호
            name : "김ㅇㅇ", // 대상자 이름
            age : 76, // 나이
            gender : "여성", // 성별
            region : "서울시 강서구 화곡동", // 거주 지역
            healthStatus : "주의", // 건강 상태 : 양호 / 주의 / 위험
            lastAccess : "10분 전", // 마지막으로 서비스에 접속한 시간
            locationStatus : "정상", // 위치 상태 : 정상 / 안전구역 이탈
            alertStatus : "없음", // 알림 상태 : 없음 / 응급 알림 등
            jobStatus : "추천 완료", // 일자리 매칭 상태 : 추천 완료 / 지원 중 / 미추천

            // 복지사가 직접 판단하는 값
            // 처음에는 아직 확인하지 않았으므로 "미검토"로 표시
            // 복지사가 적합 버튼을 누르면 "적합"
            // 부적합 버튼을 누르면 "부적합"으로 변경됨
            welfareDecision : "미검토",
        },

        {
            id : 2,
            name : "박ㅇㅇ",
            age : 82,
            gender : "남성",
            region : "서울시 양천구 신월동",
            healthStatus : "위험",
            lastAccess : "1시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 3,
            name : "이ㅇㅇ",
            age : 74,
            gender : "여성",
            region : "서울시 강서구 등촌동",
            healthStatus : "양호",
            lastAccess : "30분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "미추천",
            welfareDecision : "미검토"
        },

        {
            id : 4,
            name : "최ㅇㅇ",
            age : 79,
            gender : "남성",
            region : "서울시 강서구 가양동",
            healthStatus : "주의",
            lastAccess : "2시간 전",
            locationStatus : "정상",
            alertStatus : "복약 미확인",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 5,
            name : "정ㅇㅇ",
            age : 71,
            gender : "여성",
            region : "서울시 양천구 목동",
            healthStatus : "양호",
            lastAccess : "5분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 6,
            name : "강ㅇㅇ",
            age : 85,
            gender : "남성",
            region : "서울시 강서구 방화동",
            healthStatus : "위험",
            lastAccess : "6시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 7,
            name : "조ㅇㅇ",
            age : 73,
            gender : "여성",
            region : "서울시 마포구 상암동",
            healthStatus : "양호",
            lastAccess : "20분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 8,
            name : "윤ㅇㅇ",
            age : 80,
            gender : "여성",
            region : "서울시 강서구 염창동",
            healthStatus : "주의",
            lastAccess : "3시간 전",
            locationStatus : "정상",
            alertStatus : "장시간 미응답",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 9,
            name : "장ㅇㅇ",
            age : 77,
            gender : "남성",
            region : "서울시 양천구 신정동",
            healthStatus : "양호",
            lastAccess : "15분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 10,
            name : "임ㅇㅇ",
            age : 83,
            gender : "여성",
            region : "서울시 강서구 내발산동",
            healthStatus : "위험",
            lastAccess : "8시간 전",
            locationStatus : "정상",
            alertStatus : "복약 미확인",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 11,
            name : "한ㅇㅇ",
            age : 70,
            gender : "남성",
            region : "서울시 마포구 성산동",
            healthStatus : "양호",
            lastAccess : "12분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 12,
            name : "오ㅇㅇ",
            age : 78,
            gender : "여성",
            region : "서울시 강서구 공항동",
            healthStatus : "주의",
            lastAccess : "45분 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "위치 이탈 알림",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 13,
            name : "서ㅇㅇ",
            age : 75,
            gender : "남성",
            region : "서울시 양천구 목동",
            healthStatus : "양호",
            lastAccess : "25분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 14,
            name : "신ㅇㅇ",
            age : 81,
            gender : "여성",
            region : "서울시 강서구 등촌동",
            healthStatus : "주의",
            lastAccess : "2시간 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 15,
            name : "권ㅇㅇ",
            age : 84,
            gender : "남성",
            region : "서울시 강서구 화곡동",
            healthStatus : "위험",
            lastAccess : "10시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 16,
            name : "황ㅇㅇ",
            age : 72,
            gender : "여성",
            region : "서울시 마포구 망원동",
            healthStatus : "양호",
            lastAccess : "7분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 17,
            name : "안ㅇㅇ",
            age : 79,
            gender : "남성",
            region : "서울시 양천구 신월동",
            healthStatus : "주의",
            lastAccess : "1시간 30분 전",
            locationStatus : "정상",
            alertStatus : "장시간 미응답",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 18,
            name : "송ㅇㅇ",
            age : 86,
            gender : "여성",
            region : "서울시 강서구 방화동",
            healthStatus : "위험",
            lastAccess : "12시간 전",
            locationStatus : "정상",
            alertStatus : "복약 미확인",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 19,
            name : "류ㅇㅇ",
            age : 73,
            gender : "남성",
            region : "서울시 강서구 가양동",
            healthStatus : "양호",
            lastAccess : "18분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 20,
            name : "전ㅇㅇ",
            age : 77,
            gender : "여성",
            region : "서울시 양천구 신정동",
            healthStatus : "주의",
            lastAccess : "50분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 21,
            name : "고ㅇㅇ",
            age : 80,
            gender : "남성",
            region : "서울시 강서구 염창동",
            healthStatus : "주의",
            lastAccess : "4시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "위치 이탈 알림",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 22,
            name : "문ㅇㅇ",
            age : 74,
            gender : "여성",
            region : "서울시 마포구 합정동",
            healthStatus : "양호",
            lastAccess : "9분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 23,
            name : "백ㅇㅇ",
            age : 82,
            gender : "남성",
            region : "서울시 강서구 공항동",
            healthStatus : "위험",
            lastAccess : "7시간 전",
            locationStatus : "정상",
            alertStatus : "응급 알림",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 24,
            name : "남ㅇㅇ",
            age : 76,
            gender : "여성",
            region : "서울시 양천구 목동",
            healthStatus : "주의",
            lastAccess : "35분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 25,
            name : "유ㅇㅇ",
            age : 71,
            gender : "남성",
            region : "서울시 강서구 등촌동",
            healthStatus : "양호",
            lastAccess : "3분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 26,
            name : "민ㅇㅇ",
            age : 83,
            gender : "여성",
            region : "서울시 강서구 방화동",
            healthStatus : "위험",
            lastAccess : "9시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "미추천",
            welfareDecision : "미검토",
        },

        {
            id : 27,
            name : "노ㅇㅇ",
            age : 75,
            gender : "남성",
            region : "서울시 양천구 신정동",
            healthStatus : "주의",
            lastAccess : "1시간 전",
            locationStatus : "정상",
            alertStatus : "복약 미확인",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 28,
            name : "하ㅇㅇ",
            age : 72,
            gender : "여성",
            region : "서울시 마포구 연남동",
            healthStatus : "양호",
            lastAccess : "11분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

        {
            id : 29,
            name : "배ㅇㅇ",
            age : 78,
            gender : "남성",
            region : "서울시 강서구 가양동",
            healthStatus : "주의",
            lastAccess : "2시간 20분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "추천 완료",
            welfareDecision : "미검토",
        },

        {
            id : 30,
            name : "도ㅇㅇ",
            age : 87,
            gender : "여성",
            region : "서울시 강서구 화곡동",
            healthStatus : "위험",
            lastAccess : "14시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "지원 중",
            welfareDecision : "미검토",
        },

    ]);

    // 현재 페이지 번호
    // 처음 화면에서는 1페이지부터 보여주기 위해 기본값을 1로 설정
    const [currentPage, setCurrentPage] = useState(1);

    // 건강 상태 필터
    // 사용자가 select 박스에서 선택한 건강 상태 값을 저장함
    // 전체 / 양호 / 주의 / 위험 중 하나를 선택해서 대상자 목록을 걸러냄
    const [healthFilter, setHealthFilter] = useState("전체");

    // 위치 상태 필터
    // 위치 상태가 정상인지, 안전구역 이탈인지에 따라 대상자를 걸러보기 위해 사용
    // 전체 / 정상 / 안전구역 이탈 중 하나를 선택해서 대상자 목록을 걸러냄
    const [locationFilter, setLocationFilter] = useState("전체");

    // 알림 상태 필터
    // 전체 / 없음 / 응급 알림 / 위치 이탈 알림 / 복약 미확인 / 장시간 미응답 중 하나를 선택함
    const [alertFilter, setAlertFilter] = useState("전체");
    
    // 일자리 매칭 상태 필터
    // 전체 / 추천 완료 / 지원 중 / 미추천 중 하나를 선택함
    const [jobFilter, setJobFilter] = useState("전체");

    // 복지사 판단 필터
    // 전체 / 미검토 / 적합 / 부적합 중 하나를 선택함
    const [decisionFilter, setDecisionFilter] = useState("전체");

    // 한 페이지에 보여줄 대상자 수
    // 현재는 한 페이지에 10명씩 보여줌
    const itemPerPage = 10;

    // 선택한 필터 조건에 맞는 대상자만 남김
    // seniors 배열 전체를 돌면서 조건에 맞는 대상자만 filteredSeniors에 저장함
    // 전체가 선택된 경우에는 해당 조건을 검사하지 않고 모두 통과시킴
    const filteredSeniors = seniors.filter((senior) => {
        // 건강 상태 필터가 "전체"이면 모든 건강 상태를 통과시킴
        // "위험"을 선택하면 healthStatus가 "위험"인 대상자만 통과
        const matchHealth =
            healthFilter === "전체" || senior.healthStatus === healthFilter;

        // 위치 상태 필터
        // "전체"이면 모두 통과, "안전구역 이탈"이면 해당 대상자만 통과
        const matchLocation =
            locationFilter === "전체" || senior.locationStatus === locationFilter;

        // 알림 상태 필터
        // 응급 알림, 복약 미확인 등 선택한 알림 상태와 일치하는지 확인
        const matchAlert =
            alertFilter === "전체" || senior.alertStatus === alertFilter;

        // 일자리 상태 필터
        // 추천 완료, 지원 중, 미추천 중 선택한 값과 일치하는지 확인
        const matchJob =
            jobFilter === "전체" || senior.jobStatus === jobFilter;

        // 복지사 판단 필터
        // 미검토, 적합, 부적합 중 선택한 값과 일치하는지 확인
        const matchDecision =
            decisionFilter === "전체" || senior.welfareDecision === decisionFilter;
        
        // 모든 조건이 true인 대상자만 최종적으로 남김
        return (
            matchHealth &&
            matchLocation &&
            matchAlert &&
            matchJob &&
            matchDecision 
        );
    });

    // 전체 페이지 수 계산
    // 필터가 적용된 대상자 수를 기준으로 페이지 수를 계산함
    // 필터 결과가 7명이면 1페이지
    // Math.max(1, ...)는 필터 결과가 0명이어도 페이지 표시가 깨지지 않게 하기 위함
    const totalPages = Math.max(1, Math.ceil(filteredSeniors.length / itemPerPage));

    // 현재 페이지에서 보여줄 데이터의 시작 인덱스
    // 1페이지면 0, 2페이지면 10, 3페이지면 20
    const startIndex = (currentPage - 1) * itemPerPage;

    // 현재 페이지에서 보여줄 데이터의 끝 인덱스
    // 1페이지면 10, 2페이지면 20, 3페이지면 30
    const endIndex = startIndex + itemPerPage;

    // 우선순위 등급을 계산하는 함수
    // 숫자가 작을수록 더 높은 우선순위
    // 응급 알림은 다른 조건과 상관없이 무조건 가장 위로 오도록 설정함
    const getPriorityRank = (senior) => {
        // 1순위  : 응급 알림
        // 응급 알림이 있으면 다른 조건과 상관없이 무조건 가장 먼저 확인
        if (senior.alertStatus === "응급 알림") {
            return 1;
        }

        // 2순위 : 위치 이탈
        // 안전구역 이탈 또는 위치 이탈 알림이 있으면 두 번째 우선순위
        if (
            senior.locationStatus === "안전구역 이탈" ||
            senior.alertStatus === "위치 이탈 알림"
        ) {
            return 2;
        }

        // 3순위 : 건강 위험
        // 건강 상태가 위험이면 빠른 확인이 필요함
        if (senior.healthStatus === "위험") {
            return 3;
        }

        // 4순위 : 복약 미확인
        // 약 복용 여부 확인이 필요한 대상자
        if (senior.alertStatus === "복약 미확인") {
            return 4;
        }

        // 5순위 : 장시간 미응답
        // 오랫동안 반응이 없어서 안부 확인이 필요한 대상자
        if (senior.alertStatus === "장시간 미응답") {
            return 5;
        }

        // 6순위 : 건강 주의
        // 위험은 아니지만 지속적인 확인이 필요한 대상자
        if (senior.healthStatus === "주의") {
            return 6;
        }

        // 7순위 : 특별한 위험 없음
        return 7;
    };

    // 필터링된 대상자 목록을 우선순위 기준으로 정렬
    // 우선순위 등급이 높은 대상자가 위로 오도록 정렬
    // getPriorityRank 값이 작을수록 위로 올라감
    // [...seniors]는 기존 seniors 배열을 직접 바꾸지 않기 위해 복사하는 코드
    const sortedSeniors = [...filteredSeniors].sort((a, b) => {
        const rankA = getPriorityRank(a);
        const rankB = getPriorityRank(b);

        // 우선순위 등급이 다르면 등급 기준으로 정렬
        // 예 : 1순위가 3순위보다 위에 표시됨
        if (rankA !== rankB) {
            return rankA - rankB;
        }

        // 같은 등급이면 기존 id 순서대로 정렬
        // 예 : 둘 다 응급 알림이면 id가 작은 대상자가 먼저 나옴
        return a.id - b.id;
    });

    // 현재 페이지에 해당하는 대상자 10명만 잘라서 저장
    // 필터 적용 -> 우선순위 정렬 -> 페이지네이션 순서로 처리함
    const currentSeniors = sortedSeniors.slice(startIndex, endIndex);

    // handleDecision 함수
    // 복지사가 "적합" 또는 "부적합" 버튼을 눌렀을 때 실행됨
    // id : 어떤 대상자의 버튼을 눌렀는지 구분하기 위한 값
    // decision : 복지사가 선택한 판단 값
    // 예 : "적합" 또는 "부적합"
    const handleDecision = (id, decision) => {
        // seniors 배열을 map으로 하나씩 확인함
        // senior.id === id인 경우 :
        // 현재 버튼을 누른 대상자이므로 welfareDecision 값을 decision으로 바꿈
        // senior.id !== id인 경우 :
        // 다른 대상자이므로 기존 데이터를 그대로 유지함
        const updateSeniors = seniors.map((senior) =>
            senior.id === id
                ? { ...senior, welfareDecision : decision }
                : senior
        );

        // 변경된 대상자 목록을 setSeniors로 저장함
        // 이 코드가 실행되면 React가 화면을 다시 그려서
        // "미검토"가 "적합" 또는 "부적합"으로 바로 바뀜
        setSeniors(updateSeniors);
    };

    // 이전 페이지로 이동
    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // 다음 페이지로 이동
    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    // 특정 페이지 번호로 이동
    const goToPage = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // return 안에 작성한 JSX가 실제 화면에 표시됨
    return (
        <div>
            {/* 페이지 제목 */}
            <h1>복지사 대상자 관리</h1>

            {/* 필터 선택 영역 */}
            {/* 복지사가 건강 상태, 위치 상태, 알림 상태, 일자리 상태, 판단 상태별로 대상자를 걸러볼 수 있음*/}
            <div style = {{ marginBottom : "20px"}}>
                <label>건강 상태</label>
                {/* 현재 선택된 필터 값을 화면에 표시하고, 사용자가 값을 바꾸면 healthFilter를 변경함 */}
                <select
                    value = {healthFilter}
                    onChange = {(e) => {
                        setHealthFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value = "전체">전체</option>
                    <option value = "양호">양호</option>
                    <option value = "주의">주의</option>
                    <option value = "위험">위험</option>
                </select>

                <label> 위치 상태 </label>
                <select
                    value = {locationFilter}
                    onChange = {(e) => {
                        setLocationFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value = "전체">전체</option>
                    <option value = "정상">정상</option>
                    <option value = "안전구역 이탈">안전구역 이탈</option>
                </select>

                <label> 알림 상태 </label>
                <select
                    value = {alertFilter}
                    onChange = {(e) => {
                        setAlertFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value = "전체">전체</option>
                    <option value = "없음">없음</option>
                    <option value = "응급 알림">응급 알림</option>
                    <option value = "위치 이탈 알림">위치 이탈 알림</option>
                    <option value = "복약 미확인">복약 미확인</option>
                    <option value = "장시간 미응답">장시간 미응답</option>
                </select>

                <label> 일자리 상태 </label>
                <select
                    value = {jobFilter}
                    onChange = {(e) => {
                        setJobFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value = "전체">전체</option>
                    <option value = "추천 완료">추천 완료</option>
                    <option value = "지원 중">지원 중</option>
                    <option value = "미추천">미추천</option>
                </select>
                
                <label> 복지사 판단 </label>
                <select
                    value = {decisionFilter}
                    onChange = {(e) => {
                        setDecisionFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                >
                    <option value = "전체">전체</option>
                    <option value = "미검토">미검토</option>
                    <option value = "적합">적합</option>
                    <option value = "부적합">부적합</option>
                </select>

                {/* 필터 초기화 버튼 */}
                {/* 선택된 필터를 모두 전체로 되돌림 */}
                <button
                    onClick = {() => {
                        setHealthFilter("전체");
                        setLocationFilter("전체");
                        setAlertFilter("전체");
                        setJobFilter("전체");
                        setDecisionFilter("전체");
                        setCurrentPage(1);
                    }}
                >
                    필터 초기화
                </button>
            </div>

            <p>
                전체 대상자 {seniors.length}명 / 필터 결과 {filteredSeniors.length}명 / 현재 {currentPage}페이지 / 총 {totalPages}페이지
            </p>

            {/* 대상자 목록을 표 형태로 보여주는 영역 */}
            <table border = "1">
                {/* thead는 표의 제목 행을 의미함 */}
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>나이/성별</th>
                        <th>거주 지역</th>
                        <th>건강 상태</th>
                        <th>최근 접속 시간</th>
                        <th>위치 상태</th>
                        <th>알림 상태</th>
                        <th>일자리 매칭 상태</th>
                        <th>복지사 판단</th>
                        <th>관리</th>
                    </tr>
                </thead>

                {/* tbody는 실제 데이터가 들어가는 표의 본문 영역 */}
                <tbody>
                    {/* 
                        seniors.map()
                        seniors 배열에 들어 있는 대상자 수만큼 tr 태그를 반복 생성함
                        
                        Ex) seniors에 3명이 있으면 표의 행도 3개가 만들어짐
                    */}
                    {/* currentSeniors를 사용해서 현재 페이지의 10명만 출력 */}
                    {currentSeniors.map((senior) => (
                        // key는 React가 각 행을 구분하기 위해 사용하는 값
                        // 보통 데이터의 id를 사용함
                        <tr key = {senior.id}>
                            {/* 대상자 이름 출력 */}
                            <td>{senior.name}</td>

                            {/* 나이와 성별을 함께 출력 */}
                            <td>
                                {senior.age}세 / {senior.gender}
                            </td>

                            {/* 거주 지역 출력 */}
                            <td>{senior.region}</td>

                            {/* 건강 상태 출력 */}
                            <td>{senior.healthStatus}</td>

                            {/* 최근 접속 시간 출력 */}
                            <td>{senior.lastAccess}</td>

                            {/* 위치 상태 출력 */}
                            <td>{senior.locationStatus}</td>

                            {/* 알림 상태 출력 */}
                            <td>{senior.alertStatus}</td>

                            {/* 일자리 매칭 상태 출력 */}
                            <td>{senior.jobStatus}</td>

                            {/* 
                                복지사가 직접 선택한 판단 결과
                                처음에는 "미검토"
                                적합 버튼 클릭 시 "적합"
                                부적합 버튼 클릭 시 "부적합"
                            */}
                            <td>{senior.welfareDecision}</td>

                            {/* 관리 버튼 영역 */}
                            <td>
                                {/* 나중에 클릭하면 대상자 상세 정보 페이지로 이동하거나 상세 내용을 보여줄 예정 */}
                                <button>상세보기</button>

                                {/* 
                                    적합 버튼
                                    복지사가 대상자의 건강, 신체 정보를 보고
                                    해당 일자리 추천이 적합하다고 판단할 때 클릭 
                                */}
                                <button onClick = {() => handleDecision(senior.id, "적합")}>
                                    적합
                                </button>

                                {/* 
                                    부적합 버튼
                                    복지사가 대상자의 건강, 신체 정보를 보고
                                    해당 일자리 추천이 부적합하다고 판단할 때 클릭 
                                */}
                                <button onClick = {() => handleDecision(senior.id, "부적합")}>
                                    부적합
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* 페이지 이동 버튼 영역 */}
            <div style = {{ marginTop : "20px" }}>
                <button onClick = {goToPrevPage} disabled = {currentPage === 1}>
                    이전
                </button>

                {Array.from({ length : totalPages }, (_, index) => index + 1).map((pageNumber) => (
                   <button
                        key = {pageNumber}
                        onClick = {() => goToPage(pageNumber)}
                        disabled = {currentPage === pageNumber}
                    >
                        {pageNumber}
                    </button>
                ))}

                <button onClick = {goToNextPage} disabled = {currentPage === totalPages}>
                    다음
                </button>
            </div>
        </div>
    );
}

// 다른 파일(App.jsx 등)에서 WelfareDashboard 컴포넌트를 사용할 수 있도록 내보내기
// App.jsx에서 import 해서 화면에 표시할 수 있음
export default WelfareDashboard;