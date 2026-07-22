const ROLE_STORAGE_KEYS = {
  WELFARE_WORKER: 'woori_user_welfare',
  GUARDIAN: 'woori_user_guardian',
  SENIOR: 'woori_user_senior',
}

function normalizeUser(data) {
  if (!data) return null
  return {
    userId: data.userId,
    name: data.name,
    role: data.role,
    token: data.token,
  }
}

function roleFromPath() {
  const path = window.location.pathname
  if (path.startsWith('/guardian')) return 'GUARDIAN'
  if (path.startsWith('/welfare')) return 'WELFARE_WORKER'
  if (path.startsWith('/senior')) return 'SENIOR'
  return null
}

function storageKeyForRole(role) {
  return ROLE_STORAGE_KEYS[role] || null
}

function readUserFromKey(key) {
  if (!key) return null
  try {
    return JSON.parse(sessionStorage.getItem(key))
  } catch {
    return null
  }
}

export function saveUser(data) {
  const user = normalizeUser(data)
  if (!user) return

  const scopedKey = storageKeyForRole(user.role)
  if (scopedKey) sessionStorage.setItem(scopedKey, JSON.stringify(user))

  sessionStorage.setItem('user', JSON.stringify(user))
}

export function getUser(role = roleFromPath()) {
  const scopedUser = readUserFromKey(storageKeyForRole(role))
  if (scopedUser) return scopedUser

  const legacyUser = readUserFromKey('user')
  if (!role || legacyUser?.role === role) return legacyUser
  return null
}

export function getUserId(role) {
  return getUser(role)?.userId ?? null
}

export function getToken(role) {
  return getUser(role)?.token ?? null
}

export function clearUser(role = roleFromPath()) {
  const scopedKey = storageKeyForRole(role)
  if (scopedKey) sessionStorage.removeItem(scopedKey)

  const legacyUser = readUserFromKey('user')
  if (!role || legacyUser?.role === role) {
    sessionStorage.removeItem('user')
  }
}
