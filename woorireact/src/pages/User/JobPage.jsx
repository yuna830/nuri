import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC",
  green: "#86A788",
  greenDark: "#5f7d61",
  greenLight: "#b8d4ba",
  greenPale: "#eef6ef",
  white: "#ffffff",
  danger: "#e05252",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

const SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

const EMPL_MAP = {
  CM0101: "정규직", CM0102: "계약직", CM0103: "시간제", CM0104: "일당직", CM0105: "기타",
};
const EMPL_COLOR = {
  CM0101: { bg: "#e8f4ea", color: "#2d7a3a" },
  CM0102: { bg: "#e8edf8", color: "#2d4a8a" },
  CM0103: { bg: "#fef3e2", color: "#8a5a00" },
  CM0104: { bg: "#fdeaea", color: "#8a2020" },
  CM0105: { bg: "#f0f0f0", color: "#555" },
};
const FILTERS = [
  { label: "전체", value: "" },
  { label: "정규직", value: "CM0101" },
  { label: "계약직", value: "CM0102" },
  { label: "시간제", value: "CM0103" },
  { label: "일당직", value: "CM0104" },
];

const formatDate = (d) => {
  if (!d || d.length < 8) return "-";
  return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`;
};

const parseJobList = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = xml.querySelectorAll("item");
  const total = xml.querySelector("totalCount")?.textContent;
  return {
    list: Array.from(items).map(item => ({
      jobId:      item.querySelector("jobId")?.textContent || "",
      recrtTitle: item.querySelector("recrtTitle")?.textContent || "",
      oranNm:     item.querySelector("oranNm")?.textContent || "",
      emplymShp:  item.querySelector("emplymShp")?.textContent || "CM0105",
      emplymShpNm:item.querySelector("emplymShpNm")?.textContent || "기타",
      workPlcNm:  item.querySelector("workPlcNm")?.textContent || "",
      jobclsNm:   item.querySelector("jobclsNm")?.textContent || "",
      frDd:       item.querySelector("frDd")?.textContent || "",
      toDd:       item.querySelector("toDd")?.textContent || "",
      acptMthd:   item.querySelector("acptMthd")?.textContent || "",
      deadline:   item.querySelector("deadline")?.textContent || "",
      plDetAddr:  item.querySelector("plDetAddr")?.textContent || "",
      clerkContt: item.querySelector("clerkContt")?.textContent || "",
      detCnts:    item.querySelector("detCnts")?.textContent || "",
      clltPrnnum: item.querySelector("clltPrnnum")?.textContent || "",
    })),
    total: Number(total) || 0,
  };
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .jp-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
  }

  /* 네비바 */
  .jp-nav {
    background: ${C.white};
    border-bottom: 1px solid ${C.border};
    padding: 0 2rem;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .jp-nav-back {
    background: transparent;
    border: 1px solid ${C.border};
    border-radius: 8px;
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    color: ${C.textMuted};
    cursor: pointer;
    font-family: 'Noto Sans KR', sans-serif;
    transition: all 0.13s;
  }
  .jp-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .jp-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .jp-nav-count {
    font-size: 0.82rem;
    color: ${C.textMuted};
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 99px;
    padding: 0.25rem 0.8rem;
  }

  /* 레이아웃 */
  .jp-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  /* 왼쪽 사이드바 */
  .jp-sidebar {}
  .jp-filter-box {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    margin-bottom: 1rem;
    position: sticky;
    top: 80px;
  }
  .jp-filter-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 1rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid ${C.border};
  }
  .jp-filter-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    border: 1.5px solid transparent;
    background: transparent;
    font-size: 0.88rem;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.textMuted};
    cursor: pointer;
    text-align: left;
    margin-bottom: 0.3rem;
    transition: all 0.13s;
  }
  .jp-filter-btn:hover { background: ${C.greenPale}; color: ${C.green}; }
  .jp-filter-btn.active {
    background: ${C.green};
    color: #fff;
    font-weight: 700;
    border-color: ${C.green};
  }
  .jp-filter-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* 프로필 조건 카드 */
  .jp-profile-box {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 18px;
    padding: 1.2rem 1.4rem;
    position: sticky;
    top: calc(80px + 220px + 1rem);
  }
  .jp-profile-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.greenDark};
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 0.9rem;
  }
  .jp-profile-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid ${C.greenLight};
  }
  .jp-profile-row:last-child { border-bottom: none; }
  .jp-profile-key { font-size: 0.75rem; color: ${C.textMuted}; min-width: 56px; }
  .jp-profile-val { font-size: 0.82rem; font-weight: 700; color: ${C.greenDark}; }

  /* 오른쪽 메인 */
  .jp-main {}
  .jp-main-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .jp-main-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  /* 검색창 */
  .jp-search-wrap {
    background: ${C.white};
    border-radius: 14px;
    padding: 0.7rem 1rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 8px rgba(134,167,136,0.07);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .jp-search-icon { font-size: 1rem; color: ${C.textMuted}; flex-shrink: 0; }
  .jp-search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.9rem;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
    background: transparent;
  }
  .jp-search-input::placeholder { color: ${C.textMuted}; }

  /* 일자리 카드 */
  .jp-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.6rem;
    margin-bottom: 0.9rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.07);
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
    cursor: pointer;
  }
  .jp-card:hover {
    box-shadow: 0 4px 20px rgba(134,167,136,0.15);
    border-color: ${C.green};
  }
  .jp-card-bar {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 5px;
    background: ${C.green};
    border-radius: 18px 0 0 18px;
  }
  .jp-card-inner { padding-left: 0.6rem; }
  .jp-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .jp-card-title {
    font-size: 1rem;
    font-weight: 700;
    color: ${C.text};
    line-height: 1.4;
    flex: 1;
  }
  .jp-card-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 99px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .jp-card-company {
    font-size: 0.88rem;
    color: ${C.textMuted};
    margin-bottom: 0.7rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .jp-card-deadline {
    font-size: 0.72rem;
    font-weight: 700;
    color: ${C.danger};
    margin-left: 0.5rem;
  }
  .jp-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.7rem;
  }
  .jp-card-tag {
    font-size: 0.75rem;
    padding: 0.22rem 0.7rem;
    border-radius: 8px;
    background: ${C.greenPale};
    color: ${C.greenDark};
    font-weight: 500;
  }
  .jp-card-date {
    font-size: 0.75rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  /* 상세 모달 */
  .jp-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .jp-modal {
    background: ${C.white};
    border-radius: 24px;
    padding: 0;
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }
  .jp-modal-header {
    background: ${C.green};
    padding: 1.5rem 1.8rem;
    border-radius: 24px 24px 0 0;
    color: #fff;
    position: relative;
  }
  .jp-modal-close {
    position: absolute;
    top: 1rem; right: 1rem;
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 50%;
    width: 32px; height: 32px;
    cursor: pointer;
    font-size: 1rem;
    color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .jp-modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.3rem; line-height: 1.4; }
  .jp-modal-company { font-size: 0.85rem; opacity: 0.85; }
  .jp-modal-body { padding: 1.5rem 1.8rem; }
  .jp-modal-row {
    display: flex;
    gap: 0.8rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid ${C.border};
    align-items: flex-start;
  }
  .jp-modal-row:last-child { border-bottom: none; }
  .jp-modal-key {
    font-size: 0.75rem;
    font-weight: 700;
    color: ${C.textMuted};
    min-width: 68px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .jp-modal-val {
    font-size: 0.88rem;
    color: ${C.text};
    line-height: 1.6;
    flex: 1;
  }
  .jp-modal-apply {
    width: 100%;
    margin-top: 1.3rem;
    padding: 1rem;
    background: ${C.green};
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif;
    cursor: pointer;
    transition: opacity 0.13s;
  }
  .jp-modal-apply:hover { opacity: 0.9; }

  /* 더보기 */
  .jp-more-btn {
    width: 100%;
    padding: 1rem;
    background: ${C.white};
    border: 1.5px solid ${C.green};
    border-radius: 14px;
    color: ${C.green};
    font-size: 0.92rem;
    font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: background 0.13s;
  }
  .jp-more-btn:hover { background: ${C.greenPale}; }

  /* 로딩·에러·빈화면 */
  .jp-loading { text-align: center; padding: 4rem 2rem; color: ${C.textMuted}; font-size: 1rem; }
  .jp-error {
    text-align: center; padding: 2rem;
    color: ${C.danger}; font-size: 0.9rem;
    background: #fdf0f0; border-radius: 14px; margin-bottom: 1rem;
  }
  .jp-empty { text-align: center; padding: 4rem 2rem; color: ${C.textMuted}; }
  .jp-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .jp-empty-text { font-size: 1rem; }
`;

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
    try {
      const saved = localStorage.getItem("user_profile");
      if (saved) setProfile(JSON.parse(saved));
    } catch {}
  }, []);

  const fetchJobs = async (pageNo = 1, emplymShp = "", append = false) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/senuri/B552474/SenuriService/getJobList?ServiceKey=${SERVICE_KEY}&pageNo=${pageNo}&numOfRows=12`;
      if (emplymShp) url += `&emplymShp=${emplymShp}`;
      const res = await fetch(url);
      const text = await res.text();
      const { list, total } = parseJobList(text);
      setTotalCount(total);
      setJobs(prev => append ? [...prev, ...list] : list);
    } catch {
      setError("일자리 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1, filter);
    setPage(1);
  }, [filter]);

  const handleMore = () => {
    const next = page + 1;
    setPage(next);
    fetchJobs(next, filter, true);
  };

  const filtered = search
    ? jobs.filter(j => j.recrtTitle.includes(search) || j.oranNm.includes(search) || j.workPlcNm.includes(search))
    : jobs;

  return (
    <>
      <style>{styles}</style>
      <div className="jp-root">

        {/* 네비바 */}
        <nav className="jp-nav">
          <button className="jp-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="jp-nav-title">💼 일자리 찾기</div>
          {!loading && !error && (
            <div className="jp-nav-count">총 {totalCount}건</div>
          )}
        </nav>

        <div className="jp-layout">

          {/* 왼쪽 사이드바 */}
          <aside className="jp-sidebar">
            <div className="jp-filter-box">
              <div className="jp-filter-title">고용형태 필터</div>
              {FILTERS.map(f => {
                const colors = {
                  "": { bg: C.green },
                  "CM0101": EMPL_COLOR.CM0101,
                  "CM0102": EMPL_COLOR.CM0102,
                  "CM0103": EMPL_COLOR.CM0103,
                  "CM0104": EMPL_COLOR.CM0104,
                };
                const c = colors[f.value] || { bg: C.green };
                return (
                  <button
                    key={f.value}
                    className={`jp-filter-btn ${filter === f.value ? "active" : ""}`}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                    {filter !== f.value && (
                      <div className="jp-filter-dot" style={{ background: c.bg || c.color }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 내 조건 요약 */}
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

          {/* 오른쪽 메인 */}
          <main className="jp-main">

            {/* 검색창 */}
            <div className="jp-search-wrap">
              <span className="jp-search-icon">🔍</span>
              <input
                className="jp-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="공고명, 기업명, 근무지 검색..."
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem", color: C.textMuted }}>✕</button>
              )}
            </div>

            <div className="jp-main-head">
              <div className="jp-main-label">
                {search ? `"${search}" 검색 결과 · ${filtered.length}건` : `구인 목록 · ${filtered.length}건 표시 중`}
              </div>
            </div>

            {/* 에러 */}
            {error && <div className="jp-error">⚠️ {error}</div>}

            {/* 로딩 */}
            {loading && jobs.length === 0 && (
              <div className="jp-loading">💼 일자리 정보 불러오는 중...</div>
            )}

            {/* 빈 화면 */}
            {!loading && !error && filtered.length === 0 && (
              <div className="jp-empty">
                <div className="jp-empty-icon">🔍</div>
                <div className="jp-empty-text">해당하는 일자리가 없습니다</div>
              </div>
            )}

            {/* 일자리 목록 */}
            {filtered.map(job => {
              const empl = EMPL_MAP[job.emplymShp] || "기타";
              const color = EMPL_COLOR[job.emplymShp] || EMPL_COLOR["CM0105"];
              return (
                <div key={job.jobId} className="jp-card" onClick={() => setSelected(job)}>
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
                </div>
              );
            })}

            {/* 더보기 */}
            {!loading && !error && jobs.length > 0 && jobs.length < totalCount && !search && (
              <button className="jp-more-btn" onClick={handleMore}>
                더보기 ({jobs.length} / {totalCount}건)
              </button>
            )}

          </main>
        </div>

        {/* 상세 모달 */}
        {selected && (
          <div className="jp-overlay" onClick={() => setSelected(null)}>
            <div className="jp-modal" onClick={e => e.stopPropagation()}>
              <div className="jp-modal-header">
                <button className="jp-modal-close" onClick={() => setSelected(null)}>✕</button>
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
                ].filter(r => r.val).map((r, i) => (
                  <div key={i} className="jp-modal-row">
                    <div className="jp-modal-key">{r.key}</div>
                    <div className="jp-modal-val">{r.val}</div>
                  </div>
                ))}
                <button className="jp-modal-apply">
                  📞 지원하기 / 문의하기
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}