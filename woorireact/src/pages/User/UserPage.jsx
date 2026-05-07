import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLORS,
  alerts,
  calcHealthScore,
  menus,
  schedules,
} from "../../utils/user/userPageData";
import "../../css/user/UserPage.css";

const getInitialSeniorProfile = () => {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const getHealthScoresFromProfile = (profile) => {
  const healthInfo = profile?.healthInfo;

  if (!healthInfo) {
    return null;
  }

  return calcHealthScore({
    diabetes: healthInfo.diabetes,
    hypertension: healthInfo.hypertension,
    heart: healthInfo.heartDisease,
    joint: healthInfo.jointDisease,
    stroke: healthInfo.stroke,
    kidney: healthInfo.kidneyDisease,
    lung: healthInfo.lungDisease,
    liver: healthInfo.liverDisease,
    cancer: healthInfo.cancer,
    walkingAid: healthInfo.walkingAid,
    dementia: healthInfo.dementia,
    vision: healthInfo.vision,
    hearing: healthInfo.hearing,
    recentFall: healthInfo.recentFall,
    smoking: healthInfo.smoking,
    drinking: healthInfo.drinking,
    medicineCount: healthInfo.medicineCount,
  });
};

function RadarChart({ scores }) {
  const keys = Object.keys(scores);
  const vals = Object.values(scores);
  const count = keys.length;
  const cx = 130;
  const cy = 130;
  const radius = 95;

  const angle = (index) => (Math.PI * 2 * index) / count - Math.PI / 2;

  const point = (index, ratio) => ({
    x: cx + radius * ratio * Math.cos(angle(index)),
    y: cy + radius * ratio * Math.sin(angle(index)),
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = vals.map((value, index) => point(index, value / 100));
  const pathD =
    dataPoints
      .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`)
      .join(" ") + " Z";

  const avg = Math.round(vals.reduce((sum, value) => sum + value, 0) / count);
  const avgColor = avg >= 75 ? COLORS.green : avg >= 50 ? "#f0a500" : COLORS.danger;

  return (
    <div className="up-radar-wrap">
      <svg width="260" height="260" viewBox="0 0 260 260">
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={keys
              .map((_, index) => {
                const p = point(index, level);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={COLORS.border}
            strokeWidth="1"
          />
        ))}

        {keys.map((_, index) => {
          const p = point(index, 1);

          return (
            <line
              key={index}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={COLORS.border}
              strokeWidth="1"
            />
          );
        })}

        <path
          d={pathD}
          fill={COLORS.green}
          fillOpacity="0.2"
          stroke={COLORS.green}
          strokeWidth="2.5"
        />

        {dataPoints.map((p, index) => (
          <circle
            key={index}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={COLORS.green}
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}

        {keys.map((key, index) => {
          const p = point(index, 1.28);

          return (
            <text
              key={key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10.5"
              fontWeight="700"
              fill={COLORS.greenDark}
              fontFamily="Noto Sans KR, sans-serif"
            >
              {key}
            </text>
          );
        })}

        {vals.map((value, index) => {
          const p = point(index, (value / 100) * 0.68);

          return (
            <text
              key={index}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill={COLORS.text}
              fontWeight="700"
            >
              {value}
            </text>
          );
        })}
      </svg>

      <div className="up-radar-info">
        <div className="up-radar-label">종합 건강 점수</div>
        <div className="up-radar-score" style={{ color: avgColor }}>
          {avg}
        </div>
        <div className="up-radar-unit">/ 100점</div>

        {keys.map((key, index) => (
          <div key={key} className="up-radar-row">
            <div className="up-radar-key">{key}</div>

            <div className="up-radar-bar">
              <div
                className="up-radar-bar-fill"
                style={{
                  width: `${vals[index]}%`,
                  background:
                    vals[index] >= 75
                      ? COLORS.green
                      : vals[index] >= 50
                        ? "#f0a500"
                        : COLORS.danger,
                }}
              />
            </div>

            <div className="up-radar-value">{vals[index]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserPage() {
  const navigate = useNavigate();
  const initialProfile = getInitialSeniorProfile();
  const initialSenior = initialProfile?.senior;

  const [weather, setWeather] = useState({
    temp: 22,
    status: "맑음",
    icon: "☀️",
    region: "서울 송파구",
  });
  const [showSOS, setShowSOS] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [userName, setUserName] = useState(initialSenior?.name || "사용자");
  const [userRegion, setUserRegion] = useState(
    initialSenior?.region || initialSenior?.address || ""
  );
  const [healthScores, setHealthScores] = useState(() =>
    getHealthScoresFromProfile(initialProfile)
  );

  useEffect(() => {
    const applyProfile = (profile) => {
      const senior = profile?.senior;

      setUserName(senior?.name || "사용자");
      setUserRegion(senior?.region || senior?.address || "");
      setHealthScores(getHealthScoresFromProfile(profile));
    };

    const loadCurrentSenior = async () => {
      try {
        const saved = sessionStorage.getItem("currentSenior");

        if (saved) {
          const cachedProfile = JSON.parse(saved);
          applyProfile(cachedProfile);
          return;
        }

        const response = await fetch("http://localhost:8181/api/seniors");

        if (!response.ok) return;

        const profiles = await response.json();
        const latestProfile = profiles[profiles.length - 1];

        if (!latestProfile) return;

        sessionStorage.setItem("currentSenior", JSON.stringify(latestProfile));
        applyProfile(latestProfile);
      } catch (error) {
        console.error("사용자 정보 조회 실패:", error);
      }
    };

    loadCurrentSenior();

    const date = new Date();
    const days = ["일", "월", "화", "수", "목", "금", "토"];

    setDateStr(
      `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`
    );
  }, []);

  const confirmSOS = () => {
    setShowSOS(false);
    setTimeout(() => alert("보호자에게 SOS를 전송했습니다."), 150);
  };

  return (
    <div className="up-root">
      <nav className="up-nav">
        <div className="up-nav-logo">🌿 우리 woori</div>

        <div className="up-nav-right">
          <span className="up-nav-date">{dateStr}</span>
          <button className="up-nav-sos" type="button" onClick={() => setShowSOS(true)}>
            🆘 SOS 도움 요청
          </button>
        </div>
      </nav>

      <div className="up-layout">
        <aside>
          <div className="up-profile-card">
            <div className="up-profile-avatar">👤</div>
            <div className="up-profile-name">{userName}님</div>
            <div className="up-profile-sub">우리 돌봄 서비스</div>

            {userRegion && <div className="up-profile-region">📍 {userRegion}</div>}

            <div className="up-dot-wrap">
              <div className="up-dot" /> 디바이스 연결됨
            </div>
          </div>

          <div className="up-sidemenu">
            {menus.map((menu) => (
              <button
                key={menu.route}
                className="up-sidemenu-item"
                type="button"
                onClick={() => navigate(menu.route)}
              >
                <span className="up-sidemenu-icon">{menu.icon}</span>
                <span className="up-sidemenu-label">{menu.label}</span>
                {menu.badge && <span className="up-sidemenu-badge">{menu.badge}</span>}
              </button>
            ))}
          </div>
        </aside>

        <main>
          <div className="up-top-row">
            <div className="up-weather-card" onClick={() => navigate("/weather")}>
              <div className="up-card-label">오늘 날씨</div>
              <div className="up-weather-temp">{weather?.temp ?? "-"}°C</div>

              <div className="up-weather-bot">
                <div className="up-weather-desc">
                  {weather?.status} · {weather?.region}
                </div>
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

          <div className="up-content-row">
            <div className="up-card">
              <div className="up-card-head">
                <div className="up-card-title">📅 오늘 일정</div>
              </div>

              {schedules.map((schedule) => (
                <div key={schedule.time} className="up-schedule-row">
                  <div className="up-schedule-time">{schedule.time}</div>
                  <div className="up-schedule-dot" />
                  <div className="up-schedule-text">{schedule.text}</div>
                </div>
              ))}
            </div>

            <div className="up-card">
              <div className="up-card-head">
                <div className="up-card-title">🌡 기후 알림</div>
                <button className="up-card-more" type="button" onClick={() => navigate("/weather")}>
                  전체보기 →
                </button>
              </div>

              {alerts.map((alert) => (
                <div key={`${alert.type}-${alert.time}`} className="up-alert-item">
                  <span
                    className="up-alert-badge"
                    style={{ background: alert.color, color: "#ffffff" }}
                  >
                    {alert.type}
                  </span>

                  <div>
                    <div className="up-alert-text">{alert.msg}</div>
                    <div className="up-alert-time">🕐 {alert.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {healthScores && (
            <div className="up-content-row">
              <div className="up-card full">
                <div className="up-card-head">
                  <div className="up-card-title">🏥 건강 상태 레이더</div>
                  <button className="up-card-more" type="button" onClick={() => navigate("/profile")}>
                    정보 수정 →
                  </button>
                </div>

                <RadarChart scores={healthScores} />
              </div>
            </div>
          )}

          <div className="up-content-row">
            <div className="up-card full">
              <div className="up-card-head">
                <div className="up-card-title">⚡ 빠른 실행</div>
              </div>

              <div className="up-quick-grid">
                {menus.map((menu) => (
                  <button
                    key={menu.route}
                    className="up-quick-btn"
                    type="button"
                    onClick={() => navigate(menu.route)}
                  >
                    <span className="up-quick-icon">{menu.icon}</span>
                    <div className="up-quick-label">{menu.label}</div>
                    <div className="up-quick-desc">{menu.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {showSOS && (
        <div className="up-overlay" onClick={() => setShowSOS(false)}>
          <div className="up-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">🆘</div>
            <div className="up-modal-title">SOS를 보내시겠어요?</div>
            <div className="up-modal-desc">
              보호자와 담당 복지사에게
              <br />
              즉시 알림이 전송됩니다.
            </div>

            <div className="up-modal-row">
              <button className="up-modal-cancel" type="button" onClick={() => setShowSOS(false)}>
                취소
              </button>
              <button className="up-modal-ok" type="button" onClick={confirmSOS}>
                보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
