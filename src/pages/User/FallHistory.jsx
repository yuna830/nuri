import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const colors = {
  primary: "#86A788",
  background: "#FFFDEC",
  white: "#ffffff",
  danger: "#e94560",
  text: "#2d2d2d",
};

function FallHistory() {
  const navigate = useNavigate();
  const [fallLogs, setFallLogs] = useState([]);

  useEffect(() => {
    // 나중에 api.get('/fall/history/1') 연결
    // 임시 더미 데이터
    setFallLogs([
      {
        id: 1,
        date: "2026-05-04",
        time: "오전 8:32",
        location: "거실",
        status: "보호자 확인 완료",
        confirmed: true,
      },
      {
        id: 2,
        date: "2026-04-28",
        time: "오후 3:15",
        location: "욕실",
        status: "119 출동",
        confirmed: true,
      },
      {
        id: 3,
        date: "2026-04-20",
        time: "오전 11:50",
        location: "침실",
        status: "오탐지 (정상)",
        confirmed: false,
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
          📋 낙상 기록
        </h2>
      </div>

      {/* 요약 카드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}>
        <div style={{
          backgroundColor: colors.primary,
          borderRadius: "16px",
          padding: "1.2rem",
          color: colors.white,
          textAlign: "center",
        }}>
          <p style={{ fontSize: "1rem", margin: "0 0 0.3rem" }}>이번 달 낙상</p>
          <p style={{ fontSize: "2.5rem", fontWeight: "bold", margin: 0 }}>
            {fallLogs.filter(l => l.confirmed).length}건
          </p>
        </div>
        <div style={{
          backgroundColor: colors.white,
          borderRadius: "16px",
          padding: "1.2rem",
          border: `2px solid ${colors.primary}`,
          textAlign: "center",
        }}>
          <p style={{ fontSize: "1rem", margin: "0 0 0.3rem", color: colors.text }}>오탐지</p>
          <p style={{ fontSize: "2.5rem", fontWeight: "bold", margin: 0, color: colors.text }}>
            {fallLogs.filter(l => !l.confirmed).length}건
          </p>
        </div>
      </div>

      {/* 낙상 이력 목록 */}
      {fallLogs.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "3rem",
          color: "#aaa",
          fontSize: "1.2rem",
        }}>
          낙상 기록이 없습니다 😊
        </div>
      ) : (
        fallLogs.map(log => (
          <div key={log.id} style={{
            backgroundColor: colors.white,
            borderRadius: "16px",
            padding: "1.5rem",
            marginBottom: "1rem",
            borderLeft: `6px solid ${log.confirmed ? colors.danger : "#aaa"}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: colors.text }}>
                📍 {log.location}
              </span>
              <span style={{
                fontSize: "0.95rem",
                padding: "0.2rem 0.8rem",
                borderRadius: "99px",
                backgroundColor: log.confirmed ? colors.danger : "#aaa",
                color: "white",
                fontWeight: "bold",
              }}>
                {log.confirmed ? "낙상" : "오탐지"}
              </span>
            </div>
            <p style={{ fontSize: "1.1rem", color: colors.text, margin: "0 0 0.3rem" }}>
              🕐 {log.date} {log.time}
            </p>
            <p style={{ fontSize: "1rem", color: "#888", margin: 0 }}>
              처리: {log.status}
            </p>
          </div>
        ))
      )}

    </div>
  );
}

export default FallHistory;