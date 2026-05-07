import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLD_ACTIONS,
  DUMMY_ALERTS,
  LEVELS,
  getWorstAlert,
  hasHighRiskAlert,
} from "../../utils/user/weatherAlertData";
import "../../css/user/WeatherAlert.css";

export default function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    setAlerts(DUMMY_ALERTS);
  }, []);

  const hasWarning = useMemo(() => hasHighRiskAlert(alerts), [alerts]);
  const worstAlert = useMemo(() => getWorstAlert(alerts), [alerts]);
  const worstLevel = worstAlert ? LEVELS[worstAlert.level] : LEVELS.safe;

  return (
    <div className="wa-root">
      <nav className="wa-nav">
        <button className="wa-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>

        <div className="wa-nav-title">🌡 기후 위험 알림</div>
        <div className="wa-nav-sub">기상청 API 연동 · 실시간 업데이트</div>
      </nav>

      <div className="wa-layout">
        <main className="wa-main">
          {worstAlert && (
            <div
              className="wa-banner"
              style={{
                background: `linear-gradient(135deg, ${worstLevel.bg}, ${worstLevel.bg}dd)`,
              }}
            >
              <div className="wa-banner-top">
                <div>
                  <div className="wa-banner-label">현재 기후 위험 단계</div>
                  <div className="wa-banner-status">
                    {worstLevel.icon} {worstLevel.label}
                  </div>
                  <div className="wa-banner-desc">
                    {worstLevel.desc} · {worstAlert.type} 주의보 발령
                  </div>
                </div>

                <div className="wa-banner-icon">{worstLevel.icon}</div>
              </div>

              <div className="wa-banner-region">
                📍 서울 전역 ·{" "}
                {new Date().toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                })}{" "}
                기준
              </div>
            </div>
          )}

          <div className="wa-section-head">
            <div className="wa-section-label">전체 알림</div>
            <div className="wa-alert-count">{alerts.length}건</div>
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
                      <div className="wa-alert-type">
                        {level.icon} {alert.type}
                      </div>

                      <div className="wa-alert-right">
                        {alert.region && (
                          <span className="wa-alert-region">📍 {alert.region}</span>
                        )}

                        <span className="wa-alert-badge" style={{ background: level.bg }}>
                          {level.label}
                        </span>
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
                <div className="wa-level-pill" style={{ background: level.bg }}>
                  {level.icon} {level.label}
                </div>

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
            실시간으로 제공됩니다. 정확한 정보는 기상청 홈페이지를 참고해주세요.
          </div>
        </aside>
      </div>
    </div>
  );
}
