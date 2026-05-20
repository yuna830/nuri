import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import "../../css/user/WeatherGraph.css";
import {
  fetchUVIndex,
  fetchPollenIndex,
  fetchAirQuality,
  getWeatherItems,
  getHealthItems,
} from "../../utils/user/weatherAdvice";
import { reverseGeocode } from "../../api/userPageApi.js";

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

const PTY_ICON  = { "0": "☀️", "1": "🌧", "2": "🌨", "3": "❄️", "4": "🌦" };
const SKY_ICON  = { "1": "☀️", "3": "⛅", "4": "☁️" };

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
  blue: "#4a7fa8", bluePale: "#eef4fa", blueLight: "#b8d4e8",
};

const getEnvAdviceItems = (uvData, airData, pollenData) => {
  const items = [];

  if (uvData?.value >= 11)
    items.push({ icon: "☀️", title: "자외선 위험", desc: "외출을 삼가세요. 반드시 자외선 차단제(SPF50+)와 모자, 선글라스를 착용하고 그늘에서만 이동하세요.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (uvData?.value >= 8)
    items.push({ icon: "☀️", title: "자외선 매우 높음", desc: "선크림(SPF50+)과 모자, 선글라스를 꼭 착용하세요. 오전 10시~오후 2시 사이 외출을 자제하세요.", color: "#c05000", bg: "#fff4e6", border: "#f5c6a0" });
  else if (uvData?.value >= 6)
    items.push({ icon: "☀️", title: "자외선 높음", desc: "선크림을 바르고 외출하세요. 긴 소매 옷을 입으면 더 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (uvData?.value >= 3)
    items.push({ icon: "☀️", title: "자외선 보통", desc: "장시간 야외 활동 시 선크림을 바르는 것이 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (uvData)
    items.push({ icon: "☀️", title: "자외선 낮음", desc: "자외선 걱정 없이 외출하셔도 좋아요.", color: C.blue, bg: C.bluePale, border: C.blueLight });

  if (airData?.pm10?.level === "매우나쁨")
    items.push({ icon: "😷", title: "미세먼지 매우나쁨", desc: "외출을 최대한 자제하세요. 꼭 나가야 한다면 KF94 마스크를 착용하고 귀가 후 손발을 깨끗이 씻으세요.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (airData?.pm10?.level === "나쁨")
    items.push({ icon: "😷", title: "미세먼지 나쁨", desc: "외출 시 KF80 이상 마스크를 착용하세요. 환기는 자제하고 공기청정기를 사용하세요.", color: "#c05000", bg: "#fff4e6", border: "#f5c6a0" });
  else if (airData?.pm10?.level === "보통")
    items.push({ icon: "😷", title: "미세먼지 보통", desc: "민감한 분들은 마스크를 챙기세요. 장시간 야외 활동은 자제하는 것이 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (airData?.pm10?.level === "좋음")
    items.push({ icon: "😷", title: "미세먼지 좋음", desc: "오늘 미세먼지는 좋아요. 환기하기 좋은 날이에요.", color: C.blue, bg: C.bluePale, border: C.blueLight });
  else if (!airData)
    items.push({ icon: "😷", title: "미세먼지 정보 확인 중", desc: "에어코리아 응답을 기다리는 중이에요. 수치가 확인되기 전까지는 민감하신 분은 마스크를 챙겨주세요.", color: C.textMuted, bg: C.greenPale, border: C.border });

  if (airData?.pm25?.level === "매우나쁨")
    items.push({ icon: "🫁", title: "초미세먼지 매우나쁨", desc: "호흡기·심혈관 질환이 있으신 분은 절대 외출하지 마세요. KF94 마스크 착용 필수입니다.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (airData?.pm25?.level === "나쁨")
    items.push({ icon: "🫁", title: "초미세먼지 나쁨", desc: "KF94 마스크를 착용하세요. 노인·어린이·임산부는 실외 활동을 줄이는 게 좋아요.", color: "#c05000", bg: "#fff4e6", border: "#f5c6a0" });
  else if (airData?.pm25?.level === "보통")
    items.push({ icon: "🫁", title: "초미세먼지 보통", desc: "호흡기가 약하신 분들은 마스크를 착용하는 것이 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (airData?.pm25?.level === "좋음")
    items.push({ icon: "🫁", title: "초미세먼지 좋음", desc: "오늘 초미세먼지는 좋아요. 맑은 공기를 마음껏 마시세요.", color: C.blue, bg: C.bluePale, border: C.blueLight });
  else if (!airData)
    items.push({ icon: "🫁", title: "초미세먼지 정보 확인 중", desc: "초미세먼지 수치를 확인하는 중이에요. 호흡기가 약하시면 실외 활동 전 마스크를 준비해주세요.", color: C.textMuted, bg: C.greenPale, border: C.border });

  if (airData?.pm10?.value >= 150)
    items.push({ icon: "🌫️", title: "황사 주의", desc: "미세먼지 농도가 높아 황사 영향 가능성이 있어요. 외출을 줄이고 KF94 마스크를 착용해주세요.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (airData?.pm10?.value >= 80)
    items.push({ icon: "🌫️", title: "황사 관심", desc: "먼지 농도가 평소보다 높을 수 있어요. 장시간 야외 활동은 줄이는 것이 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (airData)
    items.push({ icon: "🌫️", title: "황사 낮음", desc: "현재 황사 영향은 낮아 보여요. 그래도 외출 전 미세먼지 변화는 한 번 더 확인해주세요.", color: C.blue, bg: C.bluePale, border: C.blueLight });
  else
    items.push({ icon: "🌫️", title: "황사 정보 확인 중", desc: "황사 판단에 필요한 미세먼지 값을 확인하는 중이에요. 수치가 들어오면 자동으로 반영됩니다.", color: C.textMuted, bg: C.greenPale, border: C.border });

  if (pollenData?.pine?.value >= 4)
    items.push({ icon: "🌲", title: "소나무 꽃가루 매우높음", desc: "알레르기 비염이나 천식이 있으시면 마스크를 착용하고 외출 후 세안과 샤워를 꼭 하세요.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (pollenData?.pine?.value >= 3)
    items.push({ icon: "🌲", title: "소나무 꽃가루 높음", desc: "꽃가루 알레르기가 있으시면 마스크를 착용하세요. 창문을 닫고 생활하는 것이 좋아요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (pollenData?.pine?.value >= 2)
    items.push({ icon: "🌲", title: "소나무 꽃가루 보통", desc: "알레르기가 심하신 분들은 외출 시 마스크를 챙기세요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (pollenData?.pine)
    items.push({ icon: "🌲", title: "소나무 꽃가루 낮음", desc: "오늘은 소나무 꽃가루가 적어요. 쾌적하게 외출하셔도 좋아요.", color: C.blue, bg: C.bluePale, border: C.blueLight });

  if (pollenData?.oak?.value >= 4)
    items.push({ icon: "🌳", title: "참나무 꽃가루 매우높음", desc: "알레르기 증상이 심해질 수 있어요. 외출 시 마스크와 안경을 착용하세요.", color: "#e05252", bg: "#fdf0f0", border: "#f5c6c6" });
  else if (pollenData?.oak?.value >= 3)
    items.push({ icon: "🌳", title: "참나무 꽃가루 높음", desc: "꽃가루 알레르기가 있으시면 외출을 자제하거나 마스크를 착용하세요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (pollenData?.oak?.value >= 2)
    items.push({ icon: "🌳", title: "참나무 꽃가루 보통", desc: "알레르기가 심하신 분들은 마스크를 챙기세요.", color: "#f0a500", bg: "#fff8e6", border: "#f0d080" });
  else if (pollenData?.oak)
    items.push({ icon: "🌳", title: "참나무 꽃가루 낮음", desc: "오늘은 참나무 꽃가루가 적어요. 안심하고 외출하셔도 좋아요.", color: C.blue, bg: C.bluePale, border: C.blueLight });

  return items;
};

const readSessionCache = (key, ttl) => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "null");
    return cached && Date.now() - cached.savedAt < ttl ? cached.data : null;
  } catch {
    return null;
  }
};

const writeSessionCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Ignore storage failure.
  }
};

const isSameJson = (first, second) => JSON.stringify(first) === JSON.stringify(second);

const setChanged = (setter, nextValue) => {
  setter((prevValue) => (isSameJson(prevValue, nextValue) ? prevValue : nextValue));
};

function EnvRow({ icon, label, value, color, hasBorder = true }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.65rem 0",
      borderBottom: hasBorder ? `1px solid ${C.border}` : "none",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.85rem",
        color: C.textMuted,
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span style={{ fontSize: "0.85rem", fontWeight: "700", color }}>
        {value}
      </span>
    </div>
  );
}

export default function WeatherGraph() {
  const navigate = useNavigate();

  const [hourlyData, setHourlyData]   = useState([]);
  const [current, setCurrent]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [address, setAddress]         = useState("위치 확인 중...");
  const [adviceItems, setAdviceItems] = useState([]);
  const [uvData, setUvData]           = useState(null);
  const [airData, setAirData]         = useState(null);
  const [pollenData, setPollenData]   = useState(null);
  const [profile, setProfile]         = useState(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      if (saved) {
        const p = JSON.parse(saved);
        setProfile(p?.healthInfo || null);
      }
    } catch {}
  }, []);

  const fetchEnvironment = async (lat, lon) => {
    const [uvResult, pollenResult, airResult] = await Promise.allSettled([
      fetchUVIndex(lat, lon),
      fetchPollenIndex(lat, lon),
      fetchAirQuality(lat, lon),
    ]);

    if (uvResult.status === "fulfilled" && uvResult.value) {
      setChanged(setUvData, uvResult.value);
    }
    if (pollenResult.status === "fulfilled" && pollenResult.value) {
      setChanged(setPollenData, pollenResult.value);
    }
    if (airResult.status === "fulfilled" && airResult.value) {
      setChanged(setAirData, airResult.value);
    }
  };

  const fetchHourly = async (lat, lon) => {
    try {
      const { nx, ny } = toGrid(lat, lon);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const currentHour = now.getHours();

      let baseTime = "0200";
      let baseDate = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;

      if (currentHour < 2) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        baseDate = `${yesterday.getFullYear()}${pad(yesterday.getMonth()+1)}${pad(yesterday.getDate())}`;
        baseTime = "2300";
      }

      const url = `/weather-api/1360000/VilageFcstInfoService_2.0/getVilageFcst`
        + `?ServiceKey=${SERVICE_KEY}&pageNo=1&numOfRows=1000&dataType=JSON`
        + `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
      const cacheKey = `weather-graph-hourly:${baseDate}:${baseTime}:${nx}:${ny}`;

      let data = readSessionCache(cacheKey, 10 * 60 * 1000);

      if (!data) {
        const res = await fetch(url);
        if (res.status === 429) throw new Error("날씨 API 요청이 잠시 제한되었습니다.");
        if (!res.ok) throw new Error("날씨 API 요청 실패");
        data = await res.json();
        writeSessionCache(cacheKey, data);
      }
      const items = data?.response?.body?.items?.item || [];

      const grouped = {};
      items.forEach(item => {
        const key = `${item.fcstDate}_${item.fcstTime}`;
        if (!grouped[key]) grouped[key] = { date: item.fcstDate, time: item.fcstTime };
        grouped[key][item.category] = item.fcstValue;
      });

      const todayStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const todayData = Object.values(grouped)
        .filter(d => d.date === todayStr)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(d => {
          const hNum = parseInt(d.time.slice(0, 2));
          const skyIcon = SKY_ICON[d.SKY] || "☀️";
          const icon = d.PTY !== "0" ? (PTY_ICON[d.PTY] || "🌧") : skyIcon;
          return {
            time: `${d.time.slice(0, 2)}:${d.time.slice(2, 4)}`,
            timeNum: hNum,
            temp: d.TMP || "--",
            humid: d.REH || "--",
            wsd: d.WSD || "0",
            pty: d.PTY || "0",
            pop: d.POP || "0",
            sky: d.SKY || "1",
            icon,
            isPast: hNum < currentHour,
            isNow: hNum === currentHour,
          };
        });

      setChanged(setHourlyData, todayData);
      const nowData = todayData.find(d => d.isNow) || todayData[0];

      if (nowData) {
        setChanged(setCurrent, nowData);
        const weatherItems = getWeatherItems(nowData.temp, nowData.pty, nowData.wsd, nowData.humid);
        const healthItems  = getHealthItems(profile, nowData.temp, nowData.pty);
        setChanged(setAdviceItems, [...weatherItems, ...healthItems]);

      }

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
        async pos => {
          const { latitude: lat, longitude: lon } = pos.coords;
          setChanged(setAddress, await reverseGeocode(lat, lon));
          fetchEnvironment(lat, lon);
          fetchHourly(lat, lon);
        },
        () => { setChanged(setAddress, "서울"); fetchEnvironment(37.5665, 126.9780); fetchHourly(37.5665, 126.9780); }
      );
    } else {
      setChanged(setAddress, "서울");
      fetchEnvironment(37.5665, 126.9780);
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
      d,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = `M ${points[0].x} ${H} ` + points.map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length-1].x} ${H} Z`;

    return (
      <svg className="wg-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity="0.3" />
            <stop offset="100%" stopColor={C.green} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r, i) => (
          <line key={i}
            x1={PAD} y1={PAD + r*(H-PAD*2)}
            x2={W-PAD} y2={PAD + r*(H-PAD*2)}
            stroke={C.border} strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        <path d={areaD} fill="url(#tempGrad)" />
        <path d={pathD} fill="none" stroke={C.green} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4"
              fill={p.d.isNow ? C.danger : p.d.isPast ? "#ccc" : C.green}
              stroke="#fff" strokeWidth="2" />
            {i % 2 === 0 && !p.d.isPast && (
              <text x={p.x} y={p.y - 10} textAnchor="middle"
                fontSize="10" fontWeight="700"
                fill={p.d.isNow ? C.danger : C.greenDark}
                fontFamily="Noto Sans KR, sans-serif">
                {p.d.temp}°
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  };

  const badgeColor = (category) => {
    if (category === "건강")   return { bg: "#fdf0f0", border: "#f5c6c6", color: C.danger };
    if (category === "준비물") return { bg: C.greenPale, border: C.greenLight, color: C.greenDark };
    return { bg: "#f0f2ff", border: "#c5cef0", color: "#2a3d9e" };
  };

  const envLevelColor = (level) => {
    if (["나쁨","매우나쁨","높음","매우높음","위험"].includes(level)) return C.danger;
    if (["보통"].includes(level)) return "#f0a500";
    if (["좋음","낮음"].includes(level)) return C.blue;
    return C.green;
  };

  const envAdviceItems = getEnvAdviceItems(uvData, airData, pollenData);
  const dustLevel = airData?.pm10?.value >= 150 ? "주의" : airData?.pm10?.value >= 80 ? "관심" : airData ? "낮음" : "정보 확인 중";
  const hasRainPrep = adviceItems.some((item) => item.label.includes("우산"));
  const hasLayerPrep = adviceItems.some((item) => item.label.includes("긴팔") || item.label.includes("가디건"));
  const rainChance = Number(current?.pop || 0);
  const prepGuideItems = [
    hasRainPrep || rainChance >= 50
      ? "비 예보가 있어 외출 전 우산을 챙겨주세요."
      : "비 가능성은 낮지만 외출 전 하늘 상태를 한 번 확인해주세요.",
    hasLayerPrep
      ? "기온 변화에 대비해 얇은 겉옷을 준비하면 좋아요."
      : "현재 기온에 맞춰 가볍고 편한 옷차림이 좋아요.",
  ];

  return (
    <div className="wg-root">
      <UserCommonHeader />

      <div className="wg-layout">
        {loading && <div className="wg-loading">🌤 날씨 데이터 불러오는 중...</div>}
        {error   && <div className="wg-error">⚠️ {error}</div>}

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
                  <div className="wg-stat-label">풍속</div>
                  <div className="wg-stat-value">{current.wsd}</div>
                  <div className="wg-stat-unit">m/s</div>
                </div>
                <div className="wg-stat">
                  <div className="wg-stat-label">강수확률</div>
                  <div className="wg-stat-value">{current.pop}</div>
                  <div className="wg-stat-unit">%</div>
                </div>
              </div>
            )}

            <div className="wg-alert-grid">
              {envAdviceItems.length > 0 && (
                <div className="wg-chart-card wg-env-advice-card">
                  <div className="wg-chart-title">⚠️ 오늘의 환경 주의사항</div>
                  <div className="wg-env-advice-list">
                    {envAdviceItems.map((item, i) => (
                      <div
                        key={i}
                        className="wg-env-advice-item"
                        style={{ "--advice-color": item.color, "--advice-bg": item.bg, "--advice-border": item.border }}
                      >
                        <div className="wg-env-advice-icon">{item.icon}</div>
                        <div>
                          <div className="wg-env-advice-title">{item.title}</div>
                          <div className="wg-env-advice-desc">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="wg-side-column">
                <div className="wg-location-card">
                  <div className="wg-chart-title">📍 현재 주소</div>
                  <div className="wg-location-card-body">
                    <strong>{address}</strong>
                  </div>
                </div>

                {adviceItems.length > 0 && (
                  <div className="wg-chart-card wg-advice-card">
                    <div className="wg-chart-title">👜 오늘의 준비물</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {adviceItems.map((item, i) => {
                        const bc = badgeColor(item.category);
                        return (
                          <span key={i} style={{
                            display: "inline-flex", alignItems: "center", gap: "0.35rem",
                            padding: "0.4rem 0.9rem", borderRadius: "99px",
                            fontSize: "0.82rem", fontWeight: "700",
                            background: bc.bg, border: `1px solid ${bc.border}`, color: bc.color,
                          }}>
                            {item.icon} {item.label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="wg-prep-guide">
                      <div className="wg-mini-title">오늘은 이렇게 준비하세요</div>
                      <ul>
                        {prepGuideItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="wg-chart-card wg-env-card">
                  <div className="wg-chart-title">🌍 환경 지수</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {uvData && (
                      <div style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.65rem 0", borderBottom: `1px solid ${C.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem",
                          fontSize: "0.85rem", color: C.textMuted }}>
                          <span>☀️</span><span>자외선 지수</span>
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: "700",
                          color: envLevelColor(uvData.level) }}>
                          {uvData.value} — {uvData.level}
                        </span>
                      </div>
                    )}
                    <EnvRow
                      icon="😷"
                      label="미세먼지 PM10"
                      value={airData ? `${airData.pm10.value}㎍/㎥ — ${airData.pm10.level}` : "정보 확인 중"}
                      color={airData ? envLevelColor(airData.pm10.level) : C.textMuted}
                    />
                    <EnvRow
                      icon="🫁"
                      label="초미세먼지 PM2.5"
                      value={airData ? `${airData.pm25.value}㎍/㎥ — ${airData.pm25.level}` : "정보 확인 중"}
                      color={airData ? envLevelColor(airData.pm25.level) : C.textMuted}
                    />
                    <EnvRow
                      icon="🌫️"
                      label="황사"
                      value={dustLevel}
                      color={dustLevel === "주의" ? C.danger : dustLevel === "관심" ? "#f0a500" : airData ? C.blue : C.textMuted}
                    />
                    {airData && (
                      <div style={{ fontSize: "0.7rem", color: C.textMuted, padding: "0.3rem 0" }}>
                        측정소: {airData.station} · 에어코리아
                      </div>
                    )}
                    {pollenData?.pine && (
                      <EnvRow
                        icon="🌲"
                        label="소나무 꽃가루"
                        value={pollenData.pine.text}
                        color={envLevelColor(pollenData.pine.text)}
                      />
                    )}
                    {pollenData?.oak && (
                      <EnvRow
                        icon="🌳"
                        label="참나무 꽃가루"
                        value={pollenData.oak.text}
                        color={envLevelColor(pollenData.oak.text)}
                        hasBorder={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="wg-chart-card wg-temp-chart-card">
              <div className="wg-chart-title">📈 오늘 시간별 기온 변화</div>
              <div className="wg-chart-wrap">
                {renderLineChart()}
              </div>
            </div>

            <div className="wg-chart-card wg-hourly-card">
              <div className="wg-chart-title">🕐 시간별 날씨</div>
              <div className="wg-hour-list">
                {hourlyData.map((d, i) => (
                  <div key={i}
                    className={`wg-hour-item ${d.isNow ? "now" : ""} ${d.isPast && !d.isNow ? "past" : ""}`}>
                    <div className="wg-hour-time">{d.isNow ? "지금" : d.time}</div>
                    <div className="wg-hour-icon">{d.icon}</div>
                    <div className="wg-hour-temp">{d.temp}°</div>
                    <div className="wg-hour-humid">{d.humid}%</div>
                    {d.pop !== "0" && (
                      <div style={{
                        fontSize: "0.6rem", marginTop: "0.1rem", fontWeight: "600",
                        color: d.isNow ? "rgba(255,255,255,0.9)" : "#7ab0e0",
                      }}>☔{d.pop}%</div>
                    )}
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
