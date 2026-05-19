export const getDefaultSafeZone = (elder) => ({
  name: "기본구역",
  address: elder.address,
  centerLatitude: elder.center.lat,
  centerLongitude: elder.center.lng,
  radiusMeters: elder.radius,
});

export const loadSafeZone = async (elder) => {
  const cacheKey = `guardian-safe-zone:${elder.id}`;

  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");

    if (cached && Date.now() - cached.savedAt < 60 * 1000) {
      return cached.data;
    }
  } catch {
    // cache is optional
  }

  const response = await fetch(`http://localhost:8080/api/safe-zones/senior/${elder.id}`);

  if (!response.ok || response.status === 204) {
    return getDefaultSafeZone(elder);
  }

  const safeZone = await response.json();

  const normalizedSafeZone = {
    name: safeZone.name || "기본구역",
    address: safeZone.address || elder.address,
    centerLatitude: safeZone.centerLatitude ?? elder.center.lat,
    centerLongitude: safeZone.centerLongitude ?? elder.center.lng,
    radiusMeters: safeZone.radiusMeters ?? elder.radius,
  };

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), data: normalizedSafeZone })
    );
  } catch {
    // ignore storage failure
  }

  return normalizedSafeZone;
};

export const saveSafeZone = async (seniorId, safeZoneForm) => {
  const response = await fetch(`http://localhost:8080/api/safe-zones/senior/${seniorId}`, {
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
    throw new Error("안전 구역 저장 실패");
  }

  return response.json();
};
