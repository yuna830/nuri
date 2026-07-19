import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerGuardian } from '../../api/guardianAuthApi.js';
import '../../css/guardian/Register.css';

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
      <div className="auth-card auth-card-wide guardian-register-card">
        <div className="auth-logo">
          <div className="auth-logo-title">WOORI LINK</div>
          <div className="auth-logo-sub">보호자 회원가입</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="auth-field guardian-register-name">
              <label className="auth-label">이름 *</label>
              <input className="auth-input" value={form.name} onChange={set('name')} placeholder="홍길동" required />
            </div>
            <div className="auth-field">
              <label className="auth-label">전화번호 *</label>
              <input className="auth-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" inputMode="numeric" maxLength={13} required />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">이메일</label>
            <input className="auth-input" type="email" value={form.email} onChange={set('email')} placeholder="example@email.com" />
          </div>

          <div className="form-row">
            <div className="auth-field">
              <label className="auth-label">비밀번호 *</label>
              <input className="auth-input" type="password" value={form.password} onChange={set('password')} placeholder="8자 이상" required />
            </div>
            <div className="auth-field">
              <label className="auth-label">비밀번호 확인 *</label>
              <input className="auth-input" type="password" value={form.passwordConfirm} onChange={set('passwordConfirm')} placeholder="비밀번호 재입력" required />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">어르신과의 관계</label>
            <input className="auth-input" value={form.relationship} onChange={set('relationship')} placeholder="예) 아들, 딸, 배우자" />
          </div>

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
