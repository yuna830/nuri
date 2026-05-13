const SERVICE_KEY =
  "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

const JOB_CACHE_TTL_MS = 10 * 60 * 1000;
const jobListCache = new Map();

export const EMPL_MAP = {
  CM0101: "정규직",
  CM0102: "계약직",
  CM0103: "시간제",
  CM0104: "일당직",
  CM0105: "기타",
};

export const EMPL_COLOR = {
  CM0101: { bg: "#e8f4ea", color: "#2d7a3a" },
  CM0102: { bg: "#e8edf8", color: "#2d4a8a" },
  CM0103: { bg: "#fef3e2", color: "#8a5a00" },
  CM0104: { bg: "#fdeaea", color: "#8a2020" },
  CM0105: { bg: "#f0f0f0", color: "#555555" },
};

export const JOB_CATEGORY_FILTERS = [
  { label: "전체", value: "", keywords: [] },
  { label: "환경미화", value: "환경미화", keywords: ["미화", "청소", "환경"] },
  { label: "경비·보안", value: "경비", keywords: ["경비", "보안", "안전"] },
  { label: "요양·돌봄", value: "요양", keywords: ["요양", "돌봄", "간병", "보호"] },
  { label: "사무보조", value: "사무보조", keywords: ["사무", "행정", "전산", "문서"] },
  { label: "생산·제조", value: "생산", keywords: ["생산", "제조", "포장", "조립"] },
  { label: "운전·배달", value: "운전", keywords: ["운전", "배송", "배달", "택배"] },
  { label: "조리·식품", value: "조리", keywords: ["조리", "급식", "식당", "주방"] },
  { label: "물류·유통", value: "물류", keywords: ["물류", "유통", "매장", "판매"] },
  { label: "기타", value: "기타", keywords: [] },
];

const readJobCache = (cacheKey) => {
  const memoryCached = jobListCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.savedAt < JOB_CACHE_TTL_MS) {
    return memoryCached.data;
  }

  try {
    const cached = JSON.parse(sessionStorage.getItem(`job-list:${cacheKey}`) || "null");
    if (cached && Date.now() - cached.savedAt < JOB_CACHE_TTL_MS) {
      jobListCache.set(cacheKey, cached);
      return cached.data;
    }
  } catch {
    // Cache is optional.
  }

  return null;
};

const writeJobCache = (cacheKey, data) => {
  const cached = { savedAt: Date.now(), data };
  jobListCache.set(cacheKey, cached);

  try {
    sessionStorage.setItem(`job-list:${cacheKey}`, JSON.stringify(cached));
  } catch {
    // Ignore storage failure.
  }
};

export const categorizeJob = (job) => {
  const text = `${job.recrtTitle || ""} ${job.jobclsNm || ""} ${job.detCnts || ""}`;
  for (const category of JOB_CATEGORY_FILTERS) {
    if (!category.keywords.length) continue;
    if (category.keywords.some((keyword) => text.includes(keyword))) return category.label;
  }
  return "기타";
};

export const formatDate = (dateText) => {
  if (!dateText || dateText.length < 8) return "-";
  return `${dateText.slice(0, 4)}.${dateText.slice(4, 6)}.${dateText.slice(6, 8)}`;
};

export const parseJobList = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = xml.querySelectorAll("item");
  const total = xml.querySelector("totalCount")?.textContent;

  return {
    list: Array.from(items).map((item) => ({
      jobId: item.querySelector("jobId")?.textContent || "",
      recrtTitle: item.querySelector("recrtTitle")?.textContent || "",
      oranNm: item.querySelector("oranNm")?.textContent || "",
      emplymShp: item.querySelector("emplymShp")?.textContent || "CM0105",
      emplymShpNm: item.querySelector("emplymShpNm")?.textContent || "기타",
      workPlcNm: item.querySelector("workPlcNm")?.textContent || "",
      jobclsNm: item.querySelector("jobclsNm")?.textContent || "",
      frDd: item.querySelector("frDd")?.textContent || "",
      toDd: item.querySelector("toDd")?.textContent || "",
      acptMthd: item.querySelector("acptMthd")?.textContent || "",
      deadline: item.querySelector("deadline")?.textContent || "",
      plDetAddr: item.querySelector("plDetAddr")?.textContent || "",
      clerkContt: item.querySelector("clerkContt")?.textContent || "",
      detCnts: item.querySelector("detCnts")?.textContent || "",
      clltPrnnum: item.querySelector("clltPrnnum")?.textContent || "",
    })),
    total: Number(total) || 0,
  };
};

export const fetchJobList = async (pageNo = 1, emplymShp = "", numOfRows = 60) => {
  const cacheKey = `${pageNo}-${emplymShp}-${numOfRows}`;
  const cached = readJobCache(cacheKey);
  if (cached) return cached;

  let url = `/senuri/B552474/SenuriService/getJobList?ServiceKey=${SERVICE_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  if (emplymShp) url += `&emplymShp=${emplymShp}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Job API failed: ${response.status}`);
  }

  const text = await response.text();
  const data = parseJobList(text);
  writeJobCache(cacheKey, data);
  return data;
};

export const getSavedJobProfile = () => {
  try {
    const currentSenior = sessionStorage.getItem("currentSenior");
    if (currentSenior) {
      const profile = JSON.parse(currentSenior);
      const healthInfo = profile.healthInfo ?? {};
      const jobPreference = profile.jobPreference ?? {};
      return {
        age: profile.senior?.age,
        maxHours: healthInfo.maxHours,
        maxDistance: healthInfo.maxDistance,
        payType: jobPreference.payType,
        hopeDays: jobPreference.hopeDays
          ? String(jobPreference.hopeDays).split(",").filter(Boolean)
          : [],
      };
    }

    const saved = localStorage.getItem("user_profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};
