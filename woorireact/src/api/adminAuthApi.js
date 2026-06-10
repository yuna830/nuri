async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const responseText = await response.text();
  let responseData = null;

  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (typeof responseData === "object" &&
        (responseData?.message || responseData?.detail || responseData?.error)) ||
      (typeof responseData === "string" && responseData) ||
      "Admin authentication request failed";
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code =
      typeof responseData === "object"
        ? responseData?.code || responseData?.errorCode || responseData?.status
        : null;
    error.detail =
      typeof responseData === "object" ? responseData?.detail || responseData?.message : responseData;
    error.data = responseData;
    throw error;
  }

  return response.status === 204 ? null : responseData;
}

export function signupAdmin(form) {
  return request("/api/admins/signup", {
    method: "POST",
    body: JSON.stringify(form),
  });
}

export function loginAdmin(form) {
  return request("/api/admins/login", {
    method: "POST",
    body: JSON.stringify(form),
  });
}

function getAdminHeaders() {
  const admin = JSON.parse(sessionStorage.getItem("currentAdmin") || "null");
  return admin?.id ? { "X-Admin-Id": String(admin.id) } : {};
}

export function fetchAdmins() {
  return request("/api/admins", {
    headers: getAdminHeaders(),
  });
}

export function updateAdminStatus(adminId, status) {
  return request(`/api/admins/${adminId}/status`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify({ status }),
  });
}

export function deleteCurrentAdmin() {
  return request("/api/admins/me", {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export function deleteAdmin(adminId) {
  return request(`/api/admins/${adminId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}
