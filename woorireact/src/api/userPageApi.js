import { reverseGeocodeByKakao } from "./kakaoLocalApi.js";
import {
  deleteLocalAlert,
  deleteLocalAlerts,
  deleteOldLocalRequestAlerts,
  getLocalSeniorAlerts,
  isLocalAlertId,
  markLocalAlertRead,
} from "./localAlertStore";

const API_BASE = "http://localhost:8080";
const getDefaultFallApiBase = () => {
  const host = window.location.hostname;

  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `${window.location.protocol}//${host}:8000`;
  }

  return "http://127.0.0.1:8000";
};

const FALL_API_BASE = (
  import.meta.env.VITE_FALL_API_BASE ||
  localStorage.getItem("woori_fall_api_base") ||
  getDefaultFallApiBase()
).replace(/\/$/, "");
const WEATHER_SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";
const WEATHER_CACHE_TTL = 10 * 60 * 1000;

export const toWeatherGrid = (lat, lon) => {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
};

const pad = (value) => String(value).padStart(2, "0");

const getForecastBase = () => {
  const now = new Date();
  const baseSlots = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = baseSlots.filter((hour) => now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= 10)).pop();
  let baseDate = new Date(now);

  if (baseHour === undefined) {
    baseHour = 23;
    baseDate.setDate(baseDate.getDate() - 1);
  }

  return {
    baseDate: `${baseDate.getFullYear()}${pad(baseDate.getMonth() + 1)}${pad(baseDate.getDate())}`,
    baseTime: `${pad(baseHour)}00`,
  };
};

const weatherText = (sky, pty) => {
  if (pty && pty !== "0") {
    if (pty === "1") return { status: "비", icon: "🌧️" };
    if (pty === "2") return { status: "비/눈", icon: "🌨️" };
    if (pty === "3") return { status: "눈", icon: "❄️" };
    if (pty === "4") return { status: "소나기", icon: "🌦️" };
  }
  if (sky === "3") return { status: "구름 많음", icon: "⛅" };
  if (sky === "4") return { status: "흐림", icon: "☁️" };
  return { status: "맑음", icon: "☀️" };
};

const normalizeItems = (items) => {
  const grouped = {};
  items.forEach((item) => {
    const key = `${item.fcstDate}_${item.fcstTime}`;
    grouped[key] ||= { date: item.fcstDate, time: item.fcstTime };
    grouped[key][item.category] = item.fcstValue;
  });
  return Object.values(grouped).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
};

