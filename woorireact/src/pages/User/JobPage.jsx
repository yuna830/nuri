import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
};

const SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

const EMPL_MAP = { CM0101: "정규직", CM0102: "계약직", CM0103: "시간제", CM0104: "일당직", CM0105: "기타" };
const EMPL_COLOR = {
  CM0101: { bg: "#e8f4ea", color: "#2d7a3a" }, CM0102: { bg: "#e8edf8", color: "#2d4a8a" },
  CM0103: { bg: "#fef3e2", color: "#8a5a00" }, CM0104: { bg: "#fdeaea", color: "#8a2020" },
  CM0105: { bg: "#f0f0f0", color: "#555" },
};
const FILTERS = [
  { label: "전체", value: "" }, { label: "정규직", value: "CM0101" },
  { label: "계약직", value: "CM0102" }, { label: "시간제", value: "CM0103" }, { label: "일당직", value: "CM0104" },
];

const formatDate = (d) => (!d || d.length < 8) ? "-" : `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`;

const parseJobList = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = xml.querySelectorAll("item");
  const total = xml.querySelector("totalCount")?.textContent;
  return {
    list: Array.from(items).map(item => ({
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
    })),
    total: Number(total) || 0,
  };
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .jp-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .jp-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .jp-nav-back {
    background: transparent; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.85rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
  .jp-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .jp-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .jp-nav-count { font-size: 0.82rem; color: ${C.textMuted}; }

  .jp-layout { max-width: 1100px; margin: 0 auto; padding: 2rem; display: grid; grid-template-columns: 220px 1fr; gap: 1.5rem; align-items: start; }

  /* 사이드 필터 */
  .jp-sidebar {}
  .jp-filter-box {
    background: ${C.white}; border-radius: 16px; padding: 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08);
    margin-bottom: 1rem; position: sticky; top: 80px;
  }
  .jp-filter-title { font-size: 0.78rem; font-weight: 700; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.9rem; }
  .jp-filter-btn {
    display: block; width: 100%; padding: 0.6rem 0.9rem; border-radius: 8px;
    border: 1px solid ${C.border}; background: transparent; font-size: 0.88rem;
    font-family: 'Noto Sans KR', sans-serif; color: ${C.textMuted};
    cursor: pointer; text-align: left; margin-bottom: 0.4rem; transition: all 0.12s;
  }
  .jp-filter-btn:hover { background: ${C.greenPale}; border-color: ${C.green}; color: ${C.green}; }
  .jp-filter-btn.active { background: ${C.green}; border-color: ${C.green}; color: #fff; font-weight: 700; }

  /* 메인 */
  .jp-main {}
  .jp-table-wrap {
    background: ${C.white}; border-radius: 16px; border: 1px solid ${C.border};
    box-shadow: 0 2px 10px rgba(134,167,136,0.08); overflow: hidden;
  }
  .jp-table-head {
    display: grid; grid-template-columns: 1fr 100px 100px 120px 130px;
    padding: 0.85rem 1.5rem; background: ${C.greenPale};
    border-bottom: 1px solid ${C.border};
    font-size: 0.75rem; font-weight: 700; color: ${C.textMuted};
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .jp-table-row {
    display: grid; grid-template-columns: 1fr 100px 100px 120px 130px;
    padding: 1rem 1.5rem; border-bottom: 1px solid ${C.border};
    align-items: center; cursor: pointer; transition: background 0.1s;
  }
  .jp-table-row:last-child { border-bottom: none; }
  .jp-table-row:hover { background: ${C.greenPale}; }
  .jp-cell-title { font-size: 0.9rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.2rem; }
  .jp-cell-sub { font-size: 0.78rem; color: ${C.textMuted}; }
  .jp-cell { font-size: 0.85rem; color: ${C.textMuted}; }
  .jp-badge {
    display: inline-block; font-size: 0.72rem; font-weight: 700;
    padding: 0.22rem 0.65rem; border-radius: 99px;
  }
  .jp-deadline { font-size: 0.72rem; font-weight: 700; color: ${C.danger}; }

  .jp-loading { text-align: center; padding: 4rem; color: ${C.textMuted}; }
  .jp-error { text-align: center; padding: 2rem; color: ${C.danger}; background: #fdf0f0; border-radius: 12px; margin-bottom: 1rem; }
  .jp-empty { text-align: center; padding: 4rem 2rem; color: ${C.textMuted}; }
  .jp-more-btn {
    width: 100%; padding: 0.9rem; background: ${C.white}; border: 1.5px solid ${C.green};
    border-radius: 0 0 16px 16px; color: ${C.green}; font-size: 0.9rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer; border-top: 1px solid ${C.border};
  }
  .jp-more-btn:hover { background: ${C.greenPale}; }
`;

export default function JobPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchJobs = async (pageNo = 1, emplymShp = "", append = false) => {
    setLoading(true); setError(null);
    try {
      let url = `/senuri/B552474/SenuriService/getJobList?ServiceKey=${SERVICE_KEY}&pageNo=${pageNo}&numOfRows=15`;
      if (emplymShp) url += `&emplymShp=${emplymShp}`;
      const res = await fetch(url);
      const text = await res.text();
      const { list, total } = parseJobList(text);
      setTotalCount(total);
      setJobs(prev => append ? [...prev, ...list] : list);
    } catch { setError("일자리 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(1, filter); setPage(1); }, [filter]);

  const handleMore = () => { const next = page + 1; setPage(next); fetchJobs(next, filter, true); };

  return (
    <>
      <style>{styles}</style>
      <div className="jp-root">
        <nav className="jp-nav">
          <button className="jp-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="jp-nav-title">💼 일자리 찾기</div>
          {!loading && !error && <div className="jp-nav-count">총 {totalCount}건</div>}
        </nav>

        <div className="jp-layout">

          {/* 사이드 필터 */}
          <aside className="jp-sidebar">
            <div className="jp-filter-box">
              <div className="jp-filter-title">고용형태</div>
              {FILTERS.map(f => (
                <button key={f.value} className={`jp-filter-btn ${filter === f.value ? "active" : ""}`} onClick={() => setFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </aside>

          {/* 메인 목록 */}
          <main className="jp-main">
            {error && <div className="jp-error">⚠️ {error}</div>}
            {loading && jobs.length === 0 && <div className="jp-loading">💼 일자리 정보 불러오는 중...</div>}

            {!error && jobs.length > 0 && (
              <div className="jp-table-wrap">
                <div className="jp-table-head">
                  <div>채용공고</div>
                  <div>고용형태</div>
                  <div>직종</div>
                  <div>근무지</div>
                  <div>접수기간</div>
                </div>
                {jobs.map(job => {
                  const color = EMPL_COLOR[job.emplymShp] || EMPL_COLOR["CM0105"];
                  const empl = EMPL_MAP[job.emplymShp] || "기타";
                  return (
                    <div key={job.jobId} className="jp-table-row">
                      <div>
                        <div className="jp-cell-title">{job.recrtTitle}</div>
                        <div className="jp-cell-sub">🏢 {job.oranNm || "기업명 미공개"} {job.deadline === "마감" && <span className="jp-deadline"> · 마감</span>}</div>
                      </div>
                      <div><span className="jp-badge" style={{ background: color.bg, color: color.color }}>{empl}</span></div>
                      <div className="jp-cell">{job.jobclsNm || "-"}</div>
                      <div className="jp-cell">{job.workPlcNm || "-"}</div>
                      <div className="jp-cell" style={{ fontSize: "0.78rem" }}>{formatDate(job.frDd)}~<br />{formatDate(job.toDd)}</div>
                    </div>
                  );
                })}
                {!loading && jobs.length < totalCount && (
                  <button className="jp-more-btn" onClick={handleMore}>더보기 ({jobs.length} / {totalCount})</button>
                )}
              </div>
            )}

            {!loading && !error && jobs.length === 0 && (
              <div className="jp-empty">
                <div style={{ fontSize: "3rem", marginBottom: "0.8rem" }}>🔍</div>
                <div>해당하는 일자리가 없습니다</div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}