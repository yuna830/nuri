import { TIME_EXPRESSION_PATTERN_SOURCE, normalizeScheduleText, parseDateFromText, parseTimeExpression, parseTimeFromText, } from "./scheduleParser";
import { formatCurrentTimeKorean, formatDateKorean, formatScheduleList, formatTodayKorean, pad, scheduleToText, todayValue, } from "../utils/scheduleText";

/*  제미나이가 뽑아준 결과를 일정 객체로 변환  */ 
export function scheduleFromExtractedIntent(extracted) {
  if (
    !extracted ||
    extracted.intent !== "create_schedule" ||
    extracted.confidence < 0.65 ||
    !extracted.title
  ) {
    return null;
  }

  const date = parseDateFromText(extracted.dateText) || parseDateFromText(extracted.normalizedText);
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
      ? { hour: timeExpression.hour, minute: timeExpression.minute }
      : null,
    sourceText: extracted.normalizedText,
    createdAt: new Date().toISOString(),
  };
}

/*  조회, 삭제, 수정 중 뭘 할건지  */
export function getExtractedScheduleAction(extracted, savedSchedules) {
  if (!extracted || extracted.confidence < 0.65) return null;

  if (extracted.intent === "lookup_schedule") {
    return getLookupAction(extracted.normalizedText || extracted.dateText, savedSchedules);
  }

  if (extracted.intent === "delete_schedule") {
    return getDeleteAction(`${extracted.title} ${extracted.normalizedText}`, savedSchedules);
  }

  if (extracted.intent === "update_schedule") {
    return getUpdateAction(
      `${extracted.title} ${extracted.normalizedText} ${extracted.timeText}`,
      savedSchedules
    );
  }

  return null;
}

/*  사용자 채팅을 분석해서 
    조회/삭제/수정/날씨 중 어떤 동작을 할지 결정  */
export function getScheduleCommandAction({ text, pendingSchedule, savedSchedules }) {
  const normalizedText = normalizeScheduleText(text);
  const dateTimeAnswer = getCurrentDateTimeAnswer(normalizedText);
  if (dateTimeAnswer) return { type: "answer", answer: dateTimeAnswer };

  if (pendingSchedule && isTimeSkipRequest(normalizedText)) {
    return { type: "savePending", schedule: pendingSchedule };
  }

  if (pendingSchedule) {
    const requestedTime = parseTimeFromText(normalizedText);
    if (requestedTime) {
      return {
        type: "savePending",
        schedule: { ...pendingSchedule, time: requestedTime, ambiguousTime: null },
      };
    }
  }

  if (isScheduleDeleteRequest(normalizedText)) {
    return getDeleteAction(normalizedText, savedSchedules);
  }

  if (isScheduleUpdateRequest(normalizedText)) {
    return getUpdateAction(normalizedText, savedSchedules);
  }

  if (isScheduleLookupRequest(normalizedText)) {
    return getLookupAction(normalizedText, savedSchedules);
  }

  if (isUnsupportedBookingRequest(normalizedText)) {
    return {
      type: "answer",
      answer: "제가 시설 예약을 직접 진행할 수는 없어요. 예약한 날짜와 시간을 말씀해 주시면 일정으로 등록해 드릴게요.",
    };
  }

  return null;
}

/*  특정 날짜 일정 조회  */
function getLookupAction(text, savedSchedules) {
  const date = parseDateFromText(text) || todayValue();
  const matches = schedulesByDate(savedSchedules, date);

  return {
    type: "answer",
    answer:
      matches.length > 0
        ? `${formatDateKorean(date)} 일정입니다.\n${formatScheduleList(matches)}`
        : `${formatDateKorean(date)}에는 등록된 일정이 없어요.`,
  };
}

/*  삭제요청 전체 처리  */
function getDeleteAction(text, savedSchedules) {
  const dateDeleteAction = getDateDeleteAction(text, savedSchedules);
  if (dateDeleteAction) return dateDeleteAction;

  const target = findScheduleByText(savedSchedules, text);
  return target
    ? { type: "delete", target }
    : {
        type: "answer",
        answer: "삭제할 일정을 찾지 못했어요. 일정 이름을 조금 더 정확히 말해주세요.",
      };
}

