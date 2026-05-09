const API_BASE = "http://localhost:8181";

export const getCurrentSeniorProfile = () => {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const getCurrentSeniorId = () => {
  const profile = getCurrentSeniorProfile();
  return profile?.senior?.id || localStorage.getItem("current_senior_id") || "";
};

export const resolveUploadUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE}${imageUrl}`;
};

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/api/uploads/profile`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Profile image upload failed");
  }

  return response.json();
};

export const fetchTodayClimateAlerts = async (seniorId) => {
  if (!seniorId) return [];
  const response = await fetch(`${API_BASE}/api/climate-alerts/senior/${seniorId}/today`);
  if (!response.ok) return [];
  return response.json();
};

export const fetchLatestClimateAlerts = async (seniorId) => {
  if (!seniorId) return [];
  const response = await fetch(`${API_BASE}/api/climate-alerts/senior/${seniorId}/latest`);
  if (!response.ok) return [];
  return response.json();
};

export const saveClimateAlert = async (alert) => {
  const response = await fetch(`${API_BASE}/api/climate-alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });

  if (!response.ok) {
    throw new Error("Climate alert save failed");
  }

  return response.json();
};

export const createSosAlert = async ({ seniorId, latitude, longitude }) => {
  const response = await fetch(`${API_BASE}/api/alerts/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude }),
  });

  if (!response.ok) {
    throw new Error("SOS alert failed");
  }

  return response.json();
};

export const createSosCancelAlert = async ({ seniorId, latitude, longitude }) => {
  const response = await fetch(`${API_BASE}/api/alerts/sos/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude }),
  });

  if (!response.ok) {
    throw new Error("SOS cancel alert failed");
  }

  return response.json();
};
