import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import WelfareCommonHeader from "../../components/welfare/WelfareCommonHeader.jsx";

import {
    normalizeSenior,
    applySavedWelfareDecision,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";
import {
    fetchWelfareSeniorDetail,
    fetchWelfareSeniorHealthEvaluation,
    requestGuardianConsultation,
    fetchSeniorAlerts,
    removeWelfareSenior,
} from "../../api/welfareDashboardApi";
import KakaoMap from "../../components/KakaoMap";

import { resolveUploadUrl } from "../../api/userPageApi.js";
import { searchPlacesByKakao } from "../../api/kakaoLocalApi.js";
import { loadSafeZones } from "../../utils/guardian/guardianSafeZone.js";
import "../../css/welfare/WelfareSeniorDetail.css";

const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";

const getSavedCounselingRecords = () => {
    try {
        return JSON.parse(localStorage.getItem(COUNSELING_RECORDS_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
};

const findWelfareDemoCounselingRecords = () => [];

const formatPhoneForDetail = (value) => {
    const digits = String(value || "").replace(/\D/g, "");

    if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    return value || "연락처 없음";
};


const formatLastAccessForDetail = (value) => {
    if (!value || value === "기록 없음") {
        return {
            main: "기록 없음",
            sub: "아직 접속 기록이 없습니다.",
        };
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return {
            main: value,
            sub: "",
        };
    }

    const now = new Date();
    const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const main = date.toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    let sub = "방금 전 접속";
    if (diffMinutes >= 1 && diffMinutes < 60) sub = `${diffMinutes}분 전 접속`;
    if (diffHours >= 1 && diffHours < 24) sub = `${diffHours}시간 전 접속`;
    if (diffDays >= 1) sub = `${diffDays}일 전 접속`;

    return { main, sub };
};

const valueOrMissing = (value, fallback = "미입력") => {
    if (Array.isArray(value)) {
        return value.filter(Boolean).length ? value.filter(Boolean).join(", ") : fallback;
    }

    return value === null || value === undefined || String(value).trim() === "" ? fallback : value;
};

const readMedications = (healthInfo = {}) => {
    if (Array.isArray(healthInfo.medications)) {
        return healthInfo.medications;
    }

    if (typeof healthInfo.medicationsJson === "string") {
        try {
            const parsed = JSON.parse(healthInfo.medicationsJson);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
};

const formatBmi = (height, weight) => {
    const heightNumber = Number(height);
    const weightNumber = Number(weight);

    if (!heightNumber || !weightNumber) {
        return "미입력";
    }

    const bmi = weightNumber / ((heightNumber / 100) ** 2);
    return bmi.toFixed(1);
};

const HEALTH_EVALUATION_CATEGORY = "건강 판정 근거";
const HEALTH_STATUS_ORDER = ["양호", "주의", "위험"];
const HEALTH_SUMMARY_RESULT_LABEL = "사용자 건강 판정 결과";

const normalizeHealthStatus = (value) => {
    const text = String(value || "");
    if (text.includes("위험")) return "위험";
    if (text.includes("주의")) return "주의";
    if (text.includes("양호")) return "양호";
    return "양호";
};

const maxNumberFromText = (value) => {
    const numbers = String(value || "").match(/\d+/g);
    return numbers ? Math.max(...numbers.map(Number)) : 0;
};

const buildConditionGradeBasis = (status) => {
    const normalized = normalizeHealthStatus(status);
    if (normalized === "위험") {
        return "최근 낙상, 중증 질환, 기능 제한, 최근 수술 후 회복 상태처럼 안전 확인이 필요한 신호를 우선 확인합니다.";
    }
    if (normalized === "주의") {
        return "질환, 복약 수, 보행/감각 제한, 활동 가능 시간처럼 배치 전 확인이 필요한 신호를 함께 확인합니다.";
    }
    return "단일 불편 항목이 있어도 전체 건강 조건에서 크게 우려할 만한 신호가 뚜렷하지 않으면 양호로 설명합니다.";
};

const inferHealthStatusFromReasons = (reasons) => {
    if (reasons.some((reason) => normalizeHealthStatus(reason.level) === "위험")) return "위험";
    if (reasons.some((reason) => normalizeHealthStatus(reason.level) === "주의")) return "주의";
    return "양호";
};

const getReasonCriterion = (reason = {}, finalStatus) => {
    const level = normalizeHealthStatus(reason.level);

    if (reason.criterion) return reason.criterion;

    const label = String(reason.label || "");
    const count = maxNumberFromText(reason.value);

    if (level === "양호") return "주의/위험 설명 조건 미충족";
    if (label.includes("낙상")) return "위험 설명 조건: 최근 낙상";
    if (label.includes("주요 질환 수")) return "위험 설명 조건: 중증 질환 2개 이상";
    if (label.includes("신체 제한")) {
        return count >= 4 || level === "위험"
            ? "위험 설명 조건: 기능 제한 4개 이상"
            : "주의 설명 조건: 기능 제한 확인";
    }
    if (label.includes("복약")) return "주의 설명 조건: 복약 3개 이상";
    if (["심장질환", "뇌졸중", "신장질환", "호흡기질환", "암", "치매"].some((keyword) => label.includes(keyword))) {
        return level === "위험" ? "위험 설명 조건: 중증 질환 상태" : "주의 설명 조건: 주요 질환 확인";
    }
    if (label.includes("질환") || ["고혈압", "당뇨"].some((keyword) => label.includes(keyword))) {
        return "주의 설명 조건: 질환 1개 이상";
    }
    if (label.includes("활동")) return "주의 설명 조건: 짧은 활동 가능 시간";
    if (["보행", "시각", "청각", "어려운 업무"].some((keyword) => label.includes(keyword))) {
        return "주의 설명 조건: 보행/감각/업무 제한 확인";
    }
    return `${level} 설명 조건`;
};

const buildDecisionSummary = (status, reasons = [], source) => {
    const normalized = normalizeHealthStatus(status);
    const meaningfulReasons = reasons.filter((reason) => normalizeHealthStatus(reason.level) !== "양호");
    const primaryLabels = meaningfulReasons
        .slice(0, 2)
        .map((reason) => reason.label)
        .join(", ");
    const prefix = source === "ML" ? `ML 모델이 ${normalized}로 예측했습니다.` : `${normalized}로 판정되었습니다.`;

    if (normalized === "양호") {
        return source === "ML"
            ? "ML 모델이 양호로 예측했습니다. 주의 또는 위험 설명 조건에 해당하는 주요 조건이 확인되지 않았습니다."
            : "주의 또는 위험 설명 조건에 해당하는 주요 조건이 확인되지 않아 양호로 판정되었습니다.";
    }

    return `${prefix} ${primaryLabels || "입력 건강 정보"} 조건이 판정 근거로 확인되었습니다.`;
};

const hasScoreText = (value) => {
    const text = String(value || "");
    return /\+\d+\s*점/.test(text) || /\d+(?:~\d+)?\s*점/.test(text) || text.includes("점수");
};

const getReasonDescription = (reason = {}, finalStatus) => {
    const level = normalizeHealthStatus(reason.level);
    const hasFinalStatus = finalStatus !== undefined && finalStatus !== null && String(finalStatus).trim() !== "";
    const normalizedFinalStatus = normalizeHealthStatus(finalStatus);

    if (reason.description && !hasScoreText(reason.description)) return reason.description;

    if (hasFinalStatus && normalizedFinalStatus === "양호" && level !== "양호") {
        const label = String(reason.label || "해당");
        return `${label} 항목은 ${level} 신호로 따로 표시됩니다. 다만 최근 낙상, 중증 질환 수, 복약 수, 활동 가능 시간 등 전체 조건을 함께 봤을 때 최종 판정은 양호로 유지되었습니다.`;
    }

    const criterion = getReasonCriterion(reason, finalStatus);
    if (level === "양호") {
        return "전체 건강 조건에서 크게 우려할 만한 신호가 뚜렷하지 않습니다.";
    }
    return `${criterion} 조건이 확인되어 업무 강도와 배치 조건을 확인해야 합니다.`;
};

const hasHealthProblemValue = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return false;
    if (["없음", "없다", "정상", "양호", "아니오", "no", "none", "false", "0"].includes(text)) return false;
    return ["있음", "있다", "주의", "위험", "질환", "진단", "치료", "관리", "제한", "중증", "경증", "yes", "true", "1"]
        .some((keyword) => text.includes(keyword));
};

const hasLimitedHealthValue = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return false;
    if (["없음", "없다", "정상", "양호", "미사용", "no", "none", "false", "0"].includes(text)) return false;
    return ["불편", "보조", "지팡이", "보행", "어려", "제한", "필요", "사용", "힘듦", "장시간", "계단", "무거운", "운반", "헷갈림", "도움"]
        .some((keyword) => text.includes(keyword));
};

const hasShortActivityHours = (value) => {
    const hours = maxNumberFromText(value);
    return hours > 0 && hours <= 4;
};

const buildFallbackHealthEvaluation = (senior = {}, healthInfo = {}) => {
    const reasons = [];
    const addReason = (label, value, level, description, condition, criterion) => {
        if (condition) {
            reasons.push({
                label,
                value: valueOrMissing(value, "입력값 있음"),
                level,
                score: 0,
                criterion: criterion || getReasonCriterion({ label, value, level }),
                description,
            });
        }
    };

    addReason("최근 낙상", healthInfo.recentFall, "위험", "위험 설명 조건에 해당합니다. 최근 낙상 이력이 확인되어 이동이 많거나 계단을 오가는 업무는 피하는 것이 좋습니다.", hasHealthProblemValue(healthInfo.recentFall), "위험 설명 조건: 최근 낙상");

    [
        ["심장질환", healthInfo.heartDisease],
        ["뇌졸중", healthInfo.stroke],
        ["신장질환", healthInfo.kidneyDisease],
        ["호흡기질환", healthInfo.lungDisease],
        ["암", healthInfo.cancer],
        ["치매", healthInfo.dementia],
    ].forEach(([label, value]) => {
        addReason(label, value, "주의", "주의 설명 조건에 해당합니다. 주요 질환 항목이 확인되어 고강도 업무 배치를 피하는 것이 좋습니다.", hasHealthProblemValue(value), "주의 설명 조건: 주요 질환 확인");
    });

    [
        ["고혈압", healthInfo.hypertension],
        ["당뇨", healthInfo.diabetes],
        ["관절질환", healthInfo.jointDisease],
        ["간질환", healthInfo.liverDisease],
        ["기타 질환", healthInfo.otherDisease],
    ].forEach(([label, value]) => {
        addReason(label, value, "주의", "주의 설명 조건에 해당합니다. 질환 항목이 확인되어 업무 강도와 근무 시간 조정이 필요할 수 있습니다.", hasHealthProblemValue(value), "주의 설명 조건: 질환 1개 이상");
    });

    const medicineCount = maxNumberFromText(healthInfo.medicineCount);
    addReason("복약 수", healthInfo.medicineCount, "주의", "주의 설명 조건에 해당합니다. 복약 수가 3개 이상으로 확인되어 근무 전 건강 상태와 복약 일정을 확인해야 합니다.", medicineCount >= 3, "주의 설명 조건: 복약 3개 이상");
    addReason("보행 보조", healthInfo.walkingAid, "주의", "주의 설명 조건에 해당합니다. 보행 보조 또는 이동 제한이 확인되어 이동이 많거나 장시간 서 있는 업무는 조정이 필요합니다.", hasLimitedHealthValue(healthInfo.walkingAid), "주의 설명 조건: 보행 제한 확인");
    addReason("시각", healthInfo.vision, "주의", "주의 설명 조건에 해당합니다. 시각 제한이 확인되어 시야 확인이 중요한 업무는 배치 전 확인이 필요합니다.", hasLimitedHealthValue(healthInfo.vision), "주의 설명 조건: 감각 제한 확인");
    addReason("청각", healthInfo.hearing, "주의", "주의 설명 조건에 해당합니다. 청각 제한이 확인되어 안내 청취나 고객 응대가 많은 업무는 배치 전 확인이 필요합니다.", hasLimitedHealthValue(healthInfo.hearing), "주의 설명 조건: 감각 제한 확인");
    addReason("어려운 업무", healthInfo.disabledWork, "주의", "주의 설명 조건에 해당합니다. 입력된 제한 업무는 일자리 추천 시 제외하거나 조정해야 합니다.", hasLimitedHealthValue(healthInfo.disabledWork), "주의 설명 조건: 업무 제한 확인");

    const maxHours = maxNumberFromText(healthInfo.maxHours);
    addReason("하루 활동 가능 시간", healthInfo.maxHours, "주의", "주의 설명 조건에 해당합니다. 하루 활동 가능 시간이 짧아 짧은 근무 시간의 공고가 우선입니다.", maxHours > 0 && maxHours <= 4, "주의 설명 조건: 짧은 활동 가능 시간");

    const status = inferHealthStatusFromReasons(reasons);
    if (reasons.length === 0) {
        reasons.push({
            label: "주의/위험 조건",
            value: "감지되지 않음",
            level: "양호",
            score: 0,
            criterion: "주의/위험 설명 조건 미충족",
            description: "현재 입력된 건강 정보에서는 주요 위험 요인이 확인되지 않았습니다.",
        });
    }

    return {
        status,
        source: "CLIENT_FALLBACK",
        probabilities: {
            양호: status === "양호" ? 1 : 0,
            주의: status === "주의" ? 1 : 0,
            위험: status === "위험" ? 1 : 0,
        },
        riskScore: 0,
        maxRiskScore: 100,
        gradeBasis: buildConditionGradeBasis(status),
        summary: buildDecisionSummary(status, reasons, "CLIENT_FALLBACK"),
        reasons,
    };
};

const formatProbability = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0%";
    return `${Math.round(number * 100)}%`;
};

const getDisplayHealthProbabilities = (probabilities = {}, status = "양호") => {
    const normalizedStatus = normalizeHealthStatus(status);
    const raw = Object.fromEntries(
        HEALTH_STATUS_ORDER.map((label) => {
            const value = Number(probabilities?.[label]);
            return [label, Number.isFinite(value) && value > 0 ? value : 0];
        })
    );
    const total = HEALTH_STATUS_ORDER.reduce((sum, label) => sum + raw[label], 0);
    const isOneHot = HEALTH_STATUS_ORDER.some((label) => raw[label] >= 0.995)
        && HEALTH_STATUS_ORDER.filter((label) => raw[label] > 0.001).length <= 1;

    if (total <= 0.001 || isOneHot) {
        if (normalizedStatus === "위험") return { 양호: 0.06, 주의: 0.24, 위험: 0.70 };
        if (normalizedStatus === "주의") return { 양호: 0.24, 주의: 0.68, 위험: 0.08 };
        return { 양호: 0.62, 주의: 0.34, 위험: 0.04 };
    }

    const normalized = Object.fromEntries(
        HEALTH_STATUS_ORDER.map((label) => [label, raw[label] / total])
    );
    const dominant = HEALTH_STATUS_ORDER.reduce(
        (best, label) => normalized[label] > normalized[best] ? label : best,
        HEALTH_STATUS_ORDER[0]
    );

    if (normalized[dominant] <= 0.94) return normalized;

    const capped = { ...normalized, [dominant]: 0.94 };
    const restLabels = HEALTH_STATUS_ORDER.filter((label) => label !== dominant);
    const restTotal = restLabels.reduce((sum, label) => sum + normalized[label], 0);
    restLabels.forEach((label, index) => {
        capped[label] = restTotal > 0
            ? (normalized[label] / restTotal) * 0.06
            : index === 0 ? 0.04 : 0.02;
    });
    return capped;
};

const getEvaluationSourceLabel = (source) => {
    if (source === "ML") return HEALTH_SUMMARY_RESULT_LABEL;
    if (source === "RULE_FALLBACK") return "규칙 기반 보조 판정";
    if (source === "NO_HEALTH_INFO") return "건강 정보 미등록";
    return "저장 정보 기준 임시 표시";
};

const getCaseValidationLabel = (decision) => {
    if (decision === "CONFIRMED") return "유사 사례 지지";
    if (decision === "ADJUSTED_BY_SIMILAR_CASES") return "유사 사례 보정";
    if (decision === "REVIEW_REQUIRED") return "추가 검토 필요";
    if (decision === "CONFIRMED_LOW_SUPPORT") return "참고 확인";
    return "검증 정보";
};

const getCaseSupportLabel = (caseValidation) => {
    const supportLevel = caseValidation?.supportLevel;
    if (supportLevel) return `사례 지지 ${supportLevel}`;

    const agreeingCount = caseValidation?.agreeingCaseCount;
    const totalCount = caseValidation?.similarCaseCount;
    if (Number.isFinite(agreeingCount) && Number.isFinite(totalCount) && totalCount > 0) {
        return `유사 사례 ${agreeingCount}/${totalCount}건 참고`;
    }

    return "유사 사례 참고";
};

const getReadableCaseSupportText = (status, caseValidation = null) => {
    const totalCount = Number(caseValidation?.similarCaseCount);
    const agreeingCount = Number(caseValidation?.agreeingCaseCount);
    const finalStatus = normalizeHealthStatus(caseValidation?.finalPrediction || status);
    const mlStatus = caseValidation?.mlPrediction ? normalizeHealthStatus(caseValidation.mlPrediction) : finalStatus;
    const caseStatus = caseValidation?.casePrediction ? normalizeHealthStatus(caseValidation.casePrediction) : "";

    if (!Number.isFinite(agreeingCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
        return "비슷한 CSV 사례를 함께 참고했습니다.";
    }

    if (caseValidation?.agreedWithModel) {
        return `상위 유사 사례 ${totalCount}건 중 ${agreeingCount}건이 ML 예측(${mlStatus})과 같았습니다.`;
    }

    if (caseStatus && caseStatus !== finalStatus) {
        return `상위 유사 사례 ${totalCount}건 중 ${agreeingCount}건은 ${caseStatus}였지만, 최종 판정은 ${finalStatus}로 유지했습니다.`;
    }

    return `상위 유사 사례 ${totalCount}건 중 ${agreeingCount}건이 ${finalStatus} 판정을 보였습니다.`;
};

const getCaseValidationTone = (decision) => {
    if (decision === "ADJUSTED_BY_SIMILAR_CASES" || decision === "REVIEW_REQUIRED") return "caution";
    return "good";
};

const READABLE_DISEASE_FIELDS = [
    ["diabetes", "당뇨"],
    ["hypertension", "고혈압"],
    ["heartDisease", "심장질환"],
    ["jointDisease", "관절질환"],
    ["stroke", "뇌졸중"],
    ["kidneyDisease", "신장질환"],
    ["lungDisease", "호흡기질환"],
    ["liverDisease", "간질환"],
    ["cancer", "암"],
    ["dementia", "치매"],
    ["otherDisease", "기타 질환"],
];

const SERIOUS_DISEASE_KEYS = new Set(["heartDisease", "stroke", "kidneyDisease", "lungDisease", "cancer", "dementia"]);
const SERIOUS_DISEASE_LABELS = new Set(
    READABLE_DISEASE_FIELDS
        .filter(([key]) => SERIOUS_DISEASE_KEYS.has(key))
        .map(([, label]) => label)
);

const READABLE_EMPTY_VALUES = new Set(["", "없음", "정상", "미입력", "미사용", "아니오", "no", "none", "false", "0", "nan"]);

const isReadablePresent = (value) => {
    const text = String(value ?? "").trim().toLowerCase();
    return !READABLE_EMPTY_VALUES.has(text);
};

const getAndParticle = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "와";
    const lastChar = text[text.length - 1];
    const code = lastChar.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
        return (code - 0xac00) % 28 === 0 ? "와" : "과";
    }
    return /[0-9]$/.test(lastChar) ? "과" : "와";
};

const getSubjectParticle = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "이";
    const lastChar = text[text.length - 1];
    const code = lastChar.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
        return (code - 0xac00) % 28 === 0 ? "가" : "이";
    }
    return /[0-9]$/.test(lastChar) ? "이" : "가";
};

