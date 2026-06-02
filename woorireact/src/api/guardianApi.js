import { POLICE_API_BASE, SPRING_API_BASE } from "../config/api.js";

const API_BASE_URL = SPRING_API_BASE;
const POLICE_API_BASE_URL = POLICE_API_BASE;

export function getPolicePhotoUrl(alertId) {
  if (!alertId) return "";
  return `${POLICE_API_BASE_URL}/api/police-missing-alerts/${alertId}/photo`;
}

async function request(baseUrl, path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`API 요청 실패: ${response.status}${message ? ` ${message}` : ""}`);
  }

  return response.json();
}

async function requestArray(baseUrl, path, options = {}) {
  try {
    const data = await request(baseUrl, path, options);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`${path} 조회 실패:`, error);
    return [];
  }
}

export function getGuardianAlerts(guardianId) {
  return requestArray(API_BASE_URL, `/api/alerts/guardian/${guardianId}`);
}

export function readAlert(alertId) {
  return request(API_BASE_URL, `/api/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

export function createCallRequestAlert({ seniorId, latitude, longitude }) {
  return request(API_BASE_URL, "/api/alerts/call", {
    method: "POST",
    body: JSON.stringify({ seniorId, latitude, longitude }),
  });
}

export function sendMedicineAlert({ seniorId, guardianId, message }) {
  return request(API_BASE_URL, "/api/alerts/medicine", {
    method: "POST",
    body: JSON.stringify({ seniorId, guardianId, message }),
  });
}

export function sendCheckInMessage({ seniorId, guardianId, message }) {
  return request(API_BASE_URL, "/api/alerts/check-in-message", {
    method: "POST",
    body: JSON.stringify({ seniorId, guardianId, message }),
  });
}

export function getMissingReports() {
  return requestArray(API_BASE_URL, "/api/missing-reports");
}

export function createMissingReport(data) {
  return request(API_BASE_URL, "/api/missing-reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createSightingReport(data) {
  return request(API_BASE_URL, "/api/sighting-reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadImage(category, file) {
  const formData = new FormData();
  formData.append("image", file);

  return request(API_BASE_URL, `/api/uploads/${category}`, {
    method: "POST",
    body: formData,
  });
}

export function getPoliceMissingAlerts() {
  return requestArray(POLICE_API_BASE_URL, "/api/police-missing-alerts");
}

export function getSeniorProfile(seniorId) {
  return request(API_BASE_URL, `/api/seniors/${seniorId}`);
}

export function getGuardianSeniors(guardianId) {
  return requestArray(API_BASE_URL, `/api/seniors/guardian/${guardianId}`);
}

export function searchSeniorExact({ name, phone }) {
  return requestArray(
    API_BASE_URL,
    `/api/seniors/search-exact?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`
  );
}

export function connectSeniorToGuardian(guardianId, { seniorId, relation }) {
  return request(API_BASE_URL, `/api/guardians/${guardianId}/seniors`, {
    method: "POST",
    body: JSON.stringify({
      seniorId,
      relation,
    }),
  });
}

export function createAndConnectSenior(guardianId, seniorForm) {
  return request(API_BASE_URL, `/api/guardians/${guardianId}/seniors/new`, {
    method: "POST",
    body: JSON.stringify(seniorForm),
  });
}

export function deleteGuardianSenior(guardianId, seniorId) {
  return request(API_BASE_URL, `/api/guardians/${guardianId}/seniors/${seniorId}`, {
    method: "DELETE",
  });
}

export function updateGuardianSeniorRelation(guardianId, seniorId, relation) {
  return request(API_BASE_URL, `/api/guardians/${guardianId}/seniors/${seniorId}/relation`, {
    method: "PATCH",
    body: JSON.stringify({ relation }),
  });
}

export function updateSeniorRequestedInfo(seniorId, data) {
  return request(API_BASE_URL, `/api/seniors/${seniorId}/requested-info`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getSeniorJobInterests(seniorId) {
  return requestArray(API_BASE_URL, `/api/job-interests/senior/${seniorId}`);
}

export function respondWelfareConsultation(alertId, { responseType, scheduleAt }) {
  return request(API_BASE_URL, `/api/alerts/${alertId}/welfare-consult-response`, {
    method: "PATCH",
    body: JSON.stringify({
      responseType,
      scheduleAt,
    }),
  });
}
