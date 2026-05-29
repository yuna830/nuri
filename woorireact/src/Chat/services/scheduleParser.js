const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULE_INTENT_PATTERN =
  /(일정|예약|알림|리마인드|등록|추가|넣어|넣어줘|기억|챙겨|복약|약|병원|검진|방문|전화|운동|이동|행사|모임|치과|안과|내과|상담|약속|산책|공원|수영장|취침|기상|수면|잠|자기|식사|아침|점심|저녁)/;

const SCHEDULE_COMMAND_PATTERN =
  /(일정|예약|알림|리마인드|등록|추가|넣어|넣어줘|기억|챙겨|삭제|취소|지워|빼줘|없애|수정|변경|바꿔|미뤄|앞당겨|조회|확인|알려|보여)/;

const NON_SCHEDULE_QUESTION_PATTERN =
  /(날씨|기분|컨디션|뭐해|뭐 할까|뭐하지|뭐할지|뭘 하지|뭐 먹|먹을까|메뉴|추천|어때|좋아|나빠|누구|이름|이야기|농담|뉴스)/;

const TYPO_REPLACEMENTS = [
  [/낼/g, "내일"],
  [/담주/g, "다음 주"],
  [/담\s*주/g, "다음 주"],
  [/모래/g, "모레"],
];

const KOREAN_NUMBER_VALUES = {
  한: 1,
  하나: 1,
  두: 2,
  둘: 2,
  세: 3,
  셋: 3,
  네: 4,
  넷: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
  열한: 11,
  열하나: 11,
  열두: 12,
  열둘: 12,
  십: 10,
  이십: 20,
  삼십: 30,
  사십: 40,
  오십: 50,
};

const KOREAN_TIME_NUMBER_PATTERN =
  "열하나|열한|열두|열둘|다섯|여섯|일곱|여덟|아홉|하나|둘|셋|넷|한|두|세|네|삼십|사십|오십|이십|십|열";
export const TIME_EXPRESSION_PATTERN_SOURCE =
  `(오전|오후|아침|저녁|밤|새벽|낮|점심)?\\s*(\\d{1,2}|${KOREAN_TIME_NUMBER_PATTERN})\\s*시(?:\\s*(반|\\d{1,2}|${KOREAN_TIME_NUMBER_PATTERN})\\s*분?)?\\s*(?:에)?`;

export function normalizeScheduleText(text) {
  return TYPO_REPLACEMENTS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    String(text || "")
  );
}

export function parseDateFromText(text, baseDate = new Date()) {
  const normalized = normalizeScheduleText(text).replace(/\s+/g, " ").trim();

  if (/오늘/.test(normalized)) return formatDate(baseDate);
  if (/글피/.test(normalized)) return formatDate(addDays(baseDate, 3));
  if (/내일\s*모레|내일모레|모레/.test(normalized)) return formatDate(addDays(baseDate, 2));
  if (/내일/.test(normalized)) return formatDate(addDays(baseDate, 1));

  const isoMatch = normalized.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})일?/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  const monthDayMatch = normalized.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    return formatDate(new Date(baseDate.getFullYear(), Number(month) - 1, Number(day)));
  }

  const weekdayDate = parseWeekday(normalized, baseDate);
  return weekdayDate ? formatDate(weekdayDate) : null;
}

export function parseTimeFromText(text) {
  const time = parseTimeExpression(text);
  return time ? time.value : "";
}

export function parseTimeExpression(text) {
  const normalized = normalizeScheduleText(text);
  const match = normalized.match(new RegExp(TIME_EXPRESSION_PATTERN_SOURCE));
  if (!match) return null;

  const [, rawMeridiem, rawHour, rawMinute] = match;
  const meridiem = normalizeMeridiem(rawMeridiem);
  let hour = parseKoreanTimeNumber(rawHour);
  const minute = rawMinute === "반" ? 30 : parseKoreanTimeNumber(rawMinute || 0);

  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;

  return {
    value: `${pad(hour)}:${pad(minute)}`,
    meridiem,
    hour: parseKoreanTimeNumber(rawHour),
    minute,
    isAmbiguous: !meridiem && parseKoreanTimeNumber(rawHour) >= 1 && parseKoreanTimeNumber(rawHour) <= 11,
    text: match[0],
  };
}

export function shouldUseScheduleExtraction(text) {
  const normalized = normalizeScheduleText(text).replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const hasDate = Boolean(parseDateFromText(normalized));
  const hasTime = Boolean(parseTimeExpression(normalized));
  const hasIntent = SCHEDULE_INTENT_PATTERN.test(normalized);
  const hasCommand = SCHEDULE_COMMAND_PATTERN.test(normalized);

  if (isScheduleQuestion(normalized)) return true;
  if (isCasualAdviceQuestion(normalized) && !hasCommand) return false;
  if (NON_SCHEDULE_QUESTION_PATTERN.test(normalized) && !hasCommand && !hasIntent) return false;
  if (hasCommand && (hasIntent || hasDate || hasTime)) return true;
  if (hasIntent && (hasDate || hasTime)) return true;

  return false;
}

