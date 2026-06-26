import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerGuardian } from '../../api/guardianAuthApi.js';

const INIT = { name: '', phone: '', password: '', passwordConfirm: '', relationship: '', email: '' };

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
};

export default function GuardianRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INIT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => {
    const value = field === 'phone' ? formatPhone(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await registerGuardian({
        name: form.name,
        phone: form.phone,
        password: form.password,
        relationship: form.relationship,
        email: form.email,
      });
      navigate('/guardian/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: 420 }}>
        <div className="auth-logo">
          <div className="auth-logo-title">WOORI LINK</div>
          <div className="auth-logo-sub">보호자 회원가입</div>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { label: '이름 *', field: 'name', placeholder: '홍길동', required: true },
            { label: '전화번호 *', field: 'phone', placeholder: '010-0000-0000', required: true, type: 'tel', inputMode: 'numeric', maxLength: 13 },
            { label: '비밀번호 *', field: 'password', placeholder: '8자 이상', required: true, type: 'password' },
            { label: '비밀번호 확인 *', field: 'passwordConfirm', placeholder: '비밀번호 재입력', required: true, type: 'password' },
            { label: '어르신과의 관계', field: 'relationship', placeholder: '예) 아들, 딸, 배우자' },
            { label: '이메일', field: 'email', placeholder: 'example@email.com', type: 'email' },
          ].map(({ label, field, placeholder, required, type = 'text', inputMode, maxLength }) => (
            <div key={field} className="auth-field">
              <label className="auth-label">{label}</label>
              <input
                className="auth-input"
                type={type}
                value={form[field]}
                onChange={set(field)}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
                required={required}
              />
            </div>
          ))}

          {error && <div className="auth-alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-footer">
          이미 계정이 있으신가요? <Link to="/guardian/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