const withSubjectParticle = (value) => {
    const text = String(value ?? "").trim();
    return text ? `${text}${getSubjectParticle(text)}` : "";
};

const joinReadableItems = (items) => {
    const cleanItems = items.filter(Boolean);
    if (cleanItems.length === 0) return "";
    if (cleanItems.length === 1) return cleanItems[0];
    return cleanItems.join(", ");
};

const summarizeReadableGroup = (items, groupLabel, visibleCount = 2) => {
    const cleanItems = items.filter(Boolean);
    if (cleanItems.length === 0) return "";
    if (cleanItems.length <= visibleCount) return joinReadableItems(cleanItems);
    return `${cleanItems.slice(0, visibleCount).join(", ")} 등 ${groupLabel} ${cleanItems.length}개`;
};

const getReadableDiseaseNames = (healthInfo = {}) => (
    READABLE_DISEASE_FIELDS
        .filter(([key]) => isReadablePresent(healthInfo[key]))
        .map(([, label]) => label)
);

const getReadableSeriousDiseaseNames = (healthInfo = {}) => (
    READABLE_DISEASE_FIELDS
        .filter(([key]) => SERIOUS_DISEASE_KEYS.has(key) && isReadablePresent(healthInfo[key]))
        .map(([, label]) => label)
);

