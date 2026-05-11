// ────────────────────────────────────────────
// 규칙 기반 옷차림·준비물 추천
// ────────────────────────────────────────────
export const getWeatherItems = (temp, pty, wsd, humid) => {
  const items = [];
  const t = parseFloat(temp);
  const wind = parseFloat(wsd || 0);
  const h = parseFloat(humid || 0);

  if (t <= 4)        items.push({ icon: "🧥", label: "패딩 필수",         category: "옷" });
  else if (t <= 8)   items.push({ icon: "🧥", label: "두꺼운 코트",        category: "옷" });
  else if (t <= 11)  items.push({ icon: "🧥", label: "트렌치코트·야상",    category: "옷" });
  else if (t <= 16)  items.push({ icon: "👗", label: "자켓·가디건",        category: "옷" });
  else if (t <= 19)  items.push({ icon: "👚", label: "얇은 가디건·긴팔",   category: "옷" });
  else if (t <= 22)  items.push({ icon: "👕", label: "긴팔 티셔츠",        category: "옷" });
  else if (t <= 27)  items.push({ icon: "👕", label: "반팔",               category: "옷" });
  else               items.push({ icon: "🩴", label: "민소매·반바지",      category: "옷" });

  if (t <= 5) items.push({ icon: "🩲", label: "내복 착용", category: "옷" });

  if (pty === "1" || pty === "4")
    items.push({ icon: "☂️", label: "우산 필수", category: "준비물" });
  if (pty === "2" || pty === "3")
    items.push({ icon: "🥾", label: "방수 신발", category: "준비물" });

  if (wind >= 9)
    items.push({ icon: "🧣", label: "목도리", category: "옷" });
  else if (wind >= 5)
    items.push({ icon: "🌬", label: "바람막이 재킷", category: "옷" });

  if (pty === "0" && t >= 20)
    items.push({ icon: "🧴", label: "선크림 필수", category: "준비물" });

  if (pty === "0" && t >= 25)
    items.push({ icon: "🧢", label: "모자 추천", category: "준비물" });

  if (h < 40)
    items.push({ icon: "😷", label: "마스크 (건조)", category: "준비물" });

  return items;
};

// ────────────────────────────────────────────
// 건강정보 기반 추가 추천
// ────────────────────────────────────────────
export const getHealthItems = (profile, temp, pty) => {
  if (!profile) return [];
  const items = [];
  const t = parseFloat(temp);

  if (profile.joint && profile.joint !== "없음") {
    if (t <= 10 || pty === "1")
      items.push({ icon: "🦴", label: "무릎·관절 보온", category: "건강" });
  }
  if (profile.lung && profile.lung !== "없음") {
    if (t <= 5)
      items.push({ icon: "🫁", label: "찬 공기 주의·마스크", category: "건강" });
  }
  if (profile.heart && profile.heart !== "없음") {
    if (t <= 5)
      items.push({ icon: "❤️", label: "갑작스러운 추위 주의", category: "건강" });
  }
  if (profile.diabetes && profile.diabetes !== "없음") {
    if (t >= 30)
      items.push({ icon: "🩸", label: "고온 혈당 관리 주의", category: "건강" });
  }
  if (t <= 3)
    items.push({ icon: "⚠️", label: "낙상 주의·외출 자제", category: "건강" });

  return items;
};

// ────────────────────────────────────────────
// 자외선 지수 (기상청)
// ────────────────────────────────────────────
const UV_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";
const CACHE_TTL = 30 * 60 * 1000;
const RATE_LIMIT_COOLDOWN = 10 * 60 * 1000;

const readCache = (key) => {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const writeCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage can fail in private mode; the API should still work.
  }
};

const fetchJsonWithCache = async (url, cacheKey, ttl = CACHE_TTL) => {
  const cached = readCache(cacheKey);
  const globalCooldown = readCache("weather-api:global-cooldown");

  if (cached && Date.now() - cached.savedAt < ttl) {
    return cached.data;
  }

  if (globalCooldown && Date.now() - globalCooldown.savedAt < RATE_LIMIT_COOLDOWN) {
    return cached?.data ?? null;
  }

  const cooldown = readCache(`${cacheKey}:cooldown`);
  if (cooldown && Date.now() - cooldown.savedAt < RATE_LIMIT_COOLDOWN) {
    return cached?.data ?? null;
  }

  try {
    const response = await fetch(url);

    if (response.status === 429) {
      writeCache(`${cacheKey}:cooldown`, true);
      writeCache("weather-api:global-cooldown", true);
      return cached?.data ?? null;
    }

    if (!response.ok) {
      return cached?.data ?? null;
    }

    const data = await response.json();
    writeCache(cacheKey, data);
    return data;
  } catch {
    return cached?.data ?? null;
  }
};

