export const WELFARE_DEMO_SENIORS = [
    {
        id : 1,
        name : "김영희",
        age : 78,
        gender : "여성",
        region : "서울시 동작구 상도동",
        healthStatus : "주의",
        lastAccess : "3시간 전",
        locationStatus : "정상",
        alertStatus : "없음",
        workRequestStatus : "검토",
        jobRequestStatus : "요청 1건",
        jobRequestCount : 1,
        jobMatchingStatus : "보류",
        welfareDecision : "보류",
        welfareDecisionReason : "관절 통증 때문에 장시간 업무는 제외하고 재검토가 필요합니다.",
        preferredWorkTime : "하루 3시간",
        safeZone : {
            placeName : "김영희 자택",
            radiusMeter : 500,
        },
        lastGps : {
            address : "서울시 동작구 상도동 자택 인근",
            latitude : 37.4996,
            longitude : 126.9427,
            recordedAt : "2026-05-10 08:40",
        },
    },
    {
        id : 2,
        name : "홍길동",
        age : 82,
        gender : "남성",
        region : "서울시 강서구 화곡동",
        healthStatus : "위험",
        lastAccess : "5시간 전",
        locationStatus : "안전구역 이탈",
        alertStatus : "SOS 요청",
        workRequestStatus : "미검토",
        jobRequestStatus : "미요청",
        jobRequestCount : 0,
        jobMatchingStatus : "검토중",
        welfareDecision : "미검토",
        welfareDecisionReason : "",
        preferredWorkTime : "하루 2시간",
        safeZone : {
            placeName : "홍길동 자택",
            radiusMeter : 300,
        },
        lastGps : {
            address : "서울시 강서구 화곡역 2번 출구 인근",
            latitude : 37.5412,
            longitude : 126.8404,
            recordedAt : "2026-05-10 09:12",
        },
    },
    {
        id : 3,
        name : "박순자",
        age : 74,
        gender : "여성",
        region : "서울시 관악구 신림동",
        healthStatus : "양호",
        lastAccess : "40분 전",
        locationStatus : "정상",
        alertStatus : "일자리 요청",
        workRequestStatus : "검토",
        jobRequestStatus : "요청 2건",
        jobRequestCount : 2,
        jobMatchingStatus : "적합",
        welfareDecision : "적합",
        welfareDecisionReason : "",
        preferredWorkTime : "하루 3시간",
        safeZone : {
            placeName : "박순자 자택",
            radiusMeter : 600,
        },
        lastGps : {
            address : "서울시 관악구 신림동 주민센터 인근",
            latitude : 37.4841,
            longitude : 126.9295,
            recordedAt : "2026-05-10 09:35",
        },
    },
    {
        id : 4,
        name : "이만수",
        age : 80,
        gender : "남성",
        region : "서울시 송파구 잠실동",
        healthStatus : "주의",
        lastAccess : "2시간 전",
        locationStatus : "정상",
        alertStatus : "일자리 요청",
        workRequestStatus : "미검토",
        jobRequestStatus : "요청 1건",
        jobRequestCount : 1,
        jobMatchingStatus : "보류",
        welfareDecision : "보류",
        welfareDecisionReason : "보호자와 근무 가능 시간 재확인이 필요합니다.",
        preferredWorkTime : "하루 2시간",
        safeZone : {
            placeName : "이만수 자택",
            radiusMeter : 400,
        },
        lastGps : {
            address : "서울시 송파구 잠실동 자택",
            latitude : 37.5133,
            longitude : 127.1002,
            recordedAt : "2026-05-10 08:58",
        },
    },
    {
        id : 5,
        name : "최정희",
        age : 76,
        gender : "여성",
        region : "서울시 강남구 역삼동",
        healthStatus : "양호",
        lastAccess : "15분 전",
        locationStatus : "안전구역 이탈",
        alertStatus : "SOS 요청",
        workRequestStatus : "검토",
        jobRequestStatus : "요청 1건",
        jobRequestCount : 1,
        jobMatchingStatus : "부적합",
        welfareDecision : "부적합",
        welfareDecisionReason : "최근 안전구역 이탈이 반복되어 이동 동선이 있는 업무 배정은 어렵습니다.",
        preferredWorkTime : "하루 3시간",
        safeZone : {
            placeName : "최정희 자택",
            radiusMeter : 500,
        },
        lastGps : {
            address : "서울시 강남구 역삼역 4번 출구 인근",
            latitude : 37.5007,
            longitude : 127.0364,
            recordedAt : "2026-05-10 09:41",
        },
    },
];

