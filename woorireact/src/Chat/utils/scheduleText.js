export function scheduleToText(schedule) {
  const dateText = schedule.date || "날짜 확인 필요";
  const timeText = schedule.time ? ` ${schedule.time}` : "";
  return `${dateText}${timeText} ${schedule.title || schedule.detail || "일정"}`.trim();
}

export function formatScheduleBrief(schedule) {
  return `${schedule.time ? `${schedule.time} ` : ""}${schedule.title || schedule.detail || "일정"}`;
}

export function formatScheduleList(schedules) {
  return schedules
    .slice()
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
    .map((schedule) => `● ${formatScheduleBrief(schedule)}`)
    .join("\n");
}

export function formatDateKorean(dateValue) {
  const [, month, day] = dateValue.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

export function formatTodayKorean() {
  const today = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일(${days[today.getDay()]})`;
}

export function formatCurrentTimeKorean() {
  const now = new Date();
  const period = now.getHours() >= 12 ? "오후" : "오전";
  const hour = now.getHours() % 12 || 12;
  const minute = now.getMinutes();

  return minute === 0 ? `${period} ${hour}시` : `${period} ${hour}시 ${minute}분`;
}

export function isPastSchedule(schedule) {
  const date = schedule.date || todayValue();
  const today = todayValue();

  if (date < today) return true;
  if (date > today || !schedule.time) return false;

  return schedule.time <= currentTimeValue();
}

export function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

function currentTimeValue() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
