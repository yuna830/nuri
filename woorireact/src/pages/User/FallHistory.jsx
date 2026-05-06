import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", dangerLight: "#fdf0f0",
  text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
};

const DUMMY_LOGS = [
  { id: 1, date: "2026-05-04", time: "오전 8:32", location: "거실", status: "보호자 확인 완료", confirmed: true },
  { id: 2, date: "2026-04-28", time: "오후 3:15", location: "욕실", status: "119 출동", confirmed: true },
  { id: 3, date: "2026-04-20", time: "오전 11:50", location: "침실", status: "오탐지 (정상)", confirmed: false },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .fh-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .fh-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .fh-nav-back {
    background: transparent; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.85rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
  .fh-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .fh-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; }

  .fh-layout { max-width: 900px; margin: 0 auto; padding: 2rem; }

  /* 요약 카드 */
  .fh-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .fh-stat {
    background: ${C.white}; border-radius: 16px; padding: 1.4rem 1.5rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08);
    text-align: center;
  }
  .fh-stat-label { font-size: 0.72rem; font-weight: 700; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
  .fh-stat-value { font-size: 2.5rem; font-weight: 700; line-height: 1; }
  .fh-stat-unit { font-size: 0.8rem; margin-top: 0.2rem; color: ${C.textMuted}; }
  .fh-stat.fall .fh-stat-value { color: ${C.danger}; }
  .fh-stat.fall .fh-stat-label { color: ${C.danger}; }
  .fh-stat.total .fh-stat-value { color: ${C.green}; }
  .fh-stat.total .fh-stat-label { color: ${C.greenDark}; }

  /* 테이블 */
  .fh-table-wrap {
    background: ${C.white}; border-radius: 16px; border: 1px solid ${C.border};
    box-shadow: 0 2px 10px rgba(134,167,136,0.08); overflow: hidden;
  }
  .fh-table-head {
    display: grid; grid-template-columns: 80px 1fr 120px 180px 100px;
    padding: 0.85rem 1.5rem; background: ${C.greenPale};
    border-bottom: 1px solid ${C.border};
    font-size: 0.75rem; font-weight: 700; color: ${C.textMuted};
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .fh-table-row {
    display: grid; grid-template-columns: 80px 1fr 120px 180px 100px;
    padding: 1rem 1.5rem; border-bottom: 1px solid ${C.border};
    align-items: center; transition: background 0.1s;
  }
  .fh-table-row:last-child { border-bottom: none; }
  .fh-table-row:hover { background: ${C.greenPale}; }
  .fh-cell { font-size: 0.88rem; color: ${C.text}; }
  .fh-cell-muted { font-size: 0.85rem; color: ${C.textMuted}; }
  .fh-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.7rem;
    border-radius: 99px; color: #fff;
  }
  .fh-empty { text-align: center; padding: 4rem 2rem; color: ${C.textMuted}; }
  .fh-section-label {
    font-size: 0.78rem; font-weight: 700; color: ${C.textMuted};
    letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.9rem;
  }
`;

export default function FallHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);

  useEffect(() => { setLogs(DUMMY_LOGS); }, []);

  const fallCount = logs.filter(l => l.confirmed).length;
  const falseCount = logs.filter(l => !l.confirmed).length;

  return (
    <>
      <style>{styles}</style>
      <div className="fh-root">
        <nav className="fh-nav">
          <button className="fh-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="fh-nav-title">📋 낙상 기록</div>
        </nav>

        <div className="fh-layout">

          {/* 요약 */}
          <div className="fh-summary">
            <div className="fh-stat fall">
              <div className="fh-stat-label">이번 달 낙상</div>
              <div className="fh-stat-value">{fallCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat">
              <div className="fh-stat-label">오탐지</div>
              <div className="fh-stat-value" style={{ color: C.textMuted }}>{falseCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat total">
              <div className="fh-stat-label">전체 기록</div>
              <div className="fh-stat-value">{logs.length}</div>
              <div className="fh-stat-unit">건</div>
            </div>
          </div>

          {/* 테이블 */}
          <div className="fh-section-label">감지 이력</div>
          <div className="fh-table-wrap">
            <div className="fh-table-head">
              <div>구분</div>
              <div>날짜 · 시간</div>
              <div>감지 위치</div>
              <div>처리 상태</div>
              <div>판정</div>
            </div>
            {logs.length === 0 ? (
              <div className="fh-empty">낙상 기록이 없습니다 😊</div>
            ) : (
              logs.map((log, i) => (
                <div key={log.id} className="fh-table-row">
                  <div className="fh-cell-muted">{String(i + 1).padStart(2, "0")}</div>
                  <div className="fh-cell">{log.date} {log.time}</div>
                  <div className="fh-cell">📍 {log.location}</div>
                  <div className="fh-cell-muted">{log.status}</div>
                  <div>
                    <span className="fh-badge" style={{ background: log.confirmed ? C.danger : "#aaa" }}>
                      {log.confirmed ? "🚨 낙상" : "✓ 오탐지"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}