export const WELFARE_DEMO_COUNSELING_RECORDS = {
    1 : [
        {
            id : "1-20260509",
            date : "2026-05-09",
            content : "건강 상태와 근무 가능 시간을 확인함. 관절 통증이 있어 서서 오래 근무하는 업무는 제외하기로 함.",
        },
        {
            id : "1-20260508",
            date : "2026-05-08",
            content : "보호자에게 최근 컨디션 확인 요청. 일자리 참여 의사는 있으나 이동 거리를 줄이는 조건이 필요함.",
        },
    ],
    2 : [
        {
            id : "2-20260510",
            date : "2026-05-10",
            content : "SOS 요청 접수. 마지막 GPS 위치를 보호자에게 공유하고 전화 확인을 진행함.",
        },
        {
            id : "2-20260508",
            date : "2026-05-08",
            content : "건강 위험 상태로 일자리 요청은 보류. 복약 및 외출 동선 확인이 필요함.",
        },
    ],
    3 : [
        {
            id : "3-20260509",
            date : "2026-05-09",
            content : "가벼운 안내 업무 참여 의사를 확인함. 관악구 주민센터 공고를 우선 검토함.",
        },
        {
            id : "3-20260508",
            date : "2026-05-08",
            content : "대상자 기본 정보와 근무 가능 시간을 확인함. 주 3회, 하루 3시간까지 가능하다고 응답함.",
        },
    ],
    4 : [
        {
            id : "4-20260509",
            date : "2026-05-09",
            content : "일자리 요청 접수. 보호자와 이동 가능 범위 및 근무 시간 재확인이 필요함.",
        },
    ],
    5 : [
        {
            id : "5-20260510",
            date : "2026-05-10",
            content : "SOS 요청 접수. 안전구역 이탈 위치와 시간을 확인하고 보호자에게 마지막 GPS를 전달함.",
        },
        {
            id : "5-20260507",
            date : "2026-05-07",
            content : "일자리 참여 의사는 있으나 최근 위치 이탈 이력이 반복되어 외부 이동 업무는 부적합으로 판단함.",
        },
    ],
};

export const WELFARE_DEMO_SCHEDULES = {
    1 : [
        {
            id : 101,
            status : "예정",
            type : "상담",
            title : "일자리 참여 가능 여부 상담",
            scheduledAt : "2026-05-10 10:00",
            place : "동작구 복지관",
        },
        {
            id : 102,
            status : "예정",
            type : "건강",
            title : "관절 통증 상태 확인",
            scheduledAt : "2026-05-11 14:30",
            place : "전화 상담",
        },
    ],
    2 : [
        {
            id : 201,
            status : "완료",
            type : "SOS",
            title : "SOS 요청 위치 확인",
            scheduledAt : "2026-05-10 09:20",
            place : "화곡역 인근",
        },
        {
            id : 202,
            status : "예정",
            type : "보호자",
            title : "보호자 안전 확인 통화",
            scheduledAt : "2026-05-10 17:30",
            place : "전화 상담",
        },
    ],
    3 : [
        {
            id : 301,
            status : "예정",
            type : "일자리",
            title : "추천 일자리 안내",
            scheduledAt : "2026-05-10 09:30",
            place : "관악구 주민센터",
        },
        {
            id : 302,
            status : "완료",
            type : "상담",
            title : "근무 가능 시간 확인",
            scheduledAt : "2026-05-08 14:00",
            place : "전화 상담",
        },
    ],
    4 : [
        {
            id : 401,
            status : "예정",
            type : "일자리",
            title : "일자리 요청 검토",
            scheduledAt : "2026-05-10 16:00",
            place : "송파구 복지관",
        },
        {
            id : 402,
            status : "보류",
            type : "상담",
            title : "보호자 근무 조건 확인",
            scheduledAt : "2026-05-12 10:30",
            place : "전화 상담",
        },
    ],
    5 : [
        {
            id : 501,
            status : "완료",
            type : "SOS",
            title : "안전구역 이탈 위치 확인",
            scheduledAt : "2026-05-10 09:50",
            place : "역삼역 인근",
        },
        {
            id : 502,
            status : "예정",
            type : "일자리",
            title : "일자리 요청 결과 안내",
            scheduledAt : "2026-05-11 13:00",
            place : "강남구 주민센터",
        },
    ],
};

