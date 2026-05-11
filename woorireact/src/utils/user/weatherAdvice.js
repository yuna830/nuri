import { reverseGeocodeByKakao } from "../../api/kakaoLocalApi.js";

export const getWeatherItems = (temp, pty, wsd, humid) => {
  const items = [];
  const t = parseFloat(temp);
  const wind = parseFloat(wsd || 0);
  const h = parseFloat(humid || 0);

  if (t <= 4) items.push({ icon: "🧥", label: "패딩 필수", category: "옷차림" });
  else if (t <= 8) items.push({ icon: "🧥", label: "두꺼운 코트", category: "옷차림" });
  else if (t <= 11) items.push({ icon: "🧥", label: "트렌치코트/야상", category: "옷차림" });
  else if (t <= 16) items.push({ icon: "👕", label: "자켓·가디건", category: "옷차림" });
  else if (t <= 19) items.push({ icon: "👔", label: "긴팔·가디건", category: "옷차림" });
  else if (t <= 22) items.push({ icon: "👕", label: "긴팔 셔츠", category: "옷차림" });
  else if (t <= 27) items.push({ icon: "👕", label: "반팔", category: "옷차림" });
  else items.push({ icon: "🧢", label: "얇고 시원한 옷", category: "옷차림" });

  if (t <= 5) items.push({ icon: "🧤", label: "장갑 착용", category: "준비물" });
  if (pty === "1" || pty === "4") items.push({ icon: "☂️", label: "우산 필수", category: "준비물" });
  if (pty === "2" || pty === "3") items.push({ icon: "🥾", label: "미끄럼 방지 신발", category: "준비물" });
  if (wind >= 9) items.push({ icon: "🧣", label: "강풍 주의", category: "주의" });
  else if (wind >= 5) items.push({ icon: "🧥", label: "바람막이 추천", category: "옷차림" });
  if (pty === "0" && t >= 20) items.push({ icon: "🧴", label: "선크림 필수", category: "준비물" });
  if (pty === "0" && t >= 25) items.push({ icon: "👒", label: "모자 추천", category: "준비물" });
  if (h < 40) items.push({ icon: "😷", label: "마스크/보습", category: "준비물" });

  return items;
};

export const getHealthItems = (profile, temp, pty) => {
  if (!profile) return [];

  const items = [];
  const t = parseFloat(temp);

  if (profile.joint && profile.joint !== "없음" && (t <= 10 || pty === "1")) {
    items.push({ icon: "🦵", label: "무릎·관절 보온", category: "건강" });
  }

  if (profile.lung && profile.lung !== "없음" && t <= 5) {
    items.push({ icon: "🫁", label: "찬 공기 주의·마스크", category: "건강" });
  }

  if (profile.heart && profile.heart !== "없음" && t <= 5) {
    items.push({ icon: "❤️", label: "갑작스러운 추위 주의", category: "건강" });
  }

  if (profile.diabetes && profile.diabetes !== "없음" && t >= 30) {
    items.push({ icon: "🩸", label: "고온 혈당 관리 주의", category: "건강" });
  }

  if (t <= 3) {
    items.push({ icon: "⚠️", label: "낙상 주의·외출 자제", category: "건강" });
  }

  return items;
};

const PUBLIC_DATA_SERVICE_KEY =
  import.meta.env.VITE_PUBLIC_DATA_SERVICE_KEY ||
  "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

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
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch {
    // ignore
  }
};

