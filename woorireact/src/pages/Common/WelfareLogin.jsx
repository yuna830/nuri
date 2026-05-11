import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/Login.css";

const DEMO_WORKER = {
  id: "W-001",
  workerId: "welfare01",
  name: "김복지",
  role: "복지사",
  center: "우리복지센터",
};

const DEMO_PASSWORD = "1234";
const WELFARE_WORKERS_STORAGE_KEY = "welfareWorkers";

const FEATURES = [
  { icon: "관리", title: "대상자 상태 확인", desc: "SOS, 일자리 요청, 위치 상태를 한 화면에서 확인합니다" },
  { icon: "소견", title: "복지사 소견 기록", desc: "적합, 보류, 부적합 소견과 사유를 상세 화면에서 처리합니다" },
  { icon: "검색", title: "필터와 검색", desc: "요청 상태별로 대상자를 빠르게 찾고 정리합니다" },
  { icon: "상세", title: "상세정보 확인", desc: "상담 기록과 마지막 GPS 정보를 대상자별로 확인합니다" },
];

export default function WelfareLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    workerId: "",
    password: "",
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

  const handleLogin = () => {
    const workerId = form.workerId.trim();
    const password = form.password.trim();

    if (!workerId) {
      setError("복지사 아이디를 입력해주세요.");
      return;
    }

    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    const savedWorkers = getSavedWorkers();
    const savedWorker = savedWorkers.find(
      (worker) => worker.workerId === workerId && worker.password === password
    );
    const matchedWorker =
      workerId === DEMO_WORKER.workerId && password === DEMO_PASSWORD
        ? DEMO_WORKER
        : savedWorker;

    if (!matchedWorker) {
      setError("복지사 아이디 또는 비밀번호를 확인해주세요.");
      return;
    }

    const workerWithoutPassword = { ...matchedWorker };
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
          <div className="login-title">복지사 로그인</div>

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
            로그인
          </button>

          <div className="login-divider">아직 복지사 계정이 없나요?</div>

          <button
            className="login-btn-outline"
            type="button"
            onClick={() => navigate("/welfare-signup")}
          >
            복지사 회원가입
          </button>

          <div className="login-footer">
            데모 계정: welfare01 / 1234
          </div>
        </div>
      </section>
    </main>
  );
}
