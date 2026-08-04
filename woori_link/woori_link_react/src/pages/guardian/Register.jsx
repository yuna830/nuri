import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  registerGuardian,
} from '../../api/guardianAuthApi.js';

import '../../css/guardian/Register.css';


const INIT = {
  name: '',
  phone: '',
  password: '',
  passwordConfirm: '',
  relationship: '',
  email: '',
};


function formatPhone(value) {
  const digits = value
    .replace(/\D/g, '')
    .slice(0, 11);

  if (digits.length > 7) {
    return [
      digits.slice(0, 3),
      digits.slice(3, 7),
      digits.slice(7),
    ].join('-');
  }

  if (digits.length > 3) {
    return [
      digits.slice(0, 3),
      digits.slice(3),
    ].join('-');
  }

  return digits;
}


export default function GuardianRegister() {
  const navigate =
    useNavigate();

  const [
    form,
    setForm,
  ] = useState(INIT);

  const [
    error,
    setError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    inviteCode,
    setInviteCode,
  ] = useState('');

  const [
    copied,
    setCopied,
  ] = useState(false);


  const set =
    (field) => (event) => {
      const value =
        field === 'phone'
          ? formatPhone(
            event.target.value,
          )
          : event.target.value;

      setForm(
        (previous) => ({
          ...previous,
          [field]: value,
        }),
      );
    };


  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    if (
      form.password
      !== form.passwordConfirm
    ) {
      setError(
        '비밀번호가 일치하지 않습니다.',
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await registerGuardian({
          name:
            form.name,

          phone:
            form.phone,

          password:
            form.password,

          relationship:
            form.relationship,

          email:
            form.email,
        });

      setInviteCode(
        response.data.inviteCode,
      );
    } catch (requestError) {
      setError(
        requestError
          .response
          ?.data
          ?.message
        || '회원가입에 실패했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleCopyInviteCode() {
    try {
      await navigator.clipboard.writeText(
        inviteCode,
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        1800,
      );
    } catch {
      setCopied(false);

      setError(
        '초대 코드를 복사하지 못했습니다.',
      );
    }
  }


  if (inviteCode) {
    return (
      <div className="auth-page guardian-register-complete-page">
        <div className="auth-card guardian-register-card invite-code-card">
          <div className="auth-register-heading">
            <span className="auth-register-heading__brand">
              WOORI
            </span>

            <h1>
              보호자 회원가입 완료
            </h1>

            <p>
              어르신 연결에 사용할 초대 코드를 확인해 주세요.
            </p>
          </div>

          <div className="invite-code-content">
            <span>
              보호자 초대 코드
            </span>

            <strong className="invite-code-value">
              {inviteCode}
            </strong>

            <p>
              어르신 계정과 연결할 때 위 코드를 사용할 수 있습니다.
            </p>
          </div>

          {error && (
            <div className="auth-alert-error">
              {error}
            </div>
          )}

          <button
            type="button"
            className="btn-primary auth-submit invite-code-copy-button"
            onClick={
              handleCopyInviteCode
            }
          >
            {copied
              ? '복사 완료'
              : '코드 복사하기'}
          </button>

          <button
            type="button"
            className="auth-login-text-button invite-code-login-button"
            onClick={() => {
              navigate(
                '/guardian/login',
                {
                  state: {
                    registered: true,
                  },
                },
              );
            }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide guardian-register-card">
        <div className="auth-register-heading">
          <span className="auth-register-heading__brand">
            WOORI
          </span>

          <h1>
            보호자 회원가입
          </h1>

          <p>
            보호자 정보를 입력해 계정을 만들어 주세요.
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <div className="form-row">
            <div className="auth-field guardian-register-name">
              <label
                className="auth-label"
                htmlFor="guardian-register-name"
              >
                이름 *
              </label>

              <input
                id="guardian-register-name"
                className="auth-input"
                value={
                  form.name
                }
                onChange={
                  set('name')
                }
                placeholder="홍길동"
                required
              />
            </div>

            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="guardian-register-phone"
              >
                전화번호 *
              </label>

              <input
                id="guardian-register-phone"
                className="auth-input"
                type="tel"
                value={
                  form.phone
                }
                onChange={
                  set('phone')
                }
                placeholder="010-0000-0000"
                inputMode="numeric"
                maxLength={13}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label
              className="auth-label"
              htmlFor="guardian-register-email"
            >
              이메일
            </label>

            <input
              id="guardian-register-email"
              className="auth-input"
              type="email"
              value={
                form.email
              }
              onChange={
                set('email')
              }
              placeholder="example@email.com"
            />
          </div>

          <div className="form-row">
            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="guardian-register-password"
              >
                비밀번호 *
              </label>

              <input
                id="guardian-register-password"
                className="auth-input"
                type="password"
                value={
                  form.password
                }
                onChange={
                  set('password')
                }
                placeholder="8자 이상"
                minLength={8}
                required
              />
            </div>

            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="guardian-register-password-confirm"
              >
                비밀번호 확인 *
              </label>

              <input
                id="guardian-register-password-confirm"
                className="auth-input"
                type="password"
                value={
                  form.passwordConfirm
                }
                onChange={
                  set('passwordConfirm')
                }
                placeholder="비밀번호 재입력"
                minLength={8}
                required
              />
            </div>
          </div>

          {error && (
            <div className="auth-alert-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading
            }
            className="btn-primary auth-submit"
          >
            {loading
              ? '가입 중...'
              : '회원가입'}
          </button>
        </form>

        <div className="auth-register-login">
          <span>
            이미 계정이 있으신가요?
          </span>

          <Link
            to="/guardian/login"
            className="auth-login-text-button"
          >
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}