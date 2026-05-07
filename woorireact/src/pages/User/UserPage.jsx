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
  .up-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .up-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    justify-content: space-between; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .up-nav-logo { font-size: 1.25rem; font-weight: 700; color: ${C.green}; }
  .up-nav-right { display: flex; align-items: center; gap: 1rem; }
  .up-nav-date { font-size: 0.85rem; color: ${C.textMuted}; }
  .up-nav-sos {
    background: ${C.danger}; color: #fff; border: none; border-radius: 8px;
    padding: 0.5rem 1.2rem; font-size: 0.9rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
    box-shadow: 0 2px 8px rgba(224,82,82,0.3); transition: transform 0.1s;
  }
  .up-nav-sos:hover { transform: scale(1.03); }

  .up-layout {
    max-width: 1200px; margin: 0 auto; padding: 2rem;
    display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem;
  }

  /* 사이드바 */
  .up-profile-card {
    background: ${C.green}; border-radius: 16px; padding: 1.6rem 1.4rem;
    color: #fff; margin-bottom: 1rem; position: relative; overflow: hidden;
  }
  .up-profile-card::after {
    content: ''; position: absolute; bottom: -40px; right: -40px;
    width: 150px; height: 150px; border-radius: 50%; background: rgba(255,255,255,0.07);
  }
  .up-profile-avatar {
    width: 52px; height: 52px; border-radius: 50%;
    background: rgba(255,255,255,0.25); display: flex;
    align-items: center; justify-content: center; font-size: 1.6rem; margin-bottom: 0.8rem;
  }
  .up-profile-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.15rem; }
  .up-profile-sub { font-size: 0.78rem; opacity: 0.8; }
  .up-profile-region { font-size: 0.75rem; opacity: 0.75; margin-top: 0.15rem; }
  .up-dot-wrap { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.8rem; font-size: 0.75rem; opacity: 0.9; }
  .up-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #a8e6a8;
    animation: blink 2s ease-in-out infinite;
  }
  @keyframes blink {
    0%,100% { opacity:1; transform:scale(1); }
    50% { opacity:0.5; transform:scale(1.4); }
  }
  .up-sidemenu {
    background: ${C.white}; border-radius: 16px;
    border: 1px solid ${C.border}; overflow: hidden; margin-bottom: 1rem;
  }
  .up-sidemenu-item {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.1rem;
    cursor: pointer; transition: background 0.12s; font-size: 0.9rem; color: ${C.text};
    border: none; background: transparent; width: 100%; text-align: left;
    font-family: 'Noto Sans KR', sans-serif; border-bottom: 1px solid ${C.border};
  }
  .up-sidemenu-item:last-child { border-bottom: none; }
  .up-sidemenu-item:hover { background: ${C.greenPale}; }
  .up-sidemenu-icon { font-size: 1.1rem; width: 22px; text-align: center; }
  .up-sidemenu-label { flex: 1; }
  .up-sidemenu-badge {
    font-size: 0.62rem; font-weight: 700; background: ${C.danger};
    color: #fff; padding: 0.12rem 0.45rem; border-radius: 99px;
  }

  /* 메인 */
  .up-top-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
  .up-weather-card {
    background: ${C.white}; border-radius: 16px; padding: 1.3rem 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    cursor: pointer; transition: box-shadow 0.15s; display: flex;
    flex-direction: column; justify-content: space-between;
  }
  .up-weather-card:hover { box-shadow: 0 4px 20px rgba(134,167,136,0.15); }
  .up-card-label {
    font-size: 0.7rem; font-weight: 700; color: ${C.textMuted};
    letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.5rem;
  }
  .up-weather-temp { font-size: 2.2rem; font-weight: 700; color: ${C.text}; line-height: 1; }
  .up-weather-bot { display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; }
  .up-weather-desc { font-size: 0.8rem; color: ${C.textMuted}; }
  .up-weather-icon { font-size: 1.8rem; }
  .up-stat-card {
    background: ${C.white}; border-radius: 16px; padding: 1.3rem 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    display: flex; flex-direction: column; justify-content: space-between;
    cursor: pointer; transition: box-shadow 0.15s;
  }
  .up-stat-card:hover { box-shadow: 0 4px 20px rgba(134,167,136,0.15); }
  .up-stat-value { font-size: 2.2rem; font-weight: 700; color: ${C.green}; line-height: 1; margin-top: 0.4rem; }
  .up-stat-value.red { color: ${C.danger}; }
  .up-stat-sub { font-size: 0.75rem; color: ${C.textMuted}; margin-top: 0.3rem; }

  .up-content-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }

  .up-card {
    background: ${C.white}; border-radius: 16px; padding: 1.3rem 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 12px rgba(134,167,136,0.08);
  }
  .up-card.full { grid-column: span 2; }
  .up-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .up-card-title { font-size: 0.95rem; font-weight: 700; color: ${C.text}; }
  .up-card-more { font-size: 0.78rem; color: ${C.green}; cursor: pointer; background: transparent; border: none; font-family: 'Noto Sans KR', sans-serif; }

  .up-schedule-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0; border-bottom: 1px solid ${C.border}; }
  .up-schedule-row:last-child { border-bottom: none; }
  .up-schedule-time { font-size: 0.78rem; font-weight: 700; color: ${C.greenDark}; min-width: 44px; }
  .up-schedule-dot { width: 7px; height: 7px; border-radius: 50%; background: ${C.green}; flex-shrink: 0; }
  .up-schedule-text { font-size: 0.88rem; color: ${C.text}; }

  .up-alert-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid ${C.border}; }
  .up-alert-item:last-child { border-bottom: none; }
  .up-alert-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
  .up-alert-text { font-size: 0.84rem; color: ${C.text}; line-height: 1.5; }
  .up-alert-time { font-size: 0.73rem; color: ${C.textMuted}; margin-top: 0.15rem; }

  .up-quick-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.8rem; }
  .up-quick-btn {
    background: ${C.greenPale}; border: 1px solid ${C.greenLight}; border-radius: 12px;
    padding: 1rem 0.6rem; text-align: center; cursor: pointer;
    transition: all 0.13s; font-family: 'Noto Sans KR', sans-serif;
  }
  .up-quick-btn:hover { background: ${C.green}; border-color: ${C.green}; }
  .up-quick-btn:hover .up-quick-label { color: #fff; }
  .up-quick-btn:hover .up-quick-desc { color: rgba(255,255,255,0.8); }
  .up-quick-icon { font-size: 1.6rem; display: block; margin-bottom: 0.4rem; }
  .up-quick-label { font-size: 0.8rem; font-weight: 700; color: ${C.greenDark}; }
  .up-quick-desc { font-size: 0.68rem; color: ${C.textMuted}; margin-top: 0.15rem; }

  /* SOS 모달 */
  .up-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 200; display: flex; align-items: center; justify-content: center;
  }
  .up-modal {
    background: ${C.white}; border-radius: 20px; padding: 2.5rem 2rem;
    width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }
  .up-modal-ico { font-size: 3rem; margin-bottom: 0.8rem; }
  .up-modal-title { font-size: 1.3rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.5rem; }
  .up-modal-desc { font-size: 0.9rem; color: ${C.textMuted}; line-height: 1.6; margin-bottom: 1.8rem; }
  .up-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
  .up-modal-cancel {
    background: #f0f0f0; color: ${C.textMuted}; border: none; border-radius: 12px;
    padding: 0.9rem; font-size: 0.95rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
  }
  .up-modal-ok {
    background: ${C.danger}; color: #fff; border: none; border-radius: 12px;
    padding: 0.9rem; font-size: 0.95rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
  }
