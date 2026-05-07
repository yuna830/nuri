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

const LEVELS = {
  safe:    { label: "안전", bg: "#86A788", barColor: "#86A788", icon: "✅", desc: "외출 가능", textColor: "#ffffff" },
  caution: { label: "주의", bg: "#f0a500", barColor: "#f0a500", icon: "⚠️", desc: "주의 필요", textColor: "#ffffff" },
  warning: { label: "경고", bg: "#e05252", barColor: "#e05252", icon: "🚨", desc: "외출 자제", textColor: "#ffffff" },
  danger:  { label: "위험", bg: "#7a1a1a", barColor: "#7a1a1a", icon: "🆘", desc: "외출 금지", textColor: "#ffffff" },
};

const DUMMY_ALERTS = [
  {
    id: 1,
    type: "한파",
    level: "warning",
    message: "오늘 최저기온이 -12°C 이하로 내려갑니다. 외출을 최대한 삼가주세요. 특히 심혈관 질환자 및 고령자는 각별히 주의하시기 바랍니다.",
    time: "오늘 오전 9:00",
    region: "서울 전역",
  },
  {
    id: 2,
    type: "강풍",
    level: "caution",
    message: "순간 풍속 15m/s 이상의 강한 바람이 예상됩니다. 외출 시 낙하물에 주의하시고 우산 사용을 자제해주세요.",
    time: "오늘 오후 2:00",
    region: "서울 전역",
  },
  {
    id: 3,
    type: "오후 날씨",
    level: "safe",
    message: "오후 4시 이후 날씨가 맑아지고 기온이 오릅니다. 저녁 외출은 비교적 안전합니다.",
    time: "오늘 오후 4:00",
    region: "서울 전역",
  },
];

const COLD_ACTIONS = [
  { icon: "🧥", text: "내복과 두꺼운 외투를 착용하세요" },
  { icon: "📞", text: "외출 전 보호자에게 반드시 알려주세요" },
  { icon: "🏠", text: "손발이 시릴 때는 즉시 따뜻한 곳으로 이동하세요" },
  { icon: "☕", text: "뜨거운 물과 따뜻한 음식을 자주 드세요" },
  { icon: "💊", text: "심혈관 질환자는 약 복용을 거르지 마세요" },
  { icon: "🌡", text: "실내 적정 온도(18~20°C)를 유지하세요" },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .wa-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
  }

  /* 네비바 */
  .wa-nav {
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
  .wa-nav-back {
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
  .wa-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .wa-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .wa-nav-sub { font-size: 0.82rem; color: ${C.textMuted}; }

  /* 레이아웃 */
  .wa-layout {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
    align-items: start;
  }

  /* 왼쪽 메인 */
  .wa-main {}

  /* 현재 기후 상태 배너 */
  .wa-banner {
    border-radius: 20px;
    padding: 2rem 2.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
    color: #fff;
  }
  .wa-banner::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .wa-banner::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -40px;
    width: 260px; height: 260px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .wa-banner-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.2rem;
    position: relative;
    z-index: 1;
  }
  .wa-banner-label {
    font-size: 0.78rem;
    opacity: 0.8;
    font-weight: 300;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }
  .wa-banner-status {
    font-size: 2rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .wa-banner-desc {
    font-size: 0.9rem;
    opacity: 0.85;
    margin-top: 0.3rem;
  }
  .wa-banner-icon { font-size: 4rem; opacity: 0.9; }
  .wa-banner-region {
    position: relative;
    z-index: 1;
    font-size: 0.82rem;
    opacity: 0.8;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* 알림 목록 */
  .wa-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
  }
  .wa-section-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .wa-alert-count {
    font-size: 0.78rem;
    color: ${C.textMuted};
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 99px;
    padding: 0.2rem 0.7rem;
  }

  .wa-alert-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.6rem;
    margin-bottom: 0.9rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .wa-alert-card:hover { box-shadow: 0 4px 20px rgba(134,167,136,0.14); }
  .wa-alert-bar {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 5px;
    border-radius: 18px 0 0 18px;
  }
  .wa-alert-inner { padding-left: 0.6rem; }
  .wa-alert-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.7rem;
  }
  .wa-alert-type {
    font-size: 1.05rem;
    font-weight: 700;
    color: ${C.text};
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .wa-alert-right { display: flex; align-items: center; gap: 0.6rem; }
  .wa-alert-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    padding: 0.22rem 0.7rem;
    border-radius: 99px;
  }
  .wa-alert-region {
    font-size: 0.72rem;
    color: ${C.textMuted};
    background: ${C.greenPale};
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
  }
  .wa-alert-msg {
    font-size: 0.9rem;
    color: ${C.text};
    line-height: 1.65;
    margin-bottom: 0.6rem;
  }
  .wa-alert-time {
    font-size: 0.75rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .wa-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: ${C.textMuted};
    background: ${C.white};
    border-radius: 18px;
    border: 1px solid ${C.border};
  }
  .wa-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .wa-empty-text { font-size: 1rem; }

  /* 오른쪽 사이드바 */
  .wa-sidebar {}

  /* 단계 안내 카드 */
  .wa-level-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
  }
  .wa-level-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .wa-level-item {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.65rem 0;
    border-bottom: 1px solid ${C.border};
  }
  .wa-level-item:last-child { border-bottom: none; }
  .wa-level-pill {
    min-width: 58px;
    text-align: center;
    border-radius: 8px;
    padding: 0.28rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }
  .wa-level-info {}
  .wa-level-name { font-size: 0.88rem; font-weight: 700; color: ${C.text}; }
  .wa-level-desc { font-size: 0.75rem; color: ${C.textMuted}; margin-top: 0.1rem; }

  /* 행동 요령 카드 */
  .wa-action-card {
    background: #fff5f5;
    border: 1px solid #f5c6c6;
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    margin-bottom: 1rem;
  }
  .wa-action-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.danger};
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .wa-action-item {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(224,82,82,0.12);
  }
  .wa-action-item:last-child { border-bottom: none; }
  .wa-action-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .wa-action-text {
    font-size: 0.85rem;
    color: ${C.text};
    line-height: 1.55;
  }

  /* 기상청 안내 */
  .wa-source-card {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 14px;
    padding: 1rem 1.2rem;
    font-size: 0.78rem;
    color: ${C.textMuted};
    line-height: 1.6;
  }
