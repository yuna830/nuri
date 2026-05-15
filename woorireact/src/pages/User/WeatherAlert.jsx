import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader, UserSubHeader } from "../../components/UserCommonHeader.jsx";
import {
  buildClimateInsightFromForecast,
  fetchTodayClimateAlerts,
  fetchTodayForecast,
  getCurrentSeniorId,
  reverseGeocode,
  saveClimateAlert,
} from "../../api/userPageApi.js";
import { fetchAirQuality, fetchPollenIndex, fetchUVIndex } from "../../utils/user/weatherAdvice";
import "../../css/user/WeatherAlert.css";

const SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";
const DEFAULT_POS = { lat: 37.5665, lon: 126.9780 };

const LEVELS = {
  safe: { label: "안전", bg: "#86A788", barColor: "#86A788", icon: "✅", desc: "외출 가능" },
  normal: { label: "보통", bg: "#4f9cc9", barColor: "#4f9cc9", icon: "ℹ️", desc: "확인 필요" },
  caution: { label: "주의", bg: "#f0a500", barColor: "#f0a500", icon: "⚠️", desc: "주의 필요" },
  warning: { label: "경고", bg: "#e05252", barColor: "#e05252", icon: "🚨", desc: "외출 자제" },
  danger: { label: "위험", bg: "#7a1a1a", barColor: "#7a1a1a", icon: "⛔", desc: "외출 금지" },
};

const LEVEL_ORDER = { danger: 0, warning: 1, caution: 2, normal: 3, safe: 4 };
const ACTIONS = [
  { icon: "🧥", text: "외출 전 옷차림과 보행 보조도구를 다시 확인하세요." },
  { icon: "📞", text: "위험 단계에서는 보호자에게 이동 사실을 먼저 알려주세요." },
  { icon: "🏠", text: "폭염, 폭우, 폭설 특보가 있으면 실내 활동을 우선하세요." },
  { icon: "💧", text: "기온 변화가 큰 날은 수분 섭취와 휴식을 자주 챙기세요." },
];

const pad = (value) => String(value).padStart(2, "0");
const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const formatNow = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const formatTodayDateTime = (time) => `${todayDate()} ${time}`;
const getAlertTimestamp = (alert) => {
  if (alert.issuedAt) return Date.parse(alert.issuedAt);
  if (alert.createdAt) return Date.parse(alert.createdAt);
  if (alert.time) return Date.parse(alert.time.replace(/\./g, "-"));
  return 0;
};

const getPosition = () => new Promise((resolve) => {
  if (!navigator.geolocation) {
    resolve(DEFAULT_POS);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => resolve(DEFAULT_POS)
  );
});

const normalizeAlert = (alert) => ({
  id: alert.eventId || alert.id,
  type: alert.type,
  level: alert.level,
  message: alert.message,
  time: alert.issuedAt
    ? alert.issuedAt.replace("T", " ").slice(0, 16)
    : alert.createdAt?.replace("T", " ").slice(0, 16),
  fetchTime: alert.issuedAt?.slice(11, 16) || "",
  region: alert.region,
  sortTime: getAlertTimestamp(alert),
});

const parseWarningType = (title) => {
  if (title.includes("폭염")) return "폭염";
  if (title.includes("한파")) return "한파";
  if (title.includes("호우")) return "폭우";
  if (title.includes("대설")) return "폭설";
  if (title.includes("강풍")) return "강풍";
  if (title.includes("황사")) return "황사";
  if (title.includes("건조")) return "건조";
  return "기상특보";
};

