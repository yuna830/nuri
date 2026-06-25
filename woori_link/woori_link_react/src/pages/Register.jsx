import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerWelfareWorker } from '../api/authApi.js';

const INIT = { name: '', phone: '', password: '', passwordConfirm: '', organization: '', email: '' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INIT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      await registerWelfareWorker({
        name: form.name,
        phone: form.phone,
        password: form.password,
        organization: form.organization,
        email: form.email,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-page)', padding: '24px',
    }}>
      <div className="card" style={{ width: 420, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>WOORI LINK</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>복지사 회원가입</div>
        </div>
        <form onSubmit={handleSubmit}>
          {[
            { label: '이름 *', field: 'name', placeholder: '홍길동', required: true },
            { label: '전화번호 *', field: 'phone', placeholder: '010-0000-0000', required: true },
            { label: '비밀번호 *', field: 'password', placeholder: '8자 이상', required: true, type: 'password' },
            { label: '비밀번호 확인 *', field: 'passwordConfirm', placeholder: '비밀번호 재입력', required: true, type: 'password' },
            { label: '소속 기관', field: 'organization', placeholder: '○○복지관' },
            { label: '이메일', field: 'email', placeholder: 'example@email.com', type: 'email' },
          ].map(({ label, field, placeholder, required, type = 'text' }) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                {label}
              </label>
              <input
                type={type}
                value={form[field]}
                onChange={set(field)}
                placeholder={placeholder}
                required={required}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}

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
            style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 4 }}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>로그인</Link>
        </div>
      </div>
    </div>
  );
}
