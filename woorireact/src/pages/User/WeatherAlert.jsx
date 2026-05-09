import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLD_ACTIONS, DUMMY_ALERTS, LEVELS, getWorstAlert, hasHighRiskAlert } from "../../utils/user/weatherAlertData";
import { fetchTodayClimateAlerts, getCurrentSeniorId, saveClimateAlert } from "../../api/userPageApi.js";
import "../../css/user/WeatherAlert.css";

const SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [lastFetched, setLastFetched] = useState(null);
  const [fetching, setFetching] = useState(false);
  const intervalRef = useRef(null);

  const toViewAlert = (alert) => ({
    id: alert.eventId || alert.id,
    type: alert.type,
    level: alert.level,
    message: alert.message,
    time: alert.issuedAt
      ? alert.issuedAt.replace("T", " ").slice(0, 16)
      : alert.createdAt?.replace("T", " ").slice(0, 16),
    fetchTime: alert.issuedAt?.slice(11, 16) || "",
    region: alert.region,
  });

  const persistAlert = async (alert) => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const alertDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const issuedAt = `${alertDate}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    await saveClimateAlert({
      seniorId,
      eventId: String(alert.id),
      type: alert.type,
      level: alert.level,
      message: alert.message,
      region: alert.region,
      source: "KMA",
      alertDate,
      issuedAt,
    }).catch(() => {});
  };

  const fetchAlerts = async () => {
    try {
      setFetching(true);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const fromTm = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}0000`;
      const toTm   = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}2359`;
      const url = `/weather-api/1360000/WthrWrnInfoService/getWthrWrnList`
        + `?ServiceKey=${SERVICE_KEY}&pageNo=1&numOfRows=20&dataType=JSON`
        + `&stnId=108&fromTmFc=${fromTm}&toTmFc=${toTm}`;
      const res = await fetch(url);
      const data = await res.json();
      const items = data?.response?.body?.items?.item || [];

      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setLastFetched(timeStr);

      if (!items || items.length === 0) {
        // 특보 없음 → 안전 알림 추가 (중복 제거)
        setAlerts(prev => {
          const safeMsg = "현재 발령된 기상특보가 없습니다. 오늘 날씨는 비교적 안전합니다.";
          const alreadyExists = prev.some(a => a.message === safeMsg && a.fetchTime === timeStr);
          if (alreadyExists) return prev;
          const newAlert = {
            id: Date.now(),
            type: "오늘 날씨",
            level: "safe",
            message: safeMsg,
            time: `오늘 ${timeStr}`,
            fetchTime: timeStr,
            region: "서울 전역",
          };
          const updated = [newAlert, ...prev];
          persistAlert(newAlert);
          return updated;
        });
        return;
      }

      const parsed = (Array.isArray(items) ? items : [items]).map((item) => {
        const title = item.title || "";
        let level = "caution";
        if (title.includes("경보") || title.includes("한파") || title.includes("폭염")) level = "warning";
        if (title.includes("태풍") || title.includes("대설경보")) level = "danger";
        let type = "기상특보";
        if (title.includes("한파")) type = "한파";
        else if (title.includes("폭염")) type = "폭염";
        else if (title.includes("강풍")) type = "강풍";
        else if (title.includes("호우")) type = "호우";
        else if (title.includes("대설")) type = "대설";
        return {
          id: item.tmFc ? Number(item.tmFc) : Date.now(),
          type, level,
          message: title,
          time: item.tmFc
            ? `${item.tmFc.toString().slice(0,4)}.${item.tmFc.toString().slice(4,6)}.${item.tmFc.toString().slice(6,8)} ${item.tmFc.toString().slice(8,10)}:${item.tmFc.toString().slice(10,12)}`
            : timeStr,
          fetchTime: timeStr,
          region: "서울 전역",
        };
      });

      // 중복 제거 후 누적
      setAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newOnes = parsed.filter(a => !existingIds.has(a.id));
        if (newOnes.length === 0) return prev;
        const updated = [...newOnes, ...prev];
        newOnes.forEach(persistAlert);
        return updated;
      });

    } catch {
      setAlerts(prev => prev.length > 0 ? prev : DUMMY_ALERTS);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    const loadSavedAlerts = async () => {
      const seniorId = getCurrentSeniorId();
      if (!seniorId) return;
      const savedAlerts = await fetchTodayClimateAlerts(seniorId).catch(() => []);
      if (savedAlerts.length > 0) {
        setAlerts(savedAlerts.map(toViewAlert));
      }
    };

    loadSavedAlerts();
    fetchAlerts();
    // 1시간마다 자동 갱신
    intervalRef.current = setInterval(fetchAlerts, 60 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const hasWarning = useMemo(() => hasHighRiskAlert(alerts), [alerts]);
  const worstAlert = useMemo(() => getWorstAlert(alerts), [alerts]);
  const worstLevel = worstAlert ? LEVELS[worstAlert.level] : LEVELS.safe;

  return (
    <div className="wa-root">
      <nav className="wa-nav">
        <button className="wa-nav-back" type="button" onClick={() => navigate("/user")}>← 돌아가기</button>
        <div className="wa-nav-title">🌡 기후 위험 알림</div>
        <div className="wa-nav-sub">
          {fetching ? "업데이트 중..." : lastFetched ? `마지막 갱신 ${lastFetched}` : "기상청 API · 1시간 갱신"}
        </div>
      </nav>

      <div className="wa-layout">
        <main className="wa-main">
          {worstAlert && (
            <div className="wa-banner" style={{ background: `linear-gradient(135deg, ${worstLevel.bg}, ${worstLevel.bg}dd)` }}>
              <div className="wa-banner-top">
                <div>
                  <div className="wa-banner-label">현재 기후 위험 단계</div>
                  <div className="wa-banner-status">{worstLevel.icon} {worstLevel.label}</div>
                  <div className="wa-banner-desc">{worstLevel.desc} · {worstAlert.type} 주의보 발령</div>
                </div>
                <div className="wa-banner-icon">{worstLevel.icon}</div>
              </div>
              <div className="wa-banner-region">
                📍 서울 전역 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 기준
              </div>
            </div>
          )}

          <div className="wa-section-head">
            <div className="wa-section-label">전체 알림 ({alerts.length}건)</div>
          </div>

          {alerts.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">😊</div>
              <div className="wa-empty-text">현재 기후 위험 알림이 없습니다</div>
            </div>
          ) : (
            alerts.map((alert) => {
              const level = LEVELS[alert.level];
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
                    <div className="wa-alert-time">🕐 {alert.time}</div>
                  </div>
                </article>
              );
            })
          )}
        </main>

        <aside className="wa-sidebar">
          <div className="wa-level-card">
            <div className="wa-level-title">알림 단계 안내</div>
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
              <div className="wa-action-title">⚡ 한파 행동 요령</div>
              {COLD_ACTIONS.map((action) => (
                <div key={action.text} className="wa-action-item">
                  <div className="wa-action-icon">{action.icon}</div>
                  <div className="wa-action-text">{action.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="wa-source-card">
            📡 본 서비스의 기후 위험 알림은 <b>기상청 공공 API</b>를 통해
            <b> 1시간마다</b> 자동으로 업데이트됩니다.
            오늘 하루 알림이 누적되며 자정에 초기화됩니다.
          </div>
        </aside>
      </div>
    </div>
  );
}
