import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EMPL_COLOR,
  EMPL_MAP,
  FILTERS,
  fetchJobList,
  formatDate,
  getSavedJobProfile,
} from "../../utils/user/jobApi";
import "../../css/user/JobPage.css";

export default function JobPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setProfile(getSavedJobProfile());
  }, []);

  const loadJobs = useCallback(async (pageNo = 1, emplymShp = "", append = false) => {
    setLoading(true);
    setError(null);

    try {
      const { list, total } = await fetchJobList(pageNo, emplymShp);

      setTotalCount(total);
      setJobs((prev) => (append ? [...prev, ...list] : list));
    } catch (fetchError) {
      console.error("일자리 조회 실패:", fetchError);
      setError("일자리 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs(1, filter);
    setPage(1);
  }, [filter, loadJobs]);

  const handleMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadJobs(nextPage, filter, true);
  };

  const filtered = search
    ? jobs.filter((job) =>
        job.recrtTitle.includes(search) ||
        job.oranNm.includes(search) ||
        job.workPlcNm.includes(search)
      )
    : jobs;

  return (
    <div className="jp-root">
      <nav className="jp-nav">
        <button className="jp-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>

        <div className="jp-nav-title">💼 일자리 찾기</div>

        {!loading && !error && (
          <div className="jp-nav-count">총 {totalCount}건</div>
        )}
      </nav>

      <div className="jp-layout">
        <aside className="jp-sidebar">
          <div className="jp-filter-box">
            <div className="jp-filter-title">고용형태 필터</div>

            {FILTERS.map((item) => (
              <button
                key={item.value}
                className={`jp-filter-btn ${filter === item.value ? "active" : ""}`}
                type="button"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                {filter !== item.value && (
                  <span className={`jp-filter-dot ${item.value || "all"}`} />
                )}
              </button>
            ))}
          </div>

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
                ✕
              </button>
            )}
          </div>

          <div className="jp-main-head">
            <div className="jp-main-label">
              {search
                ? `"${search}" 검색 결과 · ${filtered.length}건`
                : `구인 목록 · ${filtered.length}건 표시 중`}
            </div>
          </div>

          {error && <div className="jp-error">⚠️ {error}</div>}

          {loading && jobs.length === 0 && (
            <div className="jp-loading">💼 일자리 정보 불러오는 중...</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="jp-empty">
              <div className="jp-empty-icon">🔍</div>
              <div className="jp-empty-text">해당하는 일자리가 없습니다</div>
            </div>
          )}

          {filtered.map((job) => {
            const empl = EMPL_MAP[job.emplymShp] || "기타";
            const color = EMPL_COLOR[job.emplymShp] || EMPL_COLOR.CM0105;

            return (
              <article key={job.jobId} className="jp-card" onClick={() => setSelected(job)}>
                <div className="jp-card-bar" />
                <div className="jp-card-inner">
                  <div className="jp-card-top">
                    <div className="jp-card-title">{job.recrtTitle}</div>
                    <div className="jp-card-badge" style={{ background: color.bg, color: color.color }}>
                      {empl}
                    </div>
                  </div>

                  <div className="jp-card-company">
                    🏢 {job.oranNm || "기업명 미공개"}
                    {job.deadline === "마감" && <span className="jp-card-deadline">· 마감</span>}
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

          {!loading && !error && jobs.length > 0 && jobs.length < totalCount && !search && (
            <button className="jp-more-btn" type="button" onClick={handleMore}>
              더보기 ({jobs.length} / {totalCount}건)
            </button>
          )}
        </main>
      </div>

      {selected && (
        <div className="jp-overlay" onClick={() => setSelected(null)}>
          <div className="jp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jp-modal-header">
              <button className="jp-modal-close" type="button" onClick={() => setSelected(null)}>
                ✕
              </button>
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
              ].filter((row) => row.val).map((row) => (
                <div key={row.key} className="jp-modal-row">
                  <div className="jp-modal-key">{row.key}</div>
                  <div className="jp-modal-val">{row.val}</div>
                </div>
              ))}

              <button className="jp-modal-apply" type="button">
                📞 지원하기 / 문의하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
