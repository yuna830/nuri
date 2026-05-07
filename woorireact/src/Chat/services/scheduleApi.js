import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getCurrentSeniorId() {
  return localStorage.getItem("current_senior_id");
}

export async function createSchedule(payload) {
  const response = await axios.post(`${API_BASE_URL}/api/schedules`, payload);
  return response.data;
}

export async function updateSchedule(id, payload) {
  const response = await axios.put(`${API_BASE_URL}/api/schedules/${id}`, payload);
  return response.data;
}

export async function deleteSchedule(id) {
  await axios.delete(`${API_BASE_URL}/api/schedules/${id}`);
}

export async function fetchTodaySchedules(seniorId) {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedules/senior/${seniorId}/today`
  );
  return normalizeScheduleList(response.data);
}

export async function fetchSchedulesByDate(seniorId, scheduleDate) {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedules/senior/${seniorId}/date/${scheduleDate}`
  );
  return normalizeScheduleList(response.data);
}

export async function fetchSeniorSchedules(seniorId) {
  const response = await axios.get(`${API_BASE_URL}/api/schedules/senior/${seniorId}`);
  return normalizeScheduleList(response.data);
}

function normalizeScheduleList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}