const fetchJsonWithCache = async (
  url,
  cacheKey,
  ttl = CACHE_TTL
) => {
  const cached = readCache(cacheKey);

  // 정상 캐시 사용
  if (cached && Date.now() - cached.savedAt < ttl) {
    return cached.data;
  }

  // AirKorea 전체 cooldown
  if (cacheKey.startsWith("weather:air")) {
    const globalCooldown = readCache(
      "weather:air:globalCooldown"
    );

    if (
      globalCooldown &&
      Date.now() - globalCooldown.savedAt <
        RATE_LIMIT_COOLDOWN
    ) {
      console.warn("AirKorea cooldown active");
      return cached?.data ?? null;
    }
  }

  try {
    const response = await fetch(url);

    // 429 대응
    if (response.status === 429) {
      console.warn("AirKorea rate limit hit");

      if (cacheKey.startsWith("weather:air")) {
        writeCache(
          "weather:air:globalCooldown",
          true
        );
      }

      return cached?.data ?? null;
    }

    if (!response.ok) {
      console.error("API Error:", response.status);
      return cached?.data ?? null;
    }

    const data = await response.json();

    writeCache(cacheKey, data);

    return data;
  } catch (err) {
    console.error("Fetch Error:", err);
    return cached?.data ?? null;
  }
};

const uvLevel = (value) => {
  if (value >= 11) return "위험";
  if (value >= 8) return "매우높음";
  if (value >= 6) return "높음";
  if (value >= 3) return "보통";
  return "낮음";
};

export const fetchUVIndex = async () => {
  const now = new Date();

  const pad = (n) => String(n).padStart(2, "0");

  const areaNo = "1100000000";

  const time =
    `${now.getFullYear()}`
    + `${pad(now.getMonth() + 1)}`
    + `${pad(now.getDate())}`
    + `${pad(now.getHours())}`;

  const url =
    `/weather-api/1360000/LivingWthrIdxServiceV4/getUVIdxV4`
    + `?ServiceKey=${PUBLIC_DATA_SERVICE_KEY}`
    + `&pageNo=1`
    + `&numOfRows=10`
    + `&dataType=JSON`
    + `&areaNo=${areaNo}`
    + `&time=${time}`;

  const data = await fetchJsonWithCache(
    url,
    `weather:uv:${areaNo}:${time}`
  );

  const item =
    data?.response?.body?.items?.item?.[0];

  if (!item) return null;

  const value = parseInt(
    item.h0 || item.h3 || 0,
    10
  );

  return {
    value,
    level: uvLevel(value),
  };
};

const pm10Level = (value) => {
  if (value <= 30) return "좋음";
  if (value <= 80) return "보통";
  if (value <= 150) return "나쁨";
  return "매우나쁨";
};

const pm25Level = (value) => {
  if (value <= 15) return "좋음";
  if (value <= 35) return "보통";
  if (value <= 75) return "나쁨";
  return "매우나쁨";
};

const extractDistrictStation = async (
  lat,
  lon
) => {
  try {
    const address =
      await reverseGeocodeByKakao(lat, lon);

    const district =
      address.match(/([가-힣]+구)/)?.[1];

    return district || "중구";
  } catch {
    return "중구";
  }
};

const parseAirItem = (data) => {
  const item =
    data?.response?.body?.items?.[0];

  if (!item) return null;

  const pm10 = parseInt(item.pm10Value, 10);
  const pm25 = parseInt(item.pm25Value, 10);

  if (
    Number.isNaN(pm10) ||
    Number.isNaN(pm25)
  ) {
    return null;
  }

  return {
    pm10: {
      value: pm10,
      level: pm10Level(pm10),
    },
    pm25: {
      value: pm25,
      level: pm25Level(pm25),
    },
  };
};

