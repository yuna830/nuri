const SENURI_SERVICE_KEY =
  import.meta.env.VITE_PUBLIC_DATA_SERVICE_KEY ||
  "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

const SEOUL_JOB_INFO_KEY = import.meta.env.VITE_SEOUL_JOB_INFO_KEY || "";

const JOB_CACHE_TTL_MS = 10 * 60 * 1000;
const jobListCache = new Map();

export const EMPL_MAP = {
  CM0101: "정규직",
  CM0102: "계약직",
  CM0103: "시간제",
  CM0104: "일당직",
  CM0105: "기타",
  J01101: "상용직",
  J01102: "계약직",
  J01103: "계약직 시간제",
  J01105: "상용직 시간제",
};

export const EMPL_COLOR = {
  CM0101: { bg: "#e8f4ea", color: "#2d7a3a" },
  CM0102: { bg: "#e8edf8", color: "#2d4a8a" },
  CM0103: { bg: "#fef3e2", color: "#8a5a00" },
  CM0104: { bg: "#fdeaea", color: "#8a2020" },
  CM0105: { bg: "#f0f0f0", color: "#555555" },
  J01101: { bg: "#e8f4ea", color: "#2d7a3a" },
  J01102: { bg: "#e8edf8", color: "#2d4a8a" },
  J01103: { bg: "#fef3e2", color: "#8a5a00" },
  J01105: { bg: "#fef3e2", color: "#8a5a00" },
};

export const JOB_CATEGORY_FILTERS = [
  { label: "전체", value: "", keywords: [] },
  { label: "환경미화", value: "환경미화", keywords: ["미화", "청소", "환경", "위생"] },
  { label: "경비·보안", value: "경비", keywords: ["경비", "보안", "안전", "주차"] },
  { label: "요양·돌봄", value: "요양", keywords: ["요양", "돌봄", "간병", "보호", "케어"] },
  { label: "사무보조", value: "사무보조", keywords: ["사무", "행정", "전산", "문서", "보조"] },
  { label: "생산·제조", value: "생산", keywords: ["생산", "제조", "공장", "조립", "포장"] },
  { label: "운전·배달", value: "운전", keywords: ["운전", "배송", "배달", "운송"] },
  { label: "조리·식품", value: "조리", keywords: ["조리", "급식", "식당", "주방", "음식"] },
  { label: "물류·유통", value: "물류", keywords: ["물류", "유통", "매장", "판매", "계산"] },
  { label: "기타", value: "기타", keywords: [] },
];

export const MATCH_SCORE_WEIGHTS = {
  category: 25,
  region: 20,
  workHours: 15,
  employment: 10,
  career: 10,
  education: 5,
  deadline: 5,
  wage: 5,
  freshness: 5,
};

const textOf = (...values) => values.filter(Boolean).join(" ");
const normalize = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
const toNumber = (value) => {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
};

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

