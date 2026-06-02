import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";
import { formatPhoneNumber } from "../../utils/common/phone.js";

import { SPRING_API_BASE } from "../../config/api.js";

const API_BASE = SPRING_API_BASE;

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

  const [helpMode, setHelpMode] = useState(null);
  const [helpForm, setHelpForm] = useState({
    name: "",
    phone: "",
    email: "",
    newPassword: "",
  });
  const [helpResult, setHelpResult] = useState("");
  const [helpError, setHelpError] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  const handleLogin = async () => {
    setError("");

    if (!form.email.trim()) {
      alert("이메일을 입력해주세요.");
      return;
    }

    if (!form.password.trim()) {
      alert("비밀번호를 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/guardians/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError("\ube44\ud65c\uc131\ud654\ub41c \uacc4\uc815\uc785\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694.");
        } else {
          setError("\uc774\uba54\uc77c \ub610\ub294 \ube44\ubc00\ubc88\ud638\ub97c \ud655\uc778\ud574\uc8fc\uc138\uc694.");
        }
        return;
      }

      const guardian = await response.json();

      sessionStorage.setItem("currentGuardian", JSON.stringify(guardian));
      navigate("/guardian");
    } catch {
      setError("\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.");
    }
  };

  const openHelpModal = (mode) => {
    setHelpMode(mode);
    setHelpForm({
      name: "",
      phone: "",
      email: "",
      newPassword: "",
    });
    setHelpResult("");
    setHelpError("");
  };

  const closeHelpModal = () => {
    setHelpMode(null);
    setHelpForm({
      name: "",
      phone: "",
      email: "",
      newPassword: "",
    });
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

      if (helpMode === "email") {
        if (!helpForm.name.trim()) {
          setHelpError("가입한 이름을 입력해주세요.");
          return;
        }

        if (!helpForm.phone.trim()) {
          setHelpError("가입한 전화번호를 입력해주세요.");
          return;
        }

        const response = await fetch(`${API_BASE}/api/guardians/find-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: helpForm.name,
            phone: helpForm.phone,
          }),
        });

        if (!response.ok) {
          setHelpError("일치하는 보호자 계정을 찾을 수 없습니다.");
          return;
        }

        const result = await response.json();
        setHelpResult(`가입된 이메일은 ${result.email} 입니다.`);
        return;
      }

      if (!helpForm.email.trim()) {
        setHelpError("가입한 이메일을 입력해주세요.");
        return;
      }

      if (!helpForm.phone.trim()) {
        setHelpError("가입한 전화번호를 입력해주세요.");
        return;
      }

      if (!helpForm.newPassword.trim()) {
        setHelpError("새 비밀번호를 입력해주세요.");
        return;
      }

      if (!passwordPattern.test(helpForm.newPassword.trim())) {
        setHelpError("비밀번호는 영문과 숫자를 포함해 6자 이상 입력해주세요.");
        return;
      }

      const response = await fetch(`${API_BASE}/api/guardians/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: helpForm.email,
          phone: helpForm.phone,
          newPassword: helpForm.newPassword,
        }),
      });

      if (!response.ok) {
        setHelpError("입력한 정보가 일치하지 않거나 비밀번호가 너무 짧습니다.");
        return;
      }

      setHelpResult("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.");
    } catch {
      setHelpError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setHelpLoading(false);
    }
  };

  return (
    <div className="login-page login-guardian">
      <nav className="login-nav">
        <div className="login-nav-inner">
          <div className="login-nav-logo">🌿 우리 woori</div>

          <div className="login-nav-actions">
            <span className="login-nav-step">보호자 로그인</span>
            <button
              className="login-nav-button"
              type="button"
              onClick={() => navigate("/gsignup")}
            >
              회원가입
            </button>
          </div>
        </div>
      </nav>

      <main className="login-root login-guardian">
        <section className="login-left">
          <div className="login-logo">🌿 우리 woori</div>
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
              우리는 보호자와 어르신을 연결해
              <br />
              더 안전한 돌봄을 돕습니다.
            </div>

            {error && <div className="login-error">{error}</div>}

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
              placeholder="영문과 숫자를 포함해 6자 이상 입력하세요"
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

            <div className="login-footer login-help-actions">
              <button
                className="login-help-link"
                type="button"
                onClick={() => openHelpModal("email")}
              >
                이메일 찾기
              </button>

              <span />

              <button
                className="login-help-link"
                type="button"
                onClick={() => openHelpModal("password")}
              >
                비밀번호 찾기
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
                <h2>{helpMode === "email" ? "이메일 찾기" : "비밀번호 재설정"}</h2>
                <p>
                  {helpMode === "email"
                    ? "가입한 이름과 전화번호로 이메일을 확인합니다."
                    : "가입한 이메일과 전화번호를 확인한 뒤 새 비밀번호로 변경합니다."}
                </p>
              </div>

              <button className="login-modal-close" type="button" onClick={closeHelpModal}>
                X
              </button>
            </div>

            {helpMode === "email" ? (
              <>
                <label className="login-label">이름</label>
                <input
                  className="login-input"
                  value={helpForm.name}
                  onChange={(event) => setHelp("name", event.target.value)}
                  placeholder="이름을 입력하세요"
                />

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
                <label className="login-label">이메일</label>
                <input
                  className="login-input"
                  value={helpForm.email}
                  onChange={(event) => setHelp("email", event.target.value)}
                  placeholder="guardian@example.com"
                />

                <label className="login-label">전화번호</label>
                <input
                  className="login-input"
                  value={helpForm.phone}
                  onChange={(event) => setHelp("phone", event.target.value)}
                  placeholder="예: 010-0000-0000"
                />

                <label className="login-label">새 비밀번호</label>
                <input
                  className="login-input"
                  type="password"
                  value={helpForm.newPassword}
                  onChange={(event) => setHelp("newPassword", event.target.value)}
                  placeholder="영문과 숫자를 포함해 6자 이상 입력하세요"
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
