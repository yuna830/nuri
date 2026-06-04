async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = new Error("Admin authentication request failed");
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
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
