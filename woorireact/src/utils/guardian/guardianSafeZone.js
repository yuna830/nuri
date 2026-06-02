import { SPRING_API_BASE } from "../../config/api.js";

export const getDefaultSafeZones = (elder) => ([
  {
    id: "default-home",
    name: "집",
    address: elder.address,
    centerLatitude: elder.center.lat,
    centerLongitude: elder.center.lng,
    radiusMeters: elder.radius || 500,
  },
]);

export const getPrimarySafeZone = (safeZones, elder) => {
  if (Array.isArray(safeZones) && safeZones.length > 0) {
    return safeZones[0];
  }

  return getDefaultSafeZones(elder)[0];
};

const normalizeSafeZone = (safeZone, elder, index = 0) => ({
  id: safeZone.id ?? `local-${index}`,
  name: safeZone.name || "안전 반경",
  address: safeZone.address || elder.address,
  centerLatitude: safeZone.centerLatitude ?? elder.center.lat,
  centerLongitude: safeZone.centerLongitude ?? elder.center.lng,
  radiusMeters: safeZone.radiusMeters ?? elder.radius ?? 500,
});

export const loadSafeZones = async (elder) => {
  const cacheKey = `guardian-safe-zones:${elder.id}`;

  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");

    if (cached && Date.now() - cached.savedAt < 60 * 1000) {
      return cached.data;
    }
  } catch {
    // cache is optional
  }

  const response = await fetch(`${SPRING_API_BASE}/api/safe-zones/senior/${elder.id}`);

  if (!response.ok || response.status === 204) {
    return getDefaultSafeZones(elder);
  }

  const safeZones = await response.json();

  const normalizedSafeZones = Array.isArray(safeZones) && safeZones.length > 0
    ? safeZones.map((safeZone, index) => normalizeSafeZone(safeZone, elder, index))
    : getDefaultSafeZones(elder);

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), data: normalizedSafeZones })
    );
  } catch {
    // ignore storage failure
  }

  return normalizedSafeZones;
};

export const createSafeZone = async (seniorId, safeZoneForm) => {
  const response = await fetch(`${SPRING_API_BASE}/api/safe-zones/senior/${seniorId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeZoneForm.name,
      address: safeZoneForm.address,
      centerLatitude: safeZoneForm.centerLatitude,
      centerLongitude: safeZoneForm.centerLongitude,
      radiusMeters: safeZoneForm.radiusMeters,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`안전 반경 추가 실패: ${response.status}${message ? ` ${message}` : ""}`);
  }

  sessionStorage.removeItem(`guardian-safe-zones:${seniorId}`);
  return response.json();
};

export const updateSafeZone = async (seniorId, safeZoneId, safeZoneForm) => {
  const response = await fetch(`${SPRING_API_BASE}/api/safe-zones/senior/${seniorId}/${safeZoneId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeZoneForm.name,
      address: safeZoneForm.address,
      centerLatitude: safeZoneForm.centerLatitude,
      centerLongitude: safeZoneForm.centerLongitude,
      radiusMeters: safeZoneForm.radiusMeters,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`안전 반경 수정 실패: ${response.status}${message ? ` ${message}` : ""}`);
  }

  sessionStorage.removeItem(`guardian-safe-zones:${seniorId}`);
  return response.json();
};

export const deleteSafeZone = async (seniorId, safeZoneId) => {
  const response = await fetch(`${SPRING_API_BASE}/api/safe-zones/senior/${seniorId}/${safeZoneId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("안전 반경 삭제 실패");
  }

  sessionStorage.removeItem(`guardian-safe-zones:${seniorId}`);
};

export const saveSafeZone = async (seniorId, safeZoneForm) => {
  const id = String(safeZoneForm.id || "");

  if (
    id &&
    !id.startsWith("default") &&
    !id.startsWith("local") &&
    !id.startsWith("new")
  ) {
    return updateSafeZone(seniorId, safeZoneForm.id, safeZoneForm);
  }

  return createSafeZone(seniorId, safeZoneForm);
};