export const WELFARE_DEMO_JOBS = [
    {
        jobId : "JOB-001",
        title : "복지관 안내 보조",
        organization : "동작구 어르신복지관",
        workPlace : "서울시 동작구 상도동",
        district : "동작구",
        jobType : "안내",
        employmentType : "공익활동",
        workDays : "주 3회",
        workTime : "하루 3시간",
        wage : "월 29만원",
        recruitPeriod : "2026-05-01 ~ 2026-05-20",
        deadlineStatus : "모집중",
        suitabilityScore : 86,
    },
    {
        jobId : "JOB-002",
        title : "주민센터 민원 안내",
        organization : "관악구 주민센터",
        workPlace : "서울시 관악구 신림동",
        district : "관악구",
        jobType : "안내",
        employmentType : "사회서비스형",
        workDays : "주 3회",
        workTime : "하루 3시간",
        wage : "월 35만원",
        recruitPeriod : "2026-05-03 ~ 2026-05-24",
        deadlineStatus : "모집중",
        suitabilityScore : 91,
    },
    {
        jobId : "JOB-003",
        title : "도서관 자료 정리 보조",
        organization : "강남구 시니어클럽",
        workPlace : "서울시 강남구 역삼동",
        district : "강남구",
        jobType : "실내 보조",
        employmentType : "사회서비스형",
        workDays : "주 2회",
        workTime : "하루 3시간",
        wage : "월 32만원",
        recruitPeriod : "2026-05-05 ~ 2026-05-25",
        deadlineStatus : "모집중",
        suitabilityScore : 88,
    },
    {
        jobId : "JOB-004",
        title : "공원 환경 정비",
        organization : "송파구 시니어일자리센터",
        workPlace : "서울시 송파구 잠실동",
        district : "송파구",
        jobType : "환경 정비",
        employmentType : "공익활동",
        workDays : "주 3회",
        workTime : "하루 2시간",
        wage : "월 27만원",
        recruitPeriod : "2026-04-20 ~ 2026-05-08",
        deadlineStatus : "마감",
        suitabilityScore : 62,
    },
    {
        jobId : "JOB-005",
        title : "급식 배식 보조",
        organization : "강서구 복지센터",
        workPlace : "서울시 강서구 등촌동",
        district : "강서구",
        jobType : "복지 보조",
        employmentType : "사회서비스형",
        workDays : "주 4회",
        workTime : "하루 4시간",
        wage : "월 42만원",
        recruitPeriod : "2026-05-02 ~ 2026-05-18",
        deadlineStatus : "모집중",
        suitabilityScore : 58,
    },
];

const getRegionDistrict = (region = "") => {
    const districtMatch = String(region).match(/[가-힣]+구/);

    return districtMatch ? districtMatch[0] : "";
};

export const findWelfareDemoSenior = (seniorId) =>
    WELFARE_DEMO_SENIORS.find((senior) => String(senior.id) === String(seniorId));

export const findWelfareDemoSchedules = (seniorId) =>
    WELFARE_DEMO_SCHEDULES[seniorId] || [];

export const findWelfareDemoCounselingRecords = (seniorId) =>
    WELFARE_DEMO_COUNSELING_RECORDS[seniorId] || [];

export const findWelfareRecommendedJobs = (seniorId) => {
    const senior = findWelfareDemoSenior(seniorId);

    if (!senior) {
        return [];
    }

    const district = getRegionDistrict(senior.region);

    return WELFARE_DEMO_JOBS.filter((job) =>
        job.deadlineStatus !== "마감" &&
        district !== "" &&
        job.workPlace.includes(district) &&
        senior.healthStatus !== "위험"
    );
};