`;

// 건강 점수 계산
const calcHealthScore = (p) => {
  const s = (val) => {
    if (!val || val === "없음" || val === "없음 (스스로 보행 가능)" || val === "없음 (비흡연)" || val === "없음 (금주)") return 100;
    if (val.includes("경증") || val.includes("경도") || val.includes("초기") || val.includes("가끔") || val.includes("과거") || val.includes("완치") || val.includes("1회")) return 65;
    return 25;
  };

  const chronic = Math.round((s(p.diabetes) + s(p.hypertension) + s(p.heart) + s(p.kidney) + s(p.cancer)) / 5);

  const fallPenalty = p.recentFall === "4회 이상" ? 20 : p.recentFall === "2~3회" ? 15 : p.recentFall === "1회" ? 5 : 0;
  const mobility = Math.max(0, Math.round((s(p.joint) + s(p.stroke) + s(p.walkingAid)) / 3) - fallPenalty);

  const cognition = s(p.dementia);
  const sensory = Math.round((s(p.vision) + s(p.hearing)) / 2);
  const respiratory = s(p.lung);

  const smokePenalty = p.smoking === "흡연 중" ? 25 : p.smoking === "과거 흡연 (현재 금연)" ? 10 : 0;
  const drinkPenalty = p.drinking === "자주 (주 1회 이상)" ? 20 : p.drinking === "가끔 (월 1~2회)" ? 5 : 0;
  const medPenalty = p.medicineCount === "6개 이상" ? 15 : p.medicineCount === "3~5개" ? 8 : 0;
  const lifestyle = Math.max(0, 100 - smokePenalty - drinkPenalty - medPenalty);

  return {
    "만성질환": chronic,
    "관절·거동": mobility,
    "인지·정신": cognition,
    "시력·청력": sensory,
    "호흡·폐":   respiratory,
    "생활습관":  lifestyle,
  };
};

// 레이더 차트
function RadarChart({ scores }) {
  const keys = Object.keys(scores);
  const vals = Object.values(scores);
  const n = keys.length;
  const cx = 130, cy = 130, r = 95;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, ratio) => ({
    x: cx + r * ratio * Math.cos(angle(i)),
    y: cy + r * ratio * Math.sin(angle(i)),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPts = vals.map((v, i) => pt(i, v / 100));
  const pathD = dataPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / n);
  const avgColor = avg >= 75 ? C.green : avg >= 50 ? "#f0a500" : C.danger;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
      <svg width="260" height="260" viewBox="0 0 260 260">
        {gridLevels.map((lvl, li) => (
          <polygon
            key={li}
            points={keys.map((_, i) => { const p = pt(i, lvl); return `${p.x},${p.y}`; }).join(" ")}
            fill="none" stroke={C.border} strokeWidth="1"
          />
        ))}
        {keys.map((_, i) => {
          const p = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border} strokeWidth="1" />;
        })}
        <path d={pathD} fill={C.green} fillOpacity="0.2" stroke={C.green} strokeWidth="2.5" />
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={C.green} stroke="#fff" strokeWidth="2" />
        ))}
        {keys.map((key, i) => {
          const p = pt(i, 1.28);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="10.5" fontWeight="700" fill={C.greenDark} fontFamily="Noto Sans KR, sans-serif">
              {key}
            </text>
          );
        })}
        {vals.map((v, i) => {
          const p = pt(i, (v / 100) * 0.68);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill={C.text} fontWeight="700">
              {v}
            </text>
          );
        })}
      </svg>

      <div style={{ flex: 1, minWidth: "180px" }}>
        <div style={{ fontSize: "0.72rem", color: C.textMuted, fontWeight: "700", marginBottom: "0.3rem" }}>종합 건강 점수</div>
        <div style={{ fontSize: "2.8rem", fontWeight: "700", color: avgColor, lineHeight: 1 }}>{avg}</div>
        <div style={{ fontSize: "0.8rem", color: C.textMuted, marginBottom: "1.1rem" }}>/ 100점</div>
        {keys.map((key, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
            <div style={{ fontSize: "0.75rem", color: C.textMuted, minWidth: "56px" }}>{key}</div>
            <div style={{ flex: 1, height: "5px", background: C.greenPale, borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${vals[i]}%`, borderRadius: "3px", transition: "width 0.5s ease",
                background: vals[i] >= 75 ? C.green : vals[i] >= 50 ? "#f0a500" : C.danger,
              }} />
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: "700", color: C.text, minWidth: "24px" }}>{vals[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const schedules = [
  { time: "10:00", text: "혈압약 복용" },
  { time: "14:00", text: "병원 진료 예약" },
  { time: "16:30", text: "공원 산책" },
];

const alerts = [
  { type: "한파", color: "#e05252", msg: "최저기온 -12°C 예상, 외출 자제", time: "오전 9:00" },
  { type: "강풍", color: "#f0a500", msg: "순간 풍속 15m/s 이상 예상", time: "오후 2:00" },
];

const menus = [
  { icon: "🌡", label: "기후 알림",    desc: "위험 기후 안내",       route: "/weather" },
  { icon: "📋", label: "낙상 기록",    desc: "감지 이력 확인",       route: "/fall-history" },
  { icon: "💼", label: "일자리 찾기",  desc: "맞춤 일자리 추천",     route: "/jobs", badge: "NEW" },
  { icon: "📍", label: "내 위치",      desc: "실시간 위치 공유",     route: "/location" },
  { icon: "👤", label: "내 정보 수정", desc: "신체정보 및 인적사항", route: "/profile" },
];

export default function UserPage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);
  const [showSOS, setShowSOS] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [userName, setUserName] = useState("사용자");
  const [userRegion, setUserRegion] = useState("");
  const [healthScores, setHealthScores] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user_profile");
      if (saved) {
        const p = JSON.parse(saved);
        setUserName(p.name || "사용자");
        setUserRegion(p.region || "");
        setHealthScores(calcHealthScore(p));
      }
    } catch {}

    setWeather({ temp: 22, status: "맑음", icon: "☀️", region: "서울 송파구" });
    const d = new Date();
    const days = ["일","월","화","수","목","금","토"];
    setDateStr(`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`);
  }, []);

  const confirmSOS = () => {
    setShowSOS(false);
    setTimeout(() => alert("보호자에게 SOS를 전송했습니다."), 150);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="up-root">

        <nav className="up-nav">
          <div className="up-nav-logo">🌿 우리 woori</div>
          <div className="up-nav-right">
            <span className="up-nav-date">{dateStr}</span>
            <button className="up-nav-sos" onClick={() => setShowSOS(true)}>🆘 SOS 도움 요청</button>
          </div>
        </nav>

        <div className="up-layout">

          {/* 사이드바 */}
          <aside>
            <div className="up-profile-card">
              <div className="up-profile-avatar">👤</div>
              <div className="up-profile-name">{userName}님</div>
              <div className="up-profile-sub">케어링 돌봄 서비스</div>
              {userRegion && <div className="up-profile-region">📍 {userRegion}</div>}
              <div className="up-dot-wrap">
                <div className="up-dot" /> 디바이스 연결됨
              </div>
            </div>
            <div className="up-sidemenu">
              {menus.map(m => (
                <button key={m.route} className="up-sidemenu-item" onClick={() => navigate(m.route)}>
                  <span className="up-sidemenu-icon">{m.icon}</span>
                  <span className="up-sidemenu-label">{m.label}</span>
                  {m.badge && <span className="up-sidemenu-badge">{m.badge}</span>}
                </button>
              ))}
            </div>
          </aside>

          {/* 메인 */}
          <main>
            {/* 상단 3카드 */}
            <div className="up-top-row">
              <div className="up-weather-card" onClick={() => navigate("/weather")}>
                <div className="up-card-label">오늘 날씨</div>
                <div className="up-weather-temp">{weather?.temp ?? "-"}°C</div>
                <div className="up-weather-bot">
                  <div className="up-weather-desc">{weather?.status} · {weather?.region}</div>
                  <div className="up-weather-icon">{weather?.icon ?? "🌤"}</div>
                </div>
              </div>
              <div className="up-stat-card" onClick={() => navigate("/fall-history")}>
                <div className="up-card-label">이번 달 낙상</div>
                <div className="up-stat-value red">2건</div>
                <div className="up-stat-sub">최근: 5월 4일 거실</div>
              </div>
              <div className="up-stat-card">
                <div className="up-card-label">오늘 일정</div>
                <div className="up-stat-value">{schedules.length}건</div>
                <div className="up-stat-sub">다음: 10:00 혈압약 복용</div>
              </div>
            </div>

            {/* 일정 + 기후 */}
            <div className="up-content-row">
              <div className="up-card">
                <div className="up-card-head">
                  <div className="up-card-title">📅 오늘 일정</div>
                </div>
                {schedules.map((s, i) => (
                  <div key={i} className="up-schedule-row">
                    <div className="up-schedule-time">{s.time}</div>
                    <div className="up-schedule-dot" />
                    <div className="up-schedule-text">{s.text}</div>
                  </div>
                ))}
              </div>
              <div className="up-card">
                <div className="up-card-head">
                  <div className="up-card-title">🌡 기후 알림</div>
                  <button className="up-card-more" onClick={() => navigate("/weather")}>전체보기 →</button>
                </div>
                {alerts.map((a, i) => (
                  <div key={i} className="up-alert-item">
                    <span className="up-alert-badge" style={{ background: a.color, color: "#fff" }}>{a.type}</span>
                    <div>
                      <div className="up-alert-text">{a.msg}</div>
                      <div className="up-alert-time">🕐 {a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 건강 레이더 차트 */}
            {healthScores && (
              <div className="up-content-row">
                <div className="up-card full">
                  <div className="up-card-head">
                    <div className="up-card-title">🏥 건강 상태 레이더</div>
                    <button className="up-card-more" onClick={() => navigate("/profile")}>정보 수정 →</button>
                  </div>
                  <RadarChart scores={healthScores} />
                </div>
              </div>
            )}

            {/* 빠른 실행 */}
            <div className="up-content-row">
              <div className="up-card full">
                <div className="up-card-head">
                  <div className="up-card-title">⚡ 빠른 실행</div>
                </div>
                <div className="up-quick-grid">
                  {menus.map(m => (
                    <button key={m.route} className="up-quick-btn" onClick={() => navigate(m.route)}>
                      <span className="up-quick-icon">{m.icon}</span>
                      <div className="up-quick-label">{m.label}</div>
                      <div className="up-quick-desc">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* SOS 모달 */}
        {showSOS && (
          <div className="up-overlay" onClick={() => setShowSOS(false)}>
            <div className="up-modal" onClick={e => e.stopPropagation()}>
              <div className="up-modal-ico">🆘</div>
              <div className="up-modal-title">SOS를 보내시겠어요?</div>
              <div className="up-modal-desc">보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.</div>
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