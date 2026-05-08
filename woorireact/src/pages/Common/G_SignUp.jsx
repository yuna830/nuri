import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/SignUp.css";

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  passwordConfirm: "",
  seniorName: "",
  seniorAddress: "",
  seniorRelation: "",
};

export default function GuardianSignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "보호자 이름을 입력해주세요.";
    if (!form.phone.trim()) return "보호자 연락처를 입력해주세요.";
    if (!form.email.trim()) return "이메일을 입력해주세요.";
    if (!form.password.trim()) return "비밀번호를 입력해주세요.";
    if (form.password !== form.passwordConfirm) return "비밀번호가 일치하지 않습니다.";

    if (!form.seniorName.trim()) return "관리할 사용자 이름을 입력해주세요.";
    if (!form.seniorAddress.trim()) return "관리할 사용자 주소를 입력해주세요.";
    if (!form.seniorRelation.trim()) return "사용자와의 관계를 입력해주세요.";

    return "";
  };

  const handleSubmit = async () => {
    const validationMessage = validate();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");

    const response = await fetch("http://localhost:8080/api/guardians/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        seniorName: form.seniorName,
        seniorAddress: form.seniorAddress,
        seniorRelation: form.seniorRelation,
      }),
    });

    if (!response.ok) {
      setError("회원가입에 실패했습니다. 이미 가입된 이메일인지 확인해주세요.");
      return;
    }

    navigate("/glogin");
  };

  return (
    <div className="su-root">
      <nav className="su-nav">
        <div className="su-nav-logo">🌿 케어링 CaRing</div>
        <div className="su-nav-step">보호자 계정 등록</div>
      </nav>

      <div className="su-layout">
        {error && <div className="su-error">⚠️ {error}</div>}

        <div className="su-section">
          <div className="su-section-title">보호자 회원가입</div>

          <div className="su-field">
            <label className="su-label">
              이름 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="김민지"
            />
          </div>

          <div className="su-field">
            <label className="su-label">
              연락처 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="010-0000-0000"
            />
          </div>

          <div className="su-field">
            <label className="su-label">
              이메일 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="guardian@example.com"
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
              />
            </div>
          </div>
        </div>

        <div className="su-section">
          <div className="su-section-title">관리 대상자 정보</div>

          <div className="su-field">
            <label className="su-label">
              사용자 이름 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.seniorName}
              onChange={(event) => set("seniorName", event.target.value)}
              placeholder="이영희"
            />
          </div>

          <div className="su-field">
            <label className="su-label">
              사용자 주소 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.seniorAddress}
              onChange={(event) => set("seniorAddress", event.target.value)}
              placeholder="서울시 강남구 역삼동"
            />
          </div>

          <div className="su-field">
            <label className="su-label">
              관계 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.seniorRelation}
              onChange={(event) => set("seniorRelation", event.target.value)}
              placeholder="어머니"
            />
          </div>
        </div>

        <div className="su-btn-row">
          <button
            className="su-btn-prev"
            type="button"
            onClick={() => navigate("/glogin")}
          >
            ← 로그인으로
          </button>

          <button className="su-btn-next" type="button" onClick={handleSubmit}>
            보호자 가입 완료
          </button>
        </div>
      </div>
    </div>
  );
}
