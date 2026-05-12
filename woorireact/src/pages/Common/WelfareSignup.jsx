import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/SignUp.css";
import { SEOUL_WELFARE_CENTERS, WELFARE_WORKERS_STORAGE_KEY } from "../../utils/welfare/welfareConstants";

const DEMO_WORKER_ID = "welfare01";

export default function WelfareSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    workerId: "",
    password: "",
    passwordConfirm: "",
    center: "",
  });
  const [error, setError] = useState("");

  const set = (key, value) => {
    setForm((previousForm) => ({ ...previousForm, [key]: value }));
  };

  const getSavedWorkers = () => {
    try {
      return JSON.parse(localStorage.getItem(WELFARE_WORKERS_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const handleSignup = () => {
    const name = form.name.trim();
    const workerId = form.workerId.trim();
    const password = form.password.trim();
    const passwordConfirm = form.passwordConfirm.trim();
    const center = form.center.trim() || "우리복지센터";

    if (!name) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!workerId) {
      setError("복지사 아이디를 입력해주세요.");
      return;
    }

    if (!/^[A-Za-z0-9_-]{4,20}$/.test(workerId)) {
      setError("복지사 아이디는 영문, 숫자, -, _ 조합 4~20자로 입력해주세요.");
      return;
    }

    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    if (password.length < 4) {
      setError("비밀번호는 4자 이상 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    const savedWorkers = getSavedWorkers();
    const isDuplicatedWorkerId =
      workerId === DEMO_WORKER_ID ||
      savedWorkers.some((worker) => worker.workerId === workerId);

    if (isDuplicatedWorkerId) {
      setError("이미 등록된 복지사 아이디입니다.");
      return;
    }

    const newWorker = {
      id: `W-${Date.now()}`,
      workerId,
      name,
      password,
      role: "복지사",
      center,
    };

    localStorage.setItem(
      WELFARE_WORKERS_STORAGE_KEY,
      JSON.stringify([...savedWorkers, newWorker])
    );

    const workerWithoutPassword = { ...newWorker };
    delete workerWithoutPassword.password;

    sessionStorage.setItem(
      "currentWelfareWorker",
      JSON.stringify({
        ...workerWithoutPassword,
        loginAt: new Date().toISOString(),
      })
    );

    navigate("/welfare");
  };

  return (
    <div className="su-root">
      <nav className="su-nav">
        <div className="su-nav-inner">
          <div className="su-nav-logo">🌿 우리 woori</div>

          <div className="su-nav-actions">
            <span className="su-nav-step">복지사 회원가입</span>
            <button
              className="su-nav-login"
              type="button"
              onClick={() => navigate("/welfare-login")}
            >
              로그인
            </button>
          </div>
        </div>
      </nav>

      <div className="su-layout">
        {error && <div className="su-error">⚠️ {error}</div>}

        <section className="su-section">
          <div className="su-section-title">복지사 회원가입</div>

          <div className="su-row">
            <div className="su-field">
              <label className="su-label">
                이름 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="예: 김복지"
              />
            </div>

            <div className="su-field">
              <label className="su-label">
                복지사 아이디 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.workerId}
                onChange={(event) => set("workerId", event.target.value)}
                placeholder="예: worker01"
              />
            </div>
          </div>

          <div className="su-row">
            <div className="su-field">
              <label className="su-label">
                비밀번호 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                type="password"
                value={form.password}
                onChange={(event) => set("password", event.target.value)}
                placeholder="비밀번호"
              />
            </div>

            <div className="su-field">
              <label className="su-label">
                비밀번호 확인 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                type="password"
                value={form.passwordConfirm}
                onChange={(event) => set("passwordConfirm", event.target.value)}
                placeholder="비밀번호 확인"
                onKeyDown={(event) => event.key === "Enter" && handleSignup()}
              />
            </div>
          </div>
        </section>

        <section className="su-section">
          <div className="su-section-title">소속 기관 정보</div>

          <div className="su-hint">
            소속 기관을 입력하면 복지사 계정 정보에 함께 저장됩니다. 검색 결과가 없으면 직접 입력할 수 있습니다.
          </div>

          <div className="su-field su-suggest-wrap">
            <label className="su-label">
              소속 기관 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.center}
              onChange={(event) => set("center", event.target.value)}
              placeholder="예: 우리복지센터"
            />
            {form.center.trim().length > 0 && !SEOUL_WELFARE_CENTERS.includes(form.center.trim()) && (
              <div className="su-suggest-list">
                {SEOUL_WELFARE_CENTERS
                  .filter((center) => center.includes(form.center.trim()))
                  .map((center) => (
                    <button
                      type="button"
                      key={center}
                      className="su-suggest-item"
                      onClick={() => set("center", center)}
                    >
                      {center}
                    </button>
                  ))
                }
                {SEOUL_WELFARE_CENTERS.filter((center) => center.includes(form.center.trim())).length === 0 && (
                  <p className="su-suggest-empty">
                    검색 결과가 없습니다. 직접 입력해주세요.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="su-btn-row su-btn-row-end">
          <button className="su-btn-next" type="button" onClick={handleSignup}>
            복지사 가입 완료
          </button>
        </div>
      </div>
    </div>
  );
}
