import { useState } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC",
  green: "#86A788",
  greenDark: "#5f7d61",
  greenLight: "#b8d4ba",
  greenPale: "#eef6ef",
  white: "#ffffff",
  danger: "#e05252",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .login-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .login-left {
    background: ${C.green};
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 4rem;
    position: relative;
    overflow: hidden;
  }
  .login-left::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
  }
  .login-left::after {
    content: '';
    position: absolute;
    bottom: -100px; left: -60px;
    width: 350px; height: 350px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .login-logo { font-size: 2.5rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
  .login-tagline { font-size: 1rem; color: rgba(255,255,255,0.8); margin-bottom: 3rem; font-weight: 300; }
  .login-features { display: flex; flex-direction: column; gap: 1.2rem; }
  .login-feature { display: flex; align-items: center; gap: 1rem; color: rgba(255,255,255,0.9); }
  .login-feature-icon {
    width: 42px; height: 42px;
    background: rgba(255,255,255,0.15);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.3rem; flex-shrink: 0;
  }
  .login-feature-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.15rem; }
  .login-feature-desc { font-size: 0.8rem; opacity: 0.75; font-weight: 300; }

  .login-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 4rem;
  }
  .login-box { width: 100%; max-width: 380px; }
  .login-title { font-size: 1.7rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.4rem; }
  .login-sub { font-size: 0.88rem; color: ${C.textMuted}; margin-bottom: 2rem; line-height: 1.6; }
  .login-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    margin-bottom: 0.4rem;
    display: block;
  }
  .login-input {
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid ${C.border};
    border-radius: 10px;
    font-size: 0.95rem;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
    background: ${C.white};
    outline: none;
    margin-bottom: 1rem;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .login-input:focus { border-color: ${C.green}; }
  .login-error {
    background: #fdf0f0;
    border: 1px solid #f5c6c6;
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    font-size: 0.83rem;
    color: ${C.danger};
    margin-bottom: 1rem;
  }
  .login-btn {
    width: 100%;
    padding: 0.95rem;
    background: ${C.green};
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(134,167,136,0.35);
    transition: transform 0.1s;
    margin-bottom: 0.9rem;
  }
  .login-btn:hover { transform: translateY(-1px); }
  .login-divider { text-align: center; font-size: 0.8rem; color: ${C.textMuted}; margin: 0.5rem 0; }
  .login-btn-outline {
    width: 100%;
    padding: 0.85rem;
    background: transparent;
    color: ${C.green};
    border: 1.5px solid ${C.green};
    border-radius: 12px;
    font-size: 0.92rem;
    font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif;
    cursor: pointer;
    transition: background 0.13s;
  }
  .login-btn-outline:hover { background: ${C.greenPale}; }
  .login-footer {
    margin-top: 2rem;
    font-size: 0.78rem;
    color: ${C.textMuted};
    text-align: center;
    line-height: 1.6;
  }
`;

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
    if (!name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!phone.trim()) { setError("전화번호를 입력해주세요."); return; }

    // 기존 프로필 있으면 이름/전화번호만 업데이트, 없으면 회원가입 페이지로
    const existing = localStorage.getItem("user_profile");
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.name === name.trim()) {
        navigate("/user");
      } else {
        setError("등록된 이름과 다릅니다. 처음 사용하시면 아래 버튼을 눌러주세요.");
      }
    } else {
      // 이름 + 전화번호만 임시 저장 후 회원가입으로
      localStorage.setItem("login_temp", JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      navigate("/signup");
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="login-root">

        <div className="login-left">
          <div className="login-logo">🌿 우리 woori</div>
          <div className="login-tagline">취약계층 AI 통합 돌봄 플랫폼</div>
          <div className="login-features">
            {FEATURES.map((f, i) => (
              <div key={i} className="login-feature">
                <div className="login-feature-icon">{f.icon}</div>
                <div>
                  <div className="login-feature-title">{f.title}</div>
                  <div className="login-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-right">
          <div className="login-box">
            <div className="login-title">안녕하세요 👋</div>
            <div className="login-sub">이름과 전화번호를 입력하고<br />서비스를 시작해보세요!</div>

            {error && <div className="login-error">⚠️ {error}</div>}

            <label className="login-label">이름</label>
            <input
              className="login-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="홍길동"
              onKeyDown={e => e.key === "Enter" && handleStart()}
            />
            <label className="login-label">전화번호</label>
            <input
              className="login-input"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              onKeyDown={e => e.key === "Enter" && handleStart()}
            />

            <button className="login-btn" onClick={handleStart}>
              🌿 서비스 시작하기
            </button>
            <div className="login-divider">처음 사용하시나요?</div>
            <button className="login-btn-outline" onClick={() => navigate("/signup")}>
              📋 정보 등록하기
            </button>
            <div className="login-footer">
              케어링은 어르신의 안전하고 건강한 일상을<br />
              AI 기술로 함께 지켜드립니다.
            </div>
          </div>
        </div>

      </div>
    </>
  );
}