const getReadableMedicationCount = (healthInfo = {}, medications = []) => (
    Math.max(maxNumberFromText(healthInfo.medicineCount), Array.isArray(medications) ? medications.length : 0)
);

const getReadableLimitations = (healthInfo = {}) => {
    const limitations = [];
    if (hasLimitedHealthValue(healthInfo.walkingAid)) limitations.push("보행 보조 필요");
    if (hasLimitedHealthValue(healthInfo.vision)) limitations.push("시력 불편");
    if (hasLimitedHealthValue(healthInfo.hearing)) limitations.push("청력 불편");
    if (hasLimitedHealthValue(healthInfo.disabledWork)) limitations.push("업무 제한");
    return limitations;
};

const buildHealthEvidenceReasons = (status, healthInfo = {}, medications = [], modelReasons = [], probabilities = {}) => {
    const evidence = [];
    const addEvidence = (label, value, level, criterion, description) => {
        evidence.push({ label, value, level, criterion, description });
    };

    const diseases = getReadableDiseaseNames(healthInfo);
    const seriousDiseases = getReadableSeriousDiseaseNames(healthInfo);
    const generalDiseases = diseases.filter((name) => !SERIOUS_DISEASE_LABELS.has(name));
    const medicineCount = getReadableMedicationCount(healthInfo, medications);
    const maxHours = maxNumberFromText(healthInfo.maxHours);
    const limitations = getReadableLimitations(healthInfo);
    const hasFall = hasHealthProblemValue(healthInfo.recentFall);
    const dangerProbability = Number(probabilities?.위험 || 0);
    const dangerSignals = [];
    const softDangerReasons = [];
    if (hasFall) dangerSignals.push("최근 낙상");
    if (seriousDiseases.length >= 2) dangerSignals.push("중증 질환 2개 이상");
    if (limitations.length >= 4) dangerSignals.push("기능 제한 4개 이상");
    if (medicineCount >= 6 && diseases.length >= 2) dangerSignals.push("복약 6개 이상과 질환 2개 이상");
    if (maxHours > 0 && maxHours <= 4) softDangerReasons.push("짧은 활동 시간");
    if (limitations.length > 0) softDangerReasons.push("보행·감각·업무 제한");
    if (medicineCount >= 3) softDangerReasons.push("복약 수");
    if (diseases.length > 0) softDangerReasons.push("질환 정보");

    addEvidence(
        "위험 신호",
        dangerSignals.length > 0 ? joinReadableItems(dangerSignals) : "해당 없음",
        dangerSignals.length > 0 ? "위험" : "양호",
        dangerSignals.length > 0
            ? "위험 기준: 위험 신호 확인"
            : "위험 기준: 낙상/중증 질환/기능 제한 미해당",
        dangerSignals.length > 0
            ? "위험 기준에 해당하는 신호가 있어 위험 가능성을 봅니다."
            : "낙상, 중증 질환 복수, 기능 제한 4개 이상이 없어 위험으로 보지 않았습니다."
    );

    if (dangerSignals.length === 0 && dangerProbability > 0.01) {
        const dangerPercent = `${Math.round(dangerProbability * 100)}%`;
        addEvidence(
            "위험 가능성",
            dangerPercent,
            "위험",
            `참고: 위험 가능성 ${dangerPercent}`,
            softDangerReasons.length > 0
                ? `${joinReadableItems(softDangerReasons)} 때문에 위험 가능성이 낮게 남아 있습니다.`
                : "큰 위험 조건은 없지만 입력 조건상 낮은 위험 가능성이 남아 있습니다."
        );
    }

    addEvidence(
        "최근 낙상",
        hasFall ? valueOrMissing(healthInfo.recentFall) : "없음",
        hasFall ? "위험" : "양호",
        hasFall ? "위험 기준: 최근 낙상 이력 있음" : "양호 기준: 최근 낙상 이력 없음",
        hasFall
            ? "낙상 이력이 있어 이동 업무 전 안전 확인이 필요합니다."
            : "낙상 이력이 없어 위험 신호에서 제외했습니다."
    );

    addEvidence(
        "중증 질환",
        seriousDiseases.length > 0 ? joinReadableItems(seriousDiseases) : "없음",
        seriousDiseases.length >= 2 ? "위험" : seriousDiseases.length === 1 ? "주의" : "양호",
        seriousDiseases.length >= 2
            ? "위험 기준: 중증 질환 2개 이상"
            : seriousDiseases.length === 1
                ? "주의 기준: 중증 질환 1개 확인"
                : "양호 기준: 중증 질환 미확인",
        seriousDiseases.length >= 2
            ? `${joinReadableItems(seriousDiseases)}이 함께 확인되어 위험 신호로 봅니다.`
            : seriousDiseases.length === 1
                ? `${seriousDiseases[0]} 항목이 있어 주의가 필요합니다.`
                : "중증 질환 항목이 없어 위험도를 낮게 봤습니다."
    );

    addEvidence(
        "일반 질환",
        generalDiseases.length > 0 ? joinReadableItems(generalDiseases) : "없음",
        generalDiseases.length > 0 ? "주의" : "양호",
        generalDiseases.length > 0 ? "주의 기준: 질환 1개 이상" : "양호 기준: 일반 질환 미확인",
        generalDiseases.length > 0
            ? `${joinReadableItems(generalDiseases)} 항목 때문에 주의 신호로 봅니다.`
            : "일반 질환 항목이 없어 양호 신호로 봅니다."
    );

    addEvidence(
        "복약 수",
        `${medicineCount}개`,
        medicineCount >= 3 ? "주의" : "양호",
        medicineCount >= 3 ? "주의 기준: 복약 3개 이상" : "양호 기준: 복약 3개 미만",
        medicineCount >= 3
            ? `복약 ${medicineCount}개라 복약 관리 확인이 필요합니다.`
            : `복약 ${medicineCount}개라 복약 과다 기준에는 해당하지 않습니다.`
    );

    if (maxHours > 0) {
        addEvidence(
            "하루 활동 가능 시간",
            `${maxHours}시간`,
            maxHours <= 4 ? "주의" : "양호",
            maxHours <= 4 ? "주의 기준: 하루 활동 가능 시간 4시간 이하" : "양호 기준: 하루 활동 가능 시간 5시간 이상",
            maxHours <= 4
                ? `${maxHours}시간만 가능해 장시간 업무는 부담될 수 있습니다.`
                : `${maxHours}시간 가능해 짧은 활동 시간 기준에는 해당하지 않습니다.`
        );
    }

    addEvidence(
        "보행·감각·업무 제한",
        limitations.length > 0 ? joinReadableItems(limitations) : "없음",
        limitations.length >= 4 ? "위험" : limitations.length > 0 ? "주의" : "양호",
        limitations.length >= 4
            ? "위험 기준: 기능 제한 4개 이상"
            : limitations.length > 0
                ? "주의 기준: 보행/감각/업무 제한 확인"
                : "양호 기준: 보행/감각/업무 제한 미확인",
        limitations.length >= 4
            ? `${joinReadableItems(limitations)}이 겹쳐 위험 신호로 봅니다.`
            : limitations.length > 0
                ? `${joinReadableItems(limitations)} 때문에 업무 종류 조정이 필요합니다.`
                : "보행, 감각, 업무 제한이 없어 양호 신호로 봅니다."
    );

    const existingLabels = new Set(evidence.map((item) => item.label));
    modelReasons.forEach((reason) => {
        if (!reason?.label || existingLabels.has(reason.label)) return;
        const label = String(reason.label);
        if (["보행", "시각", "청각", "어려운 업무", "신체 제한", "복약", "활동 가능 시간"].some((keyword) => label.includes(keyword))) return;
        evidence.push(reason);
    });

    const normalizedStatus = normalizeHealthStatus(status);
    return evidence.sort((left, right) => {
        const leftLevel = normalizeHealthStatus(left.level);
        const rightLevel = normalizeHealthStatus(right.level);
        if (leftLevel === normalizedStatus && rightLevel !== normalizedStatus) return -1;
        if (leftLevel !== normalizedStatus && rightLevel === normalizedStatus) return 1;
        return HEALTH_STATUS_ORDER.indexOf(rightLevel) - HEALTH_STATUS_ORDER.indexOf(leftLevel);
    });
};

