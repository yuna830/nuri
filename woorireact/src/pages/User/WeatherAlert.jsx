import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
};

const LEVELS = {
  safe:    { label: "안전", bg: "#86A788", icon: "✅", desc: "외출 가능" },
  caution: { label: "주의", bg: "#f0a500", icon: "⚠️", desc: "주의 필요" },
  warning: { label: "경고", bg: "#e05252", icon: "🚨", desc: "외출 자제" },
  danger:  { label: "위험", bg: "#7a1a1a", icon: "🆘", desc: "외출 금지" },
};

const DUMMY_ALERTS = [
  { id: 1, type: "한파", level: "warning", message: "오늘 최저기온이 -12°C 이하로 내려갑니다. 외출을 최대한 삼가주세요.", time: "오늘 오전 9:00" },
  { id: 2, type: "강풍", level: "caution", message: "순간 풍속 15m/s 이상의 강한 바람이 예상됩니다. 외출 시 낙하물에 주의하세요.", time: "오늘 오후 2:00" },
  { id: 3, type: "오후 날씨", level: "safe", message: "오후 4시 이후 날씨가 맑아지고 기온이 오릅니다.", time: "오늘 오후 4:00" },
];

const COLD_ACTIONS = [
  "내복과 두꺼운 외투를 착용하세요",
  "외출 전 보호자에게 알려주세요",
  "손발이 시릴 때는 즉시 따뜻한 곳으로 이동하세요",
  "뜨거운 물과 따뜻한 음식을 자주 드세요",
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .wa-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .wa-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .wa-nav-back {
    background: transparent; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.85rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
  .wa-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .wa-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; }

  .wa-layout { max-width: 900px; margin: 0 auto; padding: 2rem; }

  /* 현재 상태 배너 */
  .wa-banner {
    border-radius: 16px; padding: 1.5rem 2rem; margin-bottom: 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    color: #fff;
  }
  .wa-banner-left {}
  .wa-banner-label { font-size: 0.78rem; opacity: 0.8; margin-bottom: 0.3rem; font-weight: 300; }
  .wa-banner-status { font-size: 1.6rem; font-weight: 700; }
  .wa-banner-desc { font-size: 0.85rem; opacity: 0.85; margin-top: 0.2rem; }
  .wa-banner-icon { font-size: 3.5rem; }

  /* 단계 카드 */
  .wa-level-wrap {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; margin-bottom: 1.5rem;
  }
  .wa-level-card {
    background: ${C.white}; border-radius: 14px; padding: 1rem;
    border: 1px solid ${C.border}; text-align: center;
    box-shadow: 0 2px 8px rgba(134,167,136,0.07);
  }
  .wa-level-icon { font-size: 1.5rem; margin-bottom: 0.4rem; }
  .wa-level-badge {
    display: inline-block; padding: 0.2rem 0.7rem; border-radius: 99px;
    font-size: 0.78rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem;
  }
  .wa-level-desc { font-size: 0.72rem; color: ${C.textMuted}; }

  /* 행동 요령 */
  .wa-action-card {
    background: #fff5f5; border: 1px solid #f5c6c6; border-radius: 16px;
    padding: 1.4rem 1.8rem; margin-bottom: 1.5rem;
  }
  .wa-action-title {
    font-size: 0.78rem; font-weight: 700; color: ${C.danger};
    letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 1rem;
  }
  .wa-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .wa-action-item {
    display: flex; align-items: flex-start; gap: 0.6rem;
    font-size: 0.88rem; color: ${C.text}; line-height: 1.5;
  }
  .wa-action-num {
    background: ${C.danger}; color: #fff; width: 20px; height: 20px;
    border-radius: 50%; font-size: 0.68rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
  }

  /* 알림 목록 */
  .wa-section-label {
    font-size: 0.78rem; font-weight: 700; color: ${C.textMuted};
    letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.9rem;
  }
  .wa-alert-card {
    background: ${C.white}; border-radius: 16px; padding: 1.3rem 1.6rem;
    margin-bottom: 0.85rem; border: 1px solid ${C.border};
    box-shadow: 0 2px 10px rgba(134,167,136,0.07);
    display: flex; gap: 1rem; align-items: flex-start; position: relative;
    border-left: 5px solid transparent;
  }
  .wa-alert-left { flex: 1; }
  .wa-alert-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
  .wa-alert-badge {
    font-size: 0.72rem; font-weight: 700; color: #fff;
    padding: 0.2rem 0.65rem; border-radius: 99px;
  }
  .wa-alert-type { font-size: 0.95rem; font-weight: 700; color: ${C.text}; }
  .wa-alert-msg { font-size: 0.88rem; color: ${C.text}; line-height: 1.6; margin-bottom: 0.4rem; }
  .wa-alert-time { font-size: 0.75rem; color: ${C.textMuted}; }

  .wa-empty { text-align: center; padding: 4rem 2rem; color: ${C.textMuted}; }
  .wa-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .wa-empty-text { font-size: 1rem; }
`;

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const hasWarning = alerts.some(a => a.level === "warning" || a.level === "danger");
  const worstAlert = alerts.find(a => a.level === "danger") || alerts.find(a => a.level === "warning") || alerts[0];

  useEffect(() => { setAlerts(DUMMY_ALERTS); }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="wa-root">
        <nav className="wa-nav">
          <button className="wa-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="wa-nav-title">🌡 기후 위험 알림</div>
        </nav>

        <div className="wa-layout">

          {/* 현재 상태 배너 */}
          {worstAlert && (() => {
            const lv = LEVELS[worstAlert.level];
            return (
              <div className="wa-banner" style={{ background: lv.bg }}>
                <div className="wa-banner-left">
                  <div className="wa-banner-label">현재 기후 상태</div>
                  <div className="wa-banner-status">{lv.icon} {lv.label}</div>
                  <div className="wa-banner-desc">{lv.desc} · 기상청 API 연동</div>
                </div>
                <div className="wa-banner-icon">{lv.icon}</div>
              </div>
            );
          })()}

          {/* 단계 안내 */}
          <div className="wa-level-wrap">
            {Object.entries(LEVELS).map(([key, lv]) => (
              <div key={key} className="wa-level-card">
                <div className="wa-level-icon">{lv.icon}</div>
                <div className="wa-level-badge" style={{ background: lv.bg }}>{lv.label}</div>
                <div className="wa-level-desc">{lv.desc}</div>
              </div>
            ))}
          </div>

          {/* 한파 행동 요령 */}
          {hasWarning && (
            <div className="wa-action-card">
              <div className="wa-action-title">⚡ 한파 행동 요령</div>
              <div className="wa-action-grid">
                {COLD_ACTIONS.map((a, i) => (
                  <div key={i} className="wa-action-item">
                    <div className="wa-action-num">{i+1}</div>
                    <div>{a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 알림 목록 */}
          <div className="wa-section-label">전체 알림 목록</div>
          {alerts.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">😊</div>
              <div className="wa-empty-text">현재 기후 위험 알림이 없습니다</div>
            </div>
          ) : (
            alerts.map(alert => {
              const lv = LEVELS[alert.level];
              return (
                <div key={alert.id} className="wa-alert-card" style={{ borderLeftColor: lv.bg }}>
                  <div className="wa-alert-left">
                    <div className="wa-alert-top">
                      <span className="wa-alert-badge" style={{ background: lv.bg }}>{lv.icon} {lv.label}</span>
                      <span className="wa-alert-type">{alert.type}</span>
                    </div>
                    <div className="wa-alert-msg">{alert.message}</div>
                    <div className="wa-alert-time">🕐 {alert.time}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}