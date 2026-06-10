import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginAdmin } from "../../api/adminAuthApi";
import "../../css/admin/AdminAuth.css";

function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ loginId: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.loginId.trim() || !form.password) {
      setError("관리자 아이디와 비밀번호를 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const admin = await loginAdmin({
        loginId: form.loginId.trim(),
        password: form.password,
      });
      sessionStorage.setItem("currentAdmin", JSON.stringify(admin));
      navigate("/admin");
    } catch (requestError) {
      const errorDescription = [
        requestError.message,
        requestError.detail,
        requestError.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const isRejected =
        requestError.status === 423 ||
        /rejected|reject|denied|거절/.test(errorDescription);
      const isPending =
        requestError.status === 403 ||
        /pending|not approved|unapproved|approval required|승인 대기|미승인|승인되지/.test(
          errorDescription,
        );

      if (isRejected) {
        setError("관리자 가입 승인이 거절된 계정입니다.");
      } else if (isPending) {
        setError("아직 관리자 승인이 완료되지 않은 계정입니다.");
      } else if (requestError.status === 401) {
        setError("관리자 아이디 또는 비밀번호를 확인해주세요.");
      } else {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <div className="admin-auth-brand">woori admin</div>
        <h1 id="admin-login-title">관리자 로그인</h1>

        <form onSubmit={handleSubmit}>
          <label className="admin-auth-label" htmlFor="admin-login-id">관리자 아이디</label>
          <input
            id="admin-login-id"
            className="admin-auth-input"
            value={form.loginId}
            onChange={(event) => updateForm("loginId", event.target.value)}
            placeholder="admin"
            autoComplete="username"
          />

          <label className="admin-auth-label" htmlFor="admin-password">비밀번호</label>
          <input
            id="admin-password"
            className="admin-auth-input"
            type="password"
            value={form.password}
            onChange={(event) => updateForm("password", event.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
          />

          {error && <p className="admin-auth-error">{error}</p>}

          <button className="admin-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="admin-auth-footer">
          관리자 계정이 없으신가요?
          <Link to="/admin/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}

export default AdminLogin;
