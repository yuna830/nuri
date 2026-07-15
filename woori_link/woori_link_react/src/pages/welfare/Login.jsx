import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { findWelfareLoginId, login, resetWelfarePassword } from '../../api/authApi.js';
import { saveUser } from '../../utils/auth.js';
import '../../css/welfare/Login.css';

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 7) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;
  const savedLoginId = localStorage.getItem('welfareSavedLoginId') || '';
  const [form, setForm] = useState({ loginId: savedLoginId, password: '' });
  const [rememberId, setRememberId] = useState(Boolean(savedLoginId));
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [findForm, setFindForm] = useState({ name: '', phone: '' });
  const [resetForm, setResetForm] = useState({ loginId: '', name: '', phone: '', newPassword: '', confirmPassword: '' });
  const [modalError, setModalError] = useState('');
  const [resultMsg, setResultMsg] = useState('');

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
      if (rememberId) localStorage.setItem('welfareSavedLoginId', form.loginId);
      else localStorage.removeItem('welfareSavedLoginId');
      saveUser(data);
      navigate('/welfare');
    } catch (err) {
      alert(err.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type) => {
    setModalError('');
    setResultMsg('');
    setModal(type);
  };

  const handleFindLoginId = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      const { data } = await findWelfareLoginId(findForm);
      setResultMsg(`회원님의 아이디는 ${data.loginId}입니다.`);
    } catch (err) {
      setModalError(err.response?.data?.message || '아이디 찾기에 실패했습니다.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setModalError('');
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setModalError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await resetWelfarePassword(resetForm);
      setForm((prev) => ({ ...prev, loginId: resetForm.loginId, password: '' }));
      setModal(null);
      alert('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.');
    } catch (err) {
      setModalError(err.response?.data?.message || '비밀번호 재설정에 실패했습니다.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-logo">
          <div className="auth-logo-title">WOORI</div>
          <div className="auth-logo-sub">복지사 관리 시스템</div>
        </div>

        <div className="auth-card">
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

          <label className="auth-remember">
            <input type="checkbox" checked={rememberId} onChange={(e) => setRememberId(e.target.checked)} />
            <span>아이디 저장</span>
          </label>

          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        </div>

        <div className="auth-footer">
          <button type="button" onClick={() => openModal('resetPassword')}>비밀번호 찾기</button>
          <span className="auth-footer-divider" aria-hidden="true">|</span>
          <button type="button" onClick={() => openModal('findId')}>아이디 찾기</button>
          <span className="auth-footer-divider" aria-hidden="true">|</span>
          <Link to="/welfare/register">회원가입</Link>
        </div>

        {modal && (
          <div className="auth-modal-backdrop" onClick={() => setModal(null)}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="auth-modal-header">
                <h2>{modal === 'findId' ? '아이디 찾기' : '비밀번호 찾기'}</h2>
                <button type="button" onClick={() => setModal(null)}>×</button>
              </div>

              <form onSubmit={modal === 'findId' ? handleFindLoginId : handleResetPassword}>
                {modal === 'resetPassword' && (
                  <div className="auth-field">
                    <label className="auth-label">아이디</label>
                    <input className="auth-input" value={resetForm.loginId}
                      onChange={(e) => setResetForm({ ...resetForm, loginId: e.target.value })} required />
                  </div>
                )}
                <div className="auth-field">
                  <label className="auth-label">이름</label>
                  <input className="auth-input" value={modal === 'findId' ? findForm.name : resetForm.name}
                    onChange={(e) => modal === 'findId'
                      ? setFindForm({ ...findForm, name: e.target.value })
                      : setResetForm({ ...resetForm, name: e.target.value })} required />
                </div>
                <div className="auth-field">
                  <label className="auth-label">전화번호</label>
                  <input className="auth-input" type="tel" placeholder="010-0000-0000"
                    value={modal === 'findId' ? findForm.phone : resetForm.phone}
                    onChange={(e) => modal === 'findId'
                      ? setFindForm({ ...findForm, phone: formatPhone(e.target.value) })
                      : setResetForm({ ...resetForm, phone: formatPhone(e.target.value) })} required />
                </div>
                {modal === 'resetPassword' && (
                  <>
                    <div className="auth-field">
                      <label className="auth-label">새 비밀번호</label>
                      <input className="auth-input" type="password" minLength="8" value={resetForm.newPassword}
                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })} required />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">새 비밀번호 확인</label>
                      <input className="auth-input" type="password" minLength="8" value={resetForm.confirmPassword}
                        onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })} required />
                    </div>
                  </>
                )}
                {modalError && <div className="auth-alert-error">{modalError}</div>}
                {resultMsg && <div className="auth-alert-success">{resultMsg}</div>}
                <div className="auth-modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setModal(null)}>취소</button>
                  <button type="submit" className="btn-primary">{modal === 'findId' ? '아이디 찾기' : '재설정'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
