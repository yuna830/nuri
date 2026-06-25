export function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

export function getUserId() {
  return getUser()?.userId ?? null;
}
