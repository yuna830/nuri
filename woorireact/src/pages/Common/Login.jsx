import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";

const FEATURES = [
  { icon: "🚨", title: "24시간 낙상 감지", desc: "카메라 AI가 실시간으로 안전을 지켜드려요" },
  { icon: "🌡", title: "위험 기후 알림", desc: "한파·폭염 등 위험 기상 자동 안내" },
  { icon: "📍", title: "실시간 위치 공유", desc: "보호자에게 현재 위치를 실시간으로 공유" },
  { icon: "💼", title: "맞춤 일자리 추천", desc: "신체 조건에 맞는 노인 일자리 매칭" },
];

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleStart = () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!phone.trim()) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    localStorage.setItem(
      "login_temp",
      JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
      })
    );

    navigate("/signup");
  };

  return (
    <main className="login-root">
      <section className="login-left">
        <div className="login-logo">🌿 우리 woori</div>
        <div className="login-tagline">취약계층 AI 통합 돌봄 플랫폼</div>

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
          <div className="login-title">안녕하세요 👋</div>
          <div className="login-sub">
            이름과 전화번호를 입력하고
            <br />
            서비스를 시작해보세요!
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <label className="login-label">이름</label>
          <input
            className="login-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="홍길동"
            onKeyDown={(event) => event.key === "Enter" && handleStart()}
          />

          <label className="login-label">전화번호</label>
          <input
            className="login-input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="010-0000-0000"
            onKeyDown={(event) => event.key === "Enter" && handleStart()}
          />

          <button className="login-btn" type="button" onClick={handleStart}>
            🌿 서비스 시작하기
          </button>

          <div className="login-divider">처음 사용하시나요?</div>

          <button
            className="login-btn-outline"
            type="button"
            onClick={() => navigate("/signup")}
          >
            📋 정보 등록하기
          </button>

          <div className="login-footer">
            케어링은 어르신의 안전하고 건강한 일상을
            <br />
            AI 기술로 함께 지켜드립니다.
          </div>
        </div>
      </section>
    </main>
  );
}
