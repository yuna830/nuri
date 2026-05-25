import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";

import {
    EMPL_MAP,
    JOB_CATEGORY_FILTERS,
    categorizeJob,
    fetchWelfareJobList,
    formatDate,
    recommendWelfareJobToSenior,
} from "../../api/welfareJobApi";
import { fetchWelfareSeniorDetail, fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import WelfarePolicyQaButton from "../../components/welfare/WelfarePolicyQaButton";
import { isSeniorFriendlyJob } from "../../utils/job/seniorJobFilter";


import "../../css/welfare/WelfareJobPostings.css";

const PAGE_SIZE = 20;
const API_PAGE_SIZE = 200;
const MAX_JOB_COUNT = 200;
const RECOMMENDATION_LIMIT = 5;
const RECOMMENDATION_CANDIDATE_LIMIT = 80;

const numberFrom = (value) => {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : null;
};

const jobText = (job) => [
    job?.recrtTitle,
    job?.oranNm,
    job?.workPlcNm,
    job?.jobclsNm,
    job?.emplymShpNm,
    job?.detCnts,
].filter(Boolean).join(" ");

const includesAny = (text, keywords) =>
    keywords.some((keyword) => String(text || "").includes(keyword));

const REGION_PATTERN = /(서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|대전|대구|부산|울산|광주|세종|제주)/;

const compactText = (values) =>
    values
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

const extractRegionName = (text) => {
    const match = String(text || "").match(REGION_PATTERN);
    return match ? match[1] : "";
};

const getJobRegion = (job) =>
    extractRegionName(compactText([job?.workPlcNm, job?.recrtTitle, job?.oranNm, job?.plDetAddr]));

const getSeniorRegion = (senior) =>
    extractRegionName(compactText([
        senior?.region,
        senior?.address,
        senior?.senior?.region,
        senior?.senior?.address,
    ]));

const getDistanceNotice = (job, senior) => {
    const jobRegion = getJobRegion(job);
    const seniorRegion = getSeniorRegion(senior);

    if (jobRegion && seniorRegion && jobRegion !== seniorRegion) {
        return `${seniorRegion} 기준 ${jobRegion} 장거리`;
    }

    return "";
};

const inferCommuteLevel = (job, senior) => {
    const jobRegion = getJobRegion(job);
    const seniorRegion = getSeniorRegion(senior);

    if (jobRegion && seniorRegion && jobRegion !== seniorRegion) {
        return "타지역 장거리";
    }

    if (jobRegion && seniorRegion && jobRegion === seniorRegion) {
        return "도보 30분 이내";
    }

    return "대중교통 30분 이내";
};

const inferDailyHours = (job) => {
    const textHour = numberFrom(job.workTime || job.detCnts);
    if (textHour) return String(Math.min(textHour, 8));
    return "3";
};

const inferWorkEnvironment = (job) => {
    const text = jobText(job);
    const outdoor = includesAny(text, ["야외", "공원", "환경", "청소", "미화", "경비", "순찰", "배달"]);
    const indoor = includesAny(text, ["실내", "사무", "문서", "센터", "도서관", "요양", "돌봄", "주방"]);

    if (indoor && outdoor) return "혼합";
    if (outdoor) return "야외";
    return "실내";
};

const inferPhysicalIntensity = (job) => {
    const text = jobText(job);

    if (includesAny(text, ["무거운", "상하차", "운반", "배송", "배달", "계단"])) {
        return "높음";
    }

    if (includesAny(text, ["청소", "미화", "경비", "순찰", "조리", "주방", "환경"])) {
        return "중간";
    }

    return "낮음";
};

const inferTaskTags = (job) => {
    const text = jobText(job);
    const tags = [];

    if (includesAny(text, ["오래", "서서", "입식", "장시간"])) tags.push("장시간 서있기");
    if (includesAny(text, ["무거운", "상하차", "운반"])) tags.push("무거운 물건 운반");
    if (includesAny(text, ["계단"])) tags.push("계단 이동");
    if (includesAny(text, ["순찰", "배달", "외근", "이동"])) tags.push("이동 많음");
    if (includesAny(text, ["안내", "응대", "민원"])) tags.push("고객 응대");
    if (includesAny(text, ["문서", "정리", "자료"])) tags.push("문서 정리");

    return tags;
};

const getRegionNotice = (job) => {
    const text = compactText([job.workPlcNm, job.recrtTitle, job.oranNm, job.plDetAddr]);
    const region = getJobRegion(job);

    if (region) return `${region} 지역 공고`;

    const firstRegion = text.split(/\s+/)[0];
    return firstRegion ? `${firstRegion.replace(/특별시|광역시|특별자치도|도$/, "")} 지역 공고` : "지역 조건 확인";
};

const isMeaningfulHealthValue = (value) => {
    const text = String(value || "").trim();
    if (!text) return false;

    return !["없음", "정상", "미입력", "해당 없음", "-", "0"].some((emptyText) =>
        text.includes(emptyText)
    );
};

const getHealthValue = (senior, keys) => {
    for (const key of keys) {
        const value = senior?.healthInfo?.[key] ?? senior?.[key];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }

    return "";
};

const buildHealthConditionChips = (senior, job) => {
    const chips = [];
    const healthStatus = getHealthValue(senior, ["healthStatus"]);
    const jointDisease = getHealthValue(senior, ["jointDisease", "joint", "diseaseInfo"]);
    const walkingStatus = getHealthValue(senior, ["walkingStatus", "walkingAid", "maxDistance"]);
    const maxHours = getHealthValue(senior, ["maxHours", "preferredWorkTime"]);
    const recentFall = getHealthValue(senior, ["recentFall"]);
    const vision = getHealthValue(senior, ["vision"]);
    const hearing = getHealthValue(senior, ["hearing"]);
    const intensity = inferPhysicalIntensity(job);
    const environment = inferWorkEnvironment(job);

    if (healthStatus) chips.push(`건강 ${healthStatus}`);
    if (isMeaningfulHealthValue(jointDisease)) chips.push(jointDisease.includes("관절") ? jointDisease : `관절 ${jointDisease}`);
    if (isMeaningfulHealthValue(walkingStatus)) chips.push(walkingStatus);
    if (maxHours) chips.push(maxHours.includes("시간") ? maxHours : `하루 ${maxHours}시간`);
    if (isMeaningfulHealthValue(recentFall)) chips.push("낙상 이력 고려");
    if (isMeaningfulHealthValue(vision)) chips.push(`시각 ${vision}`);
    if (isMeaningfulHealthValue(hearing)) chips.push(`청각 ${hearing}`);
    if (intensity !== "높음") chips.push(`${intensity} 강도 업무`);
    if (environment !== "야외") chips.push(`${environment} 근무`);

    return [...new Set(chips)].slice(0, 5);
};

const toMatchingCandidate = (job, isExpired, senior) => ({
    jobId: job.jobId,
    title: job.recrtTitle || "",
    organization: job.oranNm || "",
    jobType: categorizeJob(job),
    workEnvironment: inferWorkEnvironment(job),
    physicalIntensity: inferPhysicalIntensity(job),
    dailyHours: inferDailyHours(job),
    commuteLevel: inferCommuteLevel(job, senior),
    taskTags: inferTaskTags(job),
    closed: isExpired(job),
    workDays: [],
    workCondition: [job.workPlcNm, job.detCnts, job.workTime, job.emplymShpNm, job.acptMthd].filter(Boolean).join(" "),
});

function WelfareJobPostings() {
    const { id: routeSeniorId } = useParams();
    const [jobs, setJobs] = useState([]);
    const [activeCategory, setActiveCategory] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [hideClosedJobs, setHideClosedJobs] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedJob, setSelectedJob] = useState(null);
    const [recommendMode, setRecommendMode] = useState(false);
    const [recommendKeyword, setRecommendKeyword] = useState("");
    const [selectedSeniorId, setSelectedSeniorId] = useState("");
    const [welfareSeniors, setWelfareSeniors] = useState([]);
    const [targetSenior, setTargetSenior] = useState(null);
    const [recommendedJobs, setRecommendedJobs] = useState([]);
    const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
    const [recommendationError, setRecommendationError] = useState("");
    const isRecommendationPage = Boolean(routeSeniorId);

    const isExpired = useCallback((job) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (job.toDd) {
            const endDate = new Date(
                `${job.toDd.substring(0, 4)}-${job.toDd.substring(4, 6)}-${job.toDd.substring(6, 8)}`
            );

            if (endDate < today) {
                return true;
            }
        }

        return job.deadline === "마감";
    }, []);

    const matchesCategory = useCallback((job) => {
        if (!activeCategory) return true;

        const selectedCategory = JOB_CATEGORY_FILTERS.find(
            (item) => item.value === activeCategory
        );

        if (!selectedCategory?.keywords?.length) {
            return categorizeJob(job) === "기타";
        }

        return (
            categorizeJob(job) === selectedCategory.label ||
            selectedCategory.keywords.some((keyword) =>
                job.recrtTitle?.includes(keyword) ||
                job.jobclsNm?.includes(keyword) ||
                job.detCnts?.includes(keyword)
            )
        );
    }, [activeCategory]);

    const matchesSearch = useCallback((job) => {
        const keyword = searchKeyword.trim();

        if (!keyword) return true;

        return (
            job.recrtTitle?.includes(keyword) ||
            job.oranNm?.includes(keyword) ||
            job.workPlcNm?.includes(keyword) ||
            job.jobclsNm?.includes(keyword)
        );
    }, [searchKeyword]);

    const filterJobs = useCallback((list) => {
        return list.filter((job) => {
            if (!isSeniorFriendlyJob(job)) return false;
            if (hideClosedJobs && isExpired(job)) return false;
            return matchesCategory(job) && matchesSearch(job);
        });
    }, [hideClosedJobs, isExpired, matchesCategory, matchesSearch]);

    const filteredJobs = useMemo(() => filterJobs(jobs), [jobs, filterJobs]);
    const visibleJobs = filteredJobs.slice(0, visibleCount);
    const hasMoreVisible = filteredJobs.length > visibleCount;
    const displayJobs = isRecommendationPage ? recommendedJobs : visibleJobs;

    const categoryCounts = useMemo(() => {
        return JOB_CATEGORY_FILTERS.reduce((counts, category) => {
            counts[category.value] = filterJobs(jobs.filter((job) => {
                if (!category.value) return true;

                const selectedCategory = JOB_CATEGORY_FILTERS.find(
                    (item) => item.value === category.value
                );

                if (!selectedCategory?.keywords?.length) {
                    return categorizeJob(job) === "기타";
                }

                return (
                    categorizeJob(job) === selectedCategory.label ||
                    selectedCategory.keywords.some((keyword) =>
                        job.recrtTitle?.includes(keyword) ||
                        job.jobclsNm?.includes(keyword) ||
                        job.detCnts?.includes(keyword)
                    )
                );
            })).length;

            return counts;
        }, {});
    }, [filterJobs, jobs]);

    const loadInitialJobs = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");

        try {
            const result = await fetchWelfareJobList(1, "", API_PAGE_SIZE);
            const merged = new Map();

            (result.list || []).forEach((job) => {
                if (job.jobId) {
                    merged.set(job.jobId, job);
                }
            });

            const limitedJobs = Array.from(merged.values())
                .filter(isSeniorFriendlyJob)
                .slice(0, MAX_JOB_COUNT);

            setJobs(limitedJobs);
            setTotalCount(limitedJobs.length);
            setVisibleCount(PAGE_SIZE);
        } catch {
            setLoadError("일자리 공고를 불러오지 못했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInitialJobs();
    }, [loadInitialJobs]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [activeCategory, searchKeyword, hideClosedJobs]);

    useEffect(() => {
        if (!isRecommendationPage) {
            setTargetSenior(null);
            setRecommendedJobs([]);
            setRecommendationError("");
            return;
        }

        let ignore = false;

        fetchWelfareSeniorDetail(routeSeniorId)
            .then((data) => {
                if (ignore) return;
                const senior = data?.senior
                    ? { ...data.senior, healthInfo: data.healthInfo, jobPreference: data.jobPreference }
                    : data;
                setTargetSenior(senior);
            })
            .catch(() => {
                if (!ignore) setTargetSenior(null);
            });

        return () => {
            ignore = true;
        };
    }, [isRecommendationPage, routeSeniorId]);

    useEffect(() => {
        if (!isRecommendationPage || isLoading) return;

        if (!targetSenior) {
            setRecommendedJobs([]);
            return;
        }

        if (filteredJobs.length === 0) {
            setRecommendedJobs([]);
            return;
        }

        const controller = new AbortController();

        const loadRecommendations = async () => {
            setIsRecommendationLoading(true);
            setRecommendationError("");

            try {
                const candidateJobs = filteredJobs.slice(0, RECOMMENDATION_CANDIDATE_LIMIT);
                const response = await fetch(`/api/job-matching/seniors/${routeSeniorId}/recommendations`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        limit: RECOMMENDATION_LIMIT,
                        jobs: candidateJobs.map((job) => toMatchingCandidate(job, isExpired, targetSenior)),
                    }),
                });

                if (!response.ok) {
                    throw new Error(`recommendation failed: ${response.status}`);
                }

                const data = await response.json();
                const jobsById = new Map(candidateJobs.map((job) => [String(job.jobId), job]));
                const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
                const nextRecommendedJobs = recommendations
                    .map((recommendation) => {
                        const original = jobsById.get(String(recommendation.jobId));
                        if (!original) return null;

                        return {
                            ...original,
                            match: {
                                score: Number(recommendation.score) || 0,
                                grade: recommendation.grade || "검토",
                                reasons: Array.isArray(recommendation.reasons) ? recommendation.reasons : [],
                                warnings: Array.isArray(recommendation.warnings) ? recommendation.warnings : [],
                            },
                        };
                    })
                    .filter(Boolean);

                setRecommendedJobs(nextRecommendedJobs);
            } catch (error) {
                if (error.name === "AbortError") return;
                setRecommendedJobs([]);
                setRecommendationError("건강 정보 기반 추천 공고를 불러오지 못했습니다.");
            } finally {
                setIsRecommendationLoading(false);
            }
        };

        loadRecommendations();

        return () => controller.abort();
    }, [filteredJobs, isExpired, isLoading, isRecommendationPage, routeSeniorId, targetSenior]);

    const handleMore = () => {
        if (isLoading) return;

        setVisibleCount((currentCount) =>
            Math.min(currentCount + PAGE_SIZE, filteredJobs.length)
        );
    };

    const handleOpenRecommend = async () => {
        setRecommendMode(true);

        if (welfareSeniors.length > 0) return;

        try {
            const data = await fetchWelfareSeniors({ page: 0, size: 50 });
            const list = Array.isArray(data) ? data : data.content || [];
            setWelfareSeniors(list);
        } catch {
            alert("대상자 목록을 불러오지 못했습니다.");
        }
    };

    const handleConfirmRecommend = async () => {
        if (!selectedJob || !selectedSeniorId) {
            alert("추천할 대상자를 선택해주세요.");
            return;
        }

        try {
            await recommendWelfareJobToSenior({
                seniorId: selectedSeniorId,
                job: selectedJob,
            });

            alert("대상자에게 일자리 공고를 추천했습니다.");
            setRecommendMode(false);
            setRecommendKeyword("");
            setSelectedSeniorId("");
            setSelectedJob(null);
        } catch {
            alert("일자리 추천에 실패했습니다.");
        }
    };

    const filteredRecommendSeniors = useMemo(() => {
        const keyword = recommendKeyword.trim();

        if (!keyword) return welfareSeniors;

        return welfareSeniors.filter((senior) =>
            senior.name?.includes(keyword) ||
            String(senior.id).includes(keyword) ||
            senior.region?.includes(keyword)
        );
    }, [recommendKeyword, welfareSeniors]);

    const handleCopyContact = async (job) => {
        const contact = job.clerkContt || job.oranNm || "";

        if (!contact) {
            alert("복사할 연락처 정보가 없습니다.");
            return;
        }

        try {
            await navigator.clipboard.writeText(contact);
            alert("담당자 연락처를 복사했습니다.");
        } catch {
            alert(contact);
        }
    };

    return (
        <div className={`wj-page${isRecommendationPage ? " wj-page-recommendation" : ""}`}>
            <header className="wj-header">
                <div className="wj-brand-area">
                    <Link to="/welfare" className="wj-service-name">
                        우리 woori
                    </Link>
                </div>

                <div className="wj-header-title">
                    {isRecommendationPage
                        ? `${targetSenior?.name || "대상자"} 추천 공고 | ${displayJobs.length}건`
                        : `노인일자리 공고 | 전체 ${totalCount.toLocaleString()}건`}
                </div>
            </header>

            <main className="wj-content">
                <div className="wj-layout">
                    <nav className="wj-sidebar" aria-label="직종 분류">
                        <strong className="wj-sidebar-title">직종 분류</strong>

                        {JOB_CATEGORY_FILTERS.map((category) => (
                            <button
                                type="button"
                                key={category.label}
                                className={`wj-sidebar-item${
                                    activeCategory === category.value ? " wj-sidebar-item-active" : ""
                                }`}
                                onClick={() => setActiveCategory(category.value)}
                            >
                                <span>{category.label}</span>

                                {activeCategory === category.value && (
                                    <span className="wj-sidebar-count">
                                        {isRecommendationPage ? displayJobs.length : categoryCounts[category.value] || 0}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="wj-main-area">
                        <div className="wj-search-row">
                            <Search size={16} className="wj-search-icon" />

                            <input
                                type="search"
                                value={searchKeyword}
                                onChange={(event) => setSearchKeyword(event.target.value)}
                                placeholder="공고명, 기업명, 근무지 검색..."
                                className="wj-search-input"
                            />

                            <span className="wj-search-divider" />

                            <label className="wj-hide-closed-label">
                                <input
                                    type="checkbox"
                                    checked={hideClosedJobs}
                                    onChange={(event) => setHideClosedJobs(event.target.checked)}
                                    className="wj-hide-closed-checkbox"
                                />
                                마감 숨기기
                            </label>
                        </div>

                        {isRecommendationPage && (
                            <div className="wj-recommend-summary">
                                <div>
                                    <strong>맞춤 추천 TOP 5</strong>
                                    <p>
                                        건강 정보와 활동 조건을 기준으로 계산한 추천 공고입니다.
                                    </p>
                                </div>

                                {displayJobs[0]?.match && (
                                    <span>최고 {displayJobs[0].match.score}점</span>
                                )}
                            </div>
                        )}

                        {isLoading && jobs.length === 0 && (
                            <p className="wj-empty-text">일자리 공고를 불러오는 중입니다.</p>
                        )}

                        {!isLoading && loadError && (
                            <p className="wj-empty-text">{loadError}</p>
                        )}

                        {!isLoading && !loadError && filteredJobs.length === 0 && (
                            <p className="wj-empty-text">검색 결과가 없습니다.</p>
                        )}

                        {isRecommendationPage && isRecommendationLoading && (
                            <p className="wj-empty-text">건강 정보와 활동 조건을 기준으로 추천 공고를 계산하는 중입니다.</p>
                        )}

                        {isRecommendationPage && !isRecommendationLoading && recommendationError && (
                            <p className="wj-empty-text">{recommendationError}</p>
                        )}

                        {isRecommendationPage && !isRecommendationLoading && !recommendationError && filteredJobs.length > 0 && displayJobs.length === 0 && (
                            <p className="wj-empty-text">이 대상자에게 추천할 수 있는 공고가 없습니다.</p>
                        )}

                        <div className="wj-job-list">
                            {displayJobs.map((job) => {
                                const jobCategory = categorizeJob(job);
                                const employmentText =
                                    EMPL_MAP[job.emplymShp] || job.emplymShpNm || "기타";
                                const matchReasons = [
                                    ...(job.match?.reasons || []),
                                    ...(job.match?.warnings || []),
                                ].slice(0, 3);
                                const healthConditionChips = isRecommendationPage
                                    ? buildHealthConditionChips(targetSenior, job)
                                    : [];
                                const distanceNotice = isRecommendationPage
                                    ? getDistanceNotice(job, targetSenior)
                                    : "";

                                return (
                                    <article
                                        key={job.jobId}
                                        className="wj-job-card"
                                        onClick={() => setSelectedJob(job)}
                                    >
                                        <div className="wj-job-card-accent" />

                                        <div className="wj-job-card-top">
                                            <div>
                                                <h2 className="wj-job-title">
                                                    {job.recrtTitle || "공고명 미공개"}
                                                </h2>
                                                <p className="wj-organization">
                                                    🏢 {job.oranNm || "기관명 미공개"}
                                                </p>
                                            </div>

                                            <div className="wj-badge-row">
                                                {isRecommendationPage && job.match && (
                                                    <span className="wj-match-badge">
                                                        추천 {job.match.score}점
                                                    </span>
                                                )}
                                                {isRecommendationPage && (
                                                    <span className="wj-senior-job-badge">
                                                        노인일자리
                                                    </span>
                                                )}
                                                <span className="wj-job-type-badge">
                                                    {jobCategory}
                                                </span>
                                                <span className="wj-employment-badge">
                                                    {employmentText}
                                                </span>
                                            </div>
                                        </div>

                                        {isRecommendationPage ? (
                                            <>
                                                <div className="wj-recommend-chip-row">
                                                    {job.workPlcNm && (
                                                        <span className="wj-recommend-chip wj-recommend-chip-soft">
                                                            {job.workPlcNm}
                                                        </span>
                                                    )}
                                                    <span className="wj-recommend-chip wj-recommend-chip-soft">
                                                        경력 무관
                                                    </span>
                                                </div>

                                                <div className="wj-recommend-chip-row">
                                                    <span className="wj-recommend-chip wj-recommend-chip-outline">
                                                        {getRegionNotice(job)}
                                                    </span>
                                                    {distanceNotice && (
                                                        <span className="wj-recommend-chip wj-recommend-chip-distance">
                                                            {distanceNotice}
                                                        </span>
                                                    )}
                                                    <span className="wj-recommend-chip wj-recommend-chip-outline">
                                                        경력 무관
                                                    </span>
                                                    <span className="wj-recommend-chip wj-recommend-chip-outline">
                                                        학력 제한 없음
                                                    </span>
                                                </div>

                                                {healthConditionChips.length > 0 && (
                                                    <div className="wj-health-condition-row">
                                                        <span className="wj-health-condition-label">건강 조건</span>
                                                        {healthConditionChips.map((chip) => (
                                                            <span key={chip} className="wj-recommend-chip wj-recommend-chip-health">
                                                                {chip}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {matchReasons.length > 0 && (
                                                    <div className="wj-match-reasons wj-match-reasons-recommend">
                                                        {matchReasons.map((reason) => (
                                                            <span key={reason}>{reason}</span>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="wj-recommend-date">
                                                    {formatDate(job.frDd)} ~ {formatDate(job.toDd)}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="wj-job-meta">
                                                {job.workPlcNm && (
                                                    <span className="wj-meta-item">
                                                        📍 {job.workPlcNm}
                                                    </span>
                                                )}

                                                {job.jobclsNm && (
                                                    <span className="wj-meta-item">
                                                        📋 {job.jobclsNm}
                                                    </span>
                                                )}

                                                {job.acptMthd && (
                                                    <span className="wj-meta-item">
                                                        📝 {job.acptMthd}
                                                    </span>
                                                )}

                                                <span className="wj-meta-item">
                                                    📅 {formatDate(job.frDd)} ~ {formatDate(job.toDd)}
                                                </span>
                                            </div>
                                        )}

                                        {!isRecommendationPage && matchReasons.length > 0 && (
                                            <div className="wj-match-reasons">
                                                {matchReasons.map((reason) => (
                                                    <span key={reason}>{reason}</span>
                                                ))}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        {!isRecommendationPage && !isLoading && !loadError && hasMoreVisible && (
                            <button type="button" className="wj-more-button" onClick={handleMore}>
                                {Math.min(PAGE_SIZE, Math.max(filteredJobs.length - visibleJobs.length, 0)) || PAGE_SIZE}건 더보기
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {selectedJob && (
                <div
                    className="wj-modal-overlay"
                    onClick={() => {
                        setSelectedJob(null);
                        setRecommendMode(false);
                        setRecommendKeyword("");
                        setSelectedSeniorId("");
                    }}
                >
                    <section className="wj-modal" onClick={(event) => event.stopPropagation()}>
                        {recommendMode ? (
                            <>
                                <div className="wj-modal-header">
                                    <div>
                                        <h2>추천 대상자 선택</h2>
                                        <p>{selectedJob.recrtTitle || "공고명 미공개"}</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="wj-modal-close"
                                        onClick={() => {
                                            setSelectedJob(null);
                                            setRecommendMode(false);
                                            setRecommendKeyword("");
                                            setSelectedSeniorId("");
                                        }}
                                        aria-label="닫기"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="wj-modal-body">
                                    <input
                                        type="search"
                                        value={recommendKeyword}
                                        onChange={(event) => setRecommendKeyword(event.target.value)}
                                        placeholder="대상자 이름, ID, 지역 검색"
                                        className="wj-recommend-search"
                                    />

                                    <div className="wj-recommend-list wj-recommend-list-full">
                                        {filteredRecommendSeniors.length === 0 ? (
                                            <p className="wj-recommend-empty">대상자가 없습니다.</p>
                                        ) : (
                                            filteredRecommendSeniors.map((senior) => (
                                                <label key={senior.id} className="wj-recommend-item">
                                                    <input
                                                        type="radio"
                                                        name="recommendSenior"
                                                        value={senior.id}
                                                        checked={String(selectedSeniorId) === String(senior.id)}
                                                        onChange={(event) => setSelectedSeniorId(event.target.value)}
                                                    />

                                                    <span>
                                                        <strong>{senior.name}</strong>
                                                        <small>
                                                            ID {String(senior.id).padStart(4, "0")} ·{" "}
                                                            {senior.region || "지역 미입력"}
                                                        </small>
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="wj-modal-actions">
                                    <button type="button" onClick={handleConfirmRecommend}>
                                        선택 대상자에게 추천
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRecommendMode(false);
                                            setSelectedSeniorId("");
                                            setRecommendKeyword("");
                                        }}
                                    >
                                        상세정보로 돌아가기
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="wj-modal-header">
                                    <div>
                                        <h2>{selectedJob.recrtTitle || "공고명 미공개"}</h2>
                                        <p>{selectedJob.oranNm || "기관명 미공개"}</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="wj-modal-close"
                                        onClick={() => setSelectedJob(null)}
                                        aria-label="닫기"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="wj-modal-body">
                                    <div className="wj-modal-row">
                                        <strong>고용형태</strong>
                                        <span>
                                            {EMPL_MAP[selectedJob.emplymShp] ||
                                                selectedJob.emplymShpNm ||
                                                "기타"}
                                        </span>
                                    </div>

                                    <div className="wj-modal-row">
                                        <strong>직종</strong>
                                        <span>{selectedJob.jobclsNm || categorizeJob(selectedJob)}</span>
                                    </div>

                                    <div className="wj-modal-row">
                                        <strong>근무지</strong>
                                        <span>{selectedJob.workPlcNm || "-"}</span>
                                    </div>

                                    {selectedJob.plDetAddr && (
                                        <div className="wj-modal-row">
                                            <strong>상세주소</strong>
                                            <span>{selectedJob.plDetAddr}</span>
                                        </div>
                                    )}

                                    {selectedJob.clltPrnnum && (
                                        <div className="wj-modal-row">
                                            <strong>모집인원</strong>
                                            <span>{selectedJob.clltPrnnum}명</span>
                                        </div>
                                    )}

                                    <div className="wj-modal-row">
                                        <strong>접수기간</strong>
                                        <span>
                                            {formatDate(selectedJob.frDd)} ~ {formatDate(selectedJob.toDd)}
                                        </span>
                                    </div>

                                    <div className="wj-modal-row">
                                        <strong>접수방법</strong>
                                        <span>{selectedJob.acptMthd || "-"}</span>
                                    </div>

                                    {selectedJob.clerkContt && (
                                        <div className="wj-modal-row">
                                            <strong>담당자 연락처</strong>
                                            <span>{selectedJob.clerkContt}</span>
                                        </div>
                                    )}

                                    {selectedJob.detCnts && (
                                        <div className="wj-modal-detail">
                                            <strong>상세내용</strong>
                                            <p>{selectedJob.detCnts}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="wj-modal-actions">
                                    <button type="button" onClick={handleOpenRecommend}>
                                        대상자에게 추천하기
                                    </button>

                                    <button type="button" onClick={() => handleCopyContact(selectedJob)}>
                                        담당자 연락처 복사
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
            
            <WelfarePolicyQaButton />
        </div>
    );
}

export default WelfareJobPostings;
