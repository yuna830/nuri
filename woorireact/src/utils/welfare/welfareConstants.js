// 복지사 페이지 공통 상수

export const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";

// localStorage 키
export const WELFARE_DECISION_STORAGE_KEY = "welfareDecisions";
export const WELFARE_DECISION_DETAIL_STORAGE_KEY = "welfareDecisionDetails";
export const ADDED_SENIORS_STORAGE_KEY = "welfareAddedSeniors";
export const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";
export const SOS_REQUESTS_STORAGE_KEY = "welfareSosRequests";
export const WELFARE_WORKERS_STORAGE_KEY = "welfareWorkers";

export const SEOUL_WELFARE_CENTERS = [
    "강남구립행복요양원", "강남노인복지관", "강동노인종합복지관",
    "강북노인종합복지관", "강서노인종합복지관", "관악노인종합복지관",
    "광진노인종합복지관", "구로노인종합복지관", "금천노인종합복지관",
    "노원노인종합복지관", "도봉노인종합복지관", "동대문노인종합복지관",
    "동작노인종합복지관", "마포노인종합복지관", "서대문노인복지관",
    "서초노인종합복지관", "성동노인종합복지관", "성북노인종합복지관",
    "송파노인종합복지관", "양천노인종합복지관", "영등포노인복지관",
    "용산노인종합복지관", "은평노인종합복지관", "종로노인종합복지관",
    "중구노인종합복지관", "중랑노인종합복지관",
    "서울시립어르신돌봄센터", "서울시복지재단", "우리복지센터",
];

// 시간 관련 상수
export const LAST_ACCESS_ALERT_HOURS = 4;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
