import {
  normalizeScheduleText,
  parseDateFromText,
  parseTimeExpression,
  parseTimeFromText,
} from "./scheduleParser";
import {
  formatCurrentTimeKorean,
  formatDateKorean,
  formatScheduleBrief,
  formatTodayKorean,
  pad,
  scheduleToText,
  todayValue,
} from "../utils/scheduleText";

export function scheduleFromExtractedIntent(extracted) {
  if (
    !extracted ||
    extracted.intent !== "create_schedule" ||
    extracted.confidence < 0.65 ||
    !extracted.title
  ) {
    return null;
  }

  const date =
    parseDateFromText(extracted.dateText) ||
    parseDateFromText(extracted.normalizedText);
  const timeExpression =
    parseTimeExpression(extracted.timeText) ||
    parseTimeExpression(extracted.normalizedText);
  const time = timeExpression?.isAmbiguous ? "" : timeExpression?.value || "";

  if (!date && !time) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: extracted.title,
    date,
    time,
    ambiguousTime: timeExpression?.isAmbiguous
      ? {
          hour: timeExpression.hour,
          minute: timeExpression.minute,
        }
      : null,
    sourceText: extracted.normalizedText,
    createdAt: new Date().toISOString(),
  };
}

export function getScheduleLookupAnswer(text, savedSchedules) {
  const normalizedText = normalizeScheduleText(text);
  if (!isScheduleLookupRequest(normalizedText)) return null;

  const date = parseDateFromText(normalizedText) || todayValue();
  const matches = savedSchedules.filter((schedule) => schedule.date === date);

  return matches.length > 0
    ? `${formatDateKorean(date)} 일정은 ${matches.map(formatScheduleBrief).join(", ")}입니다.`
    : `${formatDateKorean(date)}에는 등록된 일정이 없어요.`;
}

export function getExtractedScheduleAction(extracted, savedSchedules) {
  if (!extracted || extracted.confidence < 0.65) return null;

  if (extracted.intent === "lookup_schedule") {
    const date =
      parseDateFromText(extracted.dateText) ||
      parseDateFromText(extracted.normalizedText) ||
      todayValue();
    const matches = savedSchedules.filter((schedule) => schedule.date === date);
    const answer =
      matches.length > 0
        ? `${formatDateKorean(date)} 일정은 ${matches.map(formatScheduleBrief).join(", ")}입니다.`
        : `${formatDateKorean(date)}에는 등록된 일정이 없어요.`;

    return { type: "answer", answer };
  }

  if (extracted.intent === "delete_schedule") {
    const target = findScheduleByText(
      savedSchedules,
      `${extracted.title} ${extracted.normalizedText}`
    );

    return target
      ? { type: "delete", target }
      : {
          type: "answer",
          answer: "삭제할 일정을 찾지 못했어요. 일정 이름을 조금 더 정확히 말씀해 주세요.",
        };
  }

  if (extracted.intent === "update_schedule") {
    const target = findScheduleByText(
      savedSchedules,
      `${extracted.title} ${extracted.normalizedText}`
    );
    const time =
      parseTimeFromText(extracted.timeText) ||
      parseLooseTime(extracted.timeText, target?.time);

    if (!target) {
      return {
        type: "answer",
        answer: "수정할 일정을 찾지 못했어요. 어떤 일정을 바꿀지 다시 말씀해 주세요.",
      };
    }

    if (!time) {
      return {
        type: "answer",
        answer: "몇 시로 바꿀지 다시 말씀해 주세요.",
      };
    }

    return {
      type: "update",
      schedule: {
        ...target,
        time,
        text: scheduleToText({ ...target, time }),
      },
    };
  }

  return null;
}

export function getScheduleCommandAction({
  text,
  pendingSchedule,
  savedSchedules,
}) {
  const normalizedText = normalizeScheduleText(text);
  const timeAnswer = getCurrentDateTimeAnswer(normalizedText);
  if (timeAnswer) return { type: "answer", answer: timeAnswer };

  if (pendingSchedule && isTimeSkipRequest(text)) {
    return { type: "savePending", schedule: pendingSchedule };
  }

  if (pendingSchedule) {
    const requestedTime = parseTimeFromText(text);
    if (requestedTime) {
      return {
        type: "savePending",
        schedule: {
          ...pendingSchedule,
          time: requestedTime,
        },
      };
    }
  }

  if (isScheduleDeleteRequest(normalizedText)) {
    const dateDeleteAction = getDateDeleteAction(normalizedText, savedSchedules);
    if (dateDeleteAction) return dateDeleteAction;

    const target = findScheduleByText(savedSchedules, normalizedText);
    return target
      ? { type: "delete", target }
      : {
          type: "answer",
          answer: "삭제할 일정을 찾지 못했어요. 일정 이름을 조금 더 정확히 말씀해 주세요.",
    };
  }

  if (isScheduleUpdateRequest(normalizedText)) {
    const update = parseScheduleTimeUpdate(normalizedText, savedSchedules);
    if (!update.target) {
      return {
        type: "answer",
        answer: "수정할 일정을 찾지 못했어요. 어떤 일정을 바꿀지 다시 말씀해 주세요.",
      };
    }
    if (!update.time) {
      return {
        type: "answer",
        answer: "몇 시로 바꿀지 다시 말씀해 주세요.",
      };
    }

    return {
      type: "update",
      schedule: {
        ...update.target,
        time: update.time,
        text: scheduleToText({ ...update.target, time: update.time }),
      },
    };
  }

  const lookupAnswer = getScheduleLookupAnswer(normalizedText, savedSchedules);
  if (lookupAnswer) return { type: "answer", answer: lookupAnswer };

  return null;
}

