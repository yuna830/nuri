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
  safe:    { label: "안전", bg: "#86A788", text: "#ffffff", barColor: "#86A788", icon: "✅", desc: "외출 가능" },
  caution: { label: "주의", bg: "#f0a500", text: "#ffffff", barColor: "#f0a500", icon: "⚠️", desc: "주의 필요" },
  warning: { label: "경고", bg: "#e05252", text: "#ffffff", barColor: "#e05252", icon: "🚨", desc: "외출 자제" },
  danger:  { label: "위험", bg: "#7a1a1a", text: "#ffffff", barColor: "#7a1a1a", icon: "🆘", desc: "외출 금지" },
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .wa-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
    padding-bottom: 3rem;
  }

  /* 헤더 */
  .wa-header {
    background: ${C.green};
    padding: 1.5rem 1.4rem 3rem;
    position: relative;
    overflow: hidden;
  }
  .wa-header::after {
    content:'';
    position:absolute;
    bottom:-60px; right:-40px;
    width:200px; height:200px;
    border-radius:50%;
    background:rgba(255,255,255,0.07);
  }
  .wa-back {
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
  .wa-back:active { opacity: 0.7; }
  .wa-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffffff;
  }
  .wa-subtitle {
    font-size: 0.82rem;
    color: rgba(255,255,255,0.7);
    margin-top: 0.25rem;
    font-weight: 300;
  }

  /* 바디 */
  .wa-body {
    padding: 0 1.2rem;
    margin-top: -1.6rem;
    position: relative;
    z-index: 1;
  }

  /* 단계 안내 카드 */
  .wa-level-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    margin-bottom: 1rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 16px rgba(134,167,136,0.1);
  }
  .wa-level-head {
    font-size: 0.72rem;
    font-weight: 700;
    color: ${C.textMuted};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.9rem;
  }
  .wa-level-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  .wa-level-item {
    text-align: center;
  }
  .wa-level-pill {
    border-radius: 99px;
    padding: 0.35rem 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 0.3rem;
  }
  .wa-level-desc {
    font-size: 0.68rem;
    color: ${C.textMuted};
  }

  /* 알림 없음 */
  .wa-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: ${C.textMuted};
  }
  .wa-empty-icon { font-size: 3rem; margin-bottom: 0.8rem; }
  .wa-empty-text { font-size: 1rem; }

  /* 알림 카드 */
  .wa-alert-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.4rem;
    margin-bottom: 0.85rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.07);
    position: relative;
    overflow: hidden;
  }
  .wa-alert-bar {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 5px;
    border-radius: 18px 0 0 18px;
  }
  .wa-alert-inner { padding-left: 0.4rem; }
  .wa-alert-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .wa-alert-type {
    font-size: 1rem;
    font-weight: 700;
    color: ${C.text};
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .wa-alert-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    padding: 0.2rem 0.65rem;
    border-radius: 99px;
  }
  .wa-alert-msg {
    font-size: 0.92rem;
    color: ${C.text};
    line-height: 1.55;
    margin-bottom: 0.55rem;
  }
  .wa-alert-time {
    font-size: 0.75rem;
    color: ${C.textMuted};
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  /* 행동 요령 카드 (위험 시) */
  .wa-action-card {
    background: #fff5f5;
    border: 1px solid #f5c6c6;
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    margin-bottom: 0.85rem;
  }
  .wa-action-head {
    font-size: 0.72rem;
    font-weight: 700;
    color: ${C.danger};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.8rem;
  }
  .wa-action-item {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.4rem 0;
    font-size: 0.88rem;
    color: ${C.text};
    line-height: 1.5;
  }
  .wa-action-num {
    background: ${C.danger};
    color: #fff;
    width: 20px; height: 20px;
    border-radius: 50%;
    font-size: 0.68rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

const DUMMY_ALERTS = [
  {
    id: 1,
    type: "한파",
    level: "warning",
    message: "오늘 최저기온이 -12°C 이하로 내려갑니다. 외출을 최대한 삼가주세요.",
    time: "오늘 오전 9:00",
  },
  {
    id: 2,
    type: "강풍",
    level: "caution",
    message: "순간 풍속 15m/s 이상의 강한 바람이 예상됩니다. 외출 시 낙하물에 주의하세요.",
    time: "오늘 오후 2:00",
  },
  {
    id: 3,
    type: "오후 날씨",
    level: "safe",
    message: "오후 4시 이후 날씨가 맑아지고 기온이 오릅니다.",
    time: "오늘 오후 4:00",
  },
];

const COLD_ACTIONS = [
  "내복과 두꺼운 외투를 착용하세요",
  "외출 전 보호자에게 알려주세요",
  "손발이 시릴 때는 즉시 따뜻한 곳으로 이동하세요",
  "뜨거운 물과 따뜻한 음식을 자주 드세요",
];

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const hasWarning = alerts.some(a => a.level === "warning" || a.level === "danger");

  useEffect(() => {
    setAlerts(DUMMY_ALERTS);
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="wa-root">

        <div className="wa-header">
          <button className="wa-back" onClick={() => navigate("/user")}>← 뒤로</button>
          <div className="wa-title">🌡 기후 위험 알림</div>
          <div className="wa-subtitle">실시간 기상 정보 · 기상청 API 연동</div>
        </div>

        <div className="wa-body">

          {/* 단계 안내 */}
          <div className="wa-level-card">
            <div className="wa-level-head">알림 단계 안내</div>
            <div className="wa-level-row">
              {Object.entries(LEVELS).map(([key, lv]) => (
                <div key={key} className="wa-level-item">
                  <div className="wa-level-pill" style={{ background: lv.bg }}>
                    {lv.icon} {lv.label}
                  </div>
                  <div className="wa-level-desc">{lv.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 한파 행동 요령 (경고 이상 시) */}
          {hasWarning && (
            <div className="wa-action-card">
              <div className="wa-action-head">⚡ 한파 행동 요령</div>
              {COLD_ACTIONS.map((a, i) => (
                <div key={i} className="wa-action-item">
                  <div className="wa-action-num">{i+1}</div>
                  <div>{a}</div>
                </div>
              ))}
            </div>
          )}

          {/* 알림 목록 */}
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
                      <div className="wa-alert-badge" style={{ background: lv.bg }}>
                        {lv.label}
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
      </div>
    </>
  );
}