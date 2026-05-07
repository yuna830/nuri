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

const DUMMY_LOGS = [
  {
    id: 1,
    date: "2026-05-04",
    time: "오전 8:32",
    location: "거실",
    status: "보호자 확인 완료",
    confirmed: true,
    detail: "소파 근처에서 낙상 감지. 보호자 즉시 연락, 5분 내 확인 완료.",
  },
  {
    id: 2,
    date: "2026-04-28",
    time: "오후 3:15",
    location: "욕실",
    status: "119 출동",
    confirmed: true,
    detail: "욕실 바닥에서 낙상 감지. 반응 없음 확인 후 119 신고 출동.",
  },
  {
    id: 3,
    date: "2026-04-20",
    time: "오전 11:50",
    location: "침실",
    status: "오탐지 (정상)",
    confirmed: false,
    detail: "침대 위 자세 변화로 오탐지 발생. 직접 확인 후 정상으로 처리.",
  },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .fh-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
  }

  /* 네비바 */
  .fh-nav {
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
  .fh-nav-back {
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
  .fh-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .fh-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .fh-nav-sub { font-size: 0.82rem; color: ${C.textMuted}; }

  /* 레이아웃 */
  .fh-layout {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* 요약 카드 3개 */
  .fh-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .fh-stat {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.5rem 1.6rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
  }
  .fh-stat-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  .fh-stat-value {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.3rem;
  }
  .fh-stat-unit { font-size: 0.82rem; }
  .fh-stat-sub { font-size: 0.78rem; margin-top: 0.5rem; }

  .fh-stat-fall { background: ${C.dangerLight}; border-color: #f5c6c6; }
  .fh-stat-fall .fh-stat-label { color: ${C.danger}; }
  .fh-stat-fall .fh-stat-value { color: ${C.danger}; }
  .fh-stat-fall .fh-stat-unit { color: ${C.danger}; opacity: 0.7; }
  .fh-stat-fall .fh-stat-sub { color: ${C.danger}; opacity: 0.7; }

  .fh-stat-false {
    background: ${C.white};
    border-color: ${C.border};
  }
  .fh-stat-false .fh-stat-label { color: ${C.textMuted}; }
  .fh-stat-false .fh-stat-value { color: ${C.textMuted}; }
  .fh-stat-false .fh-stat-unit { color: ${C.textMuted}; opacity: 0.7; }
  .fh-stat-false .fh-stat-sub { color: ${C.textMuted}; opacity: 0.7; }

  .fh-stat-total {
    background: ${C.greenPale};
    border-color: ${C.greenLight};
  }
  .fh-stat-total .fh-stat-label { color: ${C.greenDark}; }
  .fh-stat-total .fh-stat-value { color: ${C.green}; }
  .fh-stat-total .fh-stat-unit { color: ${C.greenDark}; opacity: 0.7; }
  .fh-stat-total .fh-stat-sub { color: ${C.greenDark}; opacity: 0.7; }

  /* 섹션 헤더 */
  .fh-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
  }
  .fh-section-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .fh-section-count {
    font-size: 0.78rem;
    color: ${C.textMuted};
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 99px;
    padding: 0.2rem 0.7rem;
  }

  /* 이력 카드 */
  .fh-log {
    background: ${C.white};
    border-radius: 18px;
    padding: 0;
    margin-bottom: 0.9rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.07);
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .fh-log:hover { box-shadow: 0 4px 20px rgba(134,167,136,0.14); }
  .fh-log-header {
    display: grid;
    grid-template-columns: 5px 1fr auto;
    align-items: stretch;
  }
  .fh-log-bar { width: 5px; }
  .fh-log-main {
    padding: 1.3rem 1.5rem;
  }
  .fh-log-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .fh-log-location {
    font-size: 1.05rem;
    font-weight: 700;
    color: ${C.text};
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .fh-log-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    padding: 0.22rem 0.7rem;
    border-radius: 99px;
  }
  .fh-log-meta {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    margin-bottom: 0.6rem;
  }
  .fh-log-datetime {
    font-size: 0.85rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .fh-log-status {
    font-size: 0.85rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .fh-log-detail {
    font-size: 0.85rem;
    color: ${C.text};
    line-height: 1.6;
    background: ${C.cream};
    border-radius: 10px;
    padding: 0.7rem 0.9rem;
    margin-top: 0.4rem;
    border-left: 3px solid ${C.greenLight};
  }
  .fh-log-detail.fall { border-left-color: #f5c6c6; background: #fff8f8; }

  /* 비어있을 때 */
  .fh-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: ${C.textMuted};
    background: ${C.white};
    border-radius: 18px;
    border: 1px solid ${C.border};
  }
  .fh-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .fh-empty-text { font-size: 1rem; }

  /* AI 안내 카드 */
  .fh-ai-card {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 16px;
    padding: 1.2rem 1.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .fh-ai-icon { font-size: 2rem; flex-shrink: 0; }
  .fh-ai-title { font-size: 0.88rem; font-weight: 700; color: ${C.greenDark}; margin-bottom: 0.2rem; }
  .fh-ai-desc { font-size: 0.78rem; color: ${C.textMuted}; line-height: 1.5; }
`;

export default function FallHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { setLogs(DUMMY_LOGS); }, []);

  const fallCount = logs.filter(l => l.confirmed).length;
  const falseCount = logs.filter(l => !l.confirmed).length;

  return (
    <>
      <style>{styles}</style>
      <div className="fh-root">

        {/* 네비바 */}
        <nav className="fh-nav">
          <button className="fh-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="fh-nav-title">📋 낙상 기록</div>
          <div className="fh-nav-sub">YOLOv8-pose · MediaPipe 감지 이력</div>
        </nav>

        <div className="fh-layout">

          {/* 요약 카드 */}
          <div className="fh-summary">
            <div className="fh-stat fh-stat-fall">
              <div>
                <div className="fh-stat-label">이번 달 낙상</div>
                <div className="fh-stat-value">{fallCount}</div>
                <div className="fh-stat-unit">건</div>
              </div>
              <div className="fh-stat-sub">최근: 2026.05.04 거실</div>
            </div>
            <div className="fh-stat fh-stat-false">
              <div>
                <div className="fh-stat-label">오탐지</div>
                <div className="fh-stat-value">{falseCount}</div>
                <div className="fh-stat-unit">건</div>
              </div>
              <div className="fh-stat-sub">AI 정확도 향상 중</div>
            </div>
            <div className="fh-stat fh-stat-total">
              <div>
                <div className="fh-stat-label">전체 기록</div>
                <div className="fh-stat-value">{logs.length}</div>
                <div className="fh-stat-unit">건</div>
              </div>
              <div className="fh-stat-sub">누적 감지 이력</div>
            </div>
          </div>

          {/* AI 안내 */}
          <div className="fh-ai-card">
            <div className="fh-ai-icon">🤖</div>
            <div>
              <div className="fh-ai-title">YOLOv8-pose 낙상 감지 시스템</div>
              <div className="fh-ai-desc">
                카메라를 통해 실시간으로 자세를 분석하여 낙상을 감지합니다. 낙상 감지 시 보호자에게 즉시 알림이 전송됩니다.
              </div>
            </div>
          </div>

          {/* 이력 목록 */}
          <div className="fh-section-head">
            <div className="fh-section-label">감지 이력</div>
            <div className="fh-section-count">총 {logs.length}건</div>
          </div>

          {logs.length === 0 ? (
            <div className="fh-empty">
              <div className="fh-empty-icon">😊</div>
              <div className="fh-empty-text">낙상 기록이 없습니다</div>
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.id}
                className="fh-log"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="fh-log-header">
                  <div
                    className="fh-log-bar"
                    style={{ background: log.confirmed ? C.danger : "#c0c0c0" }}
                  />
                  <div className="fh-log-main">
                    <div className="fh-log-top">
                      <div className="fh-log-location">
                        📍 {log.location}
                      </div>
                      <div
                        className="fh-log-badge"
                        style={{ background: log.confirmed ? C.danger : "#aaa" }}
                      >
                        {log.confirmed ? "🚨 낙상" : "✓ 오탐지"}
                      </div>
                    </div>
                    <div className="fh-log-meta">
                      <div className="fh-log-datetime">🕐 {log.date} {log.time}</div>
                      <div className="fh-log-status">처리: {log.status}</div>
                    </div>
                    {expanded === log.id && (
                      <div className={`fh-log-detail ${log.confirmed ? "fall" : ""}`}>
                        📝 {log.detail}
                      </div>
                    )}
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