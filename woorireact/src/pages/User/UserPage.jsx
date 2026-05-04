import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const colors = {
  primary: "#86A788",
  background: "#FFFDEC",
  white: "#ffffff",
  danger: "#e94560",
  text: "#2d2d2d",
};

function UserPage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);

  // 나중에 Spring Boot API 연결할 자리
  useEffect(() => {
    // api.get('/weather/current').then(res => setWeather(res.data));
    // 임시 더미 데이터
    setWeather({ temp: 22, status: "맑음", alert: null });
  }, []);

  const handleSOS = () => {
    if (window.confirm("보호자에게 SOS를 보내시겠습니까?")) {
      alert("보호자에게 알림을 보냈습니다!");
      // 나중에 api.post('/alert/sos') 연결
    }
  };

  return (
    <div style={{
      backgroundColor: colors.background,
      minHeight: "100vh",
      padding: "2rem",
      fontFamily: "sans-serif",
    }}>

      {/* 상단 인사 */}
      <div style={{
        backgroundColor: colors.primary,
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "1.2rem",
        color: colors.white,
        textAlign: "center",
      }}>
        <p style={{ fontSize: "1.1rem", margin: 0 }}>안녕하세요 👋</p>
        <h2 style={{ fontSize: "2rem", margin: "0.3rem 0 0" }}>오늘도 건강한 하루 되세요</h2>
      </div>

      {/* 날씨 현황 카드 */}
      <div style={{
        backgroundColor: colors.white,
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "1.2rem",
        border: `2px solid ${colors.primary}`,
      }}>
        <p style={{ fontSize: "1.2rem", color: colors.text, margin: "0 0 0.5rem" }}>🌤 오늘 날씨</p>
        {weather ? (
          <>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: colors.text }}>
              {weather.temp}°C &nbsp; {weather.status}
            </p>
            {weather.alert && (
              <p style={{
                marginTop: "0.5rem",
                color: colors.danger,
                fontWeight: "bold",
                fontSize: "1.1rem"
              }}>
                ⚠️ {weather.alert}
              </p>
            )}
          </>
        ) : (
          <p style={{ color: "#aaa" }}>날씨 정보를 불러오는 중...</p>
        )}
      </div>

      {/* SOS 버튼 */}
      <button
        onClick={handleSOS}
        style={{
          width: "100%",
          padding: "2.5rem",
          fontSize: "2rem",
          fontWeight: "bold",
          backgroundColor: colors.danger,
          color: colors.white,
          border: "none",
          borderRadius: "20px",
          cursor: "pointer",
          marginBottom: "1.2rem",
          boxShadow: "0 8px 20px rgba(233,69,96,0.4)",
        }}
      >
        🆘 SOS 도움 요청
      </button>

      {/* 기후 알림 바로가기 */}
      <button
        onClick={() => navigate("/weather")}
        style={{
          width: "100%",
          padding: "1.5rem",
          fontSize: "1.4rem",
          backgroundColor: colors.white,
          color: colors.text,
          border: `2px solid ${colors.primary}`,
          borderRadius: "16px",
          cursor: "pointer",
          marginBottom: "1rem",
        }}
      >
        🌡 기후 위험 알림 보기
      </button>

      {/* 낙상 이력 바로가기 */}
      <button
        onClick={() => navigate("/fall-history")}
        style={{
          width: "100%",
          padding: "1.5rem",
          fontSize: "1.4rem",
          backgroundColor: colors.white,
          color: colors.text,
          border: `2px solid ${colors.primary}`,
          borderRadius: "16px",
          cursor: "pointer",
        }}
      >
        📋 낙상 기록 보기
      </button>

    </div>
  );
}

export default UserPage;