import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/user/WeatherGraph.css";

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

const PTY_ICON = { "0": "☀️", "1": "🌧", "2": "🌨", "3": "❄️", "4": "🌦" };
const SKY_ICON = { "1": "☀️", "3": "⛅", "4": "☁️" };

export default function WeatherGraph() {
  const navigate = useNavigate();
  const [hourlyData, setHourlyData] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState("현재 위치");

  const fetchHourly = async (lat, lon) => {
    try {
      const { nx, ny } = toGrid(lat, lon);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");

      const baseTimes = ["0200","0500","0800","1100","1400","1700","2000","2300"];
      const currentHour = now.getHours();
      let baseTime = "2300";
      let baseDate = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;

      for (let i = baseTimes.length - 1; i >= 0; i--) {
        if (currentHour >= parseInt(baseTimes[i].slice(0, 2))) {
          baseTime = baseTimes[i];
          break;
        }
      }

      if (currentHour < 2) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        baseDate = `${yesterday.getFullYear()}${pad(yesterday.getMonth()+1)}${pad(yesterday.getDate())}`;
        baseTime = "2300";
      }

      const url = `/weather/1360000/VilageFcstInfoService_2.0/getVilageFcst`
        + `?ServiceKey=${SERVICE_KEY}`
        + `&pageNo=1&numOfRows=300&dataType=JSON`
        + `&base_date=${baseDate}&base_time=${baseTime}`
        + `&nx=${nx}&ny=${ny}`;

      const res = await fetch(url);
      const data = await res.json();
      const items = data?.response?.body?.items?.item || [];

      // 시간별 그룹핑
      const grouped = {};
      items.forEach(item => {
        const key = `${item.fcstDate}_${item.fcstTime}`;
        if (!grouped[key]) grouped[key] = { date: item.fcstDate, time: item.fcstTime };
        grouped[key][item.category] = item.fcstValue;
      });

      // 오늘 데이터만 필터링
      const todayStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const todayData = Object.values(grouped)
        .filter(d => d.date === todayStr)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(d => {
          const skyIcon = SKY_ICON[d.SKY] || "☀️";
          const icon = d.PTY !== "0" ? (PTY_ICON[d.PTY] || "🌧") : skyIcon;
          return {
            time: `${d.time.slice(0, 2)}:${d.time.slice(2, 4)}`,
            temp: d.TMP || "--",
            humid: d.REH || "--",
            icon,
            isNow: parseInt(d.time.slice(0, 2)) === now.getHours(),
          };
        });

      setHourlyData(todayData);
      const nowData = todayData.find(d => d.isNow) || todayData[0];
      if (nowData) setCurrent(nowData);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setError("날씨 데이터를 불러오지 못했습니다.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLocation(`${pos.coords.latitude.toFixed(2)}°N ${pos.coords.longitude.toFixed(2)}°E`);
          fetchHourly(pos.coords.latitude, pos.coords.longitude);
        },
        () => fetchHourly(37.5665, 126.9780)
      );
    } else {
      fetchHourly(37.5665, 126.9780);
    }
  }, []);

  const renderLineChart = () => {
    if (hourlyData.length === 0) return null;
    const temps = hourlyData.map(d => parseFloat(d.temp)).filter(t => !isNaN(t));
    if (temps.length === 0) return null;

    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const W = 800, H = 160, PAD = 20;
    const xStep = (W - PAD * 2) / (hourlyData.length - 1);
    const yScale = (t) => H - PAD - ((t - minT) / (maxT - minT)) * (H - PAD * 2);
    const points = hourlyData.map((d, i) => ({
      x: PAD + i * xStep,
      y: yScale(parseFloat(d.temp)),
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = `M ${points[0].x} ${H} ` + points.map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} ${H} Z`;

    return (
      <svg className="wg-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86A788" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#86A788" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r, i) => (
          <line key={i}
            x1={PAD} y1={PAD + r * (H - PAD * 2)}
            x2={W - PAD} y2={PAD + r * (H - PAD * 2)}
            stroke="#d4e8d6" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        <path d={areaD} fill="url(#tempGrad)" />
        <path d={pathD} fill="none" stroke="#86A788" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x} cy={p.y} r="4"
              fill={hourlyData[i].isNow ? "#e05252" : "#86A788"}
              stroke="#fff" strokeWidth="2"
            />
            {i % 2 === 0 && (
              <text
                x={p.x} y={p.y - 10}
                textAnchor="middle" fontSize="10" fontWeight="700"
                fill={hourlyData[i].isNow ? "#e05252" : "#5f7d61"}
                fontFamily="Noto Sans KR, sans-serif"
              >
                {hourlyData[i].temp}°
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="wg-root">
      <nav className="wg-nav">
        <button className="wg-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>
        <div className="wg-nav-title">🌤 오늘 날씨 상세</div>
        <span className="wg-nav-location">📍 {location}</span>
      </nav>

      <div className="wg-layout">
        {loading && <div className="wg-loading">🌤 날씨 데이터 불러오는 중...</div>}
        {error && <div className="wg-error">⚠️ {error}</div>}

        {!loading && !error && (
          <>
            {current && (
              <div className="wg-summary">
                <div className="wg-stat">
                  <div className="wg-stat-label">현재 기온</div>
                  <div className="wg-stat-value">{current.temp}°</div>
                  <div className="wg-stat-unit">섭씨</div>
                </div>
                <div className="wg-stat">
                  <div className="wg-stat-label">습도</div>
                  <div className="wg-stat-value">{current.humid}</div>
                  <div className="wg-stat-unit">%</div>
                </div>
                <div className="wg-stat">
                  <div className="wg-stat-label">날씨</div>
                  <div className="wg-stat-value">{current.icon}</div>
                  <div className="wg-stat-unit">현재 상태</div>
                </div>
                <div className="wg-stat">
                  <div className="wg-stat-label">예보 수</div>
                  <div className="wg-stat-value">{hourlyData.length}</div>
                  <div className="wg-stat-unit">시간</div>
                </div>
              </div>
            )}

            <div className="wg-chart-card">
              <div className="wg-chart-title">📈 오늘 시간별 기온 변화</div>
              <div className="wg-chart-wrap">
                {renderLineChart()}
              </div>
            </div>

            <div className="wg-chart-card">
              <div className="wg-chart-title">🕐 시간별 날씨</div>
              <div className="wg-hour-list">
                {hourlyData.map((d, i) => (
                  <div key={i} className={`wg-hour-item ${d.isNow ? "now" : ""}`}>
                    <div className="wg-hour-time">{d.isNow ? "지금" : d.time}</div>
                    <div className="wg-hour-icon">{d.icon}</div>
                    <div className="wg-hour-temp">{d.temp}°</div>
                    <div className="wg-hour-humid">{d.humid}%</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}