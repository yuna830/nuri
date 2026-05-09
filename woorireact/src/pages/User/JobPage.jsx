import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EMPL_COLOR,
  EMPL_MAP,
  fetchJobList,
  formatDate,
  getSavedJobProfile,
  JOB_CATEGORY_FILTERS,
  categorizeJob,
} from "../../utils/user/jobApi";
import "../../css/user/JobPage.css";

export default function JobPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [hideExpired, setHideExpired] = useState(true);

  useEffect(() => { setProfile(getSavedJobProfile()); }, []);

  const fetchAll = async (startPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const pages = [startPage, startPage + 1, startPage + 2, startPage + 3, startPage + 4];
      const results = await Promise.all(pages.map(p => fetchJobList(p, "")));
      const allJobs = results.flatMap(r => r.list);
      const total = results[0]?.total || 0;
      const unique = Array.from(new Map(allJobs.map(j => [j.jobId, j])).values());
      setTotalCount(total);
      return { unique, total };
    } catch {
      setError("일자리 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return { unique: [], total: 0 };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(1).then(({ unique }) => {
      setJobs(unique);
      setPage(5);
    });
  }, [category]);

  const handleMore = async () => {
    if (loading) return;

    const nextStart = page + 1;
    setLoading(true);

    try {
      const pages = [nextStart, nextStart + 1, nextStart + 2, nextStart + 3, nextStart + 4];
      const results = await Promise.all(pages.map(p => fetchJobList(p, "")));
      const newJobs = results.flatMap(r => r.list);

      setJobs(prev => {
        const existingIds = new Set(prev.map(j => j.jobId));
        const newOnes = newJobs.filter(j => !existingIds.has(j.jobId));
        return [...prev, ...newOnes];
      });

      setPage(nextStart + 4);
    } catch {
      setError("추가 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (job) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (job.toDd) {
      const y = job.toDd.substring(0, 4);
      const m = job.toDd.substring(4, 6);
      const d = job.toDd.substring(6, 8);
      const endDate = new Date(`${y}-${m}-${d}`);
      if (endDate < today) return true;
    }
    if (job.deadline === "마감") return true;
    return false;
  };

  const filtered = jobs.filter(job => {
    if (hideExpired && isExpired(job)) return false;
    const matchSearch = search
      ? (job.recrtTitle?.includes(search) || job.oranNm?.includes(search) || job.workPlcNm?.includes(search))
      : true;
    const matchCategory = (() => {
      if (category === "") return true;
      const found = JOB_CATEGORY_FILTERS.find(f => f.value === category);
      if (!found || !found.srchWrd) return categorizeJob(job) === "기타";
      return job.recrtTitle?.includes(found.srchWrd) || job.jobclsNm?.includes(found.srchWrd);
    })();
    return matchSearch && matchCategory;
  });

  const handleApply = (job) => {
    if (job.clerkContt) {
      window.location.href = `tel:${job.clerkContt.replace(/[^0-9]/g, "")}`;
    } else {
      alert("연락처 정보가 없습니다. 복지사에게 문의해주세요.");
    }
  };

  const handleNotifyManager = async (job) => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      const seniorId = saved ? JSON.parse(saved)?.senior?.id : null;
      if (!seniorId) { alert("로그인 정보가 없습니다."); return; }
      await fetch(`http://localhost:8083/api/job-interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seniorId,
          jobId: job.jobId,
          jobTitle: job.recrtTitle,
          company: job.oranNm,
          location: job.workPlcNm,
        }),
      });
      alert("복지사에게 관심 공고를 전달했어요!");
    } catch {
      alert("전달에 실패했습니다. 복지사에게 직접 문의해주세요.");
    }
  };

  return (
    <div className="jp-root">
      <nav className="jp-nav">
        <button className="jp-nav-back" type="button" onClick={() => navigate("/user")}>← 돌아가기</button>
        <div className="jp-nav-title">💼 일자리 찾기</div>
        {!loading && !error && <div className="jp-nav-count">총 {totalCount}건</div>}
      </nav>

      <div className="jp-top-sticky">
        <div className="jp-top-sticky-inner">
          <div className="jp-category-bar">
            {JOB_CATEGORY_FILTERS.map((item) => (
              <button
                key={item.label}
                className={`jp-cat-btn ${category === item.value ? "active" : ""}`}
                type="button"
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="jp-search-wrap">
            <span className="jp-search-icon">🔍</span>
            <input
              className="jp-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="공고명, 기업명, 근무지 검색..."
            />
            {search && (
              <button className="jp-search-clear" type="button" onClick={() => setSearch("")}>✕</button>
            )}
            <div className="jp-search-divider" />
            <label className="jp-expire-filter">
              <input
                type="checkbox"
                className="jp-expire-checkbox"
                checked={hideExpired}
                onChange={e => setHideExpired(e.target.checked)}
              />
              <span className="jp-expire-label">마감 숨기기</span>
            </label>
          </div>
        </div>
      </div>

      <div className="jp-layout">
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
        </aside>

        <main className="jp-main">
          <div className="jp-main-head">
            <div className="jp-main-label">
              {search
                ? `"${search}" 검색 결과 · ${filtered.length}건`
                : category
                ? `${category} · ${filtered.length}건`
                : `구인 목록 · ${filtered.length}건 표시 중`}
            </div>
          </div>

          {error && <div className="jp-error">⚠️ {error}</div>}
          {loading && jobs.length === 0 && (
            <div className="jp-loading">💼 일자리 정보 불러오는 중... (500건 로딩 중)</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="jp-empty">
              <div className="jp-empty-icon">🔍</div>
              <div className="jp-empty-text">해당하는 일자리가 없습니다</div>
            </div>
          )}

          {filtered.map((job, idx) => {
            const empl = EMPL_MAP[job.emplymShp] || "기타";
            const color = EMPL_COLOR[job.emplymShp] || EMPL_COLOR.CM0105;
            const jobCategory = categorizeJob(job);
            const expired = isExpired(job);

            return (
              <article
                key={`${job.jobId}-${idx}`}
                className={`jp-card ${expired ? "jp-card-expired" : ""}`}
                onClick={() => {
                  if (!expired) setSelected(job);
                }}
              >
                <div className="jp-card-bar" />
                <div className="jp-card-inner">
                  <div className="jp-card-top">
                    <div className="jp-card-title">{job.recrtTitle}</div>
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      {expired && (
                        <div
                          className="jp-card-badge"
                          style={{
                            background: "#fff1f1",
                            color: "#d93025",
                            border: "1px solid #f1b5b5",
                          }}
                        >
                          마감
                        </div>
                      )}
                      <div className="jp-card-badge" style={{ background: "#eef6ef", color: "#5f7d61", border: "1px solid #b8d4ba" }}>
                        {jobCategory}
                      </div>
                      <div className="jp-card-badge" style={{ background: color.bg, color: color.color }}>
                        {empl}
                      </div>
                    </div>
                  </div>
                  <div className="jp-card-company">
                    🏢 {job.oranNm || "기업명 미공개"}
                  </div>
                  <div className="jp-card-tags">
                    {job.workPlcNm && <span className="jp-card-tag">📍 {job.workPlcNm}</span>}
                    {job.jobclsNm && <span className="jp-card-tag">💼 {job.jobclsNm}</span>}
                    {job.acptMthd && <span className="jp-card-tag">📋 {job.acptMthd}</span>}
                    {job.clltPrnnum && <span className="jp-card-tag">👥 {job.clltPrnnum}명 모집</span>}
                  </div>
                  <div className="jp-card-date">
                    📅 {formatDate(job.frDd)} ~ {formatDate(job.toDd)}
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && !error && jobs.length > 0 && jobs.length < totalCount && (
            <button className="jp-more-btn" type="button" onClick={handleMore}>
              더보기 ({jobs.length} / {totalCount}건)
            </button>
          )}
        </main>
      </div>

      {selected && (
        <div className="jp-overlay" onClick={() => setSelected(null)}>
          <div className="jp-modal" onClick={e => e.stopPropagation()}>
            <div className="jp-modal-header">
              <button className="jp-modal-close" type="button" onClick={() => setSelected(null)}>✕</button>
              <div className="jp-modal-title">{selected.recrtTitle}</div>
              <div className="jp-modal-company">🏢 {selected.oranNm || "기업명 미공개"}</div>
            </div>
            <div className="jp-modal-body">
              {[
                { key: "고용형태", val: EMPL_MAP[selected.emplymShp] || "기타" },
                { key: "근무지", val: selected.workPlcNm },
                { key: "상세주소", val: selected.plDetAddr },
                { key: "직종", val: selected.jobclsNm },
                { key: "모집인원", val: selected.clltPrnnum ? `${selected.clltPrnnum}명` : "-" },
                { key: "접수기간", val: `${formatDate(selected.frDd)} ~ ${formatDate(selected.toDd)}` },
                { key: "접수방법", val: selected.acptMthd },
                { key: "연락처", val: selected.clerkContt },
                { key: "상세내용", val: selected.detCnts },
              ].filter(row => row.val).map(row => (
                <div key={row.key} className="jp-modal-row">
                  <div className="jp-modal-key">{row.key}</div>
                  <div className="jp-modal-val">{row.val}</div>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem", marginTop: "1.3rem" }}>
                <button className="jp-modal-apply" style={{ margin: 0, background: "#86a788" }} type="button" onClick={() => handleApply(selected)}>
                  📞 전화 지원하기
                </button>
                <button className="jp-modal-apply" style={{ margin: 0, background: "#5f7d61" }} type="button" onClick={() => handleNotifyManager(selected)}>
                  📋 복지사에게 알리기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
