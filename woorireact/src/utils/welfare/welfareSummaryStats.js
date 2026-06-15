// ── 필드 → 카테고리 매핑 ───────────────────────────────
export const FIELD_CATEGORY_MAP = {
    "연락처": "인적사항", "주소": "인적사항",
    "생년월일/나이": "인적사항", "성별": "인적사항",
    "장애 등급": "인적사항", "장애 유형": "인적사항",
    "흡연": "신체정보", "음주": "신체정보",
    "복약 정보": "복약정보",
    "당뇨": "만성질환", "고혈압": "만성질환",
    "심장질환": "만성질환", "관절질환": "만성질환",
    "뇌졸중": "만성질환", "신장질환": "만성질환",
    "호흡기질환": "만성질환", "간질환": "만성질환", "암": "만성질환",
    "보행 보조기": "거동/인지", "치매": "거동/인지",
    "시력": "거동/인지", "청력": "거동/인지",
    "최근 낙상": "거동/인지", "수술 이력": "거동/인지",
    "수술 상세": "수술 정보",
    "생계비 현황": "복지정보", "가구 유형": "복지정보",
    "연금 현황": "복지정보", "주거 유형": "복지정보",
    "최대 근무 시간": "활동/일자리", "이동 가능 거리": "활동/일자리",
    "휴식 필요": "활동/일자리", "희망 급여 유형": "활동/일자리",
};

/** fields 배열 → { 카테고리: [필드명, ...], ... } */
export const groupFieldsByCategory = (fields = []) => {
    const result = {};
    for (const field of fields) {
        const cat = FIELD_CATEGORY_MAP[field] ?? "기타";
        if (!result[cat]) result[cat] = [];
        result[cat].push(field);
    }
    return result;
};

/** 알림 message 문자열 → 포함된 카테고리 배열 (중복 제거, 순서 유지) */
export const getInfoAlertCategories = (message = "") => {
    const seen = new Set();
    const categories = [];
    for (const [field, cat] of Object.entries(FIELD_CATEGORY_MAP)) {
        if (message.includes(field) && !seen.has(cat)) {
            seen.add(cat);
            categories.push(cat);
        }
    }
    return categories;
};

const EMERGENCY_ALERT_STATUSES = [
    "SOS",
    "미응답 SOS",
    "보호자 미응답 SOS",
    "낙상 의심",
    "안전구역 이탈",
    "위험 알림",
];

const PENDING_APPLICATION_STATUSES = [
    "PENDING",
    "검토대기",
    "검토 대기",
    "대기 중",
    "미검토",
];

const PHONE_APPLICATION_STATUSES = [
    "전화상담요청",
    "전화 상담 요청",
];

const COMPLETED_APPLICATION_STATUSES = [
    "COMPLETED",
    "DONE",
    "APPROVED",
    "REJECTED",
    "CANCELED",
    "배정 완료",
    "처리 완료",
    "반려",
    "취소 처리",
];

export const isEmergencyPendingSenior = (senior) => {
    const alertStatus = String(senior.alertStatus || senior.alertType || "");
    const isHandled =
        senior.alertHandled === true ||
        senior.alertResolved === true ||
        senior.isAlertResolved === true ||
        senior.status === "처리 완료" ||
        senior.alertStatus === "처리 완료";

    return EMERGENCY_ALERT_STATUSES.some((status) => alertStatus.includes(status)) && !isHandled;
};

const isBlank = (value) =>
    value === undefined ||
    value === null ||
    String(value).trim() === "" ||
    String(value).trim() === "주소 미등록" ||
    String(value).trim() === "기록 없음";

// 개별 필드가 API에서 내려온 경우 직접 체크, 없으면 has...Info 플래그로 폴백
const checkField = (value, flagFallback) => {
    if (value !== undefined) return isBlank(value);
    return flagFallback;
};

export const hasMissingRequiredSeniorInfo = (senior) =>
    getMissingSeniorInfoFields(senior).length > 0;

