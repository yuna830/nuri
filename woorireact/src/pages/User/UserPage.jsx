import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLORS,
  calcHealthScore,
  menus,
  schedules,
} from "../../utils/user/userPageData";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import { customLocationIcon } from "../../utils/user/locationPageUtils";
import {
  createSosAlert,
  createSosCancelAlert,
  fetchTodayClimateAlerts,
  fetchTodayForecast,
  getCurrentSeniorId as getSavedSeniorId,
  resolveUploadUrl,
  reverseGeocode,
} from "../../api/userPageApi.js";
import { fetchJobList } from "../../utils/user/jobApi";
import { fetchAirQuality, fetchPollenIndex, fetchUVIndex } from "../../utils/user/weatherAdvice";
import "leaflet/dist/leaflet.css";
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
  const weatherIntervalRef = useRef(null);
  const weatherAlertIntervalRef = useRef(null);

  const [weather, setWeather] = useState(null);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [showSOS, setShowSOS] = useState(false);
  const [pendingSos, setPendingSos] = useState(() => localStorage.getItem("pending_sos") === "true");
  const [dateStr, setDateStr] = useState("");
  const [userName, setUserName] = useState(initialSenior?.name || "사용자");
  const [userRegion, setUserRegion] = useState(initialSenior?.region || initialSenior?.address || "");
  const [profileImageUrl, setProfileImageUrl] = useState(initialSenior?.profileImageUrl || "");
  const [healthScores, setHealthScores] = useState(() => getHealthScoresFromProfile(initialProfile));
  const [scheduleList, setScheduleList] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [allSchedules, setAllSchedules] = useState([]);
  const [isLoadingAllSchedules, setIsLoadingAllSchedules] = useState(false);
  const [jobHasNew, setJobHasNew] = useState(false);

  // 위치 관련 state
  const [currentPos, setCurrentPos] = useState(null);
  const [currentAddress, setCurrentAddress] = useState("위치 불러오는 중...");
  const [currentLocationTime, setCurrentLocationTime] = useState("");
  const [isInRange, setIsInRange] = useState(true);
  const [safeZone, setSafeZone] = useState(null);

  const fetchWeather = async (lat, lon) => {
    try {
      const [forecast, region] = await Promise.all([
        fetchTodayForecast(lat, lon),
        reverseGeocode(lat, lon),
      ]);

      setWeather({
        temp: forecast.temp === "--" ? "--" : Math.round(Number(forecast.temp)),
        status: forecast.status,
        icon: forecast.icon,
        region,
        humid: forecast.humid && forecast.humid !== "--" ? forecast.humid + "%" : "-",
      });
    } catch {
      setWeather({ temp: "--", status: "불러오기 실패", icon: "🌤️", region: "현재 위치" });
    }
  };

  const fetchWeatherAlerts = async () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentTime = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const currentDateTime = `${today} ${currentTime}`;

    const getPositionForAlert = () => new Promise((resolve) => {
      if (currentPos) {
        resolve({ lat: currentPos.lat, lon: currentPos.lon });
        return;
      }
      if (!navigator.geolocation) {
        resolve({ lat: 37.5665, lon: 126.9780 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve({ lat: 37.5665, lon: 126.9780 })
      );
    });

    try {
      const seniorId = getSavedSeniorId();
      const savedAlerts = seniorId ? await fetchTodayClimateAlerts(seniorId).catch(() => []) : [];
      const pos = await getPositionForAlert();
      const [uv, air, pollen] = await Promise.all([
        fetchUVIndex(pos.lat, pos.lon),
        fetchAirQuality(pos.lat, pos.lon),
        fetchPollenIndex(pos.lat, pos.lon),
      ]);

      const envAlerts = [];
      if (uv?.value >= 3) {
        const uvLevelText = uv.value >= 8 ? "매우 높음" : uv.value >= 6 ? "높음" : "보통";
        envAlerts.push({
          type: "자외선",
          color: uv.value >= 8 ? COLORS.danger : uv.value >= 6 ? "#f0a500" : "#4f9cc9",
          msg: `자외선 지수가 ${uv.value}로 ${uvLevelText}입니다. 외출 시 모자나 선크림을 챙겨주세요.`,
          time: currentDateTime,
          sortTime: now.getTime(),
        });
      }
      if (air?.pm10?.value > 80 || air?.pm25?.value > 35) {
        envAlerts.push({
          type: "미세먼지",
          color: air.pm10.value > 150 || air.pm25.value > 75 ? COLORS.danger : "#f0a500",
          msg: "미세먼지 상태가 좋지 않습니다. 외출 시 마스크를 착용해주세요.",
          time: currentDateTime,
          sortTime: now.getTime(),
        });
      }
      const pollenHigh = ["pine", "oak", "weeds"].find((key) => pollen?.[key]?.value >= 3);
      if (pollenHigh) {
        envAlerts.push({
          type: "꽃가루",
          color: pollen[pollenHigh].value >= 4 ? COLORS.danger : "#f0a500",
          msg: "꽃가루 농도가 높습니다. 알레르기나 호흡기 질환이 있다면 마스크를 착용해주세요.",
          time: currentDateTime,
          sortTime: now.getTime(),
        });
      }

      const isReadableAlert = (alert) => {
        const text = `${alert.type || ""} ${alert.message || ""}`;
        return /[가-힣]/.test(text) && !text.includes("???");
      };

      const seenDbAlertKeys = new Set();
      const dbAlerts = savedAlerts.filter(isReadableAlert).filter((alert) => {
        const key = `${alert.type}-${alert.message}-${alert.issuedAt?.slice(0, 13) || ""}`;
        if (seenDbAlertKeys.has(key)) return false;
        seenDbAlertKeys.add(key);
        return true;
      }).map((alert) => {
        const colors = { danger: COLORS.danger, warning: COLORS.danger, caution: "#f0a500", normal: "#4f9cc9", safe: COLORS.green };
        const issuedAt = alert.issuedAt || alert.createdAt || "";
        return {
          type: alert.type || "기후",
          color: colors[alert.level] || COLORS.green,
          msg: alert.message,
          time: issuedAt ? issuedAt.replace("T", " ").slice(0, 16) : "-",
          sortTime: issuedAt ? Date.parse(issuedAt) : 0,
        };
      }).sort((first, second) => second.sortTime - first.sortTime);

      const seenAlertKeys = new Set();
      const merged = [...envAlerts, ...dbAlerts].filter((alert) => {
        const key = alert.type;
        if (seenAlertKeys.has(key)) return false;
        seenAlertKeys.add(key);
        return true;
      }).sort((first, second) => second.sortTime - first.sortTime);

      if (merged.length < 2 && !seenAlertKeys.has("오늘 날씨")) {
        merged.push({
          type: "오늘 날씨",
          color: COLORS.green,
          msg: "현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.",
          time: currentDateTime,
          sortTime: now.getTime() - 1,
        });
      }

      const latestTwoAlerts = merged.slice(0, 2);
      if (latestTwoAlerts.length > 0) {
        setWeatherAlerts(latestTwoAlerts);
        return;
      }

      setWeatherAlerts([{
        type: "안전",
        color: COLORS.green,
        msg: "현재 확인된 기후 위험 알림이 없습니다.",
        time: currentDateTime,
      }]);
    } catch {
      setWeatherAlerts([{
        type: "안전",
        color: COLORS.green,
        msg: "기후 알림을 확인하는 중입니다.",
        time: currentDateTime,
      }]);
    }
  };

  const updateLocation = async (lat, lon) => {
    setCurrentPos({ lat, lon });
    const capturedAt = new Date();
    setCurrentLocationTime(
      capturedAt.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    const resolvedAddress = await reverseGeocode(lat, lon).catch(() => "현재 위치");
    setCurrentAddress(resolvedAddress);

    // 주소 변환
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
      );
      const d = await res.json();
      const addr = d?.address;
      const address = addr?.suburb || addr?.neighbourhood || addr?.city_district || addr?.city || "현재 위치";
      setCurrentAddress(resolvedAddress || address);

      // 서버에 위치 저장
      const seniorId = getCurrentSeniorId(initialSenior);
      if (seniorId) {
        await fetch("http://localhost:8181/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seniorId, latitude: lat, longitude: lon, address: resolvedAddress || address }),
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

    weatherIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(37.5665, 126.9780)
      );
    }, 10 * 60 * 1000);
  };

  useEffect(() => {
    fetchWeatherAlerts();
    startLocationTracking();
    weatherAlertIntervalRef.current = setInterval(fetchWeatherAlerts, 60 * 1000);

    const seniorId = getCurrentSeniorId(initialSenior);
    if (seniorId) {
      fetch(`http://localhost:8181/api/safe-zones/senior/` + seniorId)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => { if (data) setSafeZone(data); })
        .catch(() => {});
    }

    const checkNewJobs = async () => {
      const result = await fetchJobList(1, "").catch(() => null);
      const latestJobId = result?.list?.[0]?.jobId;
      if (!latestJobId) return;
      const seenJobId = localStorage.getItem("jobs_last_seen_job_id");
      setJobHasNew(Boolean(seenJobId && seenJobId !== latestJobId));
      if (!seenJobId) localStorage.setItem("jobs_last_seen_job_id", latestJobId);
      localStorage.setItem("jobs_latest_job_id", latestJobId);
    };
    checkNewJobs();

    const loadCurrentSenior = async () => {
      try {
        const saved = sessionStorage.getItem("currentSenior");
        if (saved) {
          const profile = JSON.parse(saved);
          const cachedSeniorId = profile?.senior?.id;
          if (cachedSeniorId) {
            const response = await fetch(`http://localhost:8181/api/seniors/` + cachedSeniorId);
            if (response.ok) {
              const freshProfile = await response.json();
              sessionStorage.setItem("currentSenior", JSON.stringify(freshProfile));
              setUserName(freshProfile?.senior?.name || "사용자");
              setUserRegion(freshProfile?.senior?.region || freshProfile?.senior?.address || "");
              setProfileImageUrl(freshProfile?.senior?.profileImageUrl || "");
              setHealthScores(getHealthScoresFromProfile(freshProfile));
              return;
            }
          }
          setUserName(profile?.senior?.name || "사용자");
          setUserRegion(profile?.senior?.region || profile?.senior?.address || "");
          setProfileImageUrl(profile?.senior?.profileImageUrl || "");
          setHealthScores(getHealthScoresFromProfile(profile));
          return;
        }

        const response = await fetch("http://localhost:8181/api/seniors");
        if (!response.ok) return;
        const profiles = await response.json();
        const latest = profiles[profiles.length - 1];
        if (!latest) return;
        sessionStorage.setItem("currentSenior", JSON.stringify(latest));
        localStorage.setItem("current_senior_id", String(latest.senior.id));
        setUserName(latest?.senior?.name || "사용자");
        setUserRegion(latest?.senior?.region || latest?.senior?.address || "");
        setProfileImageUrl(latest?.senior?.profileImageUrl || "");
        setHealthScores(getHealthScoresFromProfile(latest));
      } catch (error) {
        console.error("사용자 정보 조회 실패:", error);
      }
    };
    loadCurrentSenior();

    const currentDate = new Date();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    setDateStr(currentDate.getFullYear() + "년 " + (currentDate.getMonth() + 1) + "월 " + currentDate.getDate() + "일(" + days[currentDate.getDay()] + ")");

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
      if (weatherAlertIntervalRef.current) clearInterval(weatherAlertIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return;
    fetch(`/api/schedules/senior/${seniorId}/date/${selectedScheduleDate}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        const mapped = list.map(scheduleFromApi);
        setScheduleList(mapped);
        if (selectedScheduleDate === todayValue()) {
          setTodaySchedules(mapped);
        }
      })
      .catch(() => setScheduleList([]));
  }, [selectedScheduleDate]);

  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return;
    const today = todayValue();
    fetch(`/api/schedules/senior/${seniorId}/date/${today}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        setTodaySchedules(list.map(scheduleFromApi));
      })
      .catch(() => setTodaySchedules([]));
  }, []);

  useEffect(() => {
    if (!currentPos || !safeZone) return;
    const dist = Math.sqrt(
      Math.pow((currentPos.lat - safeZone.centerLatitude) * 111000, 2)
      + Math.pow((currentPos.lon - safeZone.centerLongitude) * 111000 * Math.cos(currentPos.lat * Math.PI / 180), 2)
    );
    setIsInRange(dist <= safeZone.radiusMeters);
  }, [currentPos, safeZone]);

  const confirmSOS = async () => {
    setShowSOS(false);
    const seniorId = getCurrentSeniorId(initialSenior);

    if (!seniorId) {
      alert("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      await createSosAlert({
        seniorId: Number(seniorId),
        latitude: currentPos?.lat,
        longitude: currentPos?.lon,
      });
      localStorage.setItem("pending_sos", "true");
      setPendingSos(true);
    } catch (error) {
      console.error("SOS 전송 실패:", error);
      alert("SOS 전송에 실패했습니다. 보호자에게 직접 연락해주세요.");
    }
  };

  const handleSosMistake = async () => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (seniorId) {
      await createSosCancelAlert({
        seniorId: Number(seniorId),
        latitude: currentPos?.lat,
        longitude: currentPos?.lon,
      }).catch((error) => {
        console.error("SOS 잘못 누름 알림 실패:", error);
      });
    }

    localStorage.removeItem("pending_sos");
    setPendingSos(false);
    alert("보호자에게 잘못 누름 알림을 보냈어요.");
  };

  const openAllSchedules = async () => {
    const seniorId = getCurrentSeniorId(initialSenior);
    const today = todayValue();
    setSelectedScheduleDate(today);
    setShowAllSchedules(true);
    if (!seniorId) { setAllSchedules([]); return; }
    setIsLoadingAllSchedules(true);
    try {
      const res = await fetch(`/api/schedules/senior/${seniorId}/date/${today}`);
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
        <div className="up-nav-logo">우리 woori</div>
        <div className="up-nav-right">
          <span className="up-nav-date">{dateStr}</span>
          <button className="up-nav-sos" type="button" onClick={() => setShowSOS(true)}>
            SOS 알림 요청
          </button>
        </div>
      </nav>

      <div className="up-layout">
        <aside>
          <div className="up-profile-card">
            <div className="up-profile-avatar">
              {profileImageUrl ? (
                <img src={resolveUploadUrl(profileImageUrl)} alt="프로필 사진" />
              ) : (
                "👤"
              )}
            </div>
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
                  if (menu.disabled) {
                    alert("AI 챗봇 기능은 준비 중입니다.");
                    return;
                  }
                  if (menu.badgeKey === "jobs") {
                    const latestJobId = localStorage.getItem("jobs_latest_job_id");
                    if (latestJobId) localStorage.setItem("jobs_last_seen_job_id", latestJobId);
                    setJobHasNew(false);
                  }
                  navigate(menu.route);
                }}
              >
                <span className="up-sidemenu-icon">{menu.icon}</span>
                <span className="up-sidemenu-label">{menu.label}</span>
                {(menu.badge || (menu.badgeKey === "jobs" && jobHasNew)) && (
                  <span className="up-sidemenu-badge" style={menu.disabled ? { background: "#7a9a7c" } : {}}>
                    {menu.badge || "NEW"}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="up-card" style={{ cursor: "pointer" }} onClick={() => navigate("/location")}>
            <div className="up-card-head">
              <div className="up-card-title">📍 현재 위치</div>
              <span style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>→</span>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isInRange ? COLORS.green : COLORS.danger,
                flexShrink: 0,
                animation: "up-blink 2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: "0.82rem",
                fontWeight: "700",
                color: isInRange ? COLORS.green : COLORS.danger,
              }}>
                {isInRange ? "안전 반경 내" : "위험 반경 이탈"}
              </span>
            </div>
            <div style={{
              fontSize: "0.78rem",
              color: COLORS.textMuted,
              lineHeight: "1.5",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {currentAddress}
            </div>
            {currentPos && (
              <div style={{ fontSize: "0.68rem", color: COLORS.textMuted, marginTop: "0.3rem" }}>
                {currentPos.lat.toFixed(4)}, {currentPos.lon.toFixed(4)}
              </div>
            )}
            {currentLocationTime && (
              <div style={{ fontSize: "0.68rem", color: COLORS.textMuted, marginTop: "0.25rem" }}>
                기준 시간 {currentLocationTime}
              </div>
            )}
            {currentPos && (
              <div className="up-mini-map-wrap" onClick={(event) => event.stopPropagation()}>
                <MapContainer
                  key={`${currentPos.lat.toFixed(4)}-${currentPos.lon.toFixed(4)}`}
                  center={[currentPos.lat, currentPos.lon]}
                  zoom={15}
                  className="up-mini-map"
                  scrollWheelZoom={false}
                  dragging={false}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {safeZone && (
                    <Circle
                      center={[safeZone.centerLatitude, safeZone.centerLongitude]}
                      radius={safeZone.radiusMeters}
                      pathOptions={{ color: "#86A788", fillColor: "#86A788", fillOpacity: 0.12 }}
                    />
                  )}
                  <Marker position={[currentPos.lat, currentPos.lon]} icon={customLocationIcon} />
                </MapContainer>
              </div>
            )}
          </div>
        </aside>

        <main>
          <div className="up-top-row">
            <div className="up-weather-card" onClick={() => navigate("/weather-graph")}>
              <div className="up-card-label">오늘 날씨</div>
              <div className="up-weather-temp">{weather?.temp ?? "-"}°C</div>
              <div className="up-weather-bot">
                <div className="up-weather-desc">
                  {weather?.status ?? "불러오는 중"} · {weather?.region ?? ""}
                </div>
                <div className="up-weather-icon">{weather?.icon ?? "🌤️"}</div>
              </div>
            </div>

            <div className="up-stat-card" onClick={() => navigate("/fall-history")}>
              <div className="up-card-label">이번 달 낙상</div>
              <div className="up-stat-value red">2건</div>
              <div className="up-stat-sub">최근: 5월 4일 거실</div>
            </div>

            <div className="up-stat-card" onClick={openAllSchedules}>
              <div className="up-card-label">오늘 일정</div>
              <div className="up-stat-value">{todaySchedules.length}건</div>
              <div className="up-stat-sub">
                {todaySchedules.length > 0
                  ? `다음: ${todaySchedules[0].time} ${todaySchedules[0].text}`
                  : "오늘 등록된 일정이 없어요"}
              </div>
            </div>
          </div>

          <div className="up-content-row">
            <div className="up-card up-schedule-card">
              <div className="up-card-head">
                <div className="up-card-title">📅 일정</div>
                <input
                  className="up-schedule-date"
                  type="date"
                  value={selectedScheduleDate}
                  onChange={(event) => setSelectedScheduleDate(event.target.value)}
                />
              </div>

              <div className="up-schedule-list">
                {scheduleList.length === 0 ? (
                  <div className="up-schedule-empty">
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
            </div>

            <div className="up-card up-climate-card">
              <div className="up-card-head">
                <div className="up-card-title">🌡 기후 알림</div>
                <button className="up-card-more" type="button" onClick={() => navigate("/weather")}>
                  전체보기 →
                </button>
              </div>

              {weatherAlerts.slice(0, 2).map((a, i) => (
                <div key={i} className="up-alert-item">
                  <span className="up-alert-badge" style={{
                    background: a.color,
                    color: "#fff",
                    border: `1px solid ${a.color}`,
                  }}>
                    {a.type}
                  </span>
                  <div>
                    <div className="up-alert-text">{a.msg}</div>
                    <div className="up-alert-time">⏱ {a.time}</div>
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
                <div className="up-card-title">빠른 실행</div>
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

      {showAllSchedules && (
        <div className="up-overlay" onClick={() => setShowAllSchedules(false)}>
          <div
            className="up-modal"
            style={{ maxHeight: "70vh", overflowY: "auto", textAlign: "left", width: "480px" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="up-card-head" style={{ marginBottom: "1rem" }}>
              <div className="up-modal-title" style={{ fontSize: "1.1rem" }}>📅 전체 일정</div>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: COLORS.textMuted }}
                type="button"
                onClick={() => setShowAllSchedules(false)}
              >
                ×
              </button>
            </div>
            {isLoadingAllSchedules ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>불러오는 중...</div>
            ) : allSchedules.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>등록된 일정이 없어요</div>
            ) : (
              allSchedules.map((s) => (
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

      {pendingSos && (
        <div className="up-sos-pending">
          <div>
            <strong>SOS가 보호자에게 전송됐어요</strong>
            <p>실수로 누르셨다면 아래 버튼을 눌러 표시를 닫아주세요.</p>
          </div>
          <button type="button" onClick={handleSosMistake}>
            잘못 눌렀어요
          </button>
        </div>
      )}

      {showSOS && (
        <div className="up-overlay" onClick={() => setShowSOS(false)}>
          <div className="up-modal" onClick={(event) => event.stopPropagation()}>
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