export const fetchForecastForDay = async (lat, lon, dayOffset = 0) => {
  const { nx, ny } = toWeatherGrid(lat, lon);
  const { baseDate, baseTime } = getForecastBase();
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  const targetDate = `${target.getFullYear()}${pad(target.getMonth() + 1)}${pad(target.getDate())}`;
  const currentHour = now.getHours();
  const cacheKey = `today-forecast:${baseDate}:${baseTime}:${nx}:${ny}`;
  const url = `/weather-api/1360000/VilageFcstInfoService_2.0/getVilageFcst`
    + `?ServiceKey=${WEATHER_SERVICE_KEY}&pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

  let data;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.savedAt < WEATHER_CACHE_TTL) {
      data = cached.data;
    }
  } catch {
    data = null;
  }

  if (!data) {
    const response = await fetch(url);

    if (response.status === 429) {
      throw new Error("Weather API rate limited");
    }

    if (!response.ok) {
      throw new Error("Weather API failed");
    }

    data = await response.json();

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
      // Ignore storage failure.
    }
  }

  const items = data?.response?.body?.items?.item || [];
  const hourly = normalizeItems(Array.isArray(items) ? items : [items])
    .filter((item) => item.date === targetDate)
    .map((item) => {
      const hour = Number(item.time?.slice(0, 2) || 0);
      const text = weatherText(item.SKY, item.PTY);
      return {
        time: `${item.time?.slice(0, 2) || "00"}:${item.time?.slice(2, 4) || "00"}`,
        timeNum: hour,
        temp: item.TMP ?? "--",
        humid: item.REH ?? "--",
        wind: item.WSD ?? "0",
        rainProb: item.POP ?? "0",
        sky: item.SKY ?? "1",
        pty: item.PTY ?? "0",
        ...text,
      };
    });

  const current = hourly.find((item) => item.timeNum === currentHour)
    || hourly.find((item) => item.timeNum > currentHour)
    || hourly[0]
    || { temp: "--", humid: "--", wind: "0", rainProb: "0", status: "정보 없음", icon: "🌤️" };

  return { ...current, hourly };
};

export const fetchTodayForecast = (lat, lon) => fetchForecastForDay(lat, lon, 0);

export const reverseGeocode = async (lat, lon) => {
  const roundedLat = Number(lat).toFixed(4);
  const roundedLon = Number(lon).toFixed(4);
  const cacheKey = `reverse-geocode:${roundedLat}:${roundedLon}`;
  const cooldownKey = "reverse-geocode:cooldown";

  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.savedAt < 30 * 60 * 1000) {
      return cached.address;
    }

    const cooldown = JSON.parse(sessionStorage.getItem(cooldownKey) || "null");
    if (cooldown && Date.now() - cooldown.savedAt < 10 * 60 * 1000) {
      return cached?.address || "현재 위치";
    }
  } catch {
    // sessionStorage can fail; continue with a normal request.
  }

  try {
    const kakaoAddress = await reverseGeocodeByKakao(lat, lon);
    if (kakaoAddress) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), address: kakaoAddress }));
      } catch {
        // Ignore storage failure.
      }
      return kakaoAddress;
    }
  } catch {
    // Fall back to Nominatim when Kakao is unavailable.
  }

  try {
    const response = await fetch(
      `/nominatim/reverse?lat=${roundedLat}&lon=${roundedLon}&format=json&accept-language=ko`
    );

    if (response.status === 429) {
      try {
        sessionStorage.setItem(cooldownKey, JSON.stringify({ savedAt: Date.now() }));
      } catch {
        // Ignore storage failure.
      }
      return "현재 위치";
    }

    if (!response.ok) {
      return "현재 위치";
    }

    const data = await response.json();
    const address = data?.address || {};
    const city = address.city || address.province || address.state || address.county;
    const district = address.city_district || address.borough || address.suburb || address.town || address.county;
    const dong = address.neighbourhood || address.quarter || address.village;
    const resolved = [city, district, dong].filter(Boolean).filter((part, index, arr) => arr.indexOf(part) === index).slice(0, 3).join(" ")
      || data?.display_name
      || "현재 위치";

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), address: resolved }));
    } catch {
      // Ignore storage failure.
    }

    return resolved;
  } catch {
    return "현재 위치";
  }
};

export const buildClimateInsightFromForecast = (forecast, region = "현재 위치") => {
  const temp = Number(forecast?.temp);
  const rainProb = Number(forecast?.rainProb);
  const wind = Number(forecast?.wind);
  const humid = Number(forecast?.humid);
  const scores = [
    {
      key: "기온",
      value: Number.isFinite(temp) ? Math.max(0, Math.min(100, temp >= 33 ? 92 : temp >= 30 ? 78 : temp <= -5 ? 76 : temp <= 0 ? 58 : 22)) : 0,
      color: "#e05252",
    },
    {
      key: "강수",
      value: Number.isFinite(rainProb) ? Math.max(0, Math.min(100, rainProb)) : 0,
      color: "#4c9ed9",
    },
    {
      key: "바람",
      value: Number.isFinite(wind) ? Math.max(0, Math.min(100, Math.round(wind * 12))) : 0,
      color: "#f0b429",
    },
    {
      key: "건조",
      value: Number.isFinite(humid) ? Math.max(0, Math.min(100, 100 - humid)) : 0,
      color: "#8b6fd6",
    },
  ];
  const dominant = scores.reduce((max, item) => (item.value > max.value ? item : max), scores[0]);
  const typeMap = {
    "기온": temp <= 0 ? { title: "한파 주의", type: "한파", tag: "한파" } : { title: "더위 대비", type: "더위", tag: "더위" },
    "강수": { title: "강수 대비", type: "강수", tag: "비" },
    "바람": { title: "강풍 대비", type: "바람", tag: "바람" },
    "건조": { title: "건조 주의", type: "건조", tag: "건조" },
  };
  const selected = dominant.value >= 35 ? typeMap[dominant.key] : { title: "기후 안정", type: "안정", tag: "좋음" };
  const tips = {
    "더위": ["낮 시간 수분 섭취", "자외선 노출 줄이기", "실내 온도 점검"],
    "한파": ["외출 전 보온 확인", "빙판길 천천히 이동", "혈압 변화 주의"],
    "강수": ["우산과 미끄럼 방지 신발", "하천 주변 이동 피하기", "젖은 옷 바로 갈아입기"],
    "바람": ["간판 주변 피하기", "창문 잠금 확인", "외출 시 보행 보조 주의"],
    "건조": ["수분 섭취 늘리기", "실내 습도 유지", "호흡기 자극 주의"],
    "안정": ["가벼운 산책 가능", "수분 섭취 유지", "날씨 변화만 확인"],
  };

  return {
    ...selected,
    region,
    status: dominant.value >= 70 ? "위험" : dominant.value >= 35 ? "주의" : "좋음",
    scores,
    tips: tips[selected.type],
  };
};

export const getCurrentSeniorProfile = () => {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const getCurrentSeniorId = () => {
  const profile = getCurrentSeniorProfile();
  return profile?.senior?.id || localStorage.getItem("current_senior_id") || "";
};

export const resolveUploadUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE}${imageUrl}`;
};

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/api/uploads/profile`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Profile image upload failed");
  }

  return response.json();
};

export const fetchTodayClimateAlerts = async (seniorId) => {
  if (!seniorId) return [];
  const response = await fetch(`${API_BASE}/api/climate-alerts/senior/${seniorId}/today`);
  if (!response.ok) return [];
  const alerts = await response.json();
  return Array.isArray(alerts) ? alerts.slice(0, 6) : [];
};

export const fetchLatestClimateAlerts = async (seniorId) => {
  if (!seniorId) return [];
  const response = await fetch(`${API_BASE}/api/climate-alerts/senior/${seniorId}/latest`);
  if (!response.ok) return [];
  const alerts = await response.json();
  return Array.isArray(alerts) ? alerts.slice(0, 6) : [];
};

export const saveClimateAlert = async (alert) => {
  const response = await fetch(`${API_BASE}/api/climate-alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });

  if (!response.ok) {
    throw new Error("Climate alert save failed");
  }

  return response.json();
};