export function parseKoreanSchedules(text, baseDate = new Date()) {
  if (!text || !text.trim()) return [];

  return splitIntoItems(text)
    .map((sourceText) => {
      const item = normalizeScheduleText(sourceText);
      const date = parseDateFromText(item, baseDate);
      const timeExpression = parseTimeExpression(item);
      const time = timeExpression?.isAmbiguous ? "" : timeExpression?.value || "";
      const title = cleanTitle(item);
      const candidateTime = time || timeExpression?.value || "";

      if (!shouldCreateScheduleCandidate({ text: item, date, time: candidateTime, title })) {
        return null;
      }

      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: title || item,
        date,
        time,
        ambiguousTime: timeExpression?.isAmbiguous
          ? { hour: timeExpression.hour, minute: timeExpression.minute }
          : null,
        sourceText,
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function shouldCreateScheduleCandidate({ text, date, time, title }) {
  const hasIntent = SCHEDULE_INTENT_PATTERN.test(text);
  const hasCommand = SCHEDULE_COMMAND_PATTERN.test(text);
  const hasNonScheduleQuestion = NON_SCHEDULE_QUESTION_PATTERN.test(text);

  if (isScheduleQuestion(text)) return false;
  if (isCasualAdviceQuestion(text) && !hasCommand) return false;
  if (hasNonScheduleQuestion && !hasIntent && !hasCommand) return false;
  if (date && !title && /일정/.test(text)) return false;
  if (hasIntent && (date || time)) return true;
  if (hasCommand && (date || time || title)) return true;
  if (date && title && !hasNonScheduleQuestion) return true;

  return false;
}

function isScheduleQuestion(text) {
  return /일정/.test(text) && /(뭐|뭐야|있어|알려|확인|보여|언제|어떻게|요약)/.test(text);
}

function isCasualAdviceQuestion(text) {
  return /(뭐\s*하지|뭐\s*할지|뭘\s*하지|뭐\s*할까|뭐\s*먹을까|뭘\s*먹을까|메뉴\s*추천|추천해\s*줘|추천해줘)/.test(text);
}

function cleanTitle(text) {
  return normalizeScheduleText(text)
    .replace(/20\d{2}[-./년\s]+\d{1,2}[-./월\s]+\d{1,2}일?/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?에?/g, "")
    .replace(/내일\s*모레|내일모레|오늘|글피|모레|내일|이번\s*주\s*[일월화수목금토]요일?|다음\s*주\s*[일월화수목금토]요일?|다음\s*주/g, "")
    .replace(new RegExp(TIME_EXPRESSION_PATTERN_SOURCE, "g"), "")
    .replace(/해야\s*해|해야해|일정|예약|알림|기억해줘|등록해줘|넣어줘|추가해줘|해줘|있어|있어요/g, "")
    .replace(/^(에는|에|은|는)\s*/g, "")
    .replace(/\s*(에는|에|은|는|이|가|을|를)\s*$/g, "")
    .replace(/[,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWeekday(text, baseDate) {
  const nextWeekOnlyMatch = text.match(/다음\s*주(?!\s*[일월화수목금토]요일?)/);
  const nextWeekMatch = text.match(/다음\s*주\s*([일월화수목금토])요일?/);
  const thisWeekMatch = text.match(/이번\s*주\s*([일월화수목금토])요일?/);
  const plainMatch = text.match(/(^|\s)([일월화수목금토])요일/);
  const match = nextWeekMatch || thisWeekMatch || plainMatch;

  if (nextWeekOnlyMatch) return addDays(baseDate, 7);
  if (!match) return null;

  const dayName = match[match.length - 1];
  const targetDay = DAY_NAMES.indexOf(dayName);
  const currentDay = baseDate.getDay();
  let diff = targetDay - currentDay;

  if (nextWeekMatch) diff += 7;
  if (thisWeekMatch && diff < 0) diff += 7;
  if (plainMatch && diff <= 0) diff += 7;

  return addDays(baseDate, diff);
}

function splitIntoItems(text) {
  return text
    .split(/\n|[.;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMeridiem(value = "") {
  if (/오전|아침|새벽/.test(value)) return "오전";
  if (/오후|저녁|밤|낮|점심/.test(value)) return "오후";
  return "";
}

function parseKoreanTimeNumber(value) {
  if (/^\d+$/.test(String(value))) return Number(value);
  return KOREAN_NUMBER_VALUES[value] || 0;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
