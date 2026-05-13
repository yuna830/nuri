// 복지사 페이지 공통 localStorage 유틸

import {
    WELFARE_DECISION_STORAGE_KEY,
    WELFARE_DECISION_DETAIL_STORAGE_KEY,
    ADDED_SENIORS_STORAGE_KEY,
    COUNSELING_RECORDS_STORAGE_KEY,
    SOS_REQUESTS_STORAGE_KEY,
} from "./welfareConstants";

export const readJsonStorage = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

export const getSavedWelfareDecisions = () =>
    readJsonStorage(WELFARE_DECISION_STORAGE_KEY, {});

export const getSavedWelfareDecisionDetails = () =>
    readJsonStorage(WELFARE_DECISION_DETAIL_STORAGE_KEY, {});

export const getSavedAddedSeniors = () =>
    readJsonStorage(ADDED_SENIORS_STORAGE_KEY, []);

export const getSavedCounselingRecords = () =>
    readJsonStorage(COUNSELING_RECORDS_STORAGE_KEY, {});

export const getSavedSosRequests = () =>
    readJsonStorage(SOS_REQUESTS_STORAGE_KEY, []);

export const saveWelfareDecision = (seniorId, decision, reason) => {
    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();

    localStorage.setItem(
        WELFARE_DECISION_STORAGE_KEY,
        JSON.stringify({
            ...savedDecisions,
            [seniorId] : decision,
        })
    );
    localStorage.setItem(
        WELFARE_DECISION_DETAIL_STORAGE_KEY,
        JSON.stringify({
            ...savedDecisionDetails,
            [seniorId] : {
                decision,
                reason,
                deliveredAt : new Date().toISOString(),
            },
        })
    );
};
