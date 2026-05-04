import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const colors = {
  primary: "#86A788",
  background: "#FFFDEC",
  white: "#ffffff",
  danger: "#e94560",
  warning: "#f5a623",
  text: "#2d2d2d",
};

const ALERT_LEVELS = {
  safe:    { label: "안전", color: "#86A788", icon: "✅" },
  caution: { label: "주의", color: "#f5a623", icon: "⚠️" },
  warning: { label: "경고", color: "#e94560", icon: "🚨" },
  danger:  { label: "위험", color: "#8b0000", icon: "🆘" },
};

function WeatherAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // 나중에 api.get('/weather/alerts') 연결
    // 임시 더미 데이터
    setAlerts([
      {
        id: 1,
        type: "한파",
        level: "warning",
        message: "오늘 최저기온이 -12°C 이하로 내려갑니다. 외출을 삼가주세요.",
        time: "오늘 오전 9:00",
      },
      {
        id: 2,
        type: "강풍",
        level: "caution",
        message: "강한 바람이 예상됩니다. 외출 시 주의하세요.",
        time: "오늘 오후 2:00",
      },
      {
        id: 3,
        type: "날씨",
        level: "safe",
        message: "오후에는 날씨가 맑아집니다.",
        time: "오늘 오후 4:00",
      },
    ]);
  }, []);

  return (
    <div style={{
      backgroundColor: colors.background,
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "sans-serif",
    }}>

      {/* 상단 헤더 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}>
        <button
          onClick={() => navigate("/user")}
          style={{
            backgroundColor: "transparent",
            border: `2px solid ${colors.primary}`,
            borderRadius: "10px",
            padding: "0.5rem 1rem",
            fontSize: "1.2rem",
            cursor: "pointer",
            color: colors.primary,
          }}
        >
          ← 뒤로
        </button>
        <h2 style={{ fontSize: "1.8rem", color: colors.text, margin: 0 }}>
          🌡 기후 위험 알림
        </h2>
      </div>

      {/* 단계 설명 */}
      <div style={{
        backgroundColor: colors.white,
        borderRadius: "16px",
        padding: "1.2rem",
        marginBottom: "1.5rem",
        border: `2px solid ${colors.primary}`,
      }}>
        <p style={{ fontSize: "1rem", color: colors.text, margin: "0 0 0.8rem", fontWeight: "bold" }}>
          알림 단계 안내
        </p>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          {Object.entries(ALERT_LEVELS).map(([key, val]) => (
            <span key={key} style={{
              padding: "0.3rem 0.9rem",
              borderRadius: "99px",
              backgroundColor: val.color,
              color: "white",
              fontSize: "1rem",
              fontWeight: "bold",
            }}>
              {val.icon} {val.label}
            </span>
          ))}
        </div>
      </div>

      {/* 알림 목록 */}
      {alerts.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "3rem",
          color: "#aaa",
          fontSize: "1.2rem",
        }}>
          현재 기후 위험 알림이 없습니다 😊
        </div>
      ) : (
        alerts.map(alert => {
          const level = ALERT_LEVELS[alert.level];
          return (
            <div key={alert.id} style={{
              backgroundColor: colors.white,
              borderRadius: "16px",
              padding: "1.5rem",
              marginBottom: "1rem",
              borderLeft: `6px solid ${level.color}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                <span style={{
                  backgroundColor: level.color,
                  color: "white",
                  padding: "0.2rem 0.8rem",
                  borderRadius: "99px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                }}>
                  {level.icon} {level.label}
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: colors.text }}>
                  {alert.type}
                </span>
              </div>
              <p style={{ fontSize: "1.2rem", color: colors.text, margin: "0 0 0.4rem" }}>
                {alert.message}
              </p>
              <p style={{ fontSize: "0.95rem", color: "#aaa", margin: 0 }}>
                🕐 {alert.time}
              </p>
            </div>
          );
        })
      )}

    </div>
  );
}

export default WeatherAlert;