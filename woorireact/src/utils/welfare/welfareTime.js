// 복지사 페이지 공통 시간 관련 유틸

import { LAST_ACCESS_ALERT_HOURS, NIGHT_START_HOUR, NIGHT_END_HOUR } from "./welfareConstants";

export const getLastAccessHours = (lastAccess) => {
    if (!lastAccess) {
        return null;
    }

    const hourMatch = String(lastAccess).match(/(\d+)\s*시간/);

    if (hourMatch) {
        return Number(hourMatch[1]);
    }

    const minuteMatch = String(lastAccess).match(/(\d+)\s*분/);

    if (minuteMatch) {
        return Number(minuteMatch[1]) / 60;
    }

    return null;
};

export const isNightTime = () => {
    const currentHour = new Date().getHours();

    return currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR;
};

export const shouldHideLastAccess = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);

    return lastAccessHours != null && lastAccessHours <= LAST_ACCESS_ALERT_HOURS;
};

export const shouldNotifyLastAccessDelay = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);

    return !isNightTime() && lastAccessHours != null && lastAccessHours > LAST_ACCESS_ALERT_HOURS;
};
