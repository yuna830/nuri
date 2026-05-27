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
  isPastDate,
  scoreJobMatch,
} from "../../utils/user/jobApi";
import "../../css/user/JobPage.css";

const PAGE_SIZE = 20;
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
  const [hideExpired, setHideExpired] = useState(true);
  const deferredSearch = useDeferredValue(search);
  const isJobAllowed = !profile || !profile.age || Number(profile.age) >= 20;

  useEffect(() => {
    setProfile(getSavedJobProfile());
  }, []);

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
    return matchesCategory(job) && matchesSearch(job);
  }), [hideExpired, isExpired, matchesCategory, matchesSearch]);

  const scoredJobs = useMemo(() => {
    return filterJobs(jobs)
      .map((job) => ({
        ...job,
        match: scoreJobMatch(job, profile || {}, category),
      }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [category, filterJobs, jobs, profile]);

  const recommendedJobs = scoredJobs.slice(0, 5);
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

      while (shouldContinue) {
        const result = await fetchJobList(nextPage, "", API_PAGE_SIZE);
        nextTotal = result.total || nextTotal;
        const merged = new Map(nextJobs.map((job) => [`${job.source}-${job.jobId}`, job]));
        result.list.forEach((job) => merged.set(`${job.source}-${job.jobId}`, job));
        nextJobs = Array.from(merged.values());

        const enoughForCategory = filterJobs(nextJobs).length >= targetCount;
        const loadedAll = nextTotal > 0 && nextJobs.length >= nextTotal;
        const emptyPage = result.list.length === 0;
        const reachedSafetyLimit = nextPage >= 20;

        shouldContinue = !enoughForCategory && !loadedAll && !emptyPage && !reachedSafetyLimit;
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
    loadUntilEnough({ startPage: 1, targetCount: PAGE_SIZE, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJobAllowed]);

  useEffect(() => {
    if (loading || jobs.length === 0 || scoredJobs.length >= PAGE_SIZE || !hasMoreSource) return;
    loadUntilEnough({
      startPage: loadedPage + 1,
      targetCount: PAGE_SIZE,
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

  const handleApply = (job) => {
    const phone = String(job.clerkContt || "").replace(/[^0-9]/g, "");
    if (phone) {
      window.location.href = `tel:${phone}`;
      return;
    }
    alert("연락처 정보가 없습니다. 복지사에게 문의해주세요.");
  };

  const handleNotifyManager = async (job) => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      const seniorId = saved ? JSON.parse(saved)?.senior?.id : null;
      if (!seniorId) {
        alert("로그인 정보가 없습니다.");
        return;
      }

      await fetch("/api/job-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seniorId,
          jobId: job.jobId,
          jobTitle: job.recrtTitle,
          company: job.oranNm,
          location: job.workPlcNm,
          applicationType: "ONLINE",
          status: "검토 대기",
        }),
      });
      alert("복지사에게 관심 공고를 전달했어요.");
    } catch {
      alert("전달에 실패했습니다. 복지사에게 직접 문의해주세요.");
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

              <div className="jp-main-head">
                <div className="jp-main-label">
                  {search
                    ? `"${search}" 검색결과 · ${scoredJobs.length}건`
                    : category
                      ? `${category} · ${scoredJobs.length}건`
                      : `구인 목록 · ${scoredJobs.length}건 표시 중`}
                </div>
              </div>

              {recommendedJobs.length > 0 && (
                <section className="jp-recommend-box">
                  <div className="jp-recommend-head">
                    <div>
                      <strong>맞춤 추천 TOP 5</strong>
                      <p>내 조건과 공고 정보를 기준으로 계산한 참고 점수예요.</p>
                    </div>
                    <span>최고 {recommendedJobs[0]?.match.score || 0}점</span>
                  </div>
                  <div className="jp-recommend-grid">
              {recommendedJobs.slice(0, 5).map((job, idx) => renderJobCard(job, idx, true))}
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
                  <div className="jp-empty-text">해당하는 일자리가 없습니다.</div>
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
                <button className="jp-modal-apply" type="button" onClick={() => handleApply(selected)}>
                  전화 지원하기
                </button>
                <button className="jp-modal-apply jp-modal-secondary" type="button" onClick={() => handleNotifyManager(selected)}>
                  복지사에게 알리기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
