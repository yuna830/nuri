// React에서 useState 기능을 가져옴
// useState은 화면에서 값이 바뀌었을 때 다시 렌더링되도록 도와주는 기능
// 여기서는 복지사가 누른 "적합 / 보류 / 부적합" 판단 결과를 화면에 바로 반영하기 위해 사용함
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
            // 복지사가 보류 버튼을 누르면 "보류"
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

    // 상세보기에서 선택된 대상자의 id를 저장하는 state
    // 처음에는 아무 대상자도 선택하지 않았으므로 null
    // 상세보기 버튼을 누르면 해당 대상자의 id가 저장됨
    const [selectedSeniorId, setSelectedSeniorId] = useState(null);

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
    // 전체 / 미검토 / 적합 / 보류 / 부적합 중 하나를 선택함
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
        // 미검토, 적합, 보류, 부적합 중 선택한 값과 일치하는지 확인
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

    // 선택된 대상자 id를 기준으로 실제 대상자 정보를 찾음
    // 이렇게 하면 상세보기 중에 적합/부적합 버튼을 눌러도 최신값이 반영됨
    const selectedSenior = seniors.find((senior) => senior.id === selectedSeniorId);

    // 상세정보 페이지에 표시할 추가 정보를 만드는 함수
    // 지금은 백엔드/DB가 없기 때문에 임시로 대상자 상태에 따라 자동 생성함
    // 나중에는 guardian, health_info, counseling_record, job_matching, 같은 DB 테이블에서 받아오게 됨
    const getSeniorDetail = (senior) => {
        // 건강 상태에 따라 기저질환 예시를 다르게 표시
        const diseaseInfo =
            senior.healthStatus === "위험"
                ? "고혈압 / 당뇨"
                : senior.healthStatus === "주의"
                ? "관절 통증"
                : "특이사항 없음";

        // 건강 상태에 따라 복약정보 예시를 다르게 표시
        const medicationInfo =
            senior.healthStatus === "위험"
                ? "혈압약, 당뇨약 복용 중"
                : senior.healthStatus === "주의"
                ? "관절약 복용 중"
                : "복약정보 없음";

        // 건강 상태에 따라 보행 가능 여부를 다르게 표시
        const walkingStatus =
            senior.healthStatus === "위험"
                ? "장시간 보행 어려움"
                : senior.healthStatus === "주의"
                ? "짧은 거리 보행 가능"
                : "보행 가능";

        // 일자리 상태에 따라 추천받은 일자리 예시를 다르게 표시
        const recommendedJob =
            senior.jobStatus === "미추천"
                ? "추천 일자리 없음"
                : senior.jobStatus === "지원 중"
                ? "주민센터 환경 정비 보조"
                : "복지관 안내 보조";

        return {
            phone : `010-1000-${String(senior.id).padStart(4, "0")}`,
            address : senior.region,

            guardianName : `${senior.name[0]}보호자`,
            guardianPhone : `010-2000-${String(senior.id).padStart(4, "0")}`,
            guardianRelation : senior.gender === "여성" ? "자녀" : "배우자",

            diseaseInfo,
            medicationInfo,
            walkingStatus,

            visionStatus : senior.age >= 80 ? "시력 저하" : "정상",
            hearingStatus : senior.age >= 82 ? "청력 저하" : "정상",
            handUseStatus : "양손 사용 가능",
            availableWorkTime : senior.healthStatus === "위험" ? "하루 2시간" : "하루 3시간",

            currentLocation :
                senior.locationStatus === "안전구역 이탈" ? "안심구역 외부" : "자택",
            frequentPlace : "주민센터 / 복지관",
            safeZone : "자택 반경 500m",

            counselingMemo :
                senior.healthStatus === "위험"
                    ? "건강 상태 확인이 필요하며 무리한 업무는 피해야 함"
                    : "가벼운 업무 중심으로 일자리 추천 가능",

            recommendedJob,
            applicationStatus : senior.jobStatus,
        };
    };

    // handleDecision 함수
    // 복지사가 "적합", "보류", "부적합" 버튼을 눌렀을 때 실행됨
    // id : 어떤 대상자의 버튼을 눌렀는지 구분하기 위한 값
    // decision : 복지사가 선택한 판단 값
    // 예 : "적합", "보류", "부적합"
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
        // "미검토"가 "적합", "보류", "부적합"으로 바로 바뀜
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

    // 상단 요약 카드에 표시할 숫자
    // 기존에는 문장으로 전체 수와 필터 결과를 보여줬지만,
    // 디자인 변경 후에는 카드 4개로 나눠서 더 빠르게 확인할 수 있게 함
    const summaryCounts = {
        // 전체 대상자 수
        total : seniors.length,

        // 현재 선택된 필터 조건에 맞는 대상자 수
        filtered : filteredSeniors.length,

        // 건강 상태가 "위험"인 대상자 수
        danger : seniors.filter((senior) => senior.healthStatus === "위험").length,

        // 알림 상태가 "없음"이 아닌 대상자 수
        alert : seniors.filter((senior) => senior.alertStatus !== "없음").length,
    };

    // 화면에서 반복해서 사용하는 스타일
    // CSS 파일을 새로 만들지 않고 이 컴포넌트 안에서만 쓰기 위해 객체로 정리함
    // 색상은 index.css에 이미 정의된 CSS 변수들을 최대한 사용함
    const styles = {
        // 전체 페이지 배경과 기본 여백
        page : {
            minHeight : "100vh",
            backgroundColor : "var(--bg-color)",
            color : "var(--text-color)",
            padding : "28px",
            boxSizing : "border-box",
        },

        // 좌우 여백을 제외한 실제 화면 내용 너비
        content : {
            width : "100%",
            maxWidth : "1280px",
            margin : "0 auto",
        },

        // 제목 영역
        header : {
            marginBottom : "18px",
        },

        // 페이지 제목
        title : {
            margin : 0,
            fontSize : "28px",
            fontWeight : "700",
        },

        // 제목 아래 설명 문구
        subText : {
            margin : "6px 0 0",
            fontSize : "14px",
            color : "#666",
        },

        // 상단 요약 카드 4개를 가로로 배치하는 영역
        summaryGrid : {
            display : "grid",
            gridTemplateColumns : "repeat(4, minmax(0, 1fr))",
            gap : "12px",
            marginBottom : "16px",
        },

        // 각각의 요약 카드
        summaryBox : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },

        // 요약 카드의 작은 제목
        summaryLabel : {
            margin : 0,
            fontSize : "13px",
            color : "#666",
        },

        // 요약 카드의 숫자
        summaryValue : {
            margin : "6px 0 0",
            fontSize : "24px",
            fontWeight : "700",
        },

        // 필터 select 박스들을 감싸는 영역
        filterBox : {
            display : "flex",
            flexWrap : "wrap",
            gap : "12px",
            alignItems : "end",
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
            marginBottom : "16px",
        },

        // label과 select를 세로로 묶는 작은 영역
        field : {
            display : "flex",
            flexDirection : "column",
            gap : "6px",
        },

        // 필터 이름 label
        label : {
            fontSize : "13px",
            fontWeight : "700",
        },

        // 필터 select 박스
        select : {
            height : "38px",
            minWidth : "130px",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "0 10px",
            backgroundColor : "white",
            color : "var(--text-color)",
        },

        // 테이블 전체를 감싸는 흰색 영역
        tableBox : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            overflow : "hidden",
        },

        // 대상자 목록 테이블
        table : {
            width : "100%",
            borderCollapse : "collapse",
            fontSize : "14px",
        },

        // 테이블 제목 셀
        th : {
            textAlign : "left",
            backgroundColor : "#f7f5e8",
            padding : "12px 10px",
            borderBottom : "1px solid var(--border-color)",
            whiteSpace : "nowrap",
        },

        // 테이블 일반 셀
        td : {
            padding : "11px 10px",
            borderBottom : "1px solid var(--border-color)",
            verticalAlign : "middle",
        },

        // 건강 상태와 복지사 판단 상태를 표시하는 작은 배지의 기본 스타일
        badge : {
            display : "inline-block",
            padding : "5px 9px",
            borderRadius : "999px",
            fontSize : "12px",
            fontWeight : "700",
            whiteSpace : "nowrap",
        },

        // 관리 버튼들을 한 줄에 정렬하기 위한 영역
        actionGroup : {
            display : "flex",
            flexWrap : "wrap",
            gap : "6px",
        },

        // 기본 버튼
        smallButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "none",
            cursor : "pointer",
            color : "white",
            backgroundColor : "var(--main-color)",
        },

        // 보류 버튼
        // 기본 버튼과 구분되도록 연한 배경과 테두리를 사용함
        holdButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "1px solid var(--main-color)",
            cursor : "pointer",
            color : "var(--text-color)",
            backgroundColor : "#f7f5e8",
        },

        // 부적합 버튼
        // 기존 메인 컬러와 너무 다르지 않게 톤을 낮춘 붉은색을 사용함
        dangerButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "none",
            cursor : "pointer",
            color : "white",
            backgroundColor : "#b66b6b",
        },

        // 필터 초기화 버튼
        resetButton : {
            height : "38px",
            padding : "0 14px",
            borderRadius : "8px",
            border : "none",
            backgroundColor : "var(--main-color)",
            color : "white",
            cursor : "pointer",
        },

        // 페이지 이동 버튼 영역
        pager : {
            display : "flex",
            flexWrap : "wrap",
            justifyContent : "center",
            gap : "6px",
            marginTop : "16px",
        },

        // 팝업 뒤쪽 어두운 배경
        modalBackdrop : {
            position : "fixed",
            inset : 0,
            backgroundColor : "rgba(0, 0, 0, 0.45)",
            display : "flex",
            justifyContent : "center",
            alignItems : "center",
            padding : "24px",
            zIndex : 100,
        },

        // 팝업 본문 박스
        modalBox : {
            width : "min(760px, 100%)",
            maxHeight : "85vh",
            overflowY : "auto",
            backgroundColor : "var(--bg-color)",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "22px",
            boxShadow : "0 20px 40px rgba(0, 0, 0, 0.25)",
        },

        // 팝업 제목과 닫기 버튼을 나란히 배치하는 영역
        modalHeader : {
            display : "flex",
            justifyContent : "space-between",
            alignItems : "start",
            gap : "12px",
            marginBottom : "16px",
        },

        // 팝업 제목
        modalTitle : {
            margin : 0,
            fontSize : "24px",
        },

        // 팝업 제목 아래 대상자 요약 문구
        modalSubText : {
            margin : "6px 0 0",
            color : "#666",
        },

        // 팝업 안의 상세정보 섹션들을 2열로 배치
        detailGrid : {
            display : "grid",
            gridTemplateColumns : "repeat(2, minmax(0, 1fr))",
            gap : "10px",
        },

        // 팝업 안의 각 정보 박스
        detailSection : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },

        // 상세정보 섹션 제목
        sectionTitle : {
            margin : "0 0 10px",
            fontSize : "16px",
        },

        // 상세정보 본문 텍스트
        detailText : {
            margin : "6px 0",
            fontSize : "14px",
        },

        // 상담 기록 박스
        memoBox : {
            marginTop : "12px",
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },
    };

    // 건강 상태와 복지사 판단 상태를 배지 색상으로 구분하는 함수
    // 화면 전체 색상은 기존 CSS 변수를 쓰고, 상태값만 알아보기 쉽게 은은하게 구분함
    const getBadgeStyle = (type, value) => {
        const badgeColors = {
            // 건강 상태 배지 색상
            health : {
                "양호" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "주의" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "위험" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },

            // 복지사 판단 배지 색상
            decision : {
                "미검토" : { backgroundColor : "#eeeeee", color : "#555" },
                "적합" : { backgroundColor : "#dff3ff", color : "#176b92" },
                "보류" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "부적합" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
        };

        return {
            ...styles.badge,
            ...(badgeColors[type]?.[value] || {
                backgroundColor : "#eeeeee",
                color : "#555",
            }),
        };
    };

    // return 안에 작성한 JSX가 실제 화면에 표시됨
    return (
        <div style = {styles.page}>
            <div style = {styles.content}>
            {/* 페이지 제목 */}
            <div style = {styles.header}>
                <h1 style = {styles.title}>복지사 대상자 관리</h1>
                <p style = {styles.subText}>
                    대상자 상태를 확인하고 상세정보는 팝업으로 확인합니다.
                </p>
            </div>

            {/* 상단 요약 카드 영역 */}
            {/* 기존 문장형 현황 표시를 카드형으로 바꿔서 중요한 수치를 먼저 보여줌 */}
            <div style = {styles.summaryGrid}>
                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>전체 대상자</p>
                    <p style = {styles.summaryValue}>{summaryCounts.total}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>필터 결과</p>
                    <p style = {styles.summaryValue}>{summaryCounts.filtered}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>건강 위험</p>
                    <p style = {styles.summaryValue}>{summaryCounts.danger}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>알림 있음</p>
                    <p style = {styles.summaryValue}>{summaryCounts.alert}명</p>
                </div>
            </div>

            {/* 필터 선택 영역 */}
            {/* 복지사가 건강 상태, 위치 상태, 알림 상태, 일자리 상태, 판단 상태별로 대상자를 걸러볼 수 있음 */}
            <div style = {styles.filterBox}>
                <div style = {styles.field}>
                    <label style = {styles.label}>건강 상태</label>
                    {/* 현재 선택된 필터 값을 화면에 표시하고, 사용자가 값을 바꾸면 healthFilter를 변경함 */}
                    <select
                        style = {styles.select}
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
                </div>

                <div style = {styles.field}>
                    <label style = {styles.label}>위치 상태</label>
                    <select
                        style = {styles.select}
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
                </div>

                <div style = {styles.field}>
                    <label style = {styles.label}>알림 상태</label>
                    <select
                        style = {styles.select}
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
                </div>

                <div style = {styles.field}>
                    <label style = {styles.label}>일자리 상태</label>
                    <select
                        style = {styles.select}
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
                </div>

                <div style = {styles.field}>
                    <label style = {styles.label}>복지사 판단</label>
                    <select
                        style = {styles.select}
                        value = {decisionFilter}
                        onChange = {(e) => {
                            setDecisionFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value = "전체">전체</option>
                        <option value = "미검토">미검토</option>
                        <option value = "적합">적합</option>
                        <option value = "보류">보류</option>
                        <option value = "부적합">부적합</option>
                    </select>
                </div>

                {/* 필터 초기화 버튼 */}
                {/* 선택된 필터를 모두 전체로 되돌림 */}
                <button
                    type = "button"
                    style = {styles.resetButton}
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
            <div style = {styles.tableBox}>
                <table style = {styles.table}>
                    {/* thead는 표의 제목 행을 의미함 */}
                    <thead>
                        <tr>
                            <th style = {styles.th}>이름</th>
                            <th style = {styles.th}>나이/성별</th>
                            <th style = {styles.th}>거주 지역</th>
                            <th style = {styles.th}>건강 상태</th>
                            <th style = {styles.th}>최근 접속 시간</th>
                            <th style = {styles.th}>위치 상태</th>
                            <th style = {styles.th}>알림 상태</th>
                            <th style = {styles.th}>일자리 매칭 상태</th>
                            <th style = {styles.th}>복지사 판단</th>
                            <th style = {styles.th}>관리</th>
                        </tr>
                    </thead>

                    {/* tbody는 실제 데이터가 들어가는 표의 본문 영역 */}
                    <tbody>
                        {/* currentSeniors를 사용해서 현재 페이지의 10명만 출력 */}
                        {currentSeniors.map((senior) => (
                            // key는 React가 각 행을 구분하기 위해 사용하는 값
                            // 보통 데이터의 id를 사용함
                            <tr key = {senior.id}>
                                {/* 대상자 이름 출력 */}
                                <td style = {styles.td}>{senior.name}</td>

                                {/* 나이와 성별을 함께 출력 */}
                                <td style = {styles.td}>
                                    {senior.age}세 / {senior.gender}
                                </td>

                                {/* 거주 지역 출력 */}
                                <td style = {styles.td}>{senior.region}</td>

                                {/* 건강 상태 출력 */}
                                {/* 색상 배지로 표시해서 양호 / 주의 / 위험을 빠르게 구분함 */}
                                <td style = {styles.td}>
                                    <span style = {getBadgeStyle("health", senior.healthStatus)}>
                                        {senior.healthStatus}
                                    </span>
                                </td>

                                {/* 최근 접속 시간 출력 */}
                                <td style = {styles.td}>{senior.lastAccess}</td>

                                {/* 위치 상태 출력 */}
                                <td style = {styles.td}>{senior.locationStatus}</td>

                                {/* 알림 상태 출력 */}
                                <td style = {styles.td}>{senior.alertStatus}</td>

                                {/* 일자리 매칭 상태 출력 */}
                                <td style = {styles.td}>{senior.jobStatus}</td>

                                {/* 복지사가 직접 선택한 판단 결과 */}
                                {/* 처음에는 "미검토", 버튼 클릭 후 "적합" / "보류" / "부적합"으로 바뀜 */}
                                <td style = {styles.td}>
                                    <span style = {getBadgeStyle("decision", senior.welfareDecision)}>
                                        {senior.welfareDecision}
                                    </span>
                                </td>

                                {/* 관리 버튼 영역 */}
                                <td style = {styles.td}>
                                    <div style = {styles.actionGroup}>
                                        {/* 상세보기 버튼 */}
                                        {/* 클릭하면 selectedSeniorId에 대상자 id를 저장해서 팝업 모달을 띄움 */}
                                        <button
                                            type = "button"
                                            style = {styles.smallButton}
                                            onClick = {() => setSelectedSeniorId(senior.id)}
                                        >
                                            상세보기
                                        </button>

                                        {/* 적합 버튼 */}
                                        {/* 복지사가 대상자의 건강, 신체 정보를 보고 해당 일자리 추천이 적합하다고 판단할 때 클릭 */}
                                        <button
                                            type = "button"
                                            style = {styles.smallButton}
                                            onClick = {() => handleDecision(senior.id, "적합")}
                                        >
                                            적합
                                        </button>

                                        {/* 보류 버튼 */}
                                        {/* 바로 적합/부적합을 판단하기 어렵거나 추가 확인이 필요할 때 클릭 */}
                                        <button
                                            type = "button"
                                            style = {styles.holdButton}
                                            onClick = {() => handleDecision(senior.id, "보류")}
                                        >
                                            보류
                                        </button>

                                        {/* 부적합 버튼 */}
                                        {/* 복지사가 대상자의 건강, 신체 정보를 보고 해당 일자리 추천이 부적합하다고 판단할 때 클릭 */}
                                        <button
                                            type = "button"
                                            style = {styles.dangerButton}
                                            onClick = {() => handleDecision(senior.id, "부적합")}
                                        >
                                            부적합
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 페이지 이동 버튼 영역 */}
            <div style = {styles.pager}>
                <button
                    type = "button"
                    style = {styles.smallButton}
                    onClick = {goToPrevPage}
                    disabled = {currentPage === 1}
                >
                    이전
                </button>

                {Array.from({ length : totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                        type = "button"
                        key = {pageNumber}
                        style = {{
                            ...styles.smallButton,
                            opacity : currentPage === pageNumber ? 0.6 : 1,
                        }}
                        onClick = {() => goToPage(pageNumber)}
                        disabled = {currentPage === pageNumber}
                    >
                        {pageNumber}
                    </button>
                ))}

                <button
                    type = "button"
                    style = {styles.smallButton}
                    onClick = {goToNextPage}
                    disabled = {currentPage === totalPages}
                >
                    다음
                </button>
            </div>
            </div>

            {/* 팝업 모달 영역 */}
            {/* selectedSenior가 있을 때만 화면 중앙에 상세정보 팝업을 보여줌 */}
            {selectedSenior && (
                <div style = {styles.modalBackdrop}>
                    <div style = {styles.modalBox}>
                        {/* getSeniorDetail 함수로 선택된 대상자의 추가 상세정보를 생성함 */}
                        {(() => {
                            const detail = getSeniorDetail(selectedSenior);

                            return (
                                <div>
                                    {/* 모달 상단 영역 */}
                                    <div style = {styles.modalHeader}>
                                        <div>
                                            <h2 style = {styles.modalTitle}>대상자 상세정보</h2>
                                            <p style = {styles.modalSubText}>
                                                {selectedSenior.name} / {selectedSenior.age}세 / {selectedSenior.gender}
                                            </p>
                                        </div>

                                        {/* 닫기 버튼 */}
                                        {/* 클릭하면 selectedSeniorId를 null로 바꿔 팝업을 닫음 */}
                                        <button
                                            type = "button"
                                            style = {styles.smallButton}
                                            onClick = {() => setSelectedSeniorId(null)}
                                        >
                                            닫기
                                        </button>
                                    </div>

                                    {/* 모달 상세정보 영역 */}
                                    <div style = {styles.detailGrid}>
                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>기본 정보</h3>
                                            <p style = {styles.detailText}>이름 : {selectedSenior.name}</p>
                                            <p style = {styles.detailText}>나이 : {selectedSenior.age}세</p>
                                            <p style = {styles.detailText}>성별 : {selectedSenior.gender}</p>
                                            <p style = {styles.detailText}>연락처 : {detail.phone}</p>
                                            <p style = {styles.detailText}>주소 : {detail.address}</p>
                                        </div>

                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>보호자 정보</h3>
                                            <p style = {styles.detailText}>보호자 이름 : {detail.guardianName}</p>
                                            <p style = {styles.detailText}>보호자 연락처 : {detail.guardianPhone}</p>
                                            <p style = {styles.detailText}>관계 : {detail.guardianRelation}</p>
                                        </div>

                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>건강 정보</h3>
                                            <p style = {styles.detailText}>건강 상태 : {selectedSenior.healthStatus}</p>
                                            <p style = {styles.detailText}>기저질환 : {detail.diseaseInfo}</p>
                                            <p style = {styles.detailText}>복약정보 : {detail.medicationInfo}</p>
                                            <p style = {styles.detailText}>보행 가능 여부 : {detail.walkingStatus}</p>
                                        </div>

                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>신체 정보</h3>
                                            <p style = {styles.detailText}>시력 : {detail.visionStatus}</p>
                                            <p style = {styles.detailText}>청력 : {detail.hearingStatus}</p>
                                            <p style = {styles.detailText}>손 사용 능력 : {detail.handUseStatus}</p>
                                            <p style = {styles.detailText}>근무 가능 시간 : {detail.availableWorkTime}</p>
                                        </div>

                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>위치 정보</h3>
                                            <p style = {styles.detailText}>현재 위치 : {detail.currentLocation}</p>
                                            <p style = {styles.detailText}>자주 가는 장소 : {detail.frequentPlace}</p>
                                            <p style = {styles.detailText}>안심구역 : {detail.safeZone}</p>
                                            <p style = {styles.detailText}>위치 상태 : {selectedSenior.locationStatus}</p>
                                        </div>

                                        <div style = {styles.detailSection}>
                                            <h3 style = {styles.sectionTitle}>일자리 정보</h3>
                                            <p style = {styles.detailText}>추천받은 일자리 : {detail.recommendedJob}</p>
                                            <p style = {styles.detailText}>지원 여부 : {detail.applicationStatus}</p>
                                            <p style = {styles.detailText}>복지사 판단 : {selectedSenior.welfareDecision}</p>
                                        </div>
                                    </div>

                                    {/* 상담 기록 영역 */}
                                    <div style = {styles.memoBox}>
                                        <h3 style = {styles.sectionTitle}>상담 기록</h3>
                                        <p style = {styles.detailText}>
                                            복지사가 남긴 메모 : {detail.counselingMemo}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

// 다른 파일(App.jsx 등)에서 WelfareDashboard 컴포넌트를 사용할 수 있도록 내보내기
// App.jsx에서 import 해서 화면에 표시할 수 있음
export default WelfareDashboard;