const parseWarningLevel = (title) => {
  if (title.includes("경보") || title.includes("폭염") || title.includes("한파")) return "warning";
  if (title.includes("주의보")) return "caution";
  return "caution";
};

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [environmentAlerts, setEnvironmentAlerts] = useState([]);
  const [lastFetched, setLastFetched] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [insight, setInsight] = useState(null);
  const liveIntervalRef = useRef(null);
  const hourlyIntervalRef = useRef(null);

  const persistAlert = async (alert) => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    const now = new Date();
    await saveClimateAlert({
      seniorId,
      eventId: String(alert.id),
      type: alert.type,
      level: alert.level,
      message: alert.message,
      region: alert.region,
      source: "KMA",
      alertDate: todayDate(),
      issuedAt: `${todayDate()}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    }).catch(() => {});
  };

  const persistAlertOnce = async (alert) => {
    const storageKey = `climate_saved_${todayDate()}`;
    const savedIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (savedIds.includes(String(alert.id))) return;
    await persistAlert(alert);
    localStorage.setItem(storageKey, JSON.stringify([...savedIds, String(alert.id)]));
  };

  const loadSavedAlerts = async () => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    const saved = await fetchTodayClimateAlerts(seniorId).catch(() => []);
    setAlerts(saved.map(normalizeAlert));
  };

  const addAlerts = (newAlerts, shouldPersist = true) => {
    setAlerts((prev) => {
      const existingIds = new Set(prev.map((item) => String(item.id)));
      const unique = newAlerts.filter((item) => !existingIds.has(String(item.id)));
      return unique.length > 0 ? [...unique, ...prev] : prev;
    });
  };

  const fetchWarnings = async ({ recordSafe = false } = {}) => {
    try {
      setFetching(true);
      const now = new Date();
      const fromTm = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}0000`;
      const toTm = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}2359`;
      const url = `/weather-api/1360000/WthrWrnInfoService/getWthrWrnList`
        + `?ServiceKey=${SERVICE_KEY}&pageNo=1&numOfRows=20&dataType=JSON`
        + `&stnId=108&fromTmFc=${fromTm}&toTmFc=${toTm}`;
      const response = await fetch(url);
      const data = await response.json();
      const rawItems = data?.response?.body?.items?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      const timeStr = formatNow();
      setLastFetched(timeStr);

      if (items.length === 0) {
        const safeAlert = {
          id: `${todayDate()}-${pad(now.getHours())}00-safe`,
          type: "오늘 날씨",
          level: "safe",
          message: "현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.",
          time: formatTodayDateTime(`${pad(now.getHours())}:00`),
          fetchTime: `${pad(now.getHours())}:00`,
          region: "대한민국",
          sortTime: new Date(`${todayDate()}T${pad(now.getHours())}:00:00`).getTime(),
        };
        addAlerts([safeAlert], recordSafe);
        return;
      }

      const parsed = items.map((item, index) => {
        const title = item.title || item.t1 || "기상특보가 발령되었습니다.";
        const eventTime = item.tmFc ? String(item.tmFc) : `${Date.now()}${index}`;
        return {
          id: eventTime,
          type: parseWarningType(title),
          level: parseWarningLevel(title),
          message: title,
          time: item.tmFc
            ? `${eventTime.slice(0, 4)}.${eventTime.slice(4, 6)}.${eventTime.slice(6, 8)} ${eventTime.slice(8, 10)}:${eventTime.slice(10, 12)}`
            : formatTodayDateTime(timeStr),
          fetchTime: timeStr,
          region: item.region || "대한민국",
          sortTime: item.tmFc
            ? Date.parse(`${eventTime.slice(0, 4)}-${eventTime.slice(4, 6)}-${eventTime.slice(6, 8)}T${eventTime.slice(8, 10)}:${eventTime.slice(10, 12)}:00`)
            : now.getTime(),
        };
      });
      addAlerts(parsed, true);
    } catch {
      addAlerts([{
        id: "fallback",
        type: "기후",
        level: "safe",
        message: "기상 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.",
        time: formatTodayDateTime(formatNow()),
        region: "대한민국",
        sortTime: Date.now(),
      }], false);
    } finally {
      setFetching(false);
    }
  };

  const loadInsight = async () => {
    const pos = await getPosition();
    const [forecast, region] = await Promise.all([
      fetchTodayForecast(pos.lat, pos.lon),
      reverseGeocode(pos.lat, pos.lon),
    ]);
    setInsight(buildClimateInsightFromForecast(forecast, region));
  };

  const loadEnvironmentAlerts = async () => {
    const pos = await getPosition();
    const [uv, air, pollen] = await Promise.all([
      fetchUVIndex(pos.lat, pos.lon),
      fetchAirQuality(pos.lat, pos.lon),
      fetchPollenIndex(pos.lat, pos.lon),
    ]);
    const now = new Date();
    const time = formatNow();
    const nextAlerts = [];

    if (uv?.value >= 3) {
      const uvLevelText = uv.value >= 8 ? "매우 높음" : uv.value >= 6 ? "높음" : "보통";
      nextAlerts.push({
        id: todayDate() + "-" + pad(now.getHours()) + "-uv",
        type: "\uC790\uC678\uC120",
        level: uv.value >= 8 ? "warning" : uv.value >= 6 ? "caution" : "normal",
        message: "\uC790\uC678\uC120 \uC9C0\uC218\uAC00 " + uv.value + "\uB85C " + uvLevelText + "\uC785\uB2C8\uB2E4. \uC678\uCD9C \uC2DC \uBAA8\uC790\uB098 \uC120\uD06C\uB9BC\uC744 \uCC59\uACA8\uC8FC\uC138\uC694.",
        time: formatTodayDateTime(time),
        fetchTime: time,
        region: "\uD604\uC7AC \uC704\uCE58",
        sortTime: now.getTime(),
      });
    }
    if (air?.pm10?.value > 80 || air?.pm25?.value > 35) {
      nextAlerts.push({
        id: todayDate() + "-" + pad(now.getHours()) + "-air",
        type: "\uBBF8\uC138\uBA3C\uC9C0",
        level: air.pm10.value > 150 || air.pm25.value > 75 ? "warning" : "caution",
        message: "\uBBF8\uC138\uBA3C\uC9C0 \uC0C1\uD0DC\uAC00 \uC88B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. PM10 " + air.pm10.value + ", PM2.5 " + air.pm25.value + " \uAE30\uC900\uC73C\uB85C \uC678\uCD9C \uC2DC \uB9C8\uC2A4\uD06C\uB97C \uCC29\uC6A9\uD574\uC8FC\uC138\uC694.",
        time: formatTodayDateTime(time),
        fetchTime: time,
        region: air.station || "\uD604\uC7AC \uC704\uCE58",
        sortTime: now.getTime(),
      });
    }
    const pollenHigh = ["pine", "oak", "weeds"].find((key) => pollen?.[key]?.value >= 3);
    if (pollenHigh) {
      nextAlerts.push({
        id: todayDate() + "-" + pad(now.getHours()) + "-pollen-" + pollenHigh,
        type: "\uAF43\uAC00\uB8E8",
        level: pollen[pollenHigh].value >= 4 ? "warning" : "caution",
        message: "\uAF43\uAC00\uB8E8 \uB18D\uB3C4\uAC00 \uB192\uC2B5\uB2C8\uB2E4. \uC54C\uB808\uB974\uAE30\uB098 \uD638\uD761\uAE30 \uC9C8\uD658\uC774 \uC788\uB2E4\uBA74 \uB9C8\uC2A4\uD06C\uB97C \uCC29\uC6A9\uD558\uACE0 \uADC0\uAC00 \uD6C4 \uC138\uC548\uD574\uC8FC\uC138\uC694.",
        time: formatTodayDateTime(time),
        fetchTime: time,
        region: "\uD604\uC7AC \uC704\uCE58",
        sortTime: now.getTime(),
      });
    }

    setEnvironmentAlerts(nextAlerts);
  };

  useEffect(() => {
    loadSavedAlerts().finally(() => fetchWarnings({ recordSafe: false }));
    loadInsight().catch(() => {});
    loadEnvironmentAlerts().catch(() => {});

    liveIntervalRef.current = setInterval(() => {
      fetchWarnings({ recordSafe: false });
      loadEnvironmentAlerts().catch(() => {});
    }, 60 * 1000);

    return () => {
      clearInterval(liveIntervalRef.current);
    };
  }, []);

  const displayAlerts = useMemo(() => {
    const existingIds = new Set();
    return [...environmentAlerts, ...alerts].filter((alert) => {
      const id = String(alert.id);
      if (existingIds.has(id)) return false;
      existingIds.add(id);
      return true;
    }).sort((first, second) => (second.sortTime || 0) - (first.sortTime || 0));
  }, [alerts, environmentAlerts]);

  const currentAlert = useMemo(() => {
    if (displayAlerts.length === 0) return null;
    return displayAlerts[0];
  }, [displayAlerts]);
  const hasWarning = currentAlert && (currentAlert.level === "warning" || currentAlert.level === "danger");
  const currentLevel = currentAlert ? LEVELS[currentAlert.level] : LEVELS.safe;

  return (
    <div className="wa-root">
      <UserCommonHeader />
      
      <div className="wa-layout">
        <main className="wa-main">
          {currentAlert && (
            <div className="wa-banner" style={{ background: `linear-gradient(135deg, ${currentLevel.bg}, ${currentLevel.bg}dd)` }}>
              <div className="wa-banner-top">
                <div>
                  <div className="wa-banner-label">현재 기후 위험 단계</div>
                  <div className="wa-banner-status">{currentLevel.icon} {currentLevel.label}</div>
                  <div className="wa-banner-desc">{currentLevel.desc} · {currentAlert.type} 기준</div>
                </div>
                <div className="wa-banner-icon">{currentLevel.icon}</div>
              </div>
              <div className="wa-banner-region">
                📍 {currentAlert.region || "대한민국"} · {currentAlert.time || new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 기준
              </div>
            </div>
          )}

          <div className="wa-section-head">
            <div className="wa-section-label">전체 알림 ({displayAlerts.length}건)</div>
          </div>

          {displayAlerts.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">🌤️</div>
              <div className="wa-empty-text">현재 기후 위험 알림이 없습니다</div>
            </div>
          ) : (
            displayAlerts.map((alert) => {
              const level = LEVELS[alert.level] || LEVELS.safe;
              return (
                <article key={alert.id} className="wa-alert-card">
                  <div className="wa-alert-bar" style={{ background: level.barColor }} />
                  <div className="wa-alert-inner">
                    <div className="wa-alert-top">
                      <div className="wa-alert-type">{level.icon} {alert.type}</div>
                      <div className="wa-alert-right">
                        {alert.region && <span className="wa-alert-region">📍 {alert.region}</span>}
                        <span className="wa-alert-badge" style={{ background: level.bg }}>{level.label}</span>
                      </div>
                    </div>
                    <div className="wa-alert-msg">{alert.message}</div>
                    <div className="wa-alert-time">⏱ {alert.time}</div>
                  </div>
                </article>
              );
            })
          )}
        </main>

        <aside className="wa-sidebar">
          <div className="wa-level-card">
            <div className="wa-level-header">
                <div className="wa-level-title">알림 단계 안내</div>
                <div className="wa-level-updated">
                    {fetching ? "업데이트 중..." : lastFetched ? `마지막 갱신 ${lastFetched}` : "기상청 API · 실시간 확인"}
                </div>
            </div>
            {Object.entries(LEVELS).map(([key, level]) => (
              <div key={key} className="wa-level-item">
                <div className="wa-level-pill" style={{ background: level.bg }}>{level.icon} {level.label}</div>
                <div className="wa-level-info">
                  <div className="wa-level-name">{level.label}</div>
                  <div className="wa-level-desc">{level.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {hasWarning && (
            <div className="wa-action-card">
              <div className="wa-action-title">위험 시 행동 요령</div>
              {ACTIONS.map((action) => (
                <div key={action.text} className="wa-action-item">
                  <div className="wa-action-icon">{action.icon}</div>
                  <div className="wa-action-text">{action.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="wa-source-card">
            📡 본 서비스의 기후 위험 알림은 <b>기상청 공공 API</b>를 통해 확인합니다.
            기상특보와 환경 위험은 실시간으로 확인하고, 특보가 없는 상태 기록은 매 정각 기준으로 하루 동안 누적됩니다.
          </div>

          {insight && (
            <div className="wa-climate-card">
              <div className="wa-climate-top">
                <div>
                  <div className="wa-climate-label">
                    <span>{insight.region}</span>
                    <span>단기예보 기반</span>
                  </div>
                  <div className="wa-climate-title">{insight.title}</div>
                </div>
                <span className="wa-climate-tag">{insight.tag}</span>
              </div>

              <div
                className="wa-donut"
                style={{
                  background: (() => {
                    const total = Math.max(1, insight.scores.reduce((sum, item) => sum + item.value, 0));
                    let cursor = 0;
                    return `conic-gradient(${insight.scores.map((score) => {
                      const start = cursor;
                      cursor += (score.value / total) * 100;
                      return `${score.color} ${start}% ${cursor}%`;
                    }).join(", ")})`;
                  })(),
                }}
              >
                <div className="wa-donut-inner">
                  <strong>{insight.type}</strong>
                  <span>{insight.status}</span>
                </div>
              </div>

              {insight.scores.map((score) => (
                <div key={score.key} className="wa-score-row">
                  <span>{score.key}</span>
                  <div className="wa-score-bar">
                    <div style={{ width: `${score.value}%`, background: score.color }} />
                  </div>
                  <b>{score.value}%</b>
                </div>
              ))}

              <div className="wa-tip-list">
                {insight.tips.map((tip) => <div key={tip}>{tip}</div>)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
