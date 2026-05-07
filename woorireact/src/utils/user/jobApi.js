const SERVICE_KEY =
  "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

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

export const FILTERS = [
  { label: "전체", value: "" },
  { label: "정규직", value: "CM0101" },
  { label: "계약직", value: "CM0102" },
  { label: "시간제", value: "CM0103" },
  { label: "일당직", value: "CM0104" },
];

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

export const fetchJobList = async (pageNo = 1, emplymShp = "") => {
  let url = `/senuri/B552474/SenuriService/getJobList?ServiceKey=${SERVICE_KEY}&pageNo=${pageNo}&numOfRows=12`;

  if (emplymShp) {
    url += `&emplymShp=${emplymShp}`;
  }

  const response = await fetch(url);
  const text = await response.text();

  return parseJobList(text);
};

export const getSavedJobProfile = () => {
  try {
    const currentSenior = sessionStorage.getItem("currentSenior");

    if (currentSenior) {
      const profile = JSON.parse(currentSenior);
      const healthInfo = profile.healthInfo ?? {};
      const jobPreference = profile.jobPreference ?? {};

      return {
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
