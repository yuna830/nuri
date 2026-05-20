const KAKAO_CACHE_TTL_MS = 30 * 60 * 1000;
const KAKAO_COOLDOWN_MS = 2 * 60 * 1000;

const readJson = (storage, key, fallback = null) => {
  try {
    return JSON.parse(storage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage cache is optional.
  }
};

const getCached = (storage, key) => {
  const cached = readJson(storage, key);
  if (cached && Date.now() - cached.savedAt < KAKAO_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
};

const setCached = (storage, key, data) => {
  writeJson(storage, key, { savedAt: Date.now(), data });
};

const assertNotCoolingDown = (storage, key) => {
  const cooldownUntil = Number(storage.getItem(key) || 0);
  if (cooldownUntil > Date.now()) {
    throw new Error("KAKAO_COOLDOWN");
  }
};

const setCooldown = (storage, key) => {
  try {
    storage.setItem(key, String(Date.now() + KAKAO_COOLDOWN_MS));
  } catch {
    // Ignore storage failure.
  }
};

const requestKakao = async (path, cooldownKey) => {
  const response = await fetch(`/kakao-local${path}`);

  if (response.status === 401 || response.status === 403) {
    setCooldown(sessionStorage, cooldownKey);
    throw new Error("KAKAO_UNAUTHORIZED");
  }

  if (response.status === 429) {
    setCooldown(sessionStorage, cooldownKey);
    throw new Error("KAKAO_RATE_LIMIT");
  }

  if (!response.ok) {
    throw new Error("KAKAO_FAILED");
  }

  return response.json();
};

export const reverseGeocodeByKakao = async (lat, lon) => {
  const roundedLat = Number(lat).toFixed(5);
  const roundedLon = Number(lon).toFixed(5);
  const cacheKey = `kakao-reverse:${roundedLat}:${roundedLon}`;
  const cooldownKey = "kakao-reverse:cooldown";
  const cached = getCached(sessionStorage, cacheKey);

  if (cached) return cached;
  assertNotCoolingDown(sessionStorage, cooldownKey);

  const data = await requestKakao(
    `/v2/local/geo/coord2address.json?x=${roundedLon}&y=${roundedLat}`,
    cooldownKey
  );

  const document = data?.documents?.[0];
  const road = document?.road_address;
  const address = document?.address;
  const resolved = road?.address_name || address?.address_name || "";

  if (!resolved) {
    throw new Error("KAKAO_EMPTY");
  }

  setCached(sessionStorage, cacheKey, resolved);
  return resolved;
};

export const searchPlacesByKakao = async (keyword, { size = 5, x, y, radius } = {}) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const locationKey = x && y ? `:${Number(x).toFixed(4)}:${Number(y).toFixed(4)}:${radius || ""}` : "";
  const cacheKey = `kakao-place:${normalizedKeyword}:${size}${locationKey}`;
  const cooldownKey = "kakao-place:cooldown";
  const cached = getCached(localStorage, cacheKey);

  if (cached) return cached;
  assertNotCoolingDown(localStorage, cooldownKey);

  const params = new URLSearchParams({
    query: keyword,
    size: String(size),
  });
  if (x && y) {
    params.set("x", String(x));
    params.set("y", String(y));
  }
  if (radius) {
    params.set("radius", String(radius));
  }

  const data = await requestKakao(
    `/v2/local/search/keyword.json?${params.toString()}`,
    cooldownKey
  );

  const results = (data?.documents || []).map((place) => ({
    place_id: place.id,
    display_name: place.road_address_name || place.address_name || place.place_name,
    name: place.place_name,
    phone: place.phone,
    distance: place.distance,
    place_url: place.place_url,
    lat: place.y,
    lon: place.x,
  })).filter((place) => place.display_name && place.lat && place.lon);

  setCached(localStorage, cacheKey, results);
  return results;
};
