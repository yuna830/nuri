import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../api/authApi.js';
import { saveUser } from '../utils/auth.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(form.phone, form.password);
      if (data.role !== 'WELFARE_WORKER') {
        setError('복지사 계정으로만 로그인할 수 있습니다.');
        return;
      }
      saveUser(data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-page)',
    }}>
      <div className="card" style={{ width: 360, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>WOORI LINK</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>복지사 관리 시스템</div>
        </div>

        {registered && (
          <div style={{
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            회원가입이 완료되었습니다. 로그인해주세요.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              전화번호
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              required
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="비밀번호를 입력하세요"
              required
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <div style={{
              background: 'var(--danger-light)', color: 'var(--danger)',
              borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15 }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          계정이 없으신가요?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>회원가입</Link>
        </div>
      </div>
    </div>
  );
}