const getReadableStatusIntro = (status) => `최종 판정은 ${normalizeHealthStatus(status)}입니다.`;

const makeReadableSentence = (items, fallback = "") => {
    const cleanItems = items.filter(Boolean);
    if (cleanItems.length === 0) return fallback;
    if (cleanItems.length === 1) return cleanItems[0];

    const toConnectingClause = (value) => {
        const text = String(value || "").trim().replace(/[.。]+$/, "");
        return text
            .replace(/봐야 합니다$/, "봐야 하고")
            .replace(/필요합니다$/, "필요하고")
            .replace(/길지 않습니다$/, "길지 않고")
            .replace(/많습니다$/, "많고")
            .replace(/큰 편입니다$/, "큰 편이고")
            .replace(/확인되었습니다$/, "확인되었고")
            .replace(/확인됩니다$/, "확인되고")
            .replace(/있습니다$/, "있고")
            .replace(/입니다$/, "이고");
    };

    const clauses = cleanItems.map((item, index) => {
        const text = String(item || "").trim().replace(/[.。]+$/, "");
        return index === cleanItems.length - 1 ? text : toConnectingClause(text);
    });

    return clauses.join(", ");
};

const buildReadableHealthSummary = (status, healthInfo = {}, medications = [], caseValidation = null) => {
    const normalized = normalizeHealthStatus(status);
    const diseases = getReadableDiseaseNames(healthInfo);
    const seriousDiseases = getReadableSeriousDiseaseNames(healthInfo);
    const medicineCount = getReadableMedicationCount(healthInfo, medications);
    const maxHours = maxNumberFromText(healthInfo.maxHours);
    const limitations = getReadableLimitations(healthInfo);
    const hasFall = hasHealthProblemValue(healthInfo.recentFall);

    if (normalized === "위험") {
        const reasons = [];
        if (hasFall) reasons.push("최근 낙상 이력이 있어 이동 중 사고 가능성을 먼저 봐야 합니다");
        if (seriousDiseases.length >= 2) {
            reasons.push(`${withSubjectParticle(summarizeReadableGroup(seriousDiseases, "중증 질환"))} 함께 확인되어 건강 부담이 큰 편입니다`);
        } else if (seriousDiseases.length === 1) {
            reasons.push(`${seriousDiseases[0]}처럼 주의가 필요한 질환이 있습니다`);
        } else if (diseases.length > 0) {
            reasons.push(`${withSubjectParticle(summarizeReadableGroup(diseases, "질환"))} 확인되었습니다`);
        }
        if (medicineCount >= 6) reasons.push(`복약 수가 ${medicineCount}개로 많습니다`);
        else if (medicineCount >= 3) reasons.push(`복약 수가 ${medicineCount}개입니다`);
        if (maxHours > 0 && maxHours <= 4) reasons.push(`하루 활동 가능 시간이 ${maxHours}시간으로 길지 않습니다`);
        if (limitations.length > 0) reasons.push(`${summarizeReadableGroup(limitations, "제한 항목")} 같은 제한 항목도 함께 확인됩니다`);

        return `${getReadableStatusIntro(normalized)} ${makeReadableSentence(reasons, "여러 건강 조건을 함께 보았을 때 위험 가능성이 높게 예측되었습니다.")}. 무리한 업무 배치는 피하고, 복지사가 한 번 더 확인하는 것이 좋습니다.`;
    }

    if (normalized === "주의") {
        const reasons = [];
        if (diseases.length > 0) reasons.push(`${withSubjectParticle(summarizeReadableGroup(diseases, "질환"))} 있습니다`);
        if (medicineCount >= 3) reasons.push(`복약 수가 ${medicineCount}개입니다`);
        if (maxHours > 0 && maxHours <= 4) reasons.push(`하루 활동 가능 시간이 ${maxHours}시간입니다`);
        if (limitations.length > 0) reasons.push(`${summarizeReadableGroup(limitations, "제한 항목")} 같은 제한 항목이 있습니다`);

        const reasonText = makeReadableSentence(reasons, "확인이 필요한 건강 조건이 있습니다");
        const tail = !hasFall && seriousDiseases.length < 2 && limitations.length < 4
            ? "다만 위험으로 볼 정도의 큰 신호는 뚜렷하지 않습니다."
            : "업무 강도와 활동 시간을 조정해 보는 것이 좋습니다.";
        return `${getReadableStatusIntro(normalized)} ${reasonText}. ${tail}`.trim();
    }

    const mildDiseaseText = diseases.length > 0
        ? `${withSubjectParticle(summarizeReadableGroup(diseases, "질환"))} 있지만, 복약 수나 활동 조건을 함께 봤을 때 큰 위험 신호는 보이지 않습니다.`
        : "최근 낙상이나 중증 질환처럼 크게 우려할 만한 신호는 보이지 않습니다.";
    return `${getReadableStatusIntro(normalized)} ${mildDiseaseText}`.trim();
};

const buildReadableCaseValidationMessage = (status, healthInfo = {}, medications = [], caseValidation = null) => {
    const normalized = normalizeHealthStatus(caseValidation?.finalPrediction || status);
    const countText = getReadableCaseSupportText(normalized, caseValidation);
    const basisText = buildReadableHealthSummary(normalized, healthInfo, medications, caseValidation);

    if (caseValidation?.decision === "ADJUSTED_BY_SIMILAR_CASES") {
        return `${basisText} 처음 ML 예측과 유사 사례가 달라서, 더 가까운 사례 쪽을 참고해 최종 판정을 ${normalized}로 조정했습니다.`;
    }

    if (caseValidation?.decision === "REVIEW_REQUIRED" || caseValidation?.decision === "CONFIRMED_LOW_SUPPORT") {
        return `${basisText} ${countText} 다만 사례가 완전히 일치한다고 보기는 어려워 담당자가 한 번 더 확인하면 좋습니다.`;
    }

    return `${basisText} ${countText} 그래서 ML 판정을 그대로 유지했습니다.`;
};

const getHealthTone = (status) => {
    const normalized = normalizeHealthStatus(status);
    if (normalized === "위험") return "danger";
    if (normalized === "주의") return "caution";
    return "good";
};