export const getMissingSeniorInfoFields = (senior) => {
    const fields = [];

    // ── 기본 정보 ───────────────────────────────────────────────────────
    if (isBlank(senior.phone)) fields.push("연락처");
    if (isBlank(senior.address) && isBlank(senior.region)) fields.push("주소");
    if (isBlank(senior.birthDate) && isBlank(senior.age)) fields.push("생년월일/나이");
    if (isBlank(senior.gender)) fields.push("성별");

    // ── 인적사항: 장애 정보 ──────────────────────────────────────────────
    if (checkField(senior.disabilityGrade, !senior.hasDisabilityInfo)) fields.push("장애 등급");
    if (checkField(senior.disabilityType, !senior.hasDisabilityInfo)) fields.push("장애 유형");

    // ── 신체 정보 ────────────────────────────────────────────────────────
    if (checkField(senior.smoking, !senior.hasBodyInfo)) fields.push("흡연");
    if (checkField(senior.drinking, !senior.hasBodyInfo)) fields.push("음주");

    // ── 복약 정보 ────────────────────────────────────────────────────────
    if (checkField(senior.medicineCount, !senior.hasMedicationInfo)) fields.push("복약 정보");

    // ── 만성질환 ─────────────────────────────────────────────────────────
    const chronicFields = [
        { key: "diabetes", label: "당뇨" },
        { key: "hypertension", label: "고혈압" },
        { key: "heart", label: "심장질환" },
        { key: "joint", label: "관절질환" },
        { key: "stroke", label: "뇌졸중" },
        { key: "kidney", label: "신장질환" },
        { key: "lung", label: "호흡기질환" },
        { key: "liver", label: "간질환" },
        { key: "cancer", label: "암" },
    ];
    for (const { key, label } of chronicFields) {
        if (checkField(senior[key], !senior.hasHealthInfo)) fields.push(label);
    }

    // ── 거동/인지 ────────────────────────────────────────────────────────
    const mobilityFields = [
        { key: "walkingAid", label: "보행 보조기" },
        { key: "dementia", label: "치매" },
        { key: "vision", label: "시력" },
        { key: "hearing", label: "청력" },
        { key: "recentFall", label: "최근 낙상" },
        { key: "hasSurgery", label: "수술 이력" },
    ];
    for (const { key, label } of mobilityFields) {
        if (checkField(senior[key], !senior.hasHealthInfo)) fields.push(label);
    }
    if (senior.hasSurgery === "있음") {
        let hasDetails = false;
        try {
            const list = typeof senior.surgeriesJson === "string"
                ? JSON.parse(senior.surgeriesJson)
                : (Array.isArray(senior.surgeriesJson) ? senior.surgeriesJson : []);
            hasDetails = Array.isArray(list) && list.some((s) => s.name && String(s.name).trim());
        } catch { /* ignore */ }
        if (!hasDetails) fields.push("수술 상세");
    }

    // ── 복지 정보 ────────────────────────────────────────────────────────
    const welfareFields = [
        { key: "livingCostStatus", label: "생계비 현황" },
        { key: "householdType", label: "가구 유형" },
        { key: "pensionStatus", label: "연금 현황" },
        { key: "housingType", label: "주거 유형" },
    ];
    for (const { key, label } of welfareFields) {
        if (checkField(senior[key], !senior.hasWelfareInfo)) fields.push(label);
    }

    // ── 활동 조건 / 일자리 (만 18세 미만은 제외) ────────────────────────
    const seniorAge = Number(senior.age) || null;
    const isMinor = seniorAge !== null && seniorAge < 18;
    if (!isMinor) {
        if (checkField(senior.maxHours, false)) fields.push("최대 근무 시간");
        if (checkField(senior.maxDistance, false)) fields.push("이동 가능 거리");
        if (checkField(senior.restNeed, false)) fields.push("휴식 필요");
        if (checkField(senior.payType, false)) fields.push("희망 급여 유형");
    }

    return fields;
};

export const getSeniorSummaryCounts = (seniors = []) => ({
    totalSeniors: seniors.length,
    emergencyRequired: seniors.filter(isEmergencyPendingSenior).length,
    missingInfo: seniors.filter(hasMissingRequiredSeniorInfo).length,
});

export const isPendingJobApplication = (application) => {
    const status = String(
        application.status ||
        application.applicationStatus ||
        application.workRequestStatus ||
        ""
    );

    return PENDING_APPLICATION_STATUSES.includes(status);
};

export const isPhoneConsultationJobApplication = (application) => {
    const status = String(
        application.status ||
        application.applicationStatus ||
        application.workRequestStatus ||
        ""
    );

    return (
        application.applicationType === "PHONE" ||
        application.application_type === "PHONE" ||
        application.consultationRequested === true ||
        application.consultation_requested === true ||
        PHONE_APPLICATION_STATUSES.includes(status)
    );
};

export const isCompletedJobApplication = (application) => {
    const status = String(
        application.status ||
        application.applicationStatus ||
        application.workRequestStatus ||
        ""
    );

    return COMPLETED_APPLICATION_STATUSES.includes(status);
};

export const getJobApplicationSummaryCounts = (applications = []) => ({
    totalApplications: applications.length,
    pendingReview: applications.filter(isPendingJobApplication).length,
    phoneConsultationRequests: applications.filter(isPhoneConsultationJobApplication).length,
    completed: applications.filter(isCompletedJobApplication).length,
});
