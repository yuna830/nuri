import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { signupAdmin } from "../../api/adminAuthApi";
import { formatPhoneNumber } from "../../utils/common/phone";
import "../../css/admin/AdminAuth.css";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

function AdminSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "이름을 입력해주세요.";
    if (!form.phone.trim()) return "전화번호를 입력해주세요.";
    if (!form.email.trim()) return "이메일을 입력해주세요.";
    if (form.password.length < 8) return "비밀번호는 8자 이상 입력해주세요.";
    if (form.password !== form.passwordConfirm) return "비밀번호가 일치하지 않습니다.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);

    if (validationError) return;

    try {
      setIsSubmitting(true);
      await signupAdmin({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      alert("회원가입 신청이 완료되었습니다. 승인 후 로그인할 수 있습니다.");
      navigate("/admin/login");
    } catch (requestError) {
      if (requestError.status === 409) {
        setError("이미 가입된 이메일입니다.");
      } else {
        setError("회원가입에 실패했습니다. 입력 내용을 확인해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card admin-auth-card-wide" aria-labelledby="admin-signup-title">
        <div className="admin-auth-brand">woori admin</div>
        <h1 id="admin-signup-title">관리자 회원가입</h1>

        <form onSubmit={handleSubmit}>
          <label className="admin-auth-label" htmlFor="admin-name">이름</label>
          <input
            id="admin-name"
            className="admin-auth-input"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="이름"
            autoComplete="name"
          />

          <label className="admin-auth-label" htmlFor="admin-phone">전화번호</label>
          <input
            id="admin-phone"
            className="admin-auth-input"
            value={form.phone}
            onChange={(event) => updateForm("phone", formatPhoneNumber(event.target.value))}
            placeholder="010-0000-0000"
            autoComplete="tel"
          />

          <label className="admin-auth-label" htmlFor="admin-signup-email">이메일</label>
          <input
            id="admin-signup-email"
            className="admin-auth-input"
            type="email"
            value={form.email}
            onChange={(event) => updateForm("email", event.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
          />

          <div className="admin-auth-grid">
            <div>
              <label className="admin-auth-label" htmlFor="admin-signup-password">비밀번호</label>
              <input
                id="admin-signup-password"
                className="admin-auth-input"
                type="password"
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
                placeholder="8자 이상"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="admin-auth-label" htmlFor="admin-password-confirm">비밀번호 확인</label>
              <input
                id="admin-password-confirm"
                className="admin-auth-input"
                type="password"
                value={form.passwordConfirm}
                onChange={(event) => updateForm("passwordConfirm", event.target.value)}
                placeholder="비밀번호 재입력"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p className="admin-auth-error">{error}</p>}

          <button className="admin-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "가입 신청 중..." : "회원가입"}
          </button>
        </form>

        <p className="admin-auth-footer">
          이미 관리자 계정이 있으신가요?
          <Link to="/admin/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}

export default AdminSignup;
