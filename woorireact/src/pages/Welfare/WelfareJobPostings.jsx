import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";

import {
    EMPL_MAP,
    JOB_CATEGORY_FILTERS,
    categorizeJob,
    fetchWelfareJobList,
    formatDate,
    recommendWelfareJobToSenior,
} from "../../api/welfareJobApi";
import { fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import CommonHeader from "../../components/CommonHeader.jsx";
import TripartiteChatModal from "../../components/TripartiteChatModal.jsx";
import { fetchUnreadChatCount } from "../../api/chatApi";
import WelfarePolicyChatButton from "../../components/welfare/WelfarePolicyChatButton";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";

import "../../css/welfare/WelfareDashboard.css";
import "../../css/welfare/WelfareJobPostings.css";

const PAGE_SIZE = 10;
const API_PAGE_SIZE = 200;

function WelfareJobPostings() {
    const currentWorker = useMemo(() => {
        try {
            return JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
        } catch {
            return null;
        }
    }, []);
    const [jobs, setJobs] = useState([]);
    const [activeCategory, setActiveCategory] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [hideClosedJobs, setHideClosedJobs] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [loadedPage, setLoadedPage] = useState(0);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMoreSource, setHasMoreSource] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [recommendMode, setRecommendMode] = useState(false);
    const [recommendKeyword, setRecommendKeyword] = useState("");
    const [selectedSeniorId, setSelectedSeniorId] = useState("");
    const [welfareSeniors, setWelfareSeniors] = useState([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    useEffect(() => {
        const workerId = currentWorker?.id || currentWorker?.worker?.id || null;
        if (!workerId) return;
        fetchUnreadChatCount(workerId, "WELFARE").then(setUnreadChatCount).catch(() => {});
        const timerId = setInterval(() => {
            fetchUnreadChatCount(workerId, "WELFARE").then(setUnreadChatCount).catch(() => {});
        }, 30000);
        return () => clearInterval(timerId);
    }, [currentWorker]);

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
            if (hideClosedJobs && isExpired(job)) return false;
            return matchesCategory(job) && matchesSearch(job);
        });
    }, [hideClosedJobs, isExpired, matchesCategory, matchesSearch]);

    const filteredJobs = useMemo(() => filterJobs(jobs), [jobs, filterJobs]);
    const visibleJobs = filteredJobs.slice(0, visibleCount);
    const hasMoreVisible = filteredJobs.length > visibleCount || hasMoreSource;

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

    const loadUntilEnough = useCallback(async ({
        startPage = 1,
        targetCount = PAGE_SIZE,
        replace = false,
    } = {}) => {
        setIsLoading(true);
        setLoadError("");

        try {
            let nextPage = startPage;
            let nextJobs = replace ? [] : jobs;
            let nextTotal = totalCount;
            let shouldContinue = true;

            while (shouldContinue) {
                const result = await fetchWelfareJobList(nextPage, "", API_PAGE_SIZE);
                nextTotal = result.total || nextTotal;

                const merged = new Map(nextJobs.map((job) => [job.jobId, job]));
                (result.list || []).forEach((job) => {
                    if (job.jobId) {
                        merged.set(job.jobId, job);
                    }
                });

                nextJobs = Array.from(merged.values());

                const enoughForCategory = filterJobs(nextJobs).length >= targetCount;
                const loadedAll = nextTotal > 0 && nextJobs.length >= nextTotal;
                const emptyPage = !result.list?.length;
                const reachedSafetyLimit = nextPage >= 60;

                shouldContinue =
                    !enoughForCategory &&
                    !loadedAll &&
                    !emptyPage &&
                    !reachedSafetyLimit;

                nextPage += 1;
            }

            setJobs(nextJobs);
            setTotalCount(nextTotal);
            setLoadedPage(nextPage - 1);
            setHasMoreSource(!(nextTotal > 0 && nextJobs.length >= nextTotal));
        } catch {
            setLoadError("일자리 공고를 불러오지 못했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [filterJobs, jobs, totalCount]);

    useEffect(() => {
        loadUntilEnough({
            startPage: 1,
            targetCount: PAGE_SIZE,
            replace: true,
        });
    }, []);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [activeCategory, searchKeyword, hideClosedJobs]);

    useEffect(() => {
        if (
            isLoading ||
            jobs.length === 0 ||
            filteredJobs.length >= PAGE_SIZE ||
            !hasMoreSource
        ) {
            return;
        }

        loadUntilEnough({
            startPage: loadedPage + 1,
            targetCount: PAGE_SIZE,
            replace: false,
        });
    }, [
        activeCategory,
        searchKeyword,
        filteredJobs.length,
        hasMoreSource,
        hideClosedJobs,
        jobs.length,
        loadedPage,
        isLoading,
        loadUntilEnough,
    ]);

    const handleMore = async () => {
        if (isLoading) return;

        const nextVisibleCount = visibleCount + PAGE_SIZE;
        setVisibleCount(nextVisibleCount);

        if (filteredJobs.length < nextVisibleCount && hasMoreSource) {
            await loadUntilEnough({
                startPage: loadedPage + 1,
                targetCount: nextVisibleCount,
                replace: false,
            });
        }
    };

    const handleOpenRecommend = async () => {
        setRecommendMode(true);

        if (welfareSeniors.length > 0) return;

        try {
            const data = await fetchWelfareSeniors({
                page: 0,
                size: 50,
                welfareWorkerId: currentWorker?.id,
            });
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
        <div className="wj-page">
            <CommonHeader
                homePath="/welfare"
                rightText={`노인일자리 공고 | 전체 ${totalCount.toLocaleString()}건`}
                className="wj-common-header"
                showNotificationButton={false}
                actions={
                    <button
                        className="common-app-icon-button"
                        type="button"
                        onClick={() => setIsChatOpen(true)}
                        aria-label="메시지"
                    >
                        <MessageCircle size={19} />
                        {unreadChatCount > 0 && <span className="common-app-badge">{unreadChatCount}</span>}
                    </button>
                }
            />
            <TripartiteChatModal
                isOpen={isChatOpen}
                rooms={[]}
                onClose={() => setIsChatOpen(false)}
            />

            <div className="wd-layout">
                <WelfareSidebar active="jobs" />

                <main className="wj-main-area">
                    <nav className="wj-category-chips" aria-label="직종 분류">
                        {JOB_CATEGORY_FILTERS.map((category) => (
                            <button
                                type="button"
                                key={category.label}
                                className={`wj-category-chip${activeCategory === category.value ? " wj-category-chip-active" : ""}`}
                                onClick={() => setActiveCategory(category.value)}
                            >
                                {category.label}
                                {activeCategory === category.value && categoryCounts[category.value] > 0 && (
                                    <span className="wj-category-chip-count">{categoryCounts[category.value]}</span>
                                )}
                            </button>
                        ))}
                    </nav>

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

                        {isLoading && jobs.length === 0 && (
                            <p className="wj-empty-text">일자리 공고를 불러오는 중입니다.</p>
                        )}

                        {!isLoading && loadError && (
                            <p className="wj-empty-text">{loadError}</p>
                        )}

                        {!isLoading && !loadError && filteredJobs.length === 0 && !hasMoreSource && (
                            <p className="wj-empty-text">검색 결과가 없습니다.</p>
                        )}

                        <div className="wj-job-list">
                            {visibleJobs.map((job) => {
                                const jobCategory = categorizeJob(job);
                                const employmentText =
                                    EMPL_MAP[job.emplymShp] || job.emplymShpNm || "기타";

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
                                                <span className="wj-source-badge">
                                                    {job.source === "seoul" ? "서울일자리" : "노인일자리"}
                                                </span>
                                                <span className="wj-job-type-badge">
                                                    {jobCategory}
                                                </span>
                                                <span className="wj-employment-badge">
                                                    {employmentText}
                                                </span>
                                            </div>
                                        </div>

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
                                    </article>
                                );
                            })}
                        </div>

                        {!isLoading && !loadError && hasMoreVisible && (
                            <button type="button" className="wj-more-button" onClick={handleMore}>
                                {Math.min(PAGE_SIZE, Math.max(filteredJobs.length - visibleJobs.length, 0)) || PAGE_SIZE}건 더보기
                            </button>
                        )}
                    </div>
                </main>
            </div>

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
                                        <strong>출처</strong>
                                        <span>{selectedJob.source === "seoul" ? "서울일자리" : "노인일자리"}</span>
                                    </div>

                                    <div className="wj-modal-row">
                                        <strong>공고번호</strong>
                                        <span>{selectedJob.jobId || "-"}</span>
                                    </div>

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

                                    {selectedJob.workTime && (
                                        <div className="wj-modal-row">
                                            <strong>근무시간</strong>
                                            <span>{selectedJob.workTime}</span>
                                        </div>
                                    )}

                                    {selectedJob.wage && (
                                        <div className="wj-modal-row">
                                            <strong>급여</strong>
                                            <span>{selectedJob.wage}</span>
                                        </div>
                                    )}

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
            
            <WelfarePolicyChatButton />
        </div>
    );
}

export default WelfareJobPostings;
