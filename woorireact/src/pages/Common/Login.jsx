function Login() {
  return (
    <div style={{
      backgroundColor: "#FFFDEC",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
    }}>
      <h1 style={{ color: "#86A788", fontSize: "2.5rem", marginBottom: "0.5rem" }}>
        🌿 누리
      </h1>
      <p style={{ color: "#555", marginBottom: "2rem" }}>취약계층 AI 통합 돌봄 플랫폼</p>

      <button
        onClick={() => window.location.href = "/user"}
        style={{
          padding: "1rem 3rem",
          fontSize: "1.2rem",
          backgroundColor: "#86A788",
          color: "white",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
        }}
      >
        시작하기
      </button>
    </div>
  );
}
export default Login;