import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";

const WELFARE_WORKERS_STORAGE_KEY = "welfareWorkers";
const DEMO_WORKER_ID = "welfare01";

const SEOUL_WELFARE_CENTERS = [
  "강남구립행복요양원", "강남노인복지관", "강동노인종합복지관",
  "강북노인종합복지관", "강서노인종합복지관", "관악노인종합복지관",
  "광진노인종합복지관", "구로노인종합복지관", "금천노인종합복지관",
  "노원노인종합복지관", "도봉노인종합복지관", "동대문노인종합복지관",
  "동작노인종합복지관", "마포노인종합복지관", "서대문노인복지관",
  "서초노인종합복지관", "성동노인종합복지관", "성북노인종합복지관",
  "송파노인종합복지관", "양천노인종합복지관", "영등포노인복지관",
  "용산노인종합복지관", "은평노인종합복지관", "종로노인종합복지관",
  "중구노인종합복지관", "중랑노인종합복지관",
  "서울시립어르신돌봄센터", "서울시복지재단", "우리복지센터",
];

const FEATURES = [
  { icon: "계정", title: "복지사 계정 생성", desc: "복지사 아이디와 비밀번호로 전용 계정을 만듭니다" },
  { icon: "관리", title: "대상자 관리 접근", desc: "가입 후 바로 복지사 대상자 관리 화면으로 이동합니다" },
  { icon: "연동", title: "추후 API 전환", desc: "현재는 브라우저 저장소를 사용하고 API 연동 구조를 유지합니다" },
  { icon: "보관", title: "로컬 저장", desc: "저장된 계정은 현재 브라우저에서만 사용할 수 있습니다" },
];

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
    <main className="login-root">
      <section className="login-left">
        <div className="login-logo">우리 woori</div>
        <div className="login-tagline">복지사 회원가입</div>

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
          <div className="login-title">복지사 회원가입</div>
          <div className="login-sub">
            복지사 아이디 기반 계정을 만들고
            <br />
            대상자 관리 화면으로 이동합니다.
          </div>

          {error && <div className="login-error">{error}</div>}

          <label className="login-label">이름</label>
          <input
            className="login-input"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="김복지"
          />

          <label className="login-label">복지사 아이디</label>
          <input
            className="login-input"
            value={form.workerId}
            onChange={(event) => set("workerId", event.target.value)}
            placeholder="worker01"
          />

          <label className="login-label">소속 기관</label>
          <div style={{ position: "relative" }}>
            <input
              className="login-input"
              value={form.center}
              onChange={(event) => set("center", event.target.value)}
              placeholder="복지관 이름 검색"
            />
            {form.center.trim().length > 0 && !SEOUL_WELFARE_CENTERS.includes(form.center.trim()) && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: "160px",
                overflowY: "auto",
                backgroundColor: "white",
                border: "1px solid #DCD8CC",
                borderRadius: "8px",
                marginTop: "4px",
                zIndex: 10,
              }}>
                {SEOUL_WELFARE_CENTERS
                  .filter((c) => c.includes(form.center.trim()))
                  .map((center) => (
                    <button
                      type="button"
                      key={center}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "10px 14px",
                        border: "none",
                        backgroundColor: "transparent",
                        textAlign: "left",
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                      onClick={() => set("center", center)}
                    >
                      {center}
                    </button>
                  ))
                }
                {SEOUL_WELFARE_CENTERS.filter((c) => c.includes(form.center.trim())).length === 0 && (
                  <p style={{ margin: 0, padding: "10px 14px", color: "#666", fontSize: "13px" }}>
                    검색 결과가 없습니다. 직접 입력해주세요.
                  </p>
                )}
              </div>
            )}
          </div>

          <label className="login-label">비밀번호</label>
          <input
            className="login-input"
            type="password"
            value={form.password}
            onChange={(event) => set("password", event.target.value)}
            placeholder="비밀번호"
          />

          <label className="login-label">비밀번호 확인</label>
          <input
            className="login-input"
            type="password"
            value={form.passwordConfirm}
            onChange={(event) => set("passwordConfirm", event.target.value)}
            placeholder="비밀번호 확인"
            onKeyDown={(event) => event.key === "Enter" && handleSignup()}
          />

          <button className="login-btn" type="button" onClick={handleSignup}>
            회원가입
          </button>

          <button
            className="login-btn-outline"
            type="button"
            onClick={() => navigate("/welfare-login")}
          >
            로그인으로 돌아가기
          </button>

          <div className="login-footer">
            저장된 계정은 현재 브라우저에서만 사용할 수 있습니다.
          </div>
        </div>
      </section>
    </main>
  );
}
