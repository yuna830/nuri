import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatPhoneNumber } from "../../utils/common/phone.js";
import "../../css/common/Login.css";

const API_BASE = "http://localhost:8080";

const FEATURES = [
  { icon: "🚨", title: "긴급 상황 알림", desc: "SOS와 위치 정보를 보호자에게 빠르게 전달해요" },
  { icon: "🌡", title: "기후 위험 안내", desc: "폭염, 한파, 미세먼지 같은 위험 정보를 확인해요" },
  { icon: "📍", title: "현재 위치 확인", desc: "안전 반경 이탈 여부를 쉽게 볼 수 있어요" },
  { icon: "💼", title: "맞춤 일자리", desc: "건강과 활동 조건에 맞는 공고를 찾아요" },
];

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [helpMode, setHelpMode] = useState(null);
  const [helpForm, setHelpForm] = useState({
    phone: "",
    name: "",
    region: "",
  });
  const [helpResult, setHelpResult] = useState("");
  const [helpError, setHelpError] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);

  const handleStart = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!trimmedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:8080/api/seniors/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
      });

      if (response.ok) {
        const profile = await response.json();

        sessionStorage.setItem("currentSenior", JSON.stringify(profile));
        localStorage.setItem("current_senior_id", String(profile?.senior?.id || ""));
        localStorage.removeItem("login_temp");

        navigate("/user");
        return;
      }

      localStorage.setItem("login_temp", JSON.stringify({ name: trimmedName, phone: trimmedPhone }));
      navigate("/signup");
    } catch (loginError) {
      console.error("사용자 로그인 실패:", loginError);
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const openHelpModal = (mode) => {
    setHelpMode(mode);
    setHelpForm({ phone: "", name: "", region: "" });
    setHelpResult("");
    setHelpError("");
  };

  const closeHelpModal = () => {
    setHelpMode(null);
    setHelpForm({ phone: "", name: "", region: "" });
    setHelpResult("");
    setHelpError("");
    setHelpLoading(false);
  };

  const setHelp = (key, value) => {
    setHelpForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleHelpSubmit = async () => {
    try {
      setHelpLoading(true);
      setHelpError("");
      setHelpResult("");

      if (helpMode === "name") {
        if (!helpForm.phone.trim()) {
          setHelpError("가입한 전화번호를 입력해주세요.");
          return;
        }

        const response = await fetch("http://localhost:8080/api/seniors/find-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: helpForm.phone }),
        });

        if (!response.ok) {
          setHelpError("일치하는 사용자 정보를 찾을 수 없습니다.");
          return;
        }

        const result = await response.json();
        setHelpResult(`가입된 이름은 ${result.name} 입니다.`);
        return;
      }

      if (!helpForm.name.trim()) {
        setHelpError("가입한 이름을 입력해주세요.");
        return;
      }

      if (!helpForm.region.trim()) {
        setHelpError("가입한 거주지를 입력해주세요.");
        return;
      }

      const response = await fetch("http://localhost:8080/api/seniors/find-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: helpForm.name,
          region: helpForm.region,
        }),
      });

      if (!response.ok) {
        setHelpError("일치하는 사용자 정보를 찾을 수 없습니다.");
        return;
      }

      const result = await response.json();
      setHelpResult(`가입된 전화번호는 ${result.phone} 입니다.`);
    } catch {
      setHelpError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setHelpLoading(false);
    }
  };

  return (
    <div className="login-page">
      <nav className="login-nav">
        <div className="login-nav-inner">
          <div className="login-nav-logo">🌿 우리 woori</div>

          <div className="login-nav-actions">
            <span className="login-nav-step">사용자 로그인</span>
            <button
              className="login-nav-button"
              type="button"
              onClick={() => navigate("/signup")}
            >
              정보 등록
            </button>
          </div>
        </div>
      </nav>

      <main className="login-root login-user">
        <section className="login-left">
          <div className="login-logo">🌿 우리 woori</div>
          <div className="login-tagline">노약자와 장애인을 위한 AI 통합 돌봄 서비스</div>

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
            <div className="login-title">사용자 로그인</div>
            <div className="login-sub">
              입력하신 정보는 돌봄 서비스 제공을
              <br />
              위해서만 사용됩니다.
            </div>

            {error && <div className="login-error">⚠️ {error}</div>}

            <label className="login-label">이름</label>
            <input
              className="login-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 김영희"
              onKeyDown={(event) => event.key === "Enter" && handleStart()}
            />

            <label className="login-label">전화번호</label>
            <input
              className="login-input"
              value={phone}
              onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
              placeholder="예: 010-0000-0000"
              onKeyDown={(event) => event.key === "Enter" && handleStart()}
            />

            <button className="login-btn" type="button" onClick={handleStart} disabled={loading}>
              {loading ? "확인 중..." : "서비스 시작하기"}
            </button>

            <div className="login-divider">처음 사용하시나요?</div>

            <button
              className="login-btn-outline"
              type="button"
              onClick={() => navigate("/signup")}
            >
              사용자 정보 등록하기
            </button>

            <div className="login-footer login-help-actions">
              <button
                className="login-help-link"
                type="button"
                onClick={() => openHelpModal("name")}
              >
                이름 찾기
              </button>

              <span />

              <button
                className="login-help-link"
                type="button"
                onClick={() => openHelpModal("phone")}
              >
                전화번호 찾기
              </button>
            </div>
          </div>
        </section>
      </main>

      {helpMode && (
        <div className="login-modal-backdrop" onClick={closeHelpModal}>
          <section className="login-modal" onClick={(event) => event.stopPropagation()}>
            <div className="login-modal-header">
              <div>
                <h2>{helpMode === "name" ? "이름 찾기" : "전화번호 찾기"}</h2>
                <p>
                  {helpMode === "name"
                    ? "가입한 전화번호로 등록된 이름을 확인합니다."
                    : "가입한 이름과 거주지로 전화번호를 확인합니다."}
                </p>
              </div>

              <button className="login-modal-close" type="button" onClick={closeHelpModal}>
                ×
              </button>
            </div>

            {helpMode === "name" ? (
              <>
                <label className="login-label">전화번호</label>
                <input
                  className="login-input"
                  value={helpForm.phone}
                  onChange={(event) => setHelp("phone", formatPhoneNumber(event.target.value))}
                  placeholder="예: 010-0000-0000"
                />
              </>
            ) : (
              <>
                <label className="login-label">이름</label>
                <input
                  className="login-input"
                  value={helpForm.name}
                  onChange={(event) => setHelp("name", event.target.value)}
                  placeholder="예: 김영희"
                />

                <label className="login-label">거주지</label>
                <input
                  className="login-input"
                  value={helpForm.region}
                  onChange={(event) => setHelp("region", event.target.value)}
                  placeholder="예: 서울시 동작구"
                />
              </>
            )}

            {helpError && <div className="login-error">{helpError}</div>}
            {helpResult && <div className="login-help-result">{helpResult}</div>}

            <div className="login-modal-actions">
              <button className="login-modal-secondary" type="button" onClick={closeHelpModal}>
                닫기
              </button>
              <button className="login-modal-primary" type="button" onClick={handleHelpSubmit} disabled={helpLoading}>
                {helpLoading ? "확인 중..." : "확인"}
              </button>
            </div>
          </section>
        </div>
      )}
     </div> 
  );
}