export const fetchAirQuality = async (
  lat,
  lon
) => {
  const primaryStation =
    await extractDistrictStation(lat, lon);

  // 시도 전체 조회
  const sidoUrl =
    `/airkorea/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty`
    + `?serviceKey=${PUBLIC_DATA_SERVICE_KEY}`
    + `&returnType=json`
    + `&numOfRows=100`
    + `&pageNo=1`
    + `&sidoName=${encodeURIComponent("서울")}`
    + `&ver=1.3`;

  const sidoData =
    await fetchJsonWithCache(
      sidoUrl,
      "weather:air:sido:seoul"
    );

  const sidoItems =
    sidoData?.response?.body?.items;

  // 시도 데이터에서 바로 찾기
  if (Array.isArray(sidoItems)) {
    const matchedItem =
      sidoItems.find(
        (item) =>
          item.stationName === primaryStation
      ) ||
      sidoItems.find((item) =>
        item.stationName?.includes(
          primaryStation.replace("구", "")
        )
      ) ||
      sidoItems.find((item) =>
        item.addr?.includes(primaryStation)
      ) ||
      sidoItems.find(
        (item) =>
          item.pm10Value !== "-" &&
          item.pm25Value !== "-"
      );

    const parsed = parseAirItem({
      response: {
        body: {
          items: matchedItem
            ? [matchedItem]
            : [],
        },
      },
    });

    if (parsed) {
      return {
        station:
          matchedItem.stationName ||
          primaryStation,
        ...parsed,
      };
    }
  }

  // fallback 최소화
  const stations = [
    ...new Set([
      primaryStation,
      "중구",
    ]),
  ];

  for (const station of stations) {
    const airUrl =
      `/airkorea/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty`
      + `?serviceKey=${PUBLIC_DATA_SERVICE_KEY}`
      + `&returnType=json`
      + `&numOfRows=1`
      + `&pageNo=1`
      + `&stationName=${encodeURIComponent(
          station
        )}`
      + `&dataTerm=DAILY`
      + `&ver=1.3`;

    const airData =
      await fetchJsonWithCache(
        airUrl,
        `weather:air:${station}`
      );

    const parsed = parseAirItem(airData);

    if (parsed) {
      return {
        station,
        ...parsed,
      };
    }
  }

  return null;
};

const pollenLevel = (value) => {
  if (value >= 4) {
    return {
      text: "매우높음",
      value: 4,
    };
  }

  if (value >= 3) {
    return {
      text: "높음",
      value: 3,
    };
  }

  if (value >= 2) {
    return {
      text: "보통",
      value: 2,
    };
  }

  return {
    text: "낮음",
    value: 1,
  };
};

export const fetchPollenIndex = async () => {
  const now = new Date();

  const pad = (n) => String(n).padStart(2, "0");

  const time =
    `${now.getFullYear()}`
    + `${pad(now.getMonth() + 1)}`
    + `${pad(now.getDate())}`
    + `${pad(now.getHours())}`;

  const areaNo = "1100000000";

  const [pineRes, oakRes, weedsRes] =
    await Promise.all([
      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getPinePollenRiskIdxV3`
          + `?ServiceKey=${PUBLIC_DATA_SERVICE_KEY}`
          + `&pageNo=1`
          + `&numOfRows=10`
          + `&dataType=JSON`
          + `&areaNo=${areaNo}`
          + `&time=${time}`,
        `weather:pollen:pine:${areaNo}:${time}`
      ),

      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getOakPollenRiskIdxV3`
          + `?ServiceKey=${PUBLIC_DATA_SERVICE_KEY}`
          + `&pageNo=1`
          + `&numOfRows=10`
          + `&dataType=JSON`
          + `&areaNo=${areaNo}`
          + `&time=${time}`,
        `weather:pollen:oak:${areaNo}:${time}`
      ),

      fetchJsonWithCache(
        `/health/1360000/HealthWthrIdxServiceV3/getWeedsPollenRiskndxV3`
          + `?ServiceKey=${PUBLIC_DATA_SERVICE_KEY}`
          + `&pageNo=1`
          + `&numOfRows=10`
          + `&dataType=JSON`
          + `&areaNo=${areaNo}`
          + `&time=${time}`,
        `weather:pollen:weeds:${areaNo}:${time}`
      ),
    ]);

  const parseItem = (data) => {
    const item =
      data?.response?.body?.items?.item?.[0];

    if (!item) return null;

    const value = parseInt(
      item.today || item.h0 || 1,
      10
    );

    return pollenLevel(value);
  };

  const result = {};

  const pine = parseItem(pineRes);
  const oak = parseItem(oakRes);
  const weeds = parseItem(weedsRes);

  if (pine) result.pine = pine;
  if (oak) result.oak = oak;
  if (weeds) result.weeds = weeds;

  return Object.keys(result).length > 0
    ? result
    : null;
};