function getCurrentDateTimeAnswer(text) {
  const asksTime = /(지금|현재)?\s*(몇\s*시|시간|시각)/.test(text);
  const asksToday = /(오늘|현재)?\s*(날짜|며칠|몇\s*일|무슨\s*요일)/.test(text);

  if (asksTime) return `지금은 ${formatCurrentTimeKorean()}입니다.`;
  if (asksToday) return `오늘은 ${formatTodayKorean()}입니다.`;

  return "";
}

function getDateDeleteAction(text, savedSchedules) {
  const date = parseDateFromText(text);
  if (!date || !/일정|거|것/.test(text)) return null;

  const matches = savedSchedules.filter((schedule) => schedule.date === date);
  if (matches.length === 0) {
    return {
      type: "answer",
      answer: `${formatDateKorean(date)}에는 삭제할 일정이 없어요.`,
    };
  }

  if (matches.length === 1) {
    return { type: "delete", target: matches[0] };
  }

  return {
    type: "deleteCandidates",
    date,
    schedules: matches,
  };
}

function isTimeSkipRequest(text) {
  return /시간\s*없이|시간은\s*없|그냥\s*등록|바로\s*등록/.test(text);
}

function isScheduleLookupRequest(text) {
  return /일정/.test(text) && (
    /(뭐|뭐야|있어|알려|확인|보여|브리핑|언제|어떻게)/.test(text) ||
    Boolean(parseDateFromText(text))
  );
}

function isScheduleDeleteRequest(text) {
  return /(취소|삭제|지워|빼줘|없애)/.test(text);
}

function isScheduleUpdateRequest(text) {
  return /(수정|변경|바꿔|말고|앞당겨|미뤄)/.test(text);
}

function findScheduleByText(schedules, text) {
  const keywords = extractScheduleKeywords(text);
  if (keywords.length === 0) return null;

  return (
    schedules.find((schedule) =>
      keywords.every((keyword) => scheduleToSearchText(schedule).includes(keyword))
    ) ||
    schedules.find((schedule) =>
      keywords.some((keyword) => scheduleToSearchText(schedule).includes(keyword))
    ) ||
    null
  );
}

function parseScheduleTimeUpdate(text, schedules) {
  const timeMatches = [...text.matchAll(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?/g)];
  const oldTimeText = timeMatches[0]?.[0] || "";
  const newTimeText = timeMatches[1]?.[0] || oldTimeText;
  const rawOldTime = oldTimeText ? parseTimeFromText(oldTimeText) : "";
  const keywords = extractScheduleKeywords(text);

  const target =
    schedules.find((schedule) => {
      const searchText = scheduleToSearchText(schedule);
      const keywordMatched =
        keywords.length === 0 || keywords.some((keyword) => searchText.includes(keyword));
      const timeMatched = rawOldTime ? isSameLooseTime(schedule.time, rawOldTime) : true;
      return keywordMatched && timeMatched;
    }) ||
    findScheduleByText(schedules, text);

  const time = parseLooseTime(newTimeText, target?.time);
  return { target, time };
}

function extractScheduleKeywords(text) {
  return text
    .replace(/(오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분?)?/g, " ")
    .replace(/일정|예약|취소|삭제|지워|빼줘|없애|수정|변경|바꿔|말고|으로|로|해줘|해주세요|줘/g, " ")
    .replace(/[,.!?]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function scheduleToSearchText(schedule) {
  return `${schedule.title || ""} ${schedule.detail || ""} ${schedule.text || ""}`;
}

function parseLooseTime(text, referenceTime = "") {
  const match = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?/);
  if (!match) return "";

  const [, meridiem, rawHour, rawMinute] = match;
  let hour = Number(rawHour);
  const minute = Number(rawMinute || 0);
  const referenceHour = Number(referenceTime.slice(0, 2));

  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;
  if (!meridiem && referenceHour >= 12 && hour < 12) hour += 12;

  return `${pad(hour)}:${pad(minute)}`;
}

function isSameLooseTime(scheduleTime, requestedTime) {
  if (!scheduleTime || !requestedTime) return false;
  if (scheduleTime === requestedTime) return true;

  const scheduleHour = Number(scheduleTime.slice(0, 2));
  const requestedHour = Number(requestedTime.slice(0, 2));
  return scheduleHour % 12 === requestedHour % 12;
}