const uvLevel = (v) => {
  if (v >= 11) return "위험";
  if (v >= 8)  return "매우높음";
  if (v >= 6)  return "높음";
  if (v >= 3)  return "보통";
  return "낮음";
};

export const fetchUVIndex = async (lat, lon) => {
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const areaNo = "1100000000";
    const time = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}`;
    const url = `/weather-api/1360000/LivingWthrIdxServiceV4/getUVIdxV4`
      + `?ServiceKey=${UV_KEY}&pageNo=1&numOfRows=10&dataType=JSON`
      + `&areaNo=${areaNo}&time=${time}`;
    const data = await fetchJsonWithCache(url, `weather:uv:${areaNo}:${time}`);
    if (!data) return null;
    const item = data?.response?.body?.items?.item?.[0];
    if (!item) return null;
    const value = parseInt(item.h0 || item.h3 || 0);
    return { value, level: uvLevel(value) };
  } catch {
    return null;
  }
};

// ────────────────────────────────────────────
// 미세먼지 (에어코리아)
// ────────────────────────────────────────────
const pm10Level = (v) => {
  if (v <= 30)  return "좋음";
  if (v <= 80)  return "보통";
  if (v <= 150) return "나쁨";
  return "매우나쁨";
};

const pm25Level = (v) => {
  if (v <= 15)  return "좋음";
  if (v <= 35)  return "보통";
  if (v <= 75)  return "나쁨";
  return "매우나쁨";
};

export const fetchAirQuality = async (lat, lon) => {
  try {
    const station = "중구";
    const airUrl = `/airkorea/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty`
      + `?serviceKey=${UV_KEY}&returnType=json&numOfRows=1&pageNo=1`
      + `&stationName=${encodeURIComponent(station)}&dataTerm=DAILY&ver=1.3`;
    const airData = await fetchJsonWithCache(airUrl, `weather:air:${station}`);
    if (!airData) return null;
    const item = airData?.response?.body?.items?.[0];
    if (!item) return null;
    const pm10 = parseInt(item.pm10Value || 0);
    const pm25 = parseInt(item.pm25Value || 0);
    return {
      station,
      pm10: { value: pm10, level: pm10Level(pm10) },
      pm25: { value: pm25, level: pm25Level(pm25) },
    };
  } catch {
    return null;
  }
};

// ────────────────────────────────────────────
// 꽃가루 (기상청 건강기상지수)
// ────────────────────────────────────────────
const pollenLevel = (v) => {
  if (v >= 4) return { text: "매우높음", value: 4 };
  if (v >= 3) return { text: "높음",     value: 3 };
  if (v >= 2) return { text: "보통",     value: 2 };
  return       { text: "낮음",     value: 1 };
};

export const fetchPollenIndex = async (lat, lon) => {
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}`;
    const areaNo = "1100000000";

    const [pineRes, oakRes, weedsRes] = await Promise.all([
      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getPinePollenRiskIdxV3`
          + `?ServiceKey=${UV_KEY}&pageNo=1&numOfRows=10&dataType=JSON`
          + `&areaNo=${areaNo}&time=${time}`,
        `weather:pollen:pine:${areaNo}:${time}`
      ),
      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getOakPollenRiskIdxV3`
          + `?ServiceKey=${UV_KEY}&pageNo=1&numOfRows=10&dataType=JSON`
          + `&areaNo=${areaNo}&time=${time}`,
        `weather:pollen:oak:${areaNo}:${time}`
      ),
      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getWeedsPollenRiskndxV3`
          + `?ServiceKey=${UV_KEY}&pageNo=1&numOfRows=10&dataType=JSON`
          + `&areaNo=${areaNo}&time=${time}`,
        `weather:pollen:weeds:${areaNo}:${time}`
      ),
    ]);

    const parseItem = (data) => {
      const item = data?.response?.body?.items?.item?.[0];
      if (!item) return null;
      const value = parseInt(item.today || item.h0 || 1);
      return pollenLevel(value);
    };

    const result = {};
    const pine  = parseItem(pineRes);
    const oak   = parseItem(oakRes);
    const weeds = parseItem(weedsRes);

    if (pine)  result.pine  = pine;
    if (oak)   result.oak   = oak;
    if (weeds) result.weeds = weeds;

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
};
