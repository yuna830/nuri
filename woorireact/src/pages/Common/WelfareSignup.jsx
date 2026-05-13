import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/SignUp.css";

const AUTH_API_BASE = "http://localhost:8080";
const WELFARE_API_BASE = "http://localhost:8181";

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
  const [centerResults, setCenterResults] = useState([]);
  const [centerSearchMessage, setCenterSearchMessage] = useState("");

  const set = (key, value) => {
    setForm((previousForm) => ({ ...previousForm, [key]: value }));
  };

  const handleCenterSearch = async () => {
    const keyword = form.center.trim();

    if (keyword.length < 2) {
      setError("소속 기관명을 2글자 이상 입력해주세요.");
      return;
    }

    try {
      setCenterResults([]);
      setCenterSearchMessage("");

      const response = await fetch(
        `${WELFARE_API_BASE}/api/welfare-centers?keyword=${encodeURIComponent(keyword)}`
      );

      if (!response.ok) {
        setError("소속 기관 검색에 실패했습니다.");
        return;
      }

      const centers = await response.json();
      setCenterResults(centers);

      if (centers.length === 0) {
        setError("");
        setCenterSearchMessage("검색 결과가 없습니다. 직접 입력할 수 있습니다.");
        return;
      }

      setError("");
      setCenterSearchMessage("");
    } catch {
      setError("서버에 연결할 수 없습니다.");
    }
  };

  const handleSignup = async () => {
    const name = form.name.trim();
    const workerId = form.workerId.trim();
    const password = form.password.trim();
    const passwordConfirm = form.passwordConfirm.trim();
    const center = form.center.trim();

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

    if (!center) {
      setError("소속 기관을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API_BASE}/api/welfare-workers/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          workerId,
          password,
          center,
          role: "복지사",
        }),
      });

      if (response.status === 409) {
        setError("이미 등록된 복지사 아이디입니다.");
        return;
      }

      if (!response.ok) {
        setError("회원가입에 실패했습니다.");
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
      setError("서버에 연결할 수 없습니다.");
    }
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

          <div className="su-field">
            <label className="su-label">
              이름 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="이름을 입력하세요"
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
                placeholder="비밀번호를 입력하세요"
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
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          </div>

          <div className="su-field su-suggest-wrap">
            <label className="su-label">
              소속 기관 <span className="su-required">*</span>
            </label>

            <div className="su-search-row">
              <input
                className="su-input"
                value={form.center}
                onChange={(event) => {
                  set("center", event.target.value);
                  setCenterResults([]);
                  setCenterSearchMessage("");
                }}
                placeholder="예: 우리복지센터"
                onKeyDown={(event) => event.key === "Enter" && handleCenterSearch()}
              />

              <button
                className="su-search-btn"
                type="button"
                onClick={handleCenterSearch}
              >
                검색
              </button>
            </div>

            {centerSearchMessage && (
              <p className="su-suggest-empty">{centerSearchMessage}</p>
            )}

            {centerResults.length > 0 && (
              <div className="su-suggest-list">
                {centerResults.map((center) => (
                  <button
                    type="button"
                    key={`${center.code}-${center.name}`}
                    className="su-suggest-item"
                    onClick={() => {
                      set("center", center.name);
                      setCenterResults([]);
                      setCenterSearchMessage("");
                    }}
                  >
                    <strong>{center.name}</strong>
                    {center.type && <span>{center.type}</span>}
                  </button>
                ))}
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
