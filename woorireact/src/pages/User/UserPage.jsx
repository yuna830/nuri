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

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .up-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
    padding-bottom: 6rem;
  }

  .up-header {
    background: ${C.green};
    padding: 2.2rem 1.5rem 3.8rem;
    position: relative;
    overflow: hidden;
  }
  .up-header::before {
    content: '';
    position: absolute;
    top: -50px; right: -50px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .up-header::after {
    content: '';
    position: absolute;
    bottom: -70px; left: -30px;
    width: 240px; height: 240px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .up-header-date {
    font-size: 0.82rem;
    color: rgba(255,255,255,0.7);
    font-weight: 300;
    letter-spacing: 0.06em;
    margin-bottom: 0.4rem;
  }
  .up-header-greeting {
    font-size: 1.55rem;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.35;
  }
  .up-header-sub {
    font-size: 0.88rem;
    color: rgba(255,255,255,0.7);
    margin-top: 0.35rem;
    font-weight: 300;
  }
  .up-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.28);
    border-radius: 99px;
    padding: 0.32rem 0.85rem;
    font-size: 0.78rem;
    color: #ffffff;
    margin-top: 1rem;
  }
  .up-status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #a8e6a8;
    animation: blink 2s ease-in-out infinite;
  }
  @keyframes blink {
    0%,100% { opacity:1; transform:scale(1); }
    50% { opacity:0.5; transform:scale(1.4); }
  }

  .up-body {
    padding: 0 1.2rem;
    margin-top: -1.8rem;
    position: relative;
    z-index: 1;
  }

  /* 날씨 카드 */
  .up-weather {
    background: ${C.white};
    border-radius: 20px;
    padding: 1.4rem 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 20px rgba(134,167,136,0.12);
    border: 1px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: box-shadow 0.15s;
  }
  .up-weather:active { box-shadow: 0 1px 8px rgba(134,167,136,0.1); }
  .up-weather-label {
    font-size: 0.72rem;
    color: ${C.textMuted};
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }
  .up-weather-temp {
    font-size: 2.6rem;
    font-weight: 700;
    color: ${C.text};
    line-height: 1;
  }
  .up-weather-desc {
    font-size: 0.85rem;
    color: ${C.textMuted};
    margin-top: 0.3rem;
  }
  .up-weather-icon { font-size: 3rem; }

  /* SOS */
  .up-sos {
    width: 100%;
    padding: 1.7rem;
    font-size: 1.25rem;
    font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif;
    background: ${C.danger};
    color: #ffffff;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    box-shadow: 0 6px 24px rgba(224,82,82,0.3);
    position: relative;
    overflow: hidden;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .up-sos:active {
    transform: scale(0.97);
    box-shadow: 0 2px 10px rgba(224,82,82,0.25);
  }
  .up-sos-deco {
    position: absolute;
    width: 260px; height: 260px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
    top: -100px; right: -70px;
    pointer-events: none;
  }

  /* 메뉴 그리드 */
  .up-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
    margin-bottom: 1rem;
  }
  .up-card {
    background: ${C.white};
    border: 1px solid ${C.border};
    border-radius: 18px;
    padding: 1.25rem 1.1rem;
    cursor: pointer;
    text-align: left;
    font-family: 'Noto Sans KR', sans-serif;
    box-shadow: 0 2px 12px rgba(134,167,136,0.07);
    transition: transform 0.13s, box-shadow 0.13s, border-color 0.13s;
    position: relative;
  }
  .up-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(134,167,136,0.16);
    border-color: ${C.green};
  }
  .up-card:active { transform: scale(0.97); }
  .up-card-icon { font-size: 1.8rem; display: block; margin-bottom: 0.65rem; }
  .up-card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: ${C.text};
    margin-bottom: 0.2rem;
  }
  .up-card-desc {
    font-size: 0.73rem;
    color: ${C.textMuted};
    line-height: 1.45;
    white-space: pre-line;
  }
  .up-card-badge {
    position: absolute;
    top: 0.8rem; right: 0.8rem;
    background: ${C.danger};
    color: #fff;
    font-size: 0.62rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 99px;
  }

  /* 일정 카드 */
  .up-schedule {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    margin-bottom: 1rem;
  }
  .up-schedule-head {
    font-size: 0.72rem;
    font-weight: 700;
    color: ${C.greenDark};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .up-schedule-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid ${C.greenLight};
  }
  .up-schedule-row:last-child { border-bottom: none; padding-bottom: 0; }
  .up-schedule-time {
    font-size: 0.75rem;
    font-weight: 700;
    color: ${C.greenDark};
    min-width: 40px;
  }
  .up-schedule-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${C.green};
    flex-shrink: 0;
  }
  .up-schedule-text { font-size: 0.88rem; color: ${C.text}; }

  /* FAB */
  .up-fab {
    position: fixed;
    bottom: 1.8rem; right: 1.5rem;
    width: 60px; height: 60px;
    border-radius: 50%;
    background: ${C.green};
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.55rem;
    box-shadow: 0 4px 20px rgba(134,167,136,0.5);
    transition: transform 0.13s, box-shadow 0.13s;
    z-index: 100;
  }
  .up-fab:hover { transform: scale(1.07); box-shadow: 0 6px 28px rgba(134,167,136,0.6); }
  .up-fab:active { transform: scale(0.93); }

  /* 모달 */
  .up-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    padding: 1rem;
  }
  .up-modal {
    background: ${C.white};
    border-radius: 24px;
    padding: 2rem 1.5rem;
    width: 100%;
    text-align: center;
  }
  .up-modal-ico { font-size: 2.8rem; margin-bottom: 0.7rem; }
  .up-modal-title { font-size: 1.25rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.4rem; }
  .up-modal-desc { font-size: 0.88rem; color: ${C.textMuted}; line-height: 1.6; margin-bottom: 1.4rem; }
  .up-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
  .up-modal-cancel {
    background: #efefef; color: ${C.textMuted};
    border: none; border-radius: 14px;
    padding: 0.95rem; font-size: 0.95rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
  }
  .up-modal-ok {
    background: ${C.danger}; color: #fff;
    border: none; border-radius: 14px;
    padding: 0.95rem; font-size: 0.95rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
    box-shadow: 0 4px 14px rgba(224,82,82,0.3);
  }
