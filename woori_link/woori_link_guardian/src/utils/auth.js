export function saveUser(data) {
  sessionStorage.setItem('user', JSON.stringify({
    userId: data.userId,
    name: data.name,
    role: data.role,
  }));
}

export function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
}

export function getUserId() {
  return getUser()?.userId ?? null;
}

export function clearUser() {
  sessionStorage.removeItem('user');
}