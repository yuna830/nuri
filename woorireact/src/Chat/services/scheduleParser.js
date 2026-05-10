const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULE_INTENT_PATTERN =
  /(일정|예약|알림|리마인드|등록|추가|잡아|넣어|기억|챙겨|복약|약|병원|검진|방문|전화|이동|운동|행사|모임|치과|내과|외과|상담|약속|산책|공원|놀이공원|외출|나들이|여행|모시기|가기|가요|가야)/;

const CASUAL_CONTEXT_PATTERN =
  /(힘들|피곤|아프|우울|슬프|외롭|기쁘|좋았|싫|무섭|걱정|고민|생각|기분|괜찮|그래|그냥|요즘|오늘은|내일은)/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function parseWeekday(text, baseDate) {
  const nextWeekMatch = text.match(/다음\s*주\s*([일월화수목금토])요일?/);
  const thisWeekMatch = text.match(/이번\s*주\s*([일월화수목금토])요일?/);
  const plainMatch = text.match(/(^|\s)([일월화수목금토])요일/);
  const match = nextWeekMatch || thisWeekMatch || plainMatch;

  if (!match) return null;

  const dayName = match[match.length - 1];
  const targetDay = DAY_NAMES.indexOf(dayName);
  const currentDay = baseDate.getDay();
  let diff = targetDay - currentDay;

  if (nextWeekMatch) diff += diff <= 0 ? 7 : 0;
  if (thisWeekMatch && diff < 0) diff += 7;
  if (plainMatch && diff <= 0) diff += 7;

  return addDays(baseDate, diff);
}

export function parseDateFromText(text, baseDate = new Date()) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (/오늘/.test(normalized)) return formatDate(baseDate);
  if (/내일\s*모레|내일모레|모레/.test(normalized)) {
    return formatDate(addDays(baseDate, 2));
  }
  if (/내일/.test(normalized)) return formatDate(addDays(baseDate, 1));

  const isoMatch = normalized.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})일?/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  const monthDayMatch = normalized.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    const candidate = new Date(baseDate.getFullYear(), Number(month) - 1, Number(day));

    return formatDate(candidate);
  }

  const weekdayDate = parseWeekday(normalized, baseDate);
  return weekdayDate ? formatDate(weekdayDate) : null;
}

export function parseTimeFromText(text) {
  const match = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?/);
  if (!match) return "";

  const [, meridiem, rawHour, rawMinute] = match;
  let hour = Number(rawHour);
  const minute = Number(rawMinute || 0);

  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;

  return `${pad(hour)}:${pad(minute)}`;
}

function hasScheduleIntent(text) {
  return SCHEDULE_INTENT_PATTERN.test(text);
}

function shouldCreateScheduleCandidate({ text, date, time, title }) {
  const hasIntent = hasScheduleIntent(text);

  if (hasIntent) return true;
  if (date && time) return true;
  if (date && title && !CASUAL_CONTEXT_PATTERN.test(text)) return true;
  if (time && !CASUAL_CONTEXT_PATTERN.test(text)) return true;

  return false;
}

function cleanTitle(text) {
  return text
    .replace(/20\d{2}[-./년\s]+\d{1,2}[-./월\s]+\d{1,2}일?/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일\s*에?/g, "")
    .replace(/내일\s*모레|내일모레|오늘|모레|내일|이번\s*주\s*[일월화수목금토]요일?|다음\s*주\s*[일월화수목금토]요일?/g, "")
    .replace(/(오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분?)?\s*에?/g, "")
    .replace(/해야\s*해|해야해|일정|예약|알림|기억해줘|등록해줘|해줘/g, "")
    .replace(/[,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoItems(text) {
  return text
    .split(/\n|[.;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseKoreanSchedules(text, baseDate = new Date()) {
  if (!text || !text.trim()) return [];

  return splitIntoItems(text)
    .map((item) => {
      const date = parseDateFromText(item, baseDate);
      const time = parseTimeFromText(item);
      const title = cleanTitle(item);

      if (!shouldCreateScheduleCandidate({ text: item, date, time, title })) {
        return null;
      }

      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: title || item,
        date,
        time,
        sourceText: item,
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}
