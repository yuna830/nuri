import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../../api/authApi.js';
import { saveUser } from '../../utils/auth.js';
import '../../css/welfare/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!registered) return;

    alert('회원가입이 완료되었습니다. 로그인해주세요.');
    navigate(location.pathname, { replace: true, state: {} });
  }, [registered, navigate, location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form.loginId, form.password);
      if (data.role !== 'WELFARE_WORKER') {
        alert('복지사 계정으로만 로그인할 수 있습니다.');
        return;
      }
      saveUser(data);
      navigate('/welfare');
    } catch (err) {
      alert(err.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-title">WOORI</div>
          <div className="auth-logo-sub">복지사 관리 시스템</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">아이디</label>
            <input
              className="auth-input"
              type="text"
              value={form.loginId}
              onChange={(e) => setForm({ ...form, loginId: e.target.value })}
              placeholder="아이디를 입력하세요"
              required
            />
          </div>
          <div className="auth-field" style={{ marginBottom: 20 }}>
            <label className="auth-label">비밀번호</label>
            <input
              className="auth-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="auth-footer">
          계정이 없으신가요? <Link to="/welfare/register">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
