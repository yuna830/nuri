import { sendWelfareSeniorAlert } from "./welfareAlertApi";
import { fetchJobList as fetchCombinedJobList } from "../utils/user/jobApi";

export const EMPL_MAP = {
    CM0101: "정규직",
    CM0102: "계약직",
    CM0103: "시간제",
    CM0104: "일당직",
    CM0105: "기타",
};

export const JOB_CATEGORY_FILTERS = [
    { label: "전체", value: "", keywords: [] },
    { label: "환경미화", value: "환경미화", keywords: ["미화", "청소", "환경"] },
    { label: "경비·보안", value: "경비", keywords: ["경비", "보안", "안전"] },
    { label: "요양·돌봄", value: "요양", keywords: ["요양", "돌봄", "간병", "보호"] },
    { label: "사무보조", value: "사무보조", keywords: ["사무", "행정", "전산", "문서"] },
    { label: "생산·제조", value: "생산", keywords: ["생산", "제조", "포장", "조립"] },
    { label: "운전·배달", value: "운전", keywords: ["운전", "배송", "배달", "운송"] },
    { label: "조리·식품", value: "조리", keywords: ["조리", "급식", "식당", "주방"] },
    { label: "물류·유통", value: "물류", keywords: ["물류", "유통", "매장", "판매"] },
    { label: "기타", value: "기타", keywords: [] },
];

export const categorizeJob = (job) => {
    const text = `${job.recrtTitle || ""} ${job.jobclsNm || ""} ${job.detCnts || ""}`;

    for (const category of JOB_CATEGORY_FILTERS) {
        if (!category.keywords.length) continue;
        if (category.keywords.some((keyword) => text.includes(keyword))) {
            return category.label;
        }
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
            source: "senuri",
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

export const fetchWelfareJobList = async (pageNo = 1, emplymShp = "", numOfRows = 60) => {
    return fetchCombinedJobList(pageNo, emplymShp, numOfRows);
};

export const fetchWelfareJobApplications = async (welfareWorkerId) => {
    const params = new URLSearchParams();
    if (welfareWorkerId) params.set("welfareWorkerId", welfareWorkerId);

    const response = await fetch(`/api/job-interests/welfare${params.toString() ? `?${params}` : ""}`);

    if (!response.ok) {
        throw new Error("Failed to load welfare job applications");
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};

export const updateWelfareJobApplicationStatus = async (id, status) => {
    const response = await fetch(`/api/job-interests/${id}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        throw new Error("Failed to update job application status");
    }

    return response.json();
};

export const recommendWelfareJobToSenior = async ({ seniorId, job }) => {
    const response = await fetch("/api/job-interests", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            seniorId: Number(seniorId),
            jobId: job.jobId,
            jobTitle: job.recrtTitle,
            company: job.oranNm,
            location: job.workPlcNm,
            applicationType: "RECOMMEND",
            status: "검토 대기",
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to recommend welfare job");
    }

    const result = await response.json();

    const alertResult = await sendWelfareSeniorAlert({
        seniorId,
        type: "JOB_RECOMMEND",
        title: "일자리 추천",
        message: `${job.recrtTitle || "추천 일자리"} 공고를 담당 복지사가 추천했습니다.`,
        extra: {
            jobId: job.jobId,
            jobTitle: job.recrtTitle,
            company: job.oranNm,
            location: job.workPlcNm,
        },
    }).catch(() => null);

    return {
        ...result,
        alertSent: Boolean(alertResult),
    };
};

export const fetchSeniorJobApplications = async (seniorId) => {
    if (!seniorId) return [];

    const response = await fetch(`/api/job-interests/senior/${seniorId}`);

    if (!response.ok) {
        throw new Error("Failed to load senior job applications");
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};
