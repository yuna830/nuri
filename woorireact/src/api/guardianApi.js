const API_BASE_URL = "http://localhost:8080";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return response.json();
}

export function getGuardianAlerts(guardianId) {
  return request(`/api/alerts/guardian/${guardianId}`);
}

export function readAlert(alertId) {
  return request(`/api/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

export function getMissingReports() {
  return request("/api/missing-reports");
}

export function createMissingReport(data) {
  return request("/api/missing-reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createSightingReport(data) {
  return request("/api/sighting-reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadImage(category, file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE_URL}/api/uploads/${category}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`이미지 업로드 실패: ${response.status}`);
  }

  return response.json();
}
