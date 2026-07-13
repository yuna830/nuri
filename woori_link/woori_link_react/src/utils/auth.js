export function saveUser(data) {
  sessionStorage.setItem('user', JSON.stringify({
    userId: data.userId,
    name: data.name,
    role: data.role,
    token: data.token,
  }));
}

export function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
}

export function getUserId() {
  return getUser()?.userId ?? null;
}

export function getToken() {
  return getUser()?.token ?? null;
}

export function clearUser() {
  sessionStorage.removeItem('user');
}