`;

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => { setAlerts(DUMMY_ALERTS); }, []);

  const hasWarning = alerts.some(a => a.level === "warning" || a.level === "danger");

  // 가장 심각한 알림 찾기
  const levelOrder = { danger: 0, warning: 1, caution: 2, safe: 3 };
  const worstAlert = [...alerts].sort((a, b) => levelOrder[a.level] - levelOrder[b.level])[0];
  const worstLv = worstAlert ? LEVELS[worstAlert.level] : LEVELS.safe;

  return (
    <>
      <style>{styles}</style>
      <div className="wa-root">

        {/* 네비바 */}
        <nav className="wa-nav">
          <button className="wa-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="wa-nav-title">🌡 기후 위험 알림</div>
          <div className="wa-nav-sub">기상청 API 연동 · 실시간 업데이트</div>
        </nav>

        <div className="wa-layout">

          {/* 왼쪽 메인 */}
          <div className="wa-main">

            {/* 현재 기후 상태 배너 */}
            {worstAlert && (
              <div className="wa-banner" style={{ background: `linear-gradient(135deg, ${worstLv.bg}, ${worstLv.bg}dd)` }}>
                <div className="wa-banner-top">
                  <div>
                    <div className="wa-banner-label">현재 기후 위험 단계</div>
                    <div className="wa-banner-status">
                      {worstLv.icon} {worstLv.label}
                    </div>
                    <div className="wa-banner-desc">{worstLv.desc} · {worstAlert.type} 주의보 발령</div>
                  </div>
                  <div className="wa-banner-icon">{worstLv.icon}</div>
                </div>
                <div className="wa-banner-region">
                  📍 서울 전역 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 기준
                </div>
              </div>
            )}

            {/* 알림 목록 */}
            <div className="wa-section-head">
              <div className="wa-section-label">전체 알림</div>
              <div className="wa-alert-count">{alerts.length}건</div>
            </div>

            {alerts.length === 0 ? (
              <div className="wa-empty">
                <div className="wa-empty-icon">😊</div>
                <div className="wa-empty-text">현재 기후 위험 알림이 없습니다</div>
              </div>
            ) : (
              alerts.map(alert => {
                const lv = LEVELS[alert.level];
                return (
                  <div key={alert.id} className="wa-alert-card">
                    <div className="wa-alert-bar" style={{ background: lv.barColor }} />
                    <div className="wa-alert-inner">
                      <div className="wa-alert-top">
                        <div className="wa-alert-type">
                          {lv.icon} {alert.type}
                        </div>
                        <div className="wa-alert-right">
                          {alert.region && <span className="wa-alert-region">📍 {alert.region}</span>}
                          <span className="wa-alert-badge" style={{ background: lv.bg }}>
                            {lv.label}
                          </span>
                        </div>
                      </div>
                      <div className="wa-alert-msg">{alert.message}</div>
                      <div className="wa-alert-time">🕐 {alert.time}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 오른쪽 사이드바 */}
          <aside className="wa-sidebar">

            {/* 단계 안내 */}
            <div className="wa-level-card">
              <div className="wa-level-title">알림 단계 안내</div>
              {Object.entries(LEVELS).map(([key, lv]) => (
                <div key={key} className="wa-level-item">
                  <div className="wa-level-pill" style={{ background: lv.bg }}>
                    {lv.icon} {lv.label}
                  </div>
                  <div className="wa-level-info">
                    <div className="wa-level-name">{lv.label}</div>
                    <div className="wa-level-desc">{lv.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 한파 행동 요령 (경고 이상 시) */}
            {hasWarning && (
              <div className="wa-action-card">
                <div className="wa-action-title">
                  ⚡ 한파 행동 요령
                </div>
                {COLD_ACTIONS.map((a, i) => (
                  <div key={i} className="wa-action-item">
                    <div className="wa-action-icon">{a.icon}</div>
                    <div className="wa-action-text">{a.text}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 출처 안내 */}
            <div className="wa-source-card">
              📡 본 서비스의 기후 위험 알림은 <b>기상청 공공 API</b>를 통해 실시간으로 제공됩니다. 정확한 정보는 기상청 홈페이지를 참고해주세요.
            </div>

          </aside>
        </div>
      </div>
    </>
  );
}