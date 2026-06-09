import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/*  현재 사용자 ID  */
export function getCurrentSeniorId() {
  return localStorage.getItem("current_senior_id");
}

/*  일정 등록  */
export async function createSchedule(payload) {
  const response = await axios.post(`${API_BASE_URL}/api/schedules`, payload);
  return response.data;
}

/*  일정 수정  */
export async function updateSchedule(id, payload) {
  const response = await axios.put(`${API_BASE_URL}/api/schedules/${id}`, payload);
  return response.data;
}

/*  일정 삭제  */
export async function deleteSchedule(id) {
  await axios.delete(`${API_BASE_URL}/api/schedules/${id}`);
}

/*  오늘 일정 조회  */ 
export async function fetchTodaySchedules(seniorId) {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedules/senior/${seniorId}/today`
  );
  return normalizeScheduleList(response.data);
}

/*  날짜별 일정 조회  */
export async function fetchSchedulesByDate(seniorId, scheduleDate) {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedules/senior/${seniorId}/date/${scheduleDate}`
  );
  return normalizeScheduleList(response.data);
}

/*  전체 일정 조회  */
export async function fetchSeniorSchedules(seniorId) {
  const response = await axios.get(`${API_BASE_URL}/api/schedules/senior/${seniorId}`);
  return normalizeScheduleList(response.data);
}

/*  일정 정규화  */
function normalizeScheduleList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}