const fetchCachedJobPostings = async () => {
  const response = await fetch("/api/job-cache");
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const saveJobPostingsToCache = async (jobs) => {
  const rows = Array.isArray(jobs)
    ? jobs.filter((job) => job?.source && job?.jobId)
    : [];

  if (rows.length === 0) return;

  await fetch("/api/job-cache/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  }).catch(() => {});
};

export const categorizeJob = (job) => {
  const text = textOf(job.recrtTitle, job.jobclsNm, job.detCnts, job.workPlcNm);
  for (const category of JOB_CATEGORY_FILTERS) {
    if (!category.keywords.length) continue;
    if (category.keywords.some((keyword) => text.includes(keyword))) return category.label;
  }
  return "기타";
};

const OUTSIDE_SEOUL_PATTERN = /경기|인천|강원|충청|충남|충북|대전|세종|전라|전남|전북|광주|경상|경남|경북|대구|부산|울산|제주/;

export const isJobRegionCompatible = (job, profile = {}) => {
  const profileText = textOf(profile?.address, profile?.region, profile?.city, profile?.district, profile?.dong);
  const jobText = textOf(job.workPlcNm, job.plDetAddr);

  if (!profileText || !jobText) return true;

  if (/서울/.test(profileText)) {
    return /서울/.test(jobText) || !OUTSIDE_SEOUL_PATTERN.test(jobText);
  }

  const regionTokens = getRegionTokens(profile);
  const normalizedJob = normalize(jobText);
  const explicitOtherRegion = /서울|경기|인천|강원|충청|충남|충북|대전|세종|전라|전남|전북|광주|경상|경남|경북|대구|부산|울산|제주/.test(jobText);

  if (!explicitOtherRegion) return true;

  return regionTokens.some((token) => normalizedJob.includes(normalize(token)));
};

export const formatDate = (dateText) => {
  if (!dateText) return "-";
  const clean = String(dateText).replace(/[^0-9]/g, "");
  if (clean.length < 8) return dateText;
  return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
};

export const isPastDate = (dateText) => {
  const clean = String(dateText || "").replace(/[^0-9]/g, "");
  if (clean.length < 8) return false;
  const date = new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isRecentDate = (dateText, days) => {
  const clean = String(dateText || "").replace(/[^0-9]/g, "");
  if (clean.length < 8) return false;
  const date = new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`);
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
};

const parseDeadlineDate = (text) => {
  const clean = String(text || "").replace(/[^0-9]/g, "");
  if (clean.length < 8) return "";
  return clean.slice(0, 8);
};

const normalizeSenuriJob = (item) => ({
  jobId: item.querySelector("jobId")?.textContent || "",
  source: "노인일자리",
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
  weekHours: "",
  workTime: "",
  career: "무관",
  education: "관계없음",
  wage: "",
  registeredAt: "",
});

export const parseJobList = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = xml.querySelectorAll("item");
  const total = xml.querySelector("totalCount")?.textContent;

  return {
    list: Array.from(items).map(normalizeSenuriJob),
    total: Number(total) || 0,
  };
};

const normalizeSeoulJob = (row) => ({
  jobId: row.JO_REQST_NO || row.JO_REGIST_NO || "",
  source: "서울일자리",
  recrtTitle: row.JO_SJ || row.JOBCODE_NM || "",
  oranNm: row.CMPNY_NM || row.MNGR_INSTT_NM || "",
  emplymShp: row.EMPLYM_STLE_CMMN_CODE_SE || "CM0105",
  emplymShpNm: row.EMPLYM_STLE_CMMN_MM || "기타",
  workPlcNm: row.WORK_PARAR_BASS_ADRES_CN || row.BASS_ADRES_CN || "",
  jobclsNm: row.JOBCODE_NM || "",
  frDd: row.JO_REG_DT ? row.JO_REG_DT.replace(/[^0-9]/g, "") : "",
  toDd: parseDeadlineDate(row.RCEPT_CLOS_NM),
  acptMthd: row.RCEPT_MTH_NM || "",
  deadline: row.RCEPT_CLOS_NM || "",
  plDetAddr: row.BASS_ADRES_CN || row.WORK_PARAR_BASS_ADRES_CN || "",
  clerkContt: row.MNGR_PHON_NO || "",
  detCnts: row.DTY_CN || row.BSNS_SUMRY_CN || "",
  clltPrnnum: row.RCRIT_NMPR_CO || "",
  weekHours: row.WEEK_WORK_HR || "",
  workTime: row.WORK_TIME_NM || "",
  career: row.CAREER_CND_NM || "",
  education: row.ACDMCR_NM || "",
  wage: row.HOPE_WAGE || row.GUI_LN || "",
  registeredAt: row.JO_REG_DT || "",
});

const fetchSenuriJobList = async (pageNo, emplymShp, numOfRows) => {
  let url = `/senuri/B552474/SenuriService/getJobList?ServiceKey=${SENURI_SERVICE_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  if (emplymShp) url += `&emplymShp=${emplymShp}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Senuri Job API failed: ${response.status}`);

  return parseJobList(await response.text());
};

const fetchSeoulJobInfo = async (pageNo, numOfRows) => {
  if (!SEOUL_JOB_INFO_KEY) return { list: [], total: 0 };

  const start = (pageNo - 1) * numOfRows + 1;
  const end = pageNo * numOfRows;
  const response = await fetch(`/seoul-openapi/${SEOUL_JOB_INFO_KEY}/json/GetJobInfo/${start}/${end}/`);
  if (!response.ok) throw new Error(`Seoul Job API failed: ${response.status}`);

  const data = await response.json();
  const body = data.GetJobInfo || {};
  const rows = Array.isArray(body.row) ? body.row : [];

  return {
    list: rows.map(normalizeSeoulJob),
    total: Number(body.list_total_count) || 0,
  };
};

export const fetchJobList = async (pageNo = 1, emplymShp = "", numOfRows = 60) => {
  const cacheKey = `combined-${pageNo}-${emplymShp}-${numOfRows}`;
  const cached = readJobCache(cacheKey);
  if (cached) return cached;

  if (pageNo === 1 && !emplymShp) {
    const dbCachedJobs = await fetchCachedJobPostings().catch(() => []);
    if (dbCachedJobs.length > 0) {
      const data = {
        list: dbCachedJobs.slice(0, numOfRows),
        total: dbCachedJobs.length,
        fromDbCache: true,
      };
      writeJobCache(cacheKey, data);
      return data;
    }
  }

  const [senuri, seoul] = await Promise.allSettled([
    fetchSenuriJobList(pageNo, emplymShp, numOfRows),
    fetchSeoulJobInfo(pageNo, numOfRows),
  ]);

  const senuriData = senuri.status === "fulfilled" ? senuri.value : { list: [], total: 0 };
  const seoulData = seoul.status === "fulfilled" ? seoul.value : { list: [], total: 0 };
  const merged = new Map();

  [...senuriData.list, ...seoulData.list].forEach((job) => {
    if (!job.jobId) return;
    merged.set(`${job.source}-${job.jobId}`, job);
  });

  const data = {
    list: Array.from(merged.values()),
    total: (senuriData.total || 0) + (seoulData.total || 0),
  };

  saveJobPostingsToCache(data.list);
  writeJobCache(cacheKey, data);
  return data;
};

export const getSavedJobProfile = () => {
  try {
    const currentSenior = sessionStorage.getItem("currentSenior");
    if (currentSenior) {
      const profile = JSON.parse(currentSenior);
      const senior = profile.senior ?? {};
      const healthInfo = profile.healthInfo ?? {};
      const jobPreference = profile.jobPreference ?? {};
      return {
        age: senior.age,
        address: senior.address || senior.region || "",
        city: senior.city || senior.sido || "",
        district: senior.district || senior.sigungu || "",
        dong: senior.dong || "",
        maxHours: healthInfo.maxHours || jobPreference.maxHours,
        maxDistance: healthInfo.maxDistance || jobPreference.maxDistance,
        restNeed: healthInfo.restNeed || "",
        avoidEnvironment: healthInfo.avoidEnvironment
          ? String(healthInfo.avoidEnvironment).split(",").filter(Boolean)
          : [],
        payType: jobPreference.payType,
        preferredCategories: jobPreference.categories || jobPreference.preferredCategories || [],
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

const getRegionTokens = (profile) => {
  const text = textOf(profile?.address, profile?.region, profile?.city, profile?.district, profile?.dong);
  return text
    .split(/\s+/)
    .map((token) => token.replace(/[^\w가-힣]/g, ""))
    .filter((token) => token.length >= 2);
};

const isPartTime = (job) => /시간제|파트|오전|오후|주간|단시간|일일/.test(textOf(job.emplymShpNm, job.workTime, job.detCnts));
const isCareerFriendly = (job) => /무관|신입|관계없음/.test(textOf(job.career, job.detCnts));
const isEducationFriendly = (job) => /관계없음|무관|학력무관/.test(textOf(job.education, job.detCnts));

export const scoreJobMatch = (job, profile = {}, selectedCategory = "") => {
  let score = 0;
  const reasons = [];
  const category = categorizeJob(job);
  const selectedLabel = JOB_CATEGORY_FILTERS.find((item) => item.value === selectedCategory)?.label || "";
  const preferredCategories = Array.isArray(profile?.preferredCategories)
    ? profile.preferredCategories
    : String(profile?.preferredCategories || "").split(",").filter(Boolean);

  if (selectedLabel && category !== selectedLabel) {
    score -= MATCH_SCORE_WEIGHTS.category;
    reasons.push("선택 직종과 다름");
  } else if (selectedLabel && category === selectedLabel) {
    score += MATCH_SCORE_WEIGHTS.category;
    reasons.push("선택한 직종과 일치");
  } else if (preferredCategories.includes(category)) {
    score += MATCH_SCORE_WEIGHTS.category;
    reasons.push("희망 직종과 일치");
  } else if (!selectedLabel && category !== "기타") {
    score += Math.round(MATCH_SCORE_WEIGHTS.category * 0.6);
    reasons.push("직종 분류가 명확함");
  }

  const regionTokens = getRegionTokens(profile);
  const jobLocation = normalize(textOf(job.workPlcNm, job.plDetAddr));
  const matchedRegion = regionTokens.find((token) => jobLocation.includes(normalize(token)));
  if (!isJobRegionCompatible(job, profile)) {
    score -= MATCH_SCORE_WEIGHTS.region;
    reasons.push("거주지와 거리가 있음");
  } else if (matchedRegion) {
    score += MATCH_SCORE_WEIGHTS.region;
    reasons.push(`${matchedRegion} 근무지`);
  } else if (/서울/.test(textOf(job.workPlcNm, job.plDetAddr))) {
    score += Math.round(MATCH_SCORE_WEIGHTS.region * 0.45);
    reasons.push("서울 지역 공고");
  }

  const maxHours = toNumber(profile?.maxHours);
  const weekHours = toNumber(job.weekHours);
  if (maxHours && weekHours && weekHours <= maxHours * 5) {
    score += MATCH_SCORE_WEIGHTS.workHours;
    reasons.push("희망 활동시간과 가까움");
  } else if (weekHours && weekHours <= 25) {
    score += Math.round(MATCH_SCORE_WEIGHTS.workHours * 0.7);
    reasons.push("주당 근무시간이 짧음");
  } else if (isPartTime(job)) {
    score += Math.round(MATCH_SCORE_WEIGHTS.workHours * 0.6);
    reasons.push("시간제 또는 단시간 근무");
  }

  if (/시간제|계약직|일당/.test(textOf(job.emplymShpNm))) {
    score += MATCH_SCORE_WEIGHTS.employment;
    reasons.push("부담이 적은 고용형태");
  }

  if (isCareerFriendly(job)) {
    score += MATCH_SCORE_WEIGHTS.career;
    reasons.push("경력 무관");
  }

  if (isEducationFriendly(job)) {
    score += MATCH_SCORE_WEIGHTS.education;
    reasons.push("학력 제한 없음");
  }

  if (job.toDd && !isPastDate(job.toDd)) {
    score += MATCH_SCORE_WEIGHTS.deadline;
    reasons.push("접수 가능");
  }

  if (job.wage || /시급|월급|일급|원/.test(textOf(job.detCnts))) {
    score += MATCH_SCORE_WEIGHTS.wage;
    reasons.push("급여 정보 있음");
  }

  if (job.frDd && isRecentDate(job.frDd, 14)) {
    score += MATCH_SCORE_WEIGHTS.freshness;
    reasons.push("최근 등록 공고");
  }

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 3),
  };
};
