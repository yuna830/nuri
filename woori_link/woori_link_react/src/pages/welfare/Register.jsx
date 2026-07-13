import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerWelfareWorker, searchFacilities, checkLoginIdAvailable } from '../../api/authApi.js';
import '../../css/welfare/Register.css';

const INIT = { loginId: '', name: '', phone: '', password: '', passwordConfirm: '', organization: '', email: '' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INIT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [idChecked, setIdChecked] = useState(false);
  const [idCheckMsg, setIdCheckMsg] = useState('');

  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (field === 'loginId') { setIdChecked(false); setIdCheckMsg(''); }
  };

  const checkLoginId = async () => {
    if (!form.loginId) return;
    try {
      await checkLoginIdAvailable(form.loginId);
      setIdChecked(true);
      setIdCheckMsg('사용 가능한 아이디입니다.');
    } catch (err) {
      setIdChecked(false);
      setIdCheckMsg(err.response?.data?.message || '이미 사용 중인 아이디입니다.');
    }
  };

  const handlePhone = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setForm((p) => ({ ...p, phone: formatted }));
  };

  const handleOrgSearch = async () => {
    if (orgQuery.length < 2) return;
    setOrgLoading(true);
    try {
      const { data } = await searchFacilities(orgQuery);
      setOrgResults(data);
      setShowDrop(true);
    } catch {
      setOrgResults([]);
    } finally {
      setOrgLoading(false);
    }
  };

  const selectOrg = (item) => {
    setForm((p) => ({ ...p, organization: item.name }));
    setOrgQuery(item.name);
    setShowDrop(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!idChecked) { setError('아이디 중복확인을 해주세요.'); return; }
    
    const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.\-]+@[a-z]+(\.[a-z]+)+$/;
    if (form.email && !emailRegex.test(form.email)) {
      setError('이메일 형식이 올바르지 않습니다. (@ 뒤는 소문자 영문만 허용)');
      return;
    }

    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    
    setLoading(true);
    try {
      await registerWelfareWorker({
        loginId: form.loginId, name: form.name, phone: form.phone,
        password: form.password, organization: form.organization, email: form.email,
      });
      navigate('/welfare/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <div className="auth-logo-title">WOORI LINK</div>
          <div className="auth-logo-sub">복지사 회원가입</div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* 이름 | 전화번호 */}
          <div className="form-row">
            <div className="auth-field" style={{ flex: '0 0 38%' }}>
              <label className="auth-label">이름 *</label>
              <input className="auth-input" type="text" value={form.name}
                onChange={set('name')} placeholder="홍길동" required />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label">전화번호</label>
              <input className="auth-input" type="text" value={form.phone}
                onChange={handlePhone} placeholder="010-0000-0000" />
            </div>
          </div>

          {/* 아이디 + 중복확인 */}
          <div className="auth-field">
            <label className="auth-label">아이디 *</label>
            <div className="form-row-inline">
              <input className="auth-input" type="text" value={form.loginId}
                onChange={set('loginId')} placeholder="영문/숫자 조합" required />
              <button type="button" className="btn-outline inline-btn" onClick={checkLoginId}>
                중복확인
              </button>
            </div>
            {idCheckMsg && (
              <span className={idChecked ? 'id-check-ok' : 'id-check-fail'}>{idCheckMsg}</span>
            )}
          </div>

          {/* 이메일 */}
          <div className="auth-field">
            <label className="auth-label">이메일</label>
            <input className="auth-input" type="email" value={form.email}
              onChange={set('email')} placeholder="example@email.com" />
          </div>

          {/* 비밀번호 | 비밀번호 확인 */}
          <div className="form-row">
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label">비밀번호 *</label>
              <input className="auth-input" type="password" value={form.password}
                onChange={set('password')} placeholder="8자 이상" required />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label">비밀번호 확인 *</label>
              <input className="auth-input" type="password" value={form.passwordConfirm}
                onChange={set('passwordConfirm')} placeholder="비밀번호 재입력" required />
            </div>
          </div>

          {/* 소속기관 + 검색 */}
          <div className="auth-field" style={{ position: 'relative' }}>
            <label className="auth-label">소속 기관</label>
            <div className="form-row-inline">
              <input
                className="auth-input"
                type="text"
                value={orgQuery}
                onChange={(e) => {
                  setOrgQuery(e.target.value);
                  if (!e.target.value) { setForm((p) => ({ ...p, organization: '' })); setShowDrop(false); }
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleOrgSearch())}
                placeholder="기관명 입력 (2글자 이상)"
              />
              <button type="button" className="btn-outline inline-btn"
                onClick={handleOrgSearch} disabled={orgLoading}>
                {orgLoading ? '검색 중' : '검색'}
              </button>
            </div>
            {showDrop && orgResults.length > 0 && (
              <div className="org-dropdown">
                {orgResults.map((item, i) => (
                  <div key={i} className="org-dropdown-item" onClick={() => selectOrg(item)}>
                    <div className="org-dropdown-item-name">{item.name}</div>
                    <div className="org-dropdown-item-sub">{item.type} · {item.sigungu}</div>
                  </div>
                ))}
              </div>
            )}
            {showDrop && orgResults.length === 0 && !orgLoading && (
              <div className="org-dropdown">
                <div className="org-dropdown-empty">검색 결과가 없습니다.</div>
              </div>
            )}
          </div>

          {error && <div className="auth-alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-footer">
          이미 계정이 있으신가요? <Link to="/welfare/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