function WelfareSeniorDetail() {
    const { id } = useParams();
    const location = useLocation();
    const [senior, setSenior] = useState(null);
    const [showCriteria, setShowCriteria] = useState(false);
    const [showHealthReasons, setShowHealthReasons] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [counselingRecords, setCounselingRecords] = useState([]);
    const [selectedCounselingDate, setSelectedCounselingDate] = useState("");
    const [draftCounselingMemo, setDraftCounselingMemo] = useState("");
    const [isMemoEditing, setIsMemoEditing] = useState(false);
    const [memoStatusMessage, setMemoStatusMessage] = useState("");
    const [isSendingConsultRequest, setIsSendingConsultRequest] = useState(false);
    const [consultRequestStatusMessage, setConsultRequestStatusMessage] = useState("");
    const [isConsultRequestModalOpen, setIsConsultRequestModalOpen] = useState(false);
    const [consultRequestMemo, setConsultRequestMemo] = useState("");
    const [seniorAlerts, setSeniorAlerts] = useState([]);
    const [isHealthEvaluationLoading, setIsHealthEvaluationLoading] = useState(false);
    const [healthEvaluationError, setHealthEvaluationError] = useState("");
    // const [isInfoRequestModalOpen, setIsInfoRequestModalOpen] = useState(false);
    // const [selectedInfoRequestKeys, setSelectedInfoRequestKeys] = useState([]);
    // const [isSendingInfoRequest, setIsSendingInfoRequest] = useState(false);
    // const [infoRequestStatusMessage, setInfoRequestStatusMessage] = useState("");

    const [allSafeZones, setAllSafeZones] = useState([]);
    const [selectedZoneIdx, setSelectedZoneIdx] = useState(0);

    const [agencyPlaces, setAgencyPlaces] = useState([]);
    const [isAgencyLoading, setIsAgencyLoading] = useState(false);
    const [agencyError, setAgencyError] = useState("");
    const [linkedAgencyId, setLinkedAgencyId] = useState(null);

    const navigate = useNavigate();
    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

    const AGENCY_LINK_CATEGORY = "기관 연계";

    const CATEGORY_LIST = ["기본 정보", "보호자 정보", "건강 정보", "안심구역 관리", HEALTH_EVALUATION_CATEGORY, AGENCY_LINK_CATEGORY];
    const HEALTH_CATEGORY_LIST = ["신체 정보", "질환/주의 항목"];

    const requestedCategory = location.state?.agencyLinkNeeded
        ? AGENCY_LINK_CATEGORY
        : location.state?.category;
    const initialCategory = CATEGORY_LIST.includes(requestedCategory)
        ? requestedCategory

        : "기본 정보";
    const [activeCategory, setActiveCategory] = useState(initialCategory);

    const applyLoadedSenior = (loadedSenior) => {
        const nextSenior = applySavedWelfareDecision(loadedSenior);
        const savedReviews = JSON.parse(localStorage.getItem("welfareWorkRequestStatus") || "{}");

        if (savedReviews[nextSenior.id]) {
            nextSenior.workRequestStatus = savedReviews[nextSenior.id];
        }

        const savedRecords = getSavedCounselingRecords();
        const nextRecords = savedRecords[nextSenior.id] || findWelfareDemoCounselingRecords(nextSenior.id);
        const sortedRecords = [...nextRecords].sort((a, b) => b.date.localeCompare(a.date));
        const firstDate = sortedRecords[0]?.date || new Date().toISOString().slice(0, 10);
        const firstRecord = sortedRecords.find((record) => record.date === firstDate);

        setSenior(nextSenior);
        setCounselingRecords(sortedRecords);
        setSelectedCounselingDate(firstDate);
        setDraftCounselingMemo(firstRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    const mapSeniorProfileResponse = (data) => {
        const seniorData = data?.senior || {};
        const healthInfo = data?.healthInfo || {};
        const jobPreference = data?.jobPreference || {};
        const safeZone = data?.safeZone || seniorData.safeZone || {};
        const lastGps = data?.lastGps || null;

        return normalizeSenior({
            id: seniorData.id,
            name: seniorData.name,
            age: seniorData.age,
            birthDate: seniorData.birthDate,
            gender: seniorData.gender,
            phone: seniorData.phone,
            profileImageUrl: seniorData.profileImageUrl,
            address: seniorData.address,
            region: seniorData.region || seniorData.address || "주소 미등록",
            city: seniorData.city,
            district: seniorData.district,
            dong: seniorData.dong,
            detailAddress: seniorData.detailAddress,
            guardianName: data?.guardianName || "",
            guardianPhone: data?.guardianPhone || "",
            guardianRelation: data?.relation || "보호 대상자",
            healthInfo,
            healthEvaluation: data?.healthEvaluation || null,
            healthStatus: data?.healthEvaluation?.status || healthInfo.healthStatus || "양호",
            disabilityGrade: seniorData.disabilityGrade,
            disabilityType: seniorData.disabilityType,
            preferredWorkTime: healthInfo.maxHours ? `하루 ${healthInfo.maxHours}시간` : "미등록",
            workRequestStatus: seniorData.workRequestStatus || "미검토",
            welfareDecision: seniorData.welfareDecision || "미검토",
            welfareDecisionReason: seniorData.welfareDecisionReason || "",
            jobPreference,
            safeZone: safeZone?.id
                ? {
                    placeName: safeZone.name || safeZone.placeName || "안심구역",
                    address: safeZone.address || "주소 미등록",
                    radiusMeter: safeZone.radiusMeters || safeZone.radiusMeter || 500,
                    radiusMeters: safeZone.radiusMeters || safeZone.radiusMeter || 500,
                    centerLatitude: safeZone.centerLatitude,
                    centerLongitude: safeZone.centerLongitude,
                }
                : null,
            lastGps: lastGps?.latitude != null && lastGps?.longitude != null
                ? {
                    address: lastGps.address || "위치 미확인",
                    latitude: lastGps.latitude,
                    longitude: lastGps.longitude,
                    recordedAt: lastGps.receivedAt,
                }
                : null,
            lastAccess: seniorData.lastLoginAt || "기록 없음",
        });
    };

    useEffect(() => {
        let ignore = false;

        const loadSenior = async () => {
            try {
                setIsLoading(true);
                setMessage("");

                const data = await fetchWelfareSeniorDetail(id);
                const loadedSenior = mapSeniorProfileResponse(data);

                if (!ignore) {
                    applyLoadedSenior(loadedSenior);
                }
            } catch (error) {
                console.error("대상자 상세정보 로딩 실패:", error);

                if (!ignore) {
                    setSenior(null);
                    setMessage("대상자 상세정보를 불러오지 못했습니다.");
                }
            } finally {
                if (!ignore) {
                    setIsLoading(false);
                }
            }
        };

        loadSenior();

        return () => {
            ignore = true;
        };
    }, [id]);

    useEffect(() => {
        if (!senior?.id) return;

        const elder = {
            id: senior.id,
            address: senior.region || senior.address || "",
            center: {
                lat: senior.safeZone?.centerLatitude ?? senior.lastGps?.latitude ?? null,
                lng: senior.safeZone?.centerLongitude ?? senior.lastGps?.longitude ?? null,
            },
            radius: senior.safeZone?.radiusMeters || 500,
        };

        loadSafeZones(elder)
            .then((zones) => { setAllSafeZones(zones); setSelectedZoneIdx(0); })
            .catch(() => {
                if (senior.safeZone) {
                    setAllSafeZones([{
                        id: "primary",
                        name: senior.safeZone.placeName || "안심구역",
                        address: senior.safeZone.address || "",
                        centerLatitude: senior.safeZone.centerLatitude,
                        centerLongitude: senior.safeZone.centerLongitude,
                        radiusMeters: senior.safeZone.radiusMeters || 500,
                    }]);
                }
            });
    }, [senior?.id]);

    useEffect(() => {
        if (!senior?.id) return;
        if (activeCategory !== HEALTH_EVALUATION_CATEGORY) return;
        if (senior.healthEvaluation?.source === "ML") return;

        let ignore = false;
        setIsHealthEvaluationLoading(true);
        setHealthEvaluationError("");

        fetchWelfareSeniorHealthEvaluation(senior.id)
            .then((healthEvaluation) => {
                if (!ignore) {
                    setSenior((prev) => prev
                        ? {
                            ...prev,
                            healthEvaluation,
                            healthStatus: healthEvaluation?.status || prev.healthStatus,
                        }
                        : prev
                    );
                }
            })
            .catch((error) => {
                console.error("건강 판정 정보 로딩 실패:", error);
                if (!ignore) {
                    setHealthEvaluationError("최신 ML 판정을 아직 불러오지 못해 저장된 건강 정보 기준으로 임시 표시하고 있습니다.");
                }
            })
            .finally(() => {
                if (!ignore) {
                    setIsHealthEvaluationLoading(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, [senior?.id, senior?.healthEvaluation?.source, activeCategory]);

    useEffect(() => {
        if (!senior?.id) return;

        let ignore = false;

        const loadSeniorAlerts = () => {
            fetchSeniorAlerts(senior.id)
                .then((data) => {
                    if (!ignore) {
                        setSeniorAlerts(Array.isArray(data) ? data : []);
                    }
                })
                .catch(() => {
                    if (!ignore) {
                        setSeniorAlerts([]);
                    }
                });
        };

        loadSeniorAlerts();

        const intervalId = window.setInterval(loadSeniorAlerts, 5000);

        const handleFocus = () => {
            loadSeniorAlerts();
        };

        window.addEventListener("focus", handleFocus);

        return () => {
            ignore = true;
            window.clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
        };
    }, [senior?.id]);

    const latestConsultRequest = seniorAlerts
        .filter((alert) => alert.type === "WELFARE_CONSULT_REQUEST")
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    const latestConsultResponseType = latestConsultRequest?.guardianResponseType || "";
    const hasImmediateConsultResponse = latestConsultResponseType === "now";
    const hasScheduledConsultResponse = latestConsultResponseType === "schedule";

    const consultRequestStatus = !latestConsultRequest
        ? "상담 요청 전"
        : hasImmediateConsultResponse
            ? "보호자 즉시 상담 가능"
            : hasScheduledConsultResponse
                ? "보호자 상담 일정 응답"
                : latestConsultRequest.isRead
                    ? "보호자 확인 완료"
                    : "보호자 확인 대기 중";

    const selectedCounselingRecord = useMemo(
        () => counselingRecords.find((record) => record.date === selectedCounselingDate),
        [counselingRecords, selectedCounselingDate]
    );

    const detail = getDetail(senior);
    const lastAccessDisplay = formatLastAccessForDetail(senior?.lastAccess);
    const healthInfo = senior?.healthInfo || {};
    const fallbackHealthEvaluation = senior ? buildFallbackHealthEvaluation(senior, healthInfo) : null;
    const healthEvaluation = senior
        ? {
            ...fallbackHealthEvaluation,
            ...(senior.healthEvaluation || {}),
            status: normalizeHealthStatus(senior.healthEvaluation?.status || fallbackHealthEvaluation.status),
            reasons: senior.healthEvaluation?.reasons?.length
                ? senior.healthEvaluation.reasons
                : fallbackHealthEvaluation.reasons,
        }
        : null;
    const medications = readMedications(healthInfo);
    const safeZone = senior?.safeZone || {};
    const safeZoneRadius = safeZone.radiusMeters || safeZone.radiusMeter || 500;
    const safeZoneCenter = {
        lat: safeZone.centerLatitude ?? senior?.lastGps?.latitude ?? null,
        lng: safeZone.centerLongitude ?? senior?.lastGps?.longitude ?? null,
    };
    const hasSafeZoneCenter = safeZoneCenter.lat != null && safeZoneCenter.lng != null;

    const safeZoneForMap = hasSafeZoneCenter
        ? {
            centerLatitude: safeZoneCenter.lat,
            centerLongitude: safeZoneCenter.lng,
            radiusMeters: safeZoneRadius,
        }
        : null;
    const currentLocationForMap = senior?.lastGps
        ? { lat: senior.lastGps.latitude, lng: senior.lastGps.longitude }
        : null;

    const agencySearchCenter = currentLocationForMap || (hasSafeZoneCenter ? safeZoneCenter : null);

    useEffect(() => {
        if (activeCategory !== AGENCY_LINK_CATEGORY) return;

        if (!agencySearchCenter?.lat || !agencySearchCenter?.lng) {
            setAgencyPlaces([]);
            setAgencyError("대상자의 마지막 위치 정보가 없어 기관을 검색할 수 없습니다.");
            return;
        }

        let ignore = false;

        const loadAgencyPlaces = async () => {
            setIsAgencyLoading(true);
            setAgencyError("");

            try {
                const keywords = ["행정복지센터", "주민센터", "동주민센터"];

                const results = await Promise.all(
                    keywords.map((keyword) =>
                        searchPlacesByKakao(keyword, {
                            x: agencySearchCenter.lng,
                            y: agencySearchCenter.lat,
                            radius: 3000,
                            size: 5,
                        }).catch(() => [])
                    )
                );

                const uniquePlaces = results
                    .flat()
                    .filter((place, index, array) => {
                        const key = place.place_id || `${place.name}-${place.display_name}`;
                        return array.findIndex((item) => {
                            const itemKey = item.place_id || `${item.name}-${item.display_name}`;
                            return itemKey === key;
                        }) === index;
                    })
                    .sort((a, b) => Number(a.distance || 999999) - Number(b.distance || 999999))
                    .slice(0, 5);

                if (!ignore) {
                    setAgencyPlaces(uniquePlaces);
                    setAgencyError(uniquePlaces.length ? "" : "근처 행정복지센터 또는 주민센터를 찾지 못했습니다.");
                }
            } catch {
                if (!ignore) {
                    setAgencyPlaces([]);
                    setAgencyError("기관 검색 중 오류가 발생했습니다.");
                }
            } finally {
                if (!ignore) {
                    setIsAgencyLoading(false);
                }
            }
        };

        loadAgencyPlaces();

        return () => {
            ignore = true;
        };
    }, [activeCategory, agencySearchCenter?.lat, agencySearchCenter?.lng]);

    useEffect(() => {
        const nextCategory = location.state?.agencyLinkNeeded
            ? AGENCY_LINK_CATEGORY
            : location.state?.category;

        if (nextCategory && CATEGORY_LIST.includes(nextCategory)) {
            setActiveCategory(nextCategory);
        }
    }, [location.state]);

    const handleCounselingDateChange = (date) => {
        const nextRecord = counselingRecords.find((record) => record.date === date);

        setSelectedCounselingDate(date);
        setDraftCounselingMemo(nextRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    const handleCounselingMemoSave = () => {
        if (!senior || !selectedCounselingDate) {
            return;
        }

        const nextContent = draftCounselingMemo.trim();
        const nextRecords = [
            {
                id: `${senior.id}-${selectedCounselingDate}`,
                date: selectedCounselingDate,
                content: nextContent,
            },
            ...counselingRecords.filter((record) => record.date !== selectedCounselingDate),
        ].sort((a, b) => b.date.localeCompare(a.date));
        const savedRecords = getSavedCounselingRecords();

        localStorage.setItem(
            COUNSELING_RECORDS_STORAGE_KEY,
            JSON.stringify({
                ...savedRecords,
                [senior.id]: nextRecords,
            })
        );

        setCounselingRecords(nextRecords);
        setDraftCounselingMemo(nextContent);
        setIsMemoEditing(false);
        setMemoStatusMessage("전화 및 상담기록이 저장되었습니다.");
    };

    const handleCounselingMemoCancel = () => {
        setDraftCounselingMemo(selectedCounselingRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    function getDetail(target) {
        if (!target) {
            return {};
        }

        return {
            phone: target.phone,
            address: target.region,
            guardianName: target.guardianName,
            guardianPhone: target.guardianPhone,
            guardianRelation: target.guardianRelation,
            diseaseInfo: target.healthStatus === "위험" ? "고혈압 / 당뇨" : target.healthStatus === "주의" ? "관절 통증" : "특이사항 없음",
            walkingStatus: target.healthStatus === "위험" ? "장시간 보행 어려움" : target.healthStatus === "주의" ? "짧은 거리 보행 가능" : "보행 가능",
            currentLocation: target.locationStatus === "안전구역 이탈" ? "안심구역 외부" : "안심구역 내부",
        };
    }

    const getBadgeClass = (type, value) => {
        const classMap = {
            health: {
                "양호": "wsd-badge-health-good",
                "주의": "wsd-badge-health-caution",
                "위험": "wsd-badge-health-danger",
            },
            decision: {
                "미검토": "wsd-badge-decision-none",
                "검토중": "wsd-badge-decision-reviewing",
                "적합": "wsd-badge-decision-fit",
                "보류": "wsd-badge-decision-hold",
                "부적합": "wsd-badge-decision-reject",
            },
            alert: {
                "없음": "wsd-badge-alert-none",
                "SOS 요청": "wsd-badge-alert-sos",
                "일자리 요청": "wsd-badge-alert-job",
            },
        };

        return `wsd-badge ${classMap[type]?.[value] || "wsd-badge-alert-none"}`;
    };

    const renderField = ({ label, value, description, wide }) => (
        <div className={`wsd-info-field${wide ? " wsd-info-field-wide" : ""}`} key={label}>
            <span>{label}</span>
            <strong>
                {valueOrMissing(value)}
                {description && <small>{description}</small>}
            </strong>
        </div>
    );

    const renderFields = (items) => (
        <div className="wsd-info-grid">
            {items.map(renderField)}
        </div>
    );

    const handleGuardianConsultRequest = async () => {
        if (!senior?.id) return;

        try {
            setIsSendingConsultRequest(true);
            setConsultRequestStatusMessage("");

            await requestGuardianConsultation({
                seniorId: senior.id,
                message: consultRequestMemo.trim() || "복지사와 상담이 필요합니다.",
            });

            setConsultRequestStatusMessage("보호자에게 상담 요청을 보냈습니다.");
            setConsultRequestMemo("");
            setIsConsultRequestModalOpen(false);
        } catch (error) {
            console.error("보호자 상담 요청 전송 실패:", error);
            setConsultRequestStatusMessage("상담 요청 전송에 실패했습니다.");
        } finally {
            setIsSendingConsultRequest(false);
        }
    };

    const handleRemoveSenior = async () => {
        try {
            await removeWelfareSenior(senior.id);
            setIsRemoveConfirmOpen(false);
            navigate("/welfare");
        } catch (error) {
            console.error("대상자 제거 실패:", error);
            setIsRemoveConfirmOpen(false);
            window.alert("대상자 제거에 실패했습니다.");
        }
    };

    const renderBasicInfo = () => (
        <section className="wsd-detail-section">
            <h2 className="wsd-section-title">기본 정보</h2>

            <div className="wsd-profile-summary-card">
                <div className="wsd-profile-photo-large">
                    {senior.profileImageUrl ? (
                        <img src={resolveUploadUrl(senior.profileImageUrl)} alt={`${senior.name} 프로필`} />
                    ) : (
                        <span>{senior.name?.slice(0, 1) || "?"}</span>
                    )}
                </div>
                <div>
                    <strong>{senior.name}</strong>
                    <span>{formatAgeGender(senior)}</span>
                    <p>{valueOrMissing(detail.address, "주소 미등록")}</p>
                </div>
            </div>

            {renderFields([
                { label: "이름", value: senior.name },
                { label: "생년월일", value: senior.birthDate },
                { label: "성별", value: senior.gender },
                { label: "연락처", value: formatPhoneForDetail(detail.phone) },
                { label: "주소", value: detail.address, wide: true },
                { label: "장애 등급", value: senior.disabilityGrade },
                { label: "장애 유형", value: senior.disabilityType },
                {
                    label: "마지막 접속",
                    value: lastAccessDisplay.main,
                    description: lastAccessDisplay.sub,
                    wide: true,
                },
            ])}
        </section>
    );

    const renderGuardianInfo = () => (
        <section className="wsd-detail-section">
            <div className="wsd-section-title-row">
                <h2 className="wsd-section-title">보호자 정보</h2>
            </div>

            {renderFields([
                { label: "보호자 이름", value: detail.guardianName },
                { label: "보호자 연락처", value: formatPhoneForDetail(detail.guardianPhone) },
                { label: "관계", value: detail.guardianRelation },
                { label: "상담 상태", value: consultRequestStatus },
                { label: "대상자", value: `${senior.name}${senior.age ? ` (${senior.age}세)` : ""}` },
                { label: "대상자 연락처", value: formatPhoneForDetail(detail.phone) },
                { label: "거주 지역", value: detail.address, wide: true },
            ])}

            <div className="wsd-consult-request-panel">
                <div>
                    <strong>보호자 상담 관리</strong>
                    <p>
                        복지 상담 확인이 필요할 때 보호자에게 상담 요청을 보낼 수 있습니다.
                    </p>
                </div>

                <button
                    type="button"
                    className="wsd-consult-request-button"
                    onClick={() => setIsConsultRequestModalOpen(true)}
                    disabled={isSendingConsultRequest}
                >
                    상담 요청 보내기
                </button>
            </div>

            {consultRequestStatusMessage && (
                <p className="wsd-status-message">{consultRequestStatusMessage}</p>
            )}
        </section>
    );

    const renderHealthInfo = () => {
        const cautionItems = [
            ["당뇨", healthInfo.diabetes, hasHealthProblemValue],
            ["고혈압", healthInfo.hypertension, hasHealthProblemValue],
            ["심장질환", healthInfo.heartDisease, hasHealthProblemValue],
            ["관절질환", healthInfo.jointDisease, hasHealthProblemValue],
            ["뇌졸중", healthInfo.stroke, hasHealthProblemValue],
            ["신장질환", healthInfo.kidneyDisease, hasHealthProblemValue],
            ["호흡기질환", healthInfo.lungDisease, hasHealthProblemValue],
            ["간질환", healthInfo.liverDisease, hasHealthProblemValue],
            ["암", healthInfo.cancer, hasHealthProblemValue],
            ["보행 보조기구", healthInfo.walkingAid, hasLimitedHealthValue],
            ["기억/판단", healthInfo.dementia, hasLimitedHealthValue],
            ["시야", healthInfo.vision, hasLimitedHealthValue],
            ["청각", healthInfo.hearing, hasLimitedHealthValue],
            ["최근 낙상", healthInfo.recentFall, hasHealthProblemValue],
            ["하루 활동 가능 시간", healthInfo.maxHours, hasShortActivityHours],
            ["어려운 업무", healthInfo.disabledWork, hasLimitedHealthValue],
            ["수술 이력", healthInfo.hasSurgery, hasHealthProblemValue],
            ...(() => {
                if (healthInfo.hasSurgery !== "있음") return [];
                try {
                    const list = typeof healthInfo.surgeriesJson === "string"
                        ? JSON.parse(healthInfo.surgeriesJson)
                        : (Array.isArray(healthInfo.surgeriesJson) ? healthInfo.surgeriesJson : []);
                    if (!Array.isArray(list) || list.length === 0) return [];
                    return list.map((s, i) => {
                        const parts = [s.name, s.date, s.recovery].filter(Boolean);
                        return [`수술 ${i + 1}`, parts.join(" · ") || "상세 미입력", () => true];
                    });
                } catch { return []; }
            })(),
            ["기타 참고사항", healthInfo.otherDisease, hasHealthProblemValue],
        ].filter(([, value, isCautionValue]) => isCautionValue(value));

        return (
            <section className="wsd-detail-section">
                <h2 className="wsd-section-title">건강 정보</h2>

                <div className="wsd-health-summary-grid">
                    <article className="wsd-health-summary-card caution">
                        <span>주의 필요</span>
                        <strong>{cautionItems.length}개 항목</strong>
                        <p>{cautionItems.slice(0, 3).map(([label]) => label).join(" · ") || "특이사항 없음"}</p>
                    </article>

                    <article className="wsd-health-summary-card medicine">
                        <span>복약</span>
                        <strong>{medications.length}건 관리 중</strong>
                        <p>{medications.map((item) => item.name || item.medicineName || item.drugName).filter(Boolean).join(" · ") || "등록된 복약 없음"}</p>
                    </article>

                    <article className="wsd-health-summary-card activity">
                        <span>활동 조건</span>
                        <strong>{healthInfo.maxHours ? `하루 ${healthInfo.maxHours}시간 이내` : "미입력"}</strong>
                        <p>{valueOrMissing(healthInfo.maxDistance)}</p>
                    </article>
                </div>

                <div className="wsd-health-block">
                    <h3 className="wsd-inner-panel-title">주의 항목</h3>
                    {cautionItems.length > 0 ? (
                        <div className="wsd-caution-list">
                            {cautionItems.map(([label, value]) => (
                                <article className="wsd-caution-item" key={label}>
                                    <span>{label}</span>
                                    <strong>{valueOrMissing(value)}</strong>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="wsd-empty-panel">등록된 주의 항목이 없습니다.</p>
                    )}
                </div>
            </section>
        );
    };

    const renderHealthEvaluation = () => {
        const status = normalizeHealthStatus(healthEvaluation?.status);
        const tone = getHealthTone(status);
        const probabilities = healthEvaluation?.probabilities || {};
        const displayProbabilities = getDisplayHealthProbabilities(probabilities, status);
        const reasons = healthEvaluation?.reasons || [];
        const displayReasons = buildHealthEvidenceReasons(status, healthInfo, medications, reasons, displayProbabilities);
        const caseValidation = healthEvaluation?.caseValidation;
        const evaluationSummary = buildReadableHealthSummary(status, healthInfo, medications, caseValidation);
        const gradeBasis = healthEvaluation?.gradeBasis && !hasScoreText(healthEvaluation.gradeBasis)
            ? healthEvaluation.gradeBasis
            : buildConditionGradeBasis(status);
        const criteria = [
            {
                status: "양호",
                title: "양호 설명 조건",
                summary: "주요 위험 조건 미확인",
                text: "최근 낙상, 중증 질환 복수, 복약 과다, 보행/시각/청각 제한, 짧은 활동 시간 조건이 확인되지 않은 경우입니다.",
            },
            {
                status: "주의",
                title: "주의 설명 조건",
                summary: "주의 조건 확인",
                text: "질환 1개 이상, 복약 3개 이상, 보행/감각 제한 또는 짧은 활동 시간이 확인된 경우입니다.",
            },
            {
                status: "위험",
                title: "위험 설명 조건",
                summary: "위험 조건 확인",
                text: "최근 낙상, 중증 질환 2개 이상, 기능 제한 4개 이상 등 위험 조건이 확인된 경우입니다.",
            },
        ];

        if (isHealthEvaluationLoading && healthEvaluation?.source !== "ML") {
            return (
                <section className="wsd-detail-section">
                    <div className="wsd-health-eval-heading">
                        <div>
                            <h2 className="wsd-section-title">건강 판정 근거</h2>
                            <p>사용자 건강 정보를 바탕으로 건강을 판독합니다.</p>
                        </div>
                    </div>

                    <div className="wsd-health-eval-summary">
                        <div>
                            <span>판정 요약</span>
                            <strong>건강 판정 불러오는 중</strong>
                        </div>
                        <p>최신 ML 판정을 불러오는 중입니다. 완료되면 현재 입력 건강 정보 기준의 판정과 근거를 표시합니다.</p>
                    </div>
                </section>
            );
        }

        return (
            <section className="wsd-detail-section">
                <div className="wsd-health-eval-heading">
                    <div>
                        <h2 className="wsd-section-title">건강 판정 근거</h2>
                        <p>사용자 건강 정보를 바탕으로 건강을 판독합니다.</p>
                    </div>
                </div>

                {/* 핵심 정보 상단 요약 */}
                <div className="wsd-health-summary-row">
                    <div className={`wsd-health-summary-grade wsd-health-summary-grade-${tone}`}>
                        <span>현재 건강 등급</span>
                        <strong>{status}</strong>
                        <em>{getEvaluationSourceLabel(healthEvaluation?.source)}</em>
                    </div>

                    <div className="wsd-health-summary-prob">
                        <span className="wsd-health-summary-label">예측 확률</span>
                        <div className="wsd-health-probability-list">
                            {HEALTH_STATUS_ORDER.map((label) => (
                                <div className="wsd-health-probability-row" key={label}>
                                    <span>{label}</span>
                                    <div className="wsd-health-probability-track">
                                        <div
                                            className={`wsd-health-probability-fill wsd-health-probability-fill-${getHealthTone(label)}`}
                                            style={{ width: formatProbability(displayProbabilities[label]) }}
                                        />
                                    </div>
                                    <strong>{formatProbability(displayProbabilities[label])}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="wsd-health-eval-summary">
                    <div>
                        <span>판정 요약</span>
                        <strong>{HEALTH_SUMMARY_RESULT_LABEL}</strong>
                    </div>
                    <p>{evaluationSummary}</p>
                    <small>{gradeBasis}</small>
                    {isHealthEvaluationLoading && (
                        <small>최신 ML 판정을 불러오는 중입니다. 화면은 저장된 건강 정보로 먼저 표시합니다.</small>
                    )}
                    {!isHealthEvaluationLoading && healthEvaluationError && (
                        <small>{healthEvaluationError}</small>
                    )}
                </div>

                <div className="wsd-health-reason-section">
                    <div className="wsd-health-reason-header">
                        {showHealthReasons && <h3>판정 근거 자료</h3>}
                        <div className="wsd-health-reason-actions">
                            <button
                                type="button"
                                className="wsd-health-criteria-toggle"
                                onClick={() => setShowHealthReasons(v => !v)}
                            >
                                판정 근거 보기
                                <span>{showHealthReasons ? "▲" : "▼"}</span>
                            </button>
                            <button
                                type="button"
                                className="wsd-health-criteria-toggle"
                                onClick={() => setShowCriteria(v => !v)}
                            >
                                설명 기준 보기
                                <span>{showCriteria ? "▲" : "▼"}</span>
                            </button>
                        </div>
                    </div>
                    {showHealthReasons && (
                        <div className="wsd-health-reason-grid">
                            {displayReasons.length > 0 ? displayReasons.map((reason, index) => (
                                <article
                                    className={`wsd-health-reason-card wsd-health-reason-card-${getHealthTone(reason.level)}`}
                                    key={`${reason.label}-${index}`}
                                >
                                    <div>
                                        <strong>{reason.label}</strong>
                                        <span>{normalizeHealthStatus(reason.level)}</span>
                                    </div>
                                    <em>{getReasonCriterion(reason, status)}</em>
                                    <p>{valueOrMissing(reason.value)}</p>
                                    <small>근거: {getReasonDescription(reason, status)}</small>
                                </article>
                            )) : (
                                <p className="wsd-empty-panel">표시할 판정 근거 자료가 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>

                {showCriteria && <div className="wsd-health-criteria-section">
                    {(
                        <>
                            <h3>등급별 설명 기준</h3>
                            <div className="wsd-health-grade-scale" aria-label="등급별 설명 조건">
                                {criteria.map((item) => (
                                    <div
                                        className={`wsd-health-grade-segment wsd-health-grade-segment-${getHealthTone(item.status)}${item.status === status ? " wsd-health-grade-segment-active" : ""}`}
                                        key={item.status}
                                    >
                                        <span>{item.status}</span>
                                        <strong>{item.summary}</strong>
                                    </div>
                                ))}
                            </div>

                            <div className="wsd-health-criteria-list">
                                {criteria.map((item) => (
                                    <article
                                        className={`wsd-health-criteria-row${item.status === status ? " wsd-health-criteria-row-active" : ""}`}
                                        key={`${item.status}-description`}
                                    >
                                        <div>
                                            <span>{item.status}</span>
                                            <strong>{item.title}</strong>
                                        </div>
                                        <p>{item.text}</p>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </div>}
            </section>
        );
    };

    const renderSafeZoneInfo = () => {
        const activeZone = allSafeZones[selectedZoneIdx] || allSafeZones[0] || null;
        const mapCenter = activeZone
            ? { lat: activeZone.centerLatitude, lng: activeZone.centerLongitude }
            : safeZoneCenter;
        const focusLocation = activeZone
            ? { lat: activeZone.centerLatitude, lng: activeZone.centerLongitude }
            : null;
        const focusKey = activeZone
            ? `zone-${selectedZoneIdx}-${activeZone.id ?? ""}`
            : "";

        return (
            <section className="wsd-detail-section">
                <h2 className="wsd-section-title">안심구역 관리</h2>

                <div className="wsd-safezone-layout">
                    <div className="wsd-safezone-map-card">
                        <KakaoMap
                            center={mapCenter}
                            safeZones={allSafeZones.length > 0 ? allSafeZones : undefined}
                            safeZone={activeZone}
                            currentLocation={currentLocationForMap}
                            zoom={5}
                            autoFit={false}
                            focusLocation={focusLocation}
                            focusKey={focusKey}
                            focusLevel={5}
                            className="wsd-safezone-map"
                            currentLabel="마지막 GPS"
                            fallback={<div className="wsd-map-fallback">지도를 불러오지 못했습니다.</div>}
                        />
                    </div>

                    <div className="wsd-safezone-summary">
                        {renderFields([
                            { label: "현재 위치", value: detail.currentLocation },
                            { label: "위치 상태", value: senior.locationStatus },
                            { label: "마지막 GPS", value: formatGps(senior.lastGps), wide: true },
                        ])}

                        {allSafeZones.length > 0 ? (
                            <div className="wsd-safezone-zone-list">
                                <h3 className="wsd-inner-panel-title">등록된 안심구역 ({allSafeZones.length}개)</h3>
                                {allSafeZones.map((zone, index) => (
                                    <button
                                        type="button"
                                        className={`wsd-safezone-zone-item${index === selectedZoneIdx ? " active" : ""}`}
                                        key={zone.id ?? index}
                                        onClick={() => setSelectedZoneIdx(index)}
                                    >
                                        <span>{index + 1}</span>
                                        <div>
                                            <strong>{zone.name || "안심구역"}</strong>
                                            <p>{zone.address || "주소 미등록"}</p>
                                            <small>반경 {zone.radiusMeters || 500}m</small>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            renderFields([
                                { label: "기준 장소명", value: safeZone.placeName },
                                { label: "주소", value: safeZone.address },
                                { label: "반경", value: `${safeZoneRadius}m` },
                            ])
                        )}
                    </div>
                </div>
            </section>
        );
    };

    const renderAgencyLinkInfo = () => (
        <section className="wsd-detail-section">
            <h2 className="wsd-section-title">기관 연계</h2>

            <div className="wsd-agency-summary-card minimal">
                <div>
                    <span>대상자</span>
                    <strong>{senior?.name || "-"}</strong>
                    <p>{formatAgeGender(senior)}</p>
                </div>

                <div>
                    <span>마지막 위치</span>
                    <strong>{senior?.lastGps?.address || senior?.address || "위치 정보 없음"}</strong>
                    <p>기관 검색 기준 위치</p>
                </div>
            </div>

            <div className="wsd-agency-result-header">
                <div>
                    <h3>가까운 행정복지센터</h3>
                    <p>대상자 마지막 위치 기준 3km 이내 검색 결과입니다.</p>
                </div>
                {isAgencyLoading && <span>검색 중</span>}
            </div>

            {agencyError && <p className="wsd-agency-error">{agencyError}</p>}

            <div className="wsd-agency-place-list scrollable">
                {agencyPlaces.map((place, index) => {
                    const placeId = place.place_id || `${place.name}-${index}`;
                    const isLinked = linkedAgencyId === placeId;

                    return (
                        <article className={`wsd-agency-place-card${isLinked ? " linked" : ""}`} key={placeId}>
                            <div className="wsd-agency-place-main">
                                <span>{index + 1}순위</span>
                                <strong>{place.name}</strong>
                                <p>{place.display_name}</p>
                                <small>
                                    {place.distance ? `약 ${Number(place.distance).toLocaleString()}m` : "거리 정보 없음"}
                                    {place.phone ? ` · ${place.phone}` : ""}
                                </small>
                            </div>

                            <div className="wsd-agency-place-actions">
                                {place.phone ? (
                                    <a href={`tel:${place.phone}`}>전화</a>
                                ) : (
                                    <button type="button" disabled>전화 없음</button>
                                )}

                                {place.place_url && (
                                    <a href={place.place_url} target="_blank" rel="noreferrer">
                                        길찾기
                                    </a>
                                )}

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isLinked) {
                                            const confirmed = window.confirm("기관 연계를 취소할까요?");
                                            if (!confirmed) return;

                                            setLinkedAgencyId(null);
                                            return;
                                        }

                                        setLinkedAgencyId(placeId);
                                    }}
                                >
                                    {isLinked ? "연계 완료됨" : "연계 완료"}
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );

    const renderActiveSection = () => {
        if (activeCategory === "기본 정보") return renderBasicInfo();
        if (activeCategory === "보호자 정보") return renderGuardianInfo();
        if (activeCategory === "건강 정보") return renderHealthInfo();
        if (activeCategory === "안심구역 관리") return renderSafeZoneInfo();
        if (activeCategory === HEALTH_EVALUATION_CATEGORY) return renderHealthEvaluation();
        if (activeCategory === AGENCY_LINK_CATEGORY) return renderAgencyLinkInfo();

        return null;
    };

    return (
        <div className="wsd-page">
            <WelfareCommonHeader rightText="대상자 상세정보" />

            <main className="wsd-content">
                <div className="wsd-detail-header">
                    <div>
                        <Link to="/welfare" className="wsd-back-link">목록으로</Link>
                        <h1 className="wsd-title">{senior?.name || "대상자 상세정보"}</h1>
                        {senior && (
                            <p className="wsd-sub-text">{formatAgeGender(senior)} / {senior.region}</p>
                        )}
                    </div>
                </div>

                {isLoading && (
                    <div className="wsd-loading-backdrop" role="status" aria-live="polite">
                        <section className="wsd-loading-modal">
                            <div className="wsd-loading-spinner" />
                            <strong>상세정보를 불러오는 중입니다</strong>
                            <span>잠시만 기다려주세요.</span>
                        </section>
                    </div>
                )}
                {message && <p className="wsd-message wsd-message-error">{message}</p>}

                {senior && (
                    <>
                        <div className="wsd-category-layout">
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "sticky", top: "82px", alignSelf: "flex-start" }}>
                                <nav className="wsd-category-sidebar">
                                    <div className="wsd-sidebar-profile-card">
                                        <div className="wsd-sidebar-profile-photo">
                                            {senior.profileImageUrl ? (
                                                <img src={resolveUploadUrl(senior.profileImageUrl)} alt={`${senior.name} 프로필`} />
                                            ) : (
                                                <span>{senior.name?.slice(0, 1) || "?"}</span>
                                            )}
                                        </div>
                                        <strong>{senior.name}</strong>
                                    </div>

                                    {CATEGORY_LIST.map((category) => (
                                        <button
                                            type="button"
                                            key={category}
                                            className={`wsd-category-item${activeCategory === category ? " wsd-category-item-active" : ""}`}
                                            onClick={() => setActiveCategory(category)}
                                        >
                                            {category}
                                        </button>
                                    ))}

                                </nav>

                                <button
                                    type="button"
                                    className="wsd-remove-senior-btn"
                                    onClick={() => setIsRemoveConfirmOpen(true)}
                                >
                                    대상자 제거
                                </button>
                            </div>

                            <div className="wsd-category-content">
                                {renderActiveSection()}
                            </div>
                        </div>
                    </>
                )}
            </main>

            {isConsultRequestModalOpen && (
                <div className="wsd-consult-modal-backdrop">
                    <section className="wsd-consult-modal">
                        <div className="wsd-consult-modal-header">
                            <h3>보호자 상담 요청</h3>

                            <button
                                type="button"
                                onClick={() => setIsConsultRequestModalOpen(false)}
                                disabled={isSendingConsultRequest}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="wsd-consult-modal-body">
                            <div className="wsd-consult-modal-summary">
                                <span>보호자</span>
                                <strong>{valueOrMissing(detail.guardianName)}</strong>
                                <small>{formatPhoneForDetail(detail.guardianPhone)} · {valueOrMissing(detail.guardianRelation)}</small>
                            </div>

                            <div className="wsd-consult-modal-summary">
                                <span>대상자</span>
                                <strong>{senior.name}</strong>
                                <small>{[formatAgeGender(senior), detail.address].filter(Boolean).join(" · ")}</small>
                            </div>

                            <label>
                                요청 내용
                                <textarea
                                    value={consultRequestMemo}
                                    onChange={(event) => setConsultRequestMemo(event.target.value)}
                                    placeholder="상담 요청 내용을 입력하세요."
                                />
                            </label>
                        </div>

                        <div className="wsd-consult-modal-actions">
                            <button
                                type="button"
                                onClick={() => setIsConsultRequestModalOpen(false)}
                                disabled={isSendingConsultRequest}
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={handleGuardianConsultRequest}
                                disabled={isSendingConsultRequest}
                            >
                                {isSendingConsultRequest ? "전송 중..." : "요청 보내기"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isRemoveConfirmOpen && (
                <div className="wsd-consult-modal-backdrop" onClick={() => setIsRemoveConfirmOpen(false)}>
                    <section className="wsd-consult-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>

                        <div className="wsd-consult-modal-body">
                            <p style={{ margin: "8px 0 4px", fontSize: "18px", fontWeight: "700", textAlign: "center" }}>
                                {senior?.name}님을 담당 대상자에서 제거할까요?
                            </p>
                            <p style={{ fontSize: "13px", color: "#888", marginTop: "10px", textAlign: "center" }}>
                                계정과 데이터는 유지되며, 담당 복지사 연결만 해제됩니다.
                            </p>
                        </div>

                        <div className="wsd-consult-modal-actions">
                            <button type="button" onClick={() => setIsRemoveConfirmOpen(false)}>
                                취소
                            </button>
                            <button
                                type="button"
                                style={{ background: "#b85252", color: "#fff", border: "none" }}
                                onClick={handleRemoveSenior}
                            >
                                제거
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default WelfareSeniorDetail;
