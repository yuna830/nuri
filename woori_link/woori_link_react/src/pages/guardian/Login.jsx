import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { guardianLogin, resetGuardianPassword } from '../../api/guardianAuthApi.js';
import '../../css/guardian/Login.css';
import '../../css/welfare/Login.css';
import { saveUser } from '../../utils/auth.js';

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

export default function GuardianLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;

  const savedPhone = localStorage.getItem('guardianSavedPhone') || '';
  const [form, setForm] = useState({ phone: savedPhone, password: '' });
  const [rememberPhone, setRememberPhone] = useState(Boolean(savedPhone));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetForm, setResetForm] = useState({
    name: '',
    phone: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [resetMsg, setResetMsg] = useState('');

  const handlePhoneChange = (e) => {
    setForm({ ...form, phone: formatPhone(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await guardianLogin(form.phone, form.password);
      if (data.role !== 'GUARDIAN') {
        setError('보호자 계정으로만 로그인할 수 있습니다.');
        return;
      }
      if (rememberPhone) localStorage.setItem('guardianSavedPhone', form.phone);
      else localStorage.removeItem('guardianSavedPhone');
      saveUser(data);
      navigate('/guardian');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPhoneChange = (e) => {
    setResetForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }));
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setResetMsg('');

    if (resetForm.newPassword !== resetForm.newPasswordConfirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await resetGuardianPassword({
        name: resetForm.name,
        phone: resetForm.phone,
        newPassword: resetForm.newPassword,
      });

      setResetMsg('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.');
      setShowReset(false);
      setForm((prev) => ({ ...prev, phone: resetForm.phone, password: '' }));
    } catch (err) {
      setError(err.response?.data?.message || '비밀번호 재설정에 실패했습니다.');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <header className="auth-logo">
          <div className="auth-logo-title">WOORI</div>
          <div className="auth-logo-sub">보호자 서비스</div>
        </header>

        <div className="auth-card">

        {registered && (
          <div className="auth-alert-success">
            회원가입이 완료되었습니다. 로그인해주세요.
          </div>
        )}

        {resetMsg && (
          <div className="auth-alert-success">
            {resetMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="guardianPhone">전화번호</label>
            <input
              className="auth-input"
              id="guardianPhone"
              type="tel"
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              inputMode="numeric"
              maxLength={13}
              required
            />
          </div>

          <div className="auth-field" style={{ marginBottom: 20 }}>
            <label className="auth-label" htmlFor="guardianPassword">비밀번호</label>
            <input
              className="auth-input"
              id="guardianPassword"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && (
            <div className="auth-alert-error">
              {error}
            </div>
          )}

          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberPhone}
              onChange={(e) => setRememberPhone(e.target.checked)}
            />
            <span>전화번호 저장</span>
          </label>

          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        </div>

        <div className="auth-footer">
          <button type="button" className="guardian-text-button" onClick={() => setShowReset(true)}>
            비밀번호 찾기
          </button>
          <span className="auth-footer-divider" aria-hidden="true">|</span>
          <Link to="/guardian/register">회원가입</Link>
        </div>

        {showReset && (
          <div className="guardian-modal-backdrop" onClick={() => setShowReset(false)}>
            <div className="guardian-modal" onClick={(e) => e.stopPropagation()}>
              <div className="guardian-modal-header">
                <h2>비밀번호 찾기</h2>
                <button type="button" onClick={() => setShowReset(false)}>
                  ×
                </button>
              </div>

              <form onSubmit={handleResetPassword}>
                <div className="guardian-login-field">
                  <label htmlFor="resetName">이름</label>
                  <input
                    id="resetName"
                    type="text"
                    value={resetForm.name}
                    onChange={(e) => setResetForm({ ...resetForm, name: e.target.value })}
                    placeholder="이름을 입력하세요"
                    required
                  />
                </div>

                <div className="guardian-login-field">
                  <label htmlFor="resetPhone">전화번호</label>
                  <input
                    id="resetPhone"
                    type="tel"
                    value={resetForm.phone}
                    onChange={handleResetPhoneChange}
                    placeholder="010-0000-0000"
                    inputMode="numeric"
                    maxLength={13}
                    required
                  />
                </div>

                <div className="guardian-login-field">
                  <label htmlFor="newPassword">새 비밀번호</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    placeholder="새 비밀번호를 입력하세요"
                    required
                  />
                </div>

                <div className="guardian-login-field">
                  <label htmlFor="newPasswordConfirm">새 비밀번호 확인</label>
                  <input
                    id="newPasswordConfirm"
                    type="password"
                    value={resetForm.newPasswordConfirm}
                    onChange={(e) => setResetForm({ ...resetForm, newPasswordConfirm: e.target.value })}
                    placeholder="새 비밀번호를 다시 입력하세요"
                    required
                  />
                </div>

                <div className="guardian-reset-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowReset(false)}>
                    취소
                  </button>
                  <button type="submit" className="btn-primary">
                    재설정
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
