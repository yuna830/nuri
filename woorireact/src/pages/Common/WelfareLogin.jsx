import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";
import { SPRING_API_BASE } from "../../config/api.js";

const API_BASE = SPRING_API_BASE;


const welfareFeatures = [
  {
    icon: "📋",
    title: "대상자 상태 확인",
    description: "SOS, 일자리 요청, 위치 상태를 확인",
  },
  {
    icon: "📝",
    title: "복지사 소견 기록",
    description: "적합, 보류, 부적합 소견 처리",
  },
  {
    icon: "🔎",
    title: "필터와 검색",
    description: "요청 상태별 대상자 빠른 정리",
  },
  {
    icon: "📍",
    title: "상세정보 확인",
    description: "상담 기록과 GPS 정보 확인",
  },
];

export default function WelfareLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    workerId: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [helpMode, setHelpMode] = useState(null);
  const [helpForm, setHelpForm] = useState({
    name: "",
    center: "",
    workerId: "",
    newPassword: "",
  });
  const [helpResult, setHelpResult] = useState("");
  const [helpError, setHelpError] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);

  const set = (key, value) => {
    setForm((previousForm) => ({ ...previousForm, [key]: value }));
  };

  const handleLogin = async () => {
    setError("");

    const workerId = form.workerId.trim();
    const password = form.password.trim();

    if (!workerId) {
      alert("복지사 아이디를 입력해주세요.");
      return;
    }

    if (!password) {
      alert("비밀번호를 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/welfare-workers/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerId,
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError("\ube44\ud65c\uc131\ud654\ub41c \uacc4\uc815\uc785\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694.");
        } else {
          setError("\ubcf5\uc9c0\uc0ac \uc544\uc774\ub514 \ub610\ub294 \ube44\ubc00\ubc88\ud638\ub97c \ud655\uc778\ud574\uc8fc\uc138\uc694.");
        }
        return;
      }

      const worker = await response.json();

      sessionStorage.setItem(
        "currentWelfareWorker",
        JSON.stringify({
          ...worker,
          loginAt: new Date().toISOString(),
        })
      );

      navigate("/welfare");
    } catch {
      setError("\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.");
    }
  };

  const openHelpModal = (mode) => {
    setHelpMode(mode);
    setHelpForm({
      name: "",
      center: "",
      workerId: "",
      newPassword: "",
    });
    setHelpResult("");
    setHelpError("");
  };

  const closeHelpModal = () => {
    setHelpMode(null);
    setHelpForm({
      name: "",
      center: "",
      workerId: "",
      newPassword: "",
    });
    setHelpResult("");
    setHelpError("");
    setHelpLoading(false);
  };

  const setHelp = (key, value) => {
    setHelpForm((prev) => ({ ...prev, [key]: value }));
  };

  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  const handleHelpSubmit = async () => {
    try {
      setHelpLoading(true);
      setHelpError("");
      setHelpResult("");

      if (helpMode === "workerId") {
        if (!helpForm.name.trim()) {
          setHelpError("가입한 복지사 이름을 입력해주세요.");
          return;
        }

        if (!helpForm.center.trim()) {
          setHelpError("소속 기관명을 입력해주세요.");
          return;
        }

        const response = await fetch(`${API_BASE}/api/welfare-workers/find-id`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: helpForm.name.trim(),
            center: helpForm.center.trim(),
          }),
        });

        if (!response.ok) {
          setHelpError("일치하는 복지사 계정을 찾을 수 없습니다.");
          return;
        }

        const result = await response.json();
        setHelpResult(`가입된 복지사 아이디는 ${result.workerId} 입니다.`);
        return;
      }

      if (!helpForm.workerId.trim()) {
        setHelpError("복지사 아이디를 입력해주세요.");
        return;
      }

      if (!helpForm.name.trim()) {
        setHelpError("가입한 복지사 이름을 입력해주세요.");
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

      const response = await fetch(`${API_BASE}/api/welfare-workers/reset-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerId: helpForm.workerId.trim(),
          name: helpForm.name.trim(),
          newPassword: helpForm.newPassword.trim(),
        }),
      });

      if (!response.ok) {
        setHelpError("일치하는 복지사 계정을 찾을 수 없습니다.");
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
    <div className="login-page login-welfare">
      <nav className="login-nav">
        <div className="login-nav-inner">
          <div className="login-nav-logo">🌿 우리 woori</div>

          <div className="login-nav-actions">
            <span className="login-nav-step">복지사 로그인</span>
            <button
              className="login-nav-button"
              type="button"
              onClick={() => navigate("/wsignup")}
            >
              회원가입
            </button>
          </div>
        </div>
      </nav>

      <main className="login-root login-welfare">
        <section className="login-left">
          <div className="login-logo">🌿 우리 woori</div>
          <div className="login-tagline">복지사를 위한 대상자 통합 관리</div>

          <div className="login-features">
            {welfareFeatures.map((feature) => (
              <div key={feature.title} className="login-feature">
                <div className="login-feature-icon">{feature.icon}</div>
                <div>
                  <div className="login-feature-title">{feature.title}</div>
                  <div className="login-feature-desc">{feature.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="login-right">
          <div className="login-box">
            <div className="login-title">복지사 로그인</div>
            <div className="login-sub">
              우리는 복지사와 어르신을 연결해
              <br />
              더 빠른 돌봄 관리를 돕습니다.
            </div>

            {error && <div className="login-error">{error}</div>}

            <label className="login-label">복지사 아이디</label>
            <input
              className="login-input"
              value={form.workerId}
              onChange={(event) => set("workerId", event.target.value)}
              placeholder="welfare01"
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
              복지사 로그인
            </button>

            <div className="login-divider">아직 복지사 계정이 없나요?</div>

            <button
              className="login-btn-outline"
              type="button"
              onClick={() => navigate("/wsignup")}
            >
              복지사 회원가입
            </button>

            <div className="login-footer login-help-actions">
              <button
                className="login-help-link"
                type="button"
                onClick={() => openHelpModal("workerId")}
              >
                아이디 찾기
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
                <h2>{helpMode === "workerId" ? "아이디 찾기" : "비밀번호 찾기"}</h2>
                <p>
                  {helpMode === "workerId"
                    ? "가입한 이름과 소속 기관명으로 복지사 아이디를 확인합니다."
                    : "복지사 아이디와 이름을 확인한 뒤 새 비밀번호로 변경합니다."}
                </p>
              </div>

              <button className="login-modal-close" type="button" onClick={closeHelpModal}>
                ×
              </button>
            </div>

            {helpMode === "workerId" ? (
              <>
                <label className="login-label">이름</label>
                <input
                  className="login-input"
                  value={helpForm.name}
                  onChange={(event) => setHelp("name", event.target.value)}
                  placeholder="예: 박정아"
                />

                <label className="login-label">소속 기관</label>
                <input
                  className="login-input"
                  value={helpForm.center}
                  onChange={(event) => setHelp("center", event.target.value)}
                  placeholder="예: 광진구 복지센터"
                />
              </>
            ) : (
              <>
                <label className="login-label">복지사 아이디</label>
                <input
                  className="login-input"
                  value={helpForm.workerId}
                  onChange={(event) => setHelp("workerId", event.target.value)}
                  placeholder="예: welfare01"
                />

                <label className="login-label">이름</label>
                <input
                  className="login-input"
                  value={helpForm.name}
                  onChange={(event) => setHelp("name", event.target.value)}
                  placeholder="예: 박정아"
                />

                <label className="login-label">새 비밀번호</label>
                <input
                  className="login-input"
                  type="password"
                  value={helpForm.newPassword}
                  onChange={(event) => setHelp("newPassword", event.target.value)}
                  placeholder="영문, 숫자 포함 6자 이상"
                />
              </>
            )}

            {helpError && <div className="login-error">{helpError}</div>}
            {helpResult && <div className="login-help-result">{helpResult}</div>}

            <div className="login-modal-actions">
              <button className="login-modal-secondary" type="button" onClick={closeHelpModal}>
                닫기
              </button>
              <button
                className="login-modal-primary"
                type="button"
                onClick={handleHelpSubmit}
                disabled={helpLoading}
              >
                {helpLoading ? "확인 중..." : "확인"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