export const createSosAlert = async ({ seniorId, latitude, longitude }) => {
  const response = await fetch(`${API_BASE}/api/alerts/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude }),
  });

  if (!response.ok) {
    throw new Error("SOS alert failed");
  }

  return response.json();
};

export const createSosCancelAlert = async ({ seniorId, latitude, longitude }) => {
  const response = await fetch(`${API_BASE}/api/alerts/sos/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude }),
  });

  if (!response.ok) {
    throw new Error("SOS cancel alert failed");
  }

  return response.json();
};

export const createSafeZoneAlert = async ({ seniorId, latitude, longitude, address }) => {
  const response = await fetch(`${API_BASE}/api/alerts/safe-zone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude, address }),
  });

  if (!response.ok) {
    throw new Error("Safe zone alert failed");
  }

  return response.json();
};

export const createFallAlert = async ({ seniorId, latitude, longitude, address, score, imageUrl }) => {
  const response = await fetch(`${API_BASE}/api/alerts/fall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seniorId, latitude, longitude, address, score, imageUrl }),
  });

  if (!response.ok) {
    throw new Error("Fall alert failed");
  }

  return response.json();
};

export const getFallVideoUrl = () => `${FALL_API_BASE}/video`;

export const getFallCaptureUrl = (filename) => {
  if (!filename) return "";
  const clean = String(filename).replace(/^captures[\\/]/, "");
  return `${FALL_API_BASE}/captures/${encodeURIComponent(clean)}`;
};

export const fetchFallCaptures = async () => {
  const response = await fetch(`${FALL_API_BASE}/captures`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Fall captures failed");
  }

  const data = await response.json();
  return Array.isArray(data?.captures) ? data.captures : [];
};

export const fetchFallDetectionStatus = async () => {
  const response = await fetch(`${FALL_API_BASE}/status`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Fall detection server failed");
  }

  return response.json();
};

export const fetchActivityToday = async () => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/today`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Activity today failed");
  }

  return response.json();
};

export const fetchActivityTrend = async (days = 7) => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/trend?days=${encodeURIComponent(days)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Activity trend failed");
  }

  return response.json();
};

export const fetchFallEvents = async (days = 1) => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/falls?days=${encodeURIComponent(days)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Fall events failed");
  }

  const data = await response.json();
  return Array.isArray(data?.events) ? data.events : [];
};

export const fetchActivitySlots = async () => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/slots`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Activity slots failed");
  }

  return response.json();
};

export const fetchActivityBaseline = async (days = 14) => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/baseline?days=${encodeURIComponent(days)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Activity baseline failed");
  }

  return response.json();
};

export const fetchFallPattern = async () => {
  const response = await fetch(`${FALL_API_BASE}/health/activity/fall-pattern`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Fall pattern failed");
  }

  return response.json();
};

export const fetchSeniorAlerts = async (seniorId) => {
  if (!seniorId) return [];
  const response = await fetch(`${API_BASE}/api/alerts/senior/${seniorId}`);
  const localAlerts = getLocalSeniorAlerts(seniorId);
  if (!response.ok) return localAlerts;
  const alerts = await response.json();
  return [...(Array.isArray(alerts) ? alerts : []), ...localAlerts];
};

export const readAlert = async (alertId) => {
  if (isLocalAlertId(alertId)) {
    return markLocalAlertRead(alertId);
  }

  const response = await fetch(`${API_BASE}/api/alerts/${alertId}/read`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Alert read failed");
  }
  return response.json();
};

export const deleteAlert = async (alertId) => {
  if (isLocalAlertId(alertId)) {
    deleteLocalAlert(alertId);
    return;
  }

  const response = await fetch(`${API_BASE}/api/alerts/${alertId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Alert delete failed");
  }
};

export const deleteAlerts = async (alertIds) => {
  const localIds = alertIds.filter(isLocalAlertId);
  const serverIds = alertIds.filter((alertId) => !isLocalAlertId(alertId));

  if (localIds.length > 0) {
    deleteLocalAlerts(localIds);
  }

  if (serverIds.length === 0) return;

  const response = await fetch(`${API_BASE}/api/alerts/bulk-delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: serverIds }),
  });
  if (!response.ok) {
    throw new Error("Alert bulk delete failed");
  }
};

export const deleteOldRequestAlerts = async (seniorId) => {
  if (!seniorId) return;
  deleteOldLocalRequestAlerts(seniorId);
  const response = await fetch(`${API_BASE}/api/alerts/senior/${seniorId}/old-requests`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Old request alert cleanup failed");
  }
};

