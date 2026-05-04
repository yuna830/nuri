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
  dangerLight: "#fdf0f0",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .fh-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
    padding-bottom: 3rem;
  }

  /* 헤더 */
  .fh-header {
    background: ${C.green};
    padding: 1.5rem 1.4rem 3rem;
    position: relative;
    overflow: hidden;
  }
  .fh-header::after {
    content:'';
    position:absolute;
    bottom:-60px; right:-40px;
    width:200px; height:200px;
    border-radius:50%;
    background:rgba(255,255,255,0.07);
  }
  .fh-back {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 99px;
    padding: 0.4rem 1rem;
    font-size: 0.85rem;
    color: #ffffff;
    font-family: 'Noto Sans KR', sans-serif;
    cursor: pointer;
    margin-bottom: 1.1rem;
  }
  .fh-back:active { opacity: 0.7; }
  .fh-title { font-size: 1.5rem; font-weight: 700; color: #ffffff; }
  .fh-subtitle { font-size: 0.82rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem; font-weight: 300; }

  /* 바디 */
  .fh-body {
    padding: 0 1.2rem;
    margin-top: -1.6rem;
    position: relative;
    z-index: 1;
  }

  /* 요약 카드 */
  .fh-summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .fh-stat {
    border-radius: 16px;
    padding: 1.1rem 0.8rem;
    text-align: center;
    border: 1px solid transparent;
  }
  .fh-stat-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
  }
  .fh-stat-value { font-size: 2rem; font-weight: 700; line-height: 1; }
  .fh-stat-unit { font-size: 0.75rem; margin-top: 0.15rem; }

  .fh-stat-fall {
    background: ${C.dangerLight};
    border-color: #f5c6c6;
  }
  .fh-stat-fall .fh-stat-label { color: ${C.danger}; }
  .fh-stat-fall .fh-stat-value { color: ${C.danger}; }
  .fh-stat-fall .fh-stat-unit { color: ${C.danger}; opacity: 0.7; }

  .fh-stat-false {
    background: ${C.white};
    border-color: ${C.border};
  }
  .fh-stat-false .fh-stat-label { color: ${C.textMuted}; }
  .fh-stat-false .fh-stat-value { color: ${C.textMuted}; }
  .fh-stat-false .fh-stat-unit { color: ${C.textMuted}; opacity: 0.7; }

  .fh-stat-total {
    background: ${C.greenPale};
    border-color: ${C.greenLight};
  }
  .fh-stat-total .fh-stat-label { color: ${C.greenDark}; }
  .fh-stat-total .fh-stat-value { color: ${C.green}; }
  .fh-stat-total .fh-stat-unit { color: ${C.greenDark}; opacity: 0.7; }

  /* 섹션 라벨 */
  .fh-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: ${C.textMuted};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.7rem;
    padding-left: 0.2rem;
  }

  /* 이력 카드 */
  .fh-log {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    margin-bottom: 0.85rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.07);
    position: relative;
    overflow: hidden;
  }
  .fh-log-bar {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 5px;
    border-radius: 18px 0 0 18px;
  }
  .fh-log-inner { padding-left: 0.5rem; }
  .fh-log-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }
  .fh-log-location {
    font-size: 1rem;
    font-weight: 700;
    color: ${C.text};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .fh-log-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    padding: 0.22rem 0.65rem;
    border-radius: 99px;
  }
  .fh-log-datetime {
    font-size: 0.85rem;
    color: ${C.textMuted};
    margin-bottom: 0.45rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .fh-log-status {
    font-size: 0.82rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  /* 비어있을 때 */
  .fh-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: ${C.textMuted};
  }
  .fh-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .fh-empty-text { font-size: 1rem; }
`;

const DUMMY_LOGS = [
  {
    id: 1,
    date: "2026-05-04",
    time: "오전 8:32",
    location: "거실",
    status: "보호자 확인 완료",
    confirmed: true,
  },
  {
    id: 2,
    date: "2026-04-28",
    time: "오후 3:15",
    location: "욕실",
    status: "119 출동",
    confirmed: true,
  },
  {
    id: 3,
    date: "2026-04-20",
    time: "오전 11:50",
    location: "침실",
    status: "오탐지 (정상)",
    confirmed: false,
  },
];

export default function FallHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    setLogs(DUMMY_LOGS);
  }, []);

  const fallCount = logs.filter(l => l.confirmed).length;
  const falseCount = logs.filter(l => !l.confirmed).length;

  return (
    <>
      <style>{styles}</style>
      <div className="fh-root">

        <div className="fh-header">
          <button className="fh-back" onClick={() => navigate("/user")}>← 뒤로</button>
          <div className="fh-title">📋 낙상 기록</div>
          <div className="fh-subtitle">YOLOv8-pose · MediaPipe 감지 이력</div>
        </div>

        <div className="fh-body">

          {/* 요약 */}
          <div className="fh-summary">
            <div className="fh-stat fh-stat-fall">
              <div className="fh-stat-label">이번 달 낙상</div>
              <div className="fh-stat-value">{fallCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat fh-stat-false">
              <div className="fh-stat-label">오탐지</div>
              <div className="fh-stat-value">{falseCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat fh-stat-total">
              <div className="fh-stat-label">전체 기록</div>
              <div className="fh-stat-value">{logs.length}</div>
              <div className="fh-stat-unit">건</div>
            </div>
          </div>

          {/* 이력 */}
          <div className="fh-section-label">감지 이력</div>

          {logs.length === 0 ? (
            <div className="fh-empty">
              <div className="fh-empty-icon">😊</div>
              <div className="fh-empty-text">낙상 기록이 없습니다</div>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="fh-log">
                <div
                  className="fh-log-bar"
                  style={{ background: log.confirmed ? C.danger : "#c0c0c0" }}
                />
                <div className="fh-log-inner">
                  <div className="fh-log-top">
                    <div className="fh-log-location">
                      📍 {log.location}
                    </div>
                    <div
                      className="fh-log-badge"
                      style={{ background: log.confirmed ? C.danger : "#aaa" }}
                    >
                      {log.confirmed ? "낙상" : "오탐지"}
                    </div>
                  </div>
                  <div className="fh-log-datetime">
                    🕐 {log.date} {log.time}
                  </div>
                  <div className="fh-log-status">
                    처리: {log.status}
                  </div>
                </div>
              </div>
            ))
          )}

        </div>
      </div>
    </>
  );
}