/*  수정  */
function getUpdateAction(text, savedSchedules) {
  const update = parseScheduleTimeUpdate(text, savedSchedules);
  if (!update.target) {
    return {
      type: "answer",
      answer: "수정할 일정을 찾지 못했어요. 어떤 일정을 바꿀지 다시 말해주세요.",
    };
  }
  if (!update.time) {
    return {
      type: "answer",
      answer: "몇 시로 바꿀지 다시 말해주세요.",
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

/*  현재 날짜 답변  */
function getCurrentDateTimeAnswer(text) {
  const asksTime = /(지금|현재)?\s*(몇\s*시|시간|시각)/.test(text);
  const asksToday = /(오늘|현재)?\s*(날짜|며칠|무슨\s*요일)/.test(text);

  if (asksTime) return `지금은 ${formatCurrentTimeKorean()}입니다.`;
  if (asksToday) return `오늘은 ${formatTodayKorean()}입니다.`;

  return "";
}

/*  특정 날짜의 일정 삭제 처리  */
function getDateDeleteAction(text, savedSchedules) {
  const date = parseDateFromText(text);
  if (!date || !/(일정|예약|거|것)/.test(text)) return null;

  const matches = schedulesByDate(savedSchedules, date);
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

function schedulesByDate(schedules, date) {
  return schedules
    .filter((schedule) => schedule.date === date)
    .slice()
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

/*  시간 없이 일정 등록 요청인지 판별  */
function isTimeSkipRequest(text) {
  return /시간\s*없이|시간은\s*없어|그냥\s*등록|바로\s*등록/.test(text);
}

/*  조회 요청인지 판별  */
function isScheduleLookupRequest(text) {
  return /일정/.test(text) && (
    /(뭐|뭐야|있어|알려|확인|보여|브리핑|언제|어떻게|요약)/.test(text) ||
    Boolean(parseDateFromText(text))
  );
}

/*  삭제 요청인지 판별  */
function isScheduleDeleteRequest(text) {
  return /(취소|삭제|지워|빼줘|없애)/.test(text);
}

/*  수정 요청인지 판별  */
function isScheduleUpdateRequest(text) {
  return /(수정|변경|바꿔|말고|앞당겨|미뤄)/.test(text);
}

/*  예약 가능은 지원하지 않고 일정 등록만 가능  */
function isUnsupportedBookingRequest(text) {
  return (
    /예약\s*(?:해\s*줘|해\s*주세요|잡아\s*줘|잡아\s*주세요)/.test(text) &&
    !parseDateFromText(text) &&
    !parseTimeFromText(text)
  );
}

/*  사용자가 말한 일정 찾기  */
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

/*  일정 수정 시 
    기존 일정과 변경 시간 찾기  */
function parseScheduleTimeUpdate(text, schedules) {
  const timeMatches = [...text.matchAll(new RegExp(TIME_EXPRESSION_PATTERN_SOURCE, "g"))];
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

/*  오전/오후 없는 시간 보정  */
function parseLooseTime(text, referenceTime = "") {
  const time = parseTimeExpression(text);
  if (!time) return "";

  if (!time.meridiem && referenceTime) {
    const referenceHour = Number(referenceTime.slice(0, 2));
    if (referenceHour >= 12 && time.hour < 12) {
      return `${pad(time.hour + 12)}:${pad(time.minute)}`;
    }
  }

  return time.value;
}

/*  12시간 기준으로 같은 시간인지 비교  */
function isSameLooseTime(scheduleTime, requestedTime) {
  if (!scheduleTime || !requestedTime) return false;
  if (scheduleTime === requestedTime) return true;

  const scheduleHour = Number(scheduleTime.slice(0, 2));
  const requestedHour = Number(requestedTime.slice(0, 2));
  return scheduleHour % 12 === requestedHour % 12;
}

/*  날짜, 시간, 불필요한 단어는 제거하고 일정 검색용 키워드 추출  */
function extractScheduleKeywords(text) {
  return text
    .replace(new RegExp(TIME_EXPRESSION_PATTERN_SOURCE, "g"), " ")
    .replace(/20\d{2}[-./년\s]+\d{1,2}[-./월\s]+\d{1,2}일?/g, " ")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?에?/g, " ")
    .replace(/오늘|내일|모레|다음\s*주|이번\s*주|[일월화수목금토]요일/g, " ")
    .replace(/일정|예약|취소|삭제|지워|빼줘|없애|수정|변경|바꿔|말고|으로|로|해줘|줘|요약/g, " ")
    .replace(/[,.!?]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

/*  일정 객체를 검색 가능한 문자열로 변환 */
function scheduleToSearchText(schedule) {
  return `${schedule.title || ""} ${schedule.detail || ""} ${schedule.text || ""}`;
}


