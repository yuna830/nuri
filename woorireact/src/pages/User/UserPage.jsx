import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLORS,
  calcHealthScore,
  menus,
  schedules,
} from "../../utils/user/userPageData";
import "../../css/user/UserPage.css";

const SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

const toGrid = (lat, lon) => {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
};

const getInitialSeniorProfile = () => {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

const getHealthScoresFromProfile = (profile) => {
  const healthInfo = profile?.healthInfo;
  if (!healthInfo) return null;
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
  const cx = 130, cy = 130, radius = 95;
  const angle = (i) => (Math.PI * 2 * i) / count - Math.PI / 2;
  const point = (i, ratio) => ({
    x: cx + radius * ratio * Math.cos(angle(i)),
    y: cy + radius * ratio * Math.sin(angle(i)),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = vals.map((v, i) => point(i, v / 100));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / count);
  const avgColor = avg >= 75 ? COLORS.green : avg >= 50 ? "#f0a500" : COLORS.danger;

  return (
    <div className="up-radar-wrap">
      <svg width="260" height="260" viewBox="0 0 260 260">
        {gridLevels.map((lvl) => (
          <polygon key={lvl}
            points={keys.map((_, i) => { const p = point(i, lvl); return `${p.x},${p.y}`; }).join(" ")}
            fill="none" stroke={COLORS.border} strokeWidth="1" />
        ))}
        {keys.map((_, i) => { const p = point(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={COLORS.border} strokeWidth="1" />; })}
        <path d={pathD} fill={COLORS.green} fillOpacity="0.2" stroke={COLORS.green} strokeWidth="2.5" />
        {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={COLORS.green} stroke="#fff" strokeWidth="2" />)}
        {keys.map((key, i) => { const p = point(i, 1.28); return <text key={key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="700" fill={COLORS.greenDark} fontFamily="Noto Sans KR, sans-serif">{key}</text>; })}
        {vals.map((v, i) => { const p = point(i, (v / 100) * 0.68); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={COLORS.text} fontWeight="700">{v}</text>; })}
      </svg>
      <div className="up-radar-info">
        <div className="up-radar-label">종합 건강 점수</div>
        <div className="up-radar-score" style={{ color: avgColor }}>{avg}</div>
        <div className="up-radar-unit">/ 100점</div>
        {keys.map((key, i) => (
          <div key={key} className="up-radar-row">
            <div className="up-radar-key">{key}</div>
            <div className="up-radar-bar">
              <div className="up-radar-bar-fill" style={{
                width: `${vals[i]}%`,
                background: vals[i] >= 75 ? COLORS.green : vals[i] >= 50 ? "#f0a500" : COLORS.danger,
              }} />
            </div>
            <div className="up-radar-value">{vals[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function scheduleFromApi(schedule) {
  return {
    id: schedule.id,
    date: schedule.scheduleDate,
    time: schedule.scheduleTime?.slice(0, 5) || "시간 미정",
    text: schedule.content || schedule.title,
  };
}

function todayValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${date}`;
}

function getCurrentSeniorId(initialSenior) {
  return localStorage.getItem("current_senior_id") || initialSenior?.id || "";
}

export default function UserPage() {
  const navigate = useNavigate();
  const initialProfile = getInitialSeniorProfile();
  const initialSenior = initialProfile?.senior;
  const locationIntervalRef = useRef(null);

  const [weather, setWeather] = useState(null);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [showSOS, setShowSOS] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [userName, setUserName] = useState(initialSenior?.name || "사용자");
  const [userRegion, setUserRegion] = useState(initialSenior?.region || initialSenior?.address || "");
  const [healthScores, setHealthScores] = useState(() => getHealthScoresFromProfile(initialProfile));
  const [scheduleList, setScheduleList] = useState([]);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [allSchedules, setAllSchedules] = useState([]);
  const [isLoadingAllSchedules, setIsLoadingAllSchedules] = useState(false);

  // 위치 관련 state
  const [currentPos, setCurrentPos] = useState(null);
  const [currentAddress, setCurrentAddress] = useState("위치 불러오는 중...");
  const [isInRange, setIsInRange] = useState(true);
  const [safeZone, setSafeZone] = useState(null);

  const fetchWeather = async (lat, lon) => {
    try {
      const { nx, ny } = toGrid(lat, lon);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const date = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const hour = pad(now.getHours());
      const url = `/weather-api/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst`
        + `?ServiceKey=${SERVICE_KEY}&pageNo=1&numOfRows=10&dataType=JSON`
        + `&base_date=${date}&base_time=${hour}00&nx=${nx}&ny=${ny}`;
      const res = await fetch(url);
      const data = await res.json();
      const items = data.response.body.items.item;
      const temp  = items.find(i => i.category === "T1H")?.obsrValue;
      const humid = items.find(i => i.category === "REH")?.obsrValue;
      const pty   = items.find(i => i.category === "PTY")?.obsrValue;
      let icon = "☀️", status = "맑음";
      if (pty === "1") { icon = "🌧"; status = "비"; }
      else if (pty === "2") { icon = "🌨"; status = "비/눈"; }
      else if (pty === "3") { icon = "❄️"; status = "눈"; }
      else if (pty === "4") { icon = "🌦"; status = "소나기"; }
      setWeather({ temp: Math.round(temp), status, icon, region: "현재 위치", humid: humid ? `${humid}%` : "-" });
    } catch {
      setWeather({ temp: "--", status: "불러오기 실패", icon: "🌤", region: "서울" });
    }
  };

  const fetchWeatherAlerts = async () => {
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const fromTm = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}0000`;
      const toTm   = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}2359`;
      const url = `/weather-api/1360000/WthrWrnInfoService/getWthrWrnList`
        + `?ServiceKey=${SERVICE_KEY}&pageNo=1&numOfRows=5&dataType=JSON`
        + `&stnId=108&fromTmFc=${fromTm}&toTmFc=${toTm}`;
      const res = await fetch(url);
      const data = await res.json();
      const items = data?.response?.body?.items?.item || [];
      const pad2 = (n) => String(n).padStart(2, "0");
      const now2 = new Date();
      if (!items || items.length === 0) {
        setWeatherAlerts([{ type: "날씨", color: COLORS.green, msg: "현재 발령된 기상특보가 없습니다.", time: `${pad2(now2.getHours())}:${pad2(now2.getMinutes())}` }]);
        return;
      }
      const parsed = (Array.isArray(items) ? items : [items]).map(item => {
        const title = item.title || "";
        let color = "#f0a500";
        if (title.includes("경보") || title.includes("한파") || title.includes("폭염")) color = COLORS.danger;
        if (title.includes("태풍")) color = "#7a1a1a";
        let type = "특보";
        if (title.includes("한파")) type = "한파";
        else if (title.includes("폭염")) type = "폭염";
        else if (title.includes("강풍")) type = "강풍";
        else if (title.includes("호우")) type = "호우";
        else if (title.includes("대설")) type = "대설";
        return { type, color, msg: title, time: item.tmFc ? `${item.tmFc.toString().slice(8,10)}:${item.tmFc.toString().slice(10,12)}` : "-" };
      });
      setWeatherAlerts(parsed);
    } catch {
      setWeatherAlerts([{ type: "날씨", color: COLORS.green, msg: "기상 정보를 불러오지 못했습니다.", time: "-" }]);
    }
  };

  // 위치 가져오기 + 서버 전송
  const updateLocation = async (lat, lon) => {
    setCurrentPos({ lat, lon });

    // 주소 변환
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
      );
      const d = await res.json();
      const addr = d?.address;
      const address = addr?.suburb || addr?.neighbourhood || addr?.city_district || addr?.city || "현재 위치";
      setCurrentAddress(address);

      // 서버에 위치 저장
      const seniorId = getCurrentSeniorId(initialSenior);
      if (seniorId) {
        await fetch("http://localhost:8181/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seniorId, latitude: lat, longitude: lon, address }),
        }).catch(() => {});
      }
    } catch {
      setCurrentAddress("현재 위치");
    }

    // 안전 반경 확인
    if (safeZone) {
      const dist = Math.sqrt(
        Math.pow((lat - safeZone.centerLatitude) * 111000, 2) +
        Math.pow((lon - safeZone.centerLongitude) * 111000 * Math.cos(lat * Math.PI / 180), 2)
      );
      setIsInRange(dist <= safeZone.radiusMeters);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude);
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => fetchWeather(37.5665, 126.9780)
    );

    // 30초마다 위치 자동 갱신
    locationIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => updateLocation(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }, 30000);
  };

  useEffect(() => {
    fetchWeatherAlerts();
    startLocationTracking();

    // 안전 반경 불러오기
    const seniorId = getCurrentSeniorId(initialSenior);
    if (seniorId) {
      fetch(`http://localhost:8181/api/safe-zones/senior/${seniorId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setSafeZone(data); })
        .catch(() => {});
    }

    // DB에서 사용자 정보
    const loadCurrentSenior = async () => {
      try {
        const saved = sessionStorage.getItem("currentSenior");
        if (saved) {
          const profile = JSON.parse(saved);
          setUserName(profile?.senior?.name || "사용자");
          setUserRegion(profile?.senior?.region || profile?.senior?.address || "");
          setHealthScores(getHealthScoresFromProfile(profile));
          return;
        }
        const res = await fetch("http://localhost:8080/api/seniors");
        if (!res.ok) return;
        const profiles = await res.json();
        const latest = profiles[profiles.length - 1];
        if (!latest) return;
        sessionStorage.setItem("currentSenior", JSON.stringify(latest));
        localStorage.setItem("current_senior_id", String(latest.senior.id));
        setUserName(latest?.senior?.name || "사용자");
        setUserRegion(latest?.senior?.region || latest?.senior?.address || "");
        setHealthScores(getHealthScoresFromProfile(latest));
      } catch (e) {
        console.error("사용자 정보 조회 실패:", e);
      }
    };
    loadCurrentSenior();

    const d = new Date();
    const days = ["일","월","화","수","목","금","토"];
    setDateStr(`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`);

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  // 날짜별 일정 불러오기
  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return;
    fetch(`/api/schedules/senior/${seniorId}/date/${selectedScheduleDate}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        setScheduleList(list.map(scheduleFromApi));
      })
      .catch(() => setScheduleList([]));
  }, [selectedScheduleDate]);

  const confirmSOS = async () => {
    setShowSOS(false);
    // SOS 알림 서버 전송
    const seniorId = getCurrentSeniorId(initialSenior);
    if (seniorId) {
      await fetch(`http://localhost:8181/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seniorId,
          message: "SOS 도움 요청",
          type: "SOS",
          latitude: currentPos?.lat,
          longitude: currentPos?.lon,
        }),
      }).catch(() => {});
    }
    setTimeout(() => alert("보호자에게 SOS를 전송했습니다."), 150);
  };

  const openAllSchedules = async () => {
    const seniorId = getCurrentSeniorId(initialSenior);
    setShowAllSchedules(true);
    if (!seniorId) { setAllSchedules([]); return; }
    setIsLoadingAllSchedules(true);
    try {
      const res = await fetch(`/api/schedules/senior/${seniorId}`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : data?.content ?? [];
      setAllSchedules(list.map(scheduleFromApi));
    } catch {
      setAllSchedules([]);
    } finally {
      setIsLoadingAllSchedules(false);
    }
  };

  return (
    <div className="up-root">
      <nav className="up-nav">
        <div className="up-nav-logo">🌿 우리 woori</div>
        <div className="up-nav-right">
          <span className="up-nav-date">{dateStr}</span>
          <button className="up-nav-sos" type="button" onClick={() => setShowSOS(true)}>
            🚨 SOS 도움 요청
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
            {menus.map((menu, i) => (
              <button
                key={i}
                className="up-sidemenu-item"
                type="button"
                onClick={() => {
                  if (menu.disabled) { alert("💬 AI 챗봇 기능은 준비 중입니다!"); return; }
                  navigate(menu.route);
                }}
              >
                <span className="up-sidemenu-icon">{menu.icon}</span>
                <span className="up-sidemenu-label">{menu.label}</span>
                {menu.badge && (
                  <span className="up-sidemenu-badge" style={menu.disabled ? { background: "#7a9a7c" } : {}}>
                    {menu.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 현재 위치 미니 카드 */}
          <div className="up-card" style={{ cursor: "pointer" }} onClick={() => navigate("/location")}>
            <div className="up-card-head">
              <div className="up-card-title">📍 현재 위치</div>
              <span style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>→</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              marginBottom: "0.5rem",
            }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: isInRange ? COLORS.green : COLORS.danger,
                flexShrink: 0,
                animation: "up-blink 2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: "0.82rem", fontWeight: "700",
                color: isInRange ? COLORS.green : COLORS.danger,
              }}>
                {isInRange ? "안전 반경 내" : "⚠️ 반경 이탈"}
              </span>
            </div>
            <div style={{
              fontSize: "0.78rem", color: COLORS.textMuted,
              lineHeight: "1.5",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {currentAddress}
            </div>
            {currentPos && (
              <div style={{ fontSize: "0.68rem", color: COLORS.textMuted, marginTop: "0.3rem" }}>
                {currentPos.lat.toFixed(4)}, {currentPos.lon.toFixed(4)}
              </div>
            )}
          </div>
        </aside>

        <main>
          <div className="up-top-row">
            <div className="up-weather-card" onClick={() => navigate("/weather-graph")}>
              <div className="up-card-label">오늘 날씨 📈</div>
              <div className="up-weather-temp">{weather?.temp ?? "-"}°C</div>
              <div className="up-weather-bot">
                <div className="up-weather-desc">{weather?.status ?? "불러오는 중"} · {weather?.region ?? ""}</div>
                <div className="up-weather-icon">{weather?.icon ?? "🌤"}</div>
              </div>
            </div>

            <div className="up-stat-card" onClick={() => navigate("/fall-history")}>
              <div className="up-card-label">이번 달 낙상</div>
              <div className="up-stat-value red">2건</div>
              <div className="up-stat-sub">최근: 5월 4일 거실</div>
            </div>

            <div className="up-stat-card" onClick={openAllSchedules}>
              <div className="up-card-label">오늘 일정</div>
              <div className="up-stat-value">{scheduleList.length}건</div>
              <div className="up-stat-sub">
                {scheduleList.length > 0
                  ? `다음: ${scheduleList[0].time} ${scheduleList[0].text}`
                  : "오늘 등록된 일정이 없어요"}
              </div>
            </div>
          </div>

          {/* 일정 + 기후 알림 */}
          <div className="up-content-row">
            {/* 일정 카드 */}
            <div className="up-card">
              <div className="up-card-head">
                <div className="up-card-title">📅 일정</div>
                <input
                  type="date"
                  value={selectedScheduleDate}
                  onChange={e => setSelectedScheduleDate(e.target.value)}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "8px",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    color: COLORS.textMuted,
                    fontFamily: "Noto Sans KR, sans-serif",
                    background: COLORS.cream,
                    outline: "none",
                    cursor: "pointer",
                  }}
                />
              </div>

              {scheduleList.length === 0 ? (
                <div style={{ padding: "1rem 0", textAlign: "center", color: COLORS.textMuted, fontSize: "0.85rem" }}>
                  등록된 일정이 없어요 😊
                </div>
              ) : (
                scheduleList.map((s, i) => (
                  <div key={i} className="up-schedule-row">
                    <div className="up-schedule-time">{s.time}</div>
                    <div className="up-schedule-dot" />
                    <div className="up-schedule-text">{s.text}</div>
                  </div>
                ))
              )}
            </div>

            {/* 기후 알림 카드 */}
            <div className="up-card">
              <div className="up-card-head">
                <div className="up-card-title">🌡 기후 알림</div>
                <button className="up-card-more" type="button" onClick={() => navigate("/weather")}>
                  전체보기 →
                </button>
              </div>

              {weatherAlerts.map((a, i) => (
                <div key={i} className="up-alert-item">
                  <span className="up-alert-badge" style={{
                    background: a.color, color: "#fff",
                    border: `1px solid ${a.color}`,
                  }}>
                    {a.type}
                  </span>
                  <div>
                    <div className="up-alert-text">{a.msg}</div>
                    <div className="up-alert-time">🕐 {a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 건강 레이더 */}
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

          {/* 빠른 실행 */}
          <div className="up-content-row">
            <div className="up-card full">
              <div className="up-card-head">
                <div className="up-card-title">⚡ 빠른 실행</div>
              </div>
              <div className="up-quick-grid">
                {menus.filter(m => !m.hideQuick).map((m, i) => (
                  <button
                    key={i}
                    className="up-quick-btn"
                    type="button"
                    onClick={() => navigate(m.route)}
                  >
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

      {/* 전체 일정 모달 */}
      {showAllSchedules && (
        <div className="up-overlay" onClick={() => setShowAllSchedules(false)}>
          <div className="up-modal" style={{ maxHeight: "70vh", overflowY: "auto", textAlign: "left", width: "480px" }}
            onClick={e => e.stopPropagation()}>
            <div className="up-card-head" style={{ marginBottom: "1rem" }}>
              <div className="up-modal-title" style={{ fontSize: "1.1rem" }}>📅 전체 일정</div>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: COLORS.textMuted }}
                onClick={() => setShowAllSchedules(false)}>✕</button>
            </div>
            {isLoadingAllSchedules ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>불러오는 중...</div>
            ) : allSchedules.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>등록된 일정이 없어요.</div>
            ) : (
              allSchedules.map(s => (
                <div key={s.id} className="up-schedule-row">
                  <div className="up-schedule-time" style={{ minWidth: "80px", fontSize: "0.75rem" }}>{s.date}</div>
                  <div className="up-schedule-dot" />
                  <div>
                    <div className="up-schedule-text">{s.text}</div>
                    <div style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>{s.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SOS 모달 */}
      {showSOS && (
        <div className="up-overlay" onClick={() => setShowSOS(false)}>
          <div className="up-modal" onClick={e => e.stopPropagation()}>
            <div className="up-modal-ico">🚨</div>
            <div className="up-modal-title">SOS를 보내시겠어요?</div>
            <div className="up-modal-desc">
              보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.
            </div>
            <div className="up-modal-row">
              <button className="up-modal-cancel" type="button" onClick={() => setShowSOS(false)}>취소</button>
              <button className="up-modal-ok" type="button" onClick={confirmSOS}>보내기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}