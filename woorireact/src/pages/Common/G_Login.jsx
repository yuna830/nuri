import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";

const FEATURES = [
  { icon: "📍", title: "실시간 위치 확인", desc: "보호 대상자의 현재 위치와 이동 경로 확인" },
  { icon: "🚨", title: "긴급 알림 수신", desc: "안전 반경 이탈, 낙상, 실종 신고 알림" },
  { icon: "🗺", title: "안심 구역 관리", desc: "자택, 병원, 복지관 등 안전 구역 설정" },
  { icon: "📋", title: "건강 정보 확인", desc: "등록된 건강 정보와 주의사항을 함께 확인" },
];

export default function GuardianLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogin = async () => {
    if (!form.email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }

    if (!form.password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    const response = await fetch("http://localhost:8080/api/guardians/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError("이메일 또는 비밀번호를 확인해주세요.");
      return;
    }

    const guardian = await response.json();

    sessionStorage.setItem("currentGuardian", JSON.stringify(guardian));
    navigate("/guardian");
  };

  return (
    <main className="login-root">
      <section className="login-left">
        <div className="login-logo">🌿 우리</div>
        <div className="login-tagline">보호자를 위한 실시간 안전 관리</div>

        <div className="login-features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="login-feature">
              <div className="login-feature-icon">{feature.icon}</div>
              <div>
                <div className="login-feature-title">{feature.title}</div>
                <div className="login-feature-desc">{feature.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="login-right">
        <div className="login-box">
          <div className="login-title">보호자 로그인</div>
          <div className="login-sub">
            이메일과 비밀번호를 입력하고
            <br />
            보호자 서비스를 시작하세요.
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <label className="login-label">이메일</label>
          <input
            className="login-input"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="guardian@example.com"
            onKeyDown={(event) => event.key === "Enter" && handleLogin()}
          />

          <label className="login-label">비밀번호</label>
          <input
            className="login-input"
            type="password"
            value={form.password}
            onChange={(event) => set("password", event.target.value)}
            placeholder="비밀번호"
            onKeyDown={(event) => event.key === "Enter" && handleLogin()}
          />

          <button className="login-btn" type="button" onClick={handleLogin}>
            보호자 로그인
          </button>

          <div className="login-divider">아직 보호자 계정이 없나요?</div>

          <button
            className="login-btn-outline"
            type="button"
            onClick={() => navigate("/gsignup")}
          >
            보호자 회원가입
          </button>

          <div className="login-footer">
            우리는 보호자와 어르신을 연결해
            <br />
            더 안전한 돌봄을 돕습니다.
          </div>
        </div>
      </section>
    </main>
  );
}
