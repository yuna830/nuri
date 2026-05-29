import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import {
  EMPL_COLOR,
  EMPL_MAP,
  JOB_CATEGORY_FILTERS,
  categorizeJob,
  fetchJobList,
  formatDate,
  getSavedJobProfile,
  isJobRegionCompatible,
  isPastDate,
  scoreJobMatch,
} from "../../utils/user/jobApi";
import "../../css/user/JobPage.css";

const PAGE_SIZE = 20;
const RECOMMEND_SIZE = 5;
const CATEGORY_TARGET_SIZE = PAGE_SIZE + RECOMMEND_SIZE;
const API_PAGE_SIZE = 200;

export default function JobPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loadedPage, setLoadedPage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMoreSource, setHasMoreSource] = useState(true);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobApplications, setJobApplications] = useState([]);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
  const [selectedRecommendedApplication, setSelectedRecommendedApplication] = useState(null);
  const [hideExpired, setHideExpired] = useState(true);
  const deferredSearch = useDeferredValue(search);
  const isJobAllowed = !profile || !profile.age || Number(profile.age) >= 20;

  useEffect(() => {
    setProfile(getSavedJobProfile());
  }, []);

  const loadJobApplications = useCallback(async () => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      const seniorId = saved ? JSON.parse(saved)?.senior?.id : null;
      if (!seniorId) return;

      const response = await fetch(`/api/job-interests/senior/${seniorId}`);
      const data = response.ok ? await response.json() : [];
      setJobApplications(Array.isArray(data) ? data : []);
    } catch {
      setJobApplications([]);
    }
  }, []);

  useEffect(() => {
    loadJobApplications();
    const timerId = window.setInterval(loadJobApplications, 30000);
    return () => window.clearInterval(timerId);
  }, [loadJobApplications]);

  const isExpired = useCallback((job) => {
    if (job.toDd) return isPastDate(job.toDd);
    return job.deadline === "마감";
  }, []);

  const matchesCategory = useCallback((job) => {
    if (!category) return true;
    const selectedCategory = JOB_CATEGORY_FILTERS.find((item) => item.value === category);
    if (!selectedCategory?.keywords?.length) return categorizeJob(job) === "기타";
    return categorizeJob(job) === selectedCategory.label;
  }, [category]);

  const matchesSearch = useCallback((job) => {
    const keyword = deferredSearch.trim();
    if (!keyword) return true;
    return [job.recrtTitle, job.oranNm, job.workPlcNm, job.jobclsNm, job.source]
      .some((value) => String(value || "").includes(keyword));
  }, [deferredSearch]);

  const filterJobs = useCallback((list) => list.filter((job) => {
    if (hideExpired && isExpired(job)) return false;
    return matchesCategory(job) && matchesSearch(job) && isJobRegionCompatible(job, profile || {});
  }), [hideExpired, isExpired, matchesCategory, matchesSearch, profile]);

  const scoredJobs = useMemo(() => {
    return filterJobs(jobs)
      .map((job) => ({
        ...job,
        match: scoreJobMatch(job, profile || {}, category),
      }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [category, filterJobs, jobs, profile]);

  const recommendedJobs = scoredJobs.slice(0, RECOMMEND_SIZE);
  const welfareRecommendedApplications = useMemo(
    () => jobApplications.filter((application) =>
      application.applicationType === "RECOMMEND"
      && !["관심 있음", "문의 요청", "거절", "처리 완료", "승인", "반려"].includes(application.status)
    ),
    [jobApplications],
  );
  const interestedApplications = useMemo(
    () => jobApplications.filter((application) =>
      (application.applicationType === "INTEREST" || application.status === "관심 있음")
      && !["관심 삭제", "삭제", "취소", "취소 처리"].includes(application.status)
    ),
    [jobApplications],
  );
  const appliedApplications = useMemo(
    () => jobApplications.filter((application) =>
      !["INTEREST", "RECOMMEND"].includes(application.applicationType)
    ),
    [jobApplications],
  );
  const [selectedInterestApplication, setSelectedInterestApplication] = useState(null);
  const findCachedJobForApplication = useCallback((application) => {
    if (!application?.jobId) return null;
    return jobs.find((job) => String(job.jobId) === String(application.jobId)) || null;
  }, [jobs]);
  const fetchCachedJobForApplication = useCallback(async (application) => {
    const localJob = findCachedJobForApplication(application);
    if (localJob) return localJob;
    if (!application?.jobId) return null;

    try {
      const response = await fetch("/api/job-cache");
      if (!response.ok) return null;

      const cachedJobs = await response.json();
      if (!Array.isArray(cachedJobs)) return null;

      return cachedJobs.find((job) =>
        String(job.jobId) === String(application.jobId)
        && (!application.source || !job.source || String(job.source) === String(application.source))
      ) || cachedJobs.find((job) => String(job.jobId) === String(application.jobId)) || null;
    } catch {
      return null;
    }
  }, [findCachedJobForApplication]);
  const openInterestApplicationDetail = useCallback(async (application) => {
    const sourceJob = await fetchCachedJobForApplication(application);

    setSelectedInterestApplication(sourceJob ? {
      ...application,
      __sourceJob: sourceJob,
      organization: application.organization || application.company || sourceJob.oranNm,
      company: application.company || application.organization || sourceJob.oranNm,
      location: application.location || sourceJob.workPlcNm,
      source: application.source || sourceJob.source,
    } : application);
  }, [fetchCachedJobForApplication]);
  const buildApplicationDetailRows = useCallback((application, statusLabel = "상태") => {
    const sourceJob = application.__sourceJob || findCachedJobForApplication(application) || {};

    return [
      { key: statusLabel, val: application.status || "확인 대기" },
      { key: "출처", val: application.source || sourceJob.source },
      { key: "근무지", val: application.location || sourceJob.workPlcNm },
      { key: "상세 주소", val: application.detailAddress || sourceJob.plDetAddr },
      { key: "직종", val: application.jobType || sourceJob.jobclsNm },
      { key: "근무 시간", val: application.workTime || sourceJob.workTime },
      { key: "주당 시간", val: application.weekHours ? `${application.weekHours}시간` : sourceJob.weekHours ? `${sourceJob.weekHours}시간` : "" },
      { key: "급여", val: application.wage || sourceJob.wage },
      { key: "모집 인원", val: application.recruitCount ? `${application.recruitCount}명` : sourceJob.clltPrnnum ? `${sourceJob.clltPrnnum}명` : "" },
      { key: "접수 기간", val: (application.fromDate || application.toDate) ? `${formatDate(application.fromDate)} ~ ${formatDate(application.toDate)}` : (sourceJob.frDd || sourceJob.toDd) ? `${formatDate(sourceJob.frDd)} ~ ${formatDate(sourceJob.toDd)}` : "" },
      { key: "접수 방법", val: application.applyMethod || sourceJob.acptMthd },
      { key: "연락처", val: application.contactInfo || sourceJob.clerkContt },
      { key: "상세 내용", val: application.detail || sourceJob.detCnts },
      { key: "등록일", val: application.requestedAt || sourceJob.registeredAt },
      { key: "공고번호", val: application.jobId },
    ];
  }, [findCachedJobForApplication]);
  const recommendedIds = useMemo(
    () => new Set(recommendedJobs.map((job) => `${job.source}-${job.jobId}`)),
    [recommendedJobs],
  );
  const listJobs = scoredJobs.filter((job) => !recommendedIds.has(`${job.source}-${job.jobId}`));
  const visibleJobs = listJobs.slice(0, visibleCount);
  const hasMoreVisible = listJobs.length > visibleCount || hasMoreSource;

  const loadUntilEnough = useCallback(async ({ startPage = 1, targetCount = PAGE_SIZE, replace = false } = {}) => {
    setLoading(true);
    setError(null);

    try {
      let nextPage = startPage;
      let nextJobs = replace ? [] : jobs;
      let nextTotal = totalCount;
      let shouldContinue = true;
      let startPageWasDbCache = false;

      while (shouldContinue) {
        const currentPage = nextPage;
        const result = await fetchJobList(currentPage, "", API_PAGE_SIZE);
        if (currentPage === startPage && result.fromDbCache) startPageWasDbCache = true;
        if (!result.fromDbCache) nextTotal = result.total || nextTotal;

        const merged = new Map(nextJobs.map((job) => [`${job.source}-${job.jobId}`, job]));
        result.list.forEach((job) => merged.set(`${job.source}-${job.jobId}`, job));
        nextJobs = Array.from(merged.values());

        const enoughForCategory = filterJobs(nextJobs).length >= targetCount;
        const loadedAll = nextTotal > 0 && nextJobs.length >= nextTotal;
        const emptyPage = result.list.length === 0;
        const reachedSafetyLimit = currentPage >= 60;
        const needsFreshPage = startPageWasDbCache && currentPage <= startPage;

        shouldContinue = (needsFreshPage || !enoughForCategory) && !loadedAll && !emptyPage && !reachedSafetyLimit;
        nextPage += 1;
      }

      setJobs(nextJobs);
      setTotalCount(nextTotal);
      setLoadedPage(nextPage - 1);
      setHasMoreSource(!(nextTotal > 0 && nextJobs.length >= nextTotal));
    } catch {
      setError("일자리 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, [filterJobs, jobs, totalCount]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [category, deferredSearch, hideExpired]);

  useEffect(() => {
    if (!isJobAllowed) {
      setLoading(false);
      setJobs([]);
      return;
    }
    loadUntilEnough({ startPage: 1, targetCount: CATEGORY_TARGET_SIZE, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJobAllowed]);

  useEffect(() => {
    if (loading || jobs.length === 0 || scoredJobs.length >= CATEGORY_TARGET_SIZE || !hasMoreSource) return;
    loadUntilEnough({
      startPage: loadedPage + 1,
      targetCount: CATEGORY_TARGET_SIZE,
      replace: false,
    });
  }, [hasMoreSource, jobs.length, loadedPage, loading, loadUntilEnough, scoredJobs.length]);

  const handleMore = async () => {
    if (loading) return;
    const nextVisibleCount = visibleCount + PAGE_SIZE;
    setVisibleCount(nextVisibleCount);

    if (scoredJobs.length < nextVisibleCount && hasMoreSource) {
      await loadUntilEnough({
        startPage: loadedPage + 1,
        targetCount: nextVisibleCount,
        replace: false,
      });
    }
  };

  const saveJobApplication = async (job, applicationType, status) => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      const seniorId = saved ? JSON.parse(saved)?.senior?.id : null;
      if (!seniorId) {
        alert("로그인 정보가 없습니다.");
        return false;
      }

      const response = await fetch("/api/job-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seniorId,
          jobId: job.jobId,
          jobTitle: job.recrtTitle,
          company: job.oranNm,
          location: job.workPlcNm,
          applicationType,
          status,
          source: job.source,
          detailAddress: job.plDetAddr,
          jobType: job.jobclsNm,
          workTime: job.workTime,
          weekHours: job.weekHours ? String(job.weekHours) : null,
          wage: job.wage,
          recruitCount: job.clltPrnnum ? String(job.clltPrnnum) : null,
          fromDate: job.frDd,
          toDate: job.toDd,
          applyMethod: job.acptMthd,
          contactInfo: job.clerkContt,
          detail: job.detCnts,
        }),
      });
      if (!response.ok) throw new Error("job application failed");
      await loadJobApplications();
      return true;
    } catch {
      return false;
    }
  };

  const handleApply = async (job) => {
    const ok = await saveJobApplication(job, "ONLINE", "검토 대기");
    if (ok) {
      setSelected(null);
      alert("복지사에게 일자리 신청을 보냈어요.");
    } else {
      alert("신청에 실패했습니다. 복지사에게 직접 문의해주세요.");
    }
  };

  const handleNotifyManager = async (job) => {
    const ok = await saveJobApplication(job, "INTEREST", "관심 있음");
    if (ok) {
      setSelected(null);
      alert("복지사에게 관심 공고를 전달했어요.");
    } else {
      alert("전달에 실패했습니다. 복지사에게 직접 문의해주세요.");
    }
  };

  const handleApplyFromInterest = async (application) => {
    if (!application?.id) return;
    try {
      const response = await fetch(`/api/job-interests/${application.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "검토 대기", applicationType: "ONLINE" }),
      });
      if (!response.ok) throw new Error("apply failed");
      await loadJobApplications();
      setSelectedInterestApplication(null);
      alert("복지사에게 일자리 신청을 보냈어요.");
    } catch {
      alert("신청에 실패했습니다.");
    }
  };

  const handleDeleteInterest = async (application) => {
    if (!application?.id) return;

    const confirmed = window.confirm("이 관심공고를 삭제할까요?");
    if (!confirmed) return;

    try {
      const deleteResponse = await fetch(`/api/job-interests/${application.id}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        const fallbackResponse = await fetch(`/api/job-interests/${application.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "관심 삭제" }),
        });

        if (!fallbackResponse.ok) throw new Error("interest delete failed");
      }

      setJobApplications((previous) =>
        previous.filter((item) => String(item.id) !== String(application.id))
      );
      setSelectedInterestApplication(null);
      alert("관심공고를 삭제했습니다.");
    } catch {
      alert("관심공고 삭제에 실패했습니다.");
    }
  };

  const handleUpdateApplicationStatus = async (application, status) => {
    if (!application?.id) return;

    try {
      const response = await fetch(`/api/job-interests/${application.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("status update failed");

      const updated = await response.json();
      setJobApplications((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      if (["관심 있음", "문의 요청", "거절"].includes(updated.status)) {
        setSelectedRecommendedApplication(null);
      } else {
        setSelectedRecommendedApplication(updated);
      }
    } catch (error) {
      console.error("일자리 추천 상태 변경 실패:", error);
      alert("상태 변경에 실패했습니다.");
    }
  };

  const renderJobCard = (job, idx, compact = false) => {
    const empl = EMPL_MAP[job.emplymShp] || job.emplymShpNm || "기타";
    const color = EMPL_COLOR[job.emplymShp] || EMPL_COLOR.CM0105;
    const jobCategory = categorizeJob(job);
    const expired = isExpired(job);
    const key = `${job.source}-${job.jobId}`;
    const recommended = compact || recommendedIds.has(key);

    return (
      <article
        key={`${key}-${idx}-${compact ? "recommend" : "list"}`}
        className={`jp-card ${expired ? "jp-card-expired" : ""} ${recommended ? "jp-card-recommended" : ""} ${compact ? "jp-card-compact" : ""}`}
        onClick={() => {
          if (!expired) setSelected(job);
        }}
      >
        <div className="jp-card-bar" />
        <div className="jp-card-inner">
          <div className="jp-card-top">
            <div>
              <div className="jp-card-title">{job.recrtTitle}</div>
              <div className="jp-card-company">{job.oranNm || "기업명 미공개"}</div>
            </div>
            <div className="jp-card-badges">
              {recommended && <div className="jp-match-badge">추천 {job.match.score}점</div>}
              {expired && <div className="jp-card-badge jp-expired-badge">마감</div>}
              <div className="jp-card-badge jp-source-badge">{job.source}</div>
              <div className="jp-card-badge" style={{ background: "#eef6ef", color: "#5f7d61", border: "1px solid #b8d4ba" }}>
                {jobCategory}
              </div>
              <div className="jp-card-badge" style={{ background: color.bg, color: color.color }}>
                {empl}
              </div>
            </div>
          </div>

          <div className="jp-card-tags">
            {job.workPlcNm && <span className="jp-card-tag">{job.workPlcNm}</span>}
            {job.jobclsNm && <span className="jp-card-tag">{job.jobclsNm}</span>}
            {job.weekHours && <span className="jp-card-tag">주 {job.weekHours}시간</span>}
            {job.career && <span className="jp-card-tag">경력 {job.career}</span>}
          </div>

          {recommended && job.match.reasons.length > 0 && (
            <div className="jp-match-reasons">
              {job.match.reasons.map((reason) => <span key={reason}>{reason}</span>)}
            </div>
          )}

          <div className="jp-card-date">
            {formatDate(job.frDd)} ~ {formatDate(job.toDd)}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="jp-root">
      <UserCommonHeader />

      <div className="jp-layout">
        {!isJobAllowed ? (
          <main className="jp-main jp-age-block">
            <div className="jp-empty">
              <div className="jp-empty-icon">💼</div>
              <div className="jp-empty-text">일자리 정보는 만 20세 이상부터 볼 수 있어요.</div>
            </div>
          </main>
        ) : (
          <>
            <aside className="jp-sidebar">
              {profile && (
                <div className="jp-profile-box">
                  <div className="jp-profile-title">내 희망 조건</div>
                  {(profile.address || profile.city || profile.district || profile.dong) && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">거주지</span>
                      <span className="jp-profile-val">{profile.address || [profile.city, profile.district, profile.dong].filter(Boolean).join(" ")}</span>
                    </div>
                  )}
                  {profile.maxHours && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">활동시간</span>
                      <span className="jp-profile-val">{profile.maxHours}시간 이내</span>
                    </div>
                  )}
                  {profile.maxDistance && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">이동거리</span>
                      <span className="jp-profile-val">{profile.maxDistance}</span>
                    </div>
                  )}
                  {profile.payType && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">급여형태</span>
                      <span className="jp-profile-val">{profile.payType}</span>
                    </div>
                  )}
                  {profile.restNeed && profile.restNeed !== "없음" && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">휴식</span>
                      <span className="jp-profile-val">{profile.restNeed}</span>
                    </div>
                  )}
                  {profile.avoidEnvironment?.length > 0 && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">피할 환경</span>
                      <span className="jp-profile-val">{profile.avoidEnvironment.join("·")}</span>
                    </div>
                  )}
                  {profile.hopeDays?.length > 0 && (
                    <div className="jp-profile-row">
                      <span className="jp-profile-key">희망요일</span>
                      <span className="jp-profile-val">{profile.hopeDays.join("·")}</span>
                    </div>
                  )}
                </div>
              )}

              <nav className="jp-category-sidebar" aria-label="직종 분류">
                <strong className="jp-category-sidebar-title">직종 분류</strong>
                {JOB_CATEGORY_FILTERS.map((item) => (
                  <button
                    key={item.label}
                    className={`jp-category-sidebar-item ${category === item.value ? "active" : ""}`}
                    type="button"
                    onClick={() => setCategory(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>

            <main className="jp-main">
              <div className="jp-main-search">
                <div className="jp-search-wrap">
                  <span className="jp-search-icon">🔍</span>
                  <input
                    className="jp-search-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="공고명, 기업명, 근무지 검색..."
                  />
                  {search && (
                    <button className="jp-search-clear" type="button" onClick={() => setSearch("")}>
                      ×
                    </button>
                  )}
                  <div className="jp-search-divider" />
                  <label className="jp-expire-filter">
                    <input
                      type="checkbox"
                      className="jp-expire-checkbox"
                      checked={hideExpired}
                      onChange={(event) => setHideExpired(event.target.checked)}
                    />
                    <span className="jp-expire-label">마감 숨기기</span>
                  </label>
                </div>
              </div>

              <div className="jp-main-actions">
                <button
                  className="jp-application-toggle"
                  type="button"
                  onClick={() => setIsInterestModalOpen(true)}
                >
                  관심 공고 모아 보기
                </button>
                {appliedApplications.length > 0 && (
                  <button
                    className="jp-application-toggle"
                    type="button"
                    onClick={() => setIsApplicationModalOpen(true)}
                  >
                    내가 신청한 공고 결과 보기
                  </button>
                )}
              </div>

              {welfareRecommendedApplications.length > 0 && (
                <section className="jp-welfare-recommend-section">
                  <div className="jp-welfare-recommend-head">
                    <div>
                      <strong>복지사가 추천한 공고</strong>
                      <p>관심 여부를 누르면 복지사 쪽 관리 화면에 바로 반영됩니다.</p>
                    </div>
                    <span>{welfareRecommendedApplications.length}건</span>
                  </div>

                  <div className="jp-welfare-recommend-list">
                    {welfareRecommendedApplications.slice(0, 3).map((application) => (
                      <article className="jp-welfare-recommend-card" key={application.id}>
                        <div>
                          <strong>{application.jobTitle || "추천 공고"}</strong>
                          <span>{application.organization || application.company || ""}</span>
                          <small>{application.location || ""}</small>
                        </div>
                        <em>{application.status || "확인 대기"}</em>
                        <button type="button" onClick={() => setSelectedRecommendedApplication(application)}>
                          공고 보기
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <div className="jp-cards-scroll">
              {recommendedJobs.length > 0 && (
                <section className="jp-recommend-section">
                  <div className="jp-recommend-head">
                    <div>
                      <strong>맞춤 추천 TOP 5</strong>
                      <p>내 조건과 공고 정보를 기준으로 계산한 참고 점수예요.</p>
                    </div>
                  </div>
                  <div className="jp-recommend-grid">
              {recommendedJobs.slice(0, RECOMMEND_SIZE).map((job, idx) => renderJobCard(job, idx, true))}
                  </div>
                </section>
              )}

              {error && <div className="jp-error">⚠️ {error}</div>}
              {loading && jobs.length === 0 && (
                <div className="jp-loading">💼 일자리 정보를 불러오는 중...</div>
              )}
              {!loading && !error && scoredJobs.length === 0 && !hasMoreSource && (
                <div className="jp-empty">
                  <div className="jp-empty-icon">🔍</div>
                  <div className="jp-empty-text">
                    {category ? `${category} 카테고리에 현재 모집 중인 공고가 없습니다.` : "해당하는 일자리가 없습니다."}
                  </div>
                </div>
              )}

              {visibleJobs.map((job, idx) => renderJobCard(job, idx))}

              {!loading && !error && hasMoreVisible && (
                <button className="jp-more-btn" type="button" onClick={handleMore}>
                  {visibleJobs.length > 0
                    ? `더보기 (${visibleJobs.length + recommendedJobs.length} / ${scoredJobs.length + (hasMoreSource ? "+" : "")}건)`
                    : "이 조건의 공고 더 찾아보기"}
                </button>
              )}
              </div>
            </main>
          </>
        )}
      </div>

      {selected && (
        <div className="jp-overlay" onClick={() => setSelected(null)}>
          <div className="jp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button className="jp-modal-close" type="button" onClick={() => setSelected(null)}>×</button>
              <div className="jp-modal-title">{selected.recrtTitle}</div>
              <div className="jp-modal-company">{selected.oranNm || "기업명 미공개"}</div>
            </div>
            <div className="jp-modal-body">
              {[
                { key: "출처", val: selected.source },
                { key: "추천점수", val: `${selected.match?.score ?? scoreJobMatch(selected, profile || {}, category).score}점` },
                { key: "고용형태", val: EMPL_MAP[selected.emplymShp] || selected.emplymShpNm || "기타" },
                { key: "근무지", val: selected.workPlcNm },
                { key: "상세주소", val: selected.plDetAddr },
                { key: "직종", val: selected.jobclsNm },
                { key: "근무시간", val: selected.workTime },
                { key: "주당시간", val: selected.weekHours ? `${selected.weekHours}시간` : "" },
                { key: "급여", val: selected.wage },
                { key: "모집인원", val: selected.clltPrnnum ? `${selected.clltPrnnum}명` : "" },
                { key: "접수기간", val: `${formatDate(selected.frDd)} ~ ${formatDate(selected.toDd)}` },
                { key: "접수방법", val: selected.acptMthd },
                { key: "연락처", val: selected.clerkContt },
                { key: "상세내용", val: selected.detCnts },
              ].filter((row) => row.val).map((row) => (
                <div key={row.key} className="jp-modal-row">
                  <div className="jp-modal-key">{row.key}</div>
                  <div className="jp-modal-val">{row.val}</div>
                </div>
              ))}
              <div className="jp-modal-actions">
                <button className="jp-modal-apply" type="button" onClick={() => handleNotifyManager(selected)}>
                  관심공고 등록하기
                </button>
                <button className="jp-modal-apply" type="button" onClick={() => handleApply(selected)}>
                  신청하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRecommendedApplication && (
        <div className="jp-overlay" onClick={() => setSelectedRecommendedApplication(null)}>
          <div className="jp-modal jp-application-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button
                className="jp-modal-close"
                type="button"
                onClick={() => setSelectedRecommendedApplication(null)}
              >
                ×
              </button>
              <div className="jp-modal-title">{selectedRecommendedApplication.jobTitle || "추천 공고"}</div>
              <div className="jp-modal-company">
                {selectedRecommendedApplication.organization || selectedRecommendedApplication.company || "기관 정보 없음"}
              </div>
            </div>
            <div className="jp-modal-body">
              {buildApplicationDetailRows(selectedRecommendedApplication, "추천 상태").filter((row) => row.val).map((row) => (
                <div key={row.key} className="jp-modal-row">
                  <div className="jp-modal-key">{row.key}</div>
                  <div className="jp-modal-val">{row.val}</div>
                </div>
              ))}

              <div className="jp-recommend-response-actions">
                <button
                  type="button"
                  onClick={() => handleUpdateApplicationStatus(selectedRecommendedApplication, "관심 있음")}
                >
                  관심 있어요
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateApplicationStatus(selectedRecommendedApplication, "거절")}
                >
                  거절할게요
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateApplicationStatus(selectedRecommendedApplication, "문의 요청")}
                >
                  복지사에게 문의
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInterestModalOpen && (
        <div className="jp-overlay" onClick={() => setIsInterestModalOpen(false)}>
          <div className="jp-modal jp-application-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button
                className="jp-modal-close"
                type="button"
                onClick={() => setIsInterestModalOpen(false)}
              >
                ×
              </button>
              <div className="jp-modal-title">관심 공고 모아 보기</div>
              <div className="jp-modal-company">관심공고로 등록한 일자리를 한 번에 확인할 수 있어요.</div>
            </div>
            <div className="jp-modal-body">
              {interestedApplications.length === 0 ? (
                <div className="jp-application-empty">아직 관심공고가 없습니다.</div>
              ) : (
                <div className="jp-application-list">
                  {interestedApplications.map((application) => (
                    <article
                      className="jp-application-item jp-application-item-clickable"
                      key={application.id}
                      onClick={() => openInterestApplicationDetail(application)}
                    >
                      <div>
                        <strong>{application.jobTitle || "관심 공고"}</strong>
                        <span>{application.organization || application.company || ""}</span>
                      </div>
                      <em>{application.status || "관심 있음"}</em>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedInterestApplication && (
        <div className="jp-overlay" onClick={() => setSelectedInterestApplication(null)}>
          <div className="jp-modal jp-application-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button
                className="jp-modal-close"
                type="button"
                onClick={() => setSelectedInterestApplication(null)}
              >
                ×
              </button>
              <div className="jp-modal-title">{selectedInterestApplication.jobTitle || "관심 공고"}</div>
              <div className="jp-modal-company">
                {selectedInterestApplication.organization || selectedInterestApplication.company || "기관 정보 없음"}
              </div>
            </div>
            <div className="jp-modal-body">
              {buildApplicationDetailRows(selectedInterestApplication).filter((row) => row.val).map((row) => (
                <div key={row.key} className="jp-modal-row">
                  <div className="jp-modal-key">{row.key}</div>
                  <div className="jp-modal-val">{row.val}</div>
                </div>
              ))}
              <div className="jp-modal-actions">
                <button
                  className="jp-modal-apply"
                  type="button"
                  onClick={() => handleApplyFromInterest(selectedInterestApplication)}
                >
                  신청하기
                </button>
                <button
                  className="jp-modal-secondary"
                  type="button"
                  onClick={() => handleDeleteInterest(selectedInterestApplication)}
                >
                  관심공고 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isApplicationModalOpen && (
        <div className="jp-overlay" onClick={() => setIsApplicationModalOpen(false)}>
          <div className="jp-modal jp-application-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button
                className="jp-modal-close"
                type="button"
                onClick={() => setIsApplicationModalOpen(false)}
              >
                ×
              </button>
              <div className="jp-modal-title">내가 신청한 일자리</div>
              <div className="jp-modal-company">신청한 공고와 처리 결과를 확인할 수 있어요.</div>
            </div>
            <div className="jp-modal-body">
              {appliedApplications.length === 0 ? (
                <div className="jp-application-empty">아직 신청한 일자리가 없습니다.</div>
              ) : (
                <div className="jp-application-list">
                  {appliedApplications.map((application) => (
                    <article className="jp-application-item" key={application.id}>
                      <div>
                        <strong>{application.jobTitle || "신청 공고"}</strong>
                        <span>{application.organization || application.company || ""}</span>
                      </div>
                      <em>{application.status || "검토 대기"}</em>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