`;

const menus = [
  { icon: "🌡", title: "기후 알림", desc: "한파·폭염 등\n위험 기후 안내", route: "/weather", badge: null },
  { icon: "📋", title: "낙상 기록", desc: "낙상 감지 이력\n확인하기", route: "/fall-history", badge: null },
  { icon: "💼", title: "일자리 찾기", desc: "내 조건 맞춤\n일자리 추천", route: "/jobs", badge: "NEW" },
  { icon: "📍", title: "내 위치", desc: "실시간 위치\n보호자 공유", route: "/location", badge: null },
];

const schedules = [
  { time: "10:00", text: "혈압약 복용" },
  { time: "14:00", text: "병원 진료 예약" },
  { time: "16:30", text: "공원 산책" },
];

export default function UserPage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);
  const [showSOS, setShowSOS] = useState(false);
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setWeather({ temp: 22, status: "맑음", icon: "☀️", region: "서울 송파구" });
    const d = new Date();
    const days = ["일","월","화","수","목","금","토"];
    setDateStr(`${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`);
  }, []);

  const confirmSOS = () => {
    setShowSOS(false);
    setTimeout(() => alert("보호자에게 SOS를 전송했습니다."), 150);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="up-root">

        <div className="up-header">
          <div className="up-header-date">{dateStr}</div>
          <div className="up-header-greeting">안녕하세요 👋<br />오늘도 건강한 하루 되세요</div>
          <div className="up-header-sub">케어링이 항상 함께합니다</div>
          <div className="up-status-badge">
            <div className="up-status-dot" />
            디바이스 연결됨
          </div>
        </div>

        <div className="up-body">

          {/* 날씨 */}
          <div className="up-weather" onClick={() => navigate("/weather")}>
            <div>
              <div className="up-weather-label">오늘 날씨</div>
              {weather
                ? <>
                    <div className="up-weather-temp">{weather.temp}°C</div>
                    <div className="up-weather-desc">{weather.status} · {weather.region}</div>
                  </>
                : <div style={{color:"#bbb",fontSize:"0.9rem"}}>불러오는 중...</div>
              }
            </div>
            <div className="up-weather-icon">{weather?.icon ?? "🌤"}</div>
          </div>

          {/* SOS */}
          <button className="up-sos" onClick={() => setShowSOS(true)}>
            <span className="up-sos-deco" />
            🆘 &nbsp;SOS 도움 요청
          </button>

          {/* 메뉴 */}
          <div className="up-grid">
            {menus.map(m => (
              <button key={m.route} className="up-card" onClick={() => navigate(m.route)}>
                {m.badge && <span className="up-card-badge">{m.badge}</span>}
                <span className="up-card-icon">{m.icon}</span>
                <div className="up-card-title">{m.title}</div>
                <div className="up-card-desc">{m.desc}</div>
              </button>
            ))}
          </div>

          {/* 일정 */}
          <div className="up-schedule">
            <div className="up-schedule-head">📅 오늘 일정</div>
            {schedules.map((s, i) => (
              <div key={i} className="up-schedule-row">
                <div className="up-schedule-time">{s.time}</div>
                <div className="up-schedule-dot" />
                <div className="up-schedule-text">{s.text}</div>
              </div>
            ))}
          </div>

        </div>

        {/* 챗봇 FAB */}
        <button className="up-fab" onClick={() => navigate("/chatbot")}>
          💬
        </button>

        {/* SOS 모달 */}
        {showSOS && (
          <div className="up-overlay" onClick={() => setShowSOS(false)}>
            <div className="up-modal" onClick={e => e.stopPropagation()}>
              <div className="up-modal-ico">🆘</div>
              <div className="up-modal-title">SOS를 보내시겠어요?</div>
              <div className="up-modal-desc">
                보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.
              </div>
              <div className="up-modal-row">
                <button className="up-modal-cancel" onClick={() => setShowSOS(false)}>취소</button>
                <button className="up-modal-ok" onClick={confirmSOS}>보내기</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}