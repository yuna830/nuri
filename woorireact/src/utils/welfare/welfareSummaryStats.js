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

export const hasMissingRequiredSeniorInfo = (senior) =>
    getMissingSeniorInfoFields(senior).length > 0;

export const getMissingSeniorInfoFields = (senior) => {
    const fields = [];

    if (isBlank(senior.phone)) fields.push("연락처");
    if (isBlank(senior.address) && isBlank(senior.region)) fields.push("주소");
    if (isBlank(senior.birthDate) && isBlank(senior.age)) fields.push("생년월일/나이");
    if (isBlank(senior.gender)) fields.push("성별");

    if (!senior.hasDisabilityInfo) fields.push("장애 정보");
    if (!senior.hasBodyInfo) fields.push("신체 정보");
    if (!senior.hasHealthInfo) fields.push("건강 정보");
    if (!senior.hasMedicationInfo) fields.push("복약 정보");
    if (!senior.hasWelfareInfo) fields.push("복지 정보");

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
