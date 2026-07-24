import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  checkLoginIdAvailable,
  registerWelfareWorker,
} from '../../api/authApi.js';

import '../../css/welfare/Register.css';


const INIT = {
  loginId: '',
  name: '',
  phone: '',
  password: '',
  passwordConfirm: '',
  organization: '',
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


export default function Register() {
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
    idChecking,
    setIdChecking,
  ] = useState(false);

  const [
    idChecked,
    setIdChecked,
  ] = useState(false);

  const [
    idCheckMsg,
    setIdCheckMsg,
  ] = useState('');


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

      if (
        field === 'loginId'
      ) {
        setIdChecked(false);
        setIdCheckMsg('');
      }
    };


  async function checkLoginId() {
    const loginId =
      form.loginId.trim();

    if (!loginId) {
      setIdChecked(false);

      setIdCheckMsg(
        '아이디를 입력해 주세요.',
      );

      return;
    }

    setIdChecking(true);
    setIdCheckMsg('');

    try {
      await checkLoginIdAvailable(
        loginId,
      );

      setIdChecked(true);

      setIdCheckMsg(
        '사용 가능한 아이디입니다.',
      );
    } catch (requestError) {
      setIdChecked(false);

      setIdCheckMsg(
        requestError
          .response
          ?.data
          ?.message
        || '이미 사용 중인 아이디입니다.',
      );
    } finally {
      setIdChecking(false);
    }
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    if (!idChecked) {
      setError(
        '아이디 중복확인을 해주세요.',
      );

      return;
    }

    const emailRegex =
      /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.\-]+@[a-z]+(\.[a-z]+)+$/;

    if (
      form.email
      && !emailRegex.test(
        form.email,
      )
    ) {
      setError(
        '이메일 형식이 올바르지 않습니다.',
      );

      return;
    }

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
      await registerWelfareWorker({
        loginId:
          form.loginId.trim(),

        name:
          form.name,

        phone:
          form.phone,

        password:
          form.password,

        organization:
          form.organization,

        email:
          form.email,
      });

      navigate(
        '/welfare/login',
        {
          state: {
            registered: true,
          },
        },
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


  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-register-heading">
          <span className="auth-register-heading__brand">
            WOORI
          </span>

          <h1>
            복지사 회원가입
          </h1>

          <p>
            복지사 계정 정보를 입력해 주세요.
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <div className="form-row">
            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="welfare-register-name"
              >
                이름 *
              </label>

              <input
                id="welfare-register-name"
                className="auth-input"
                type="text"
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
                htmlFor="welfare-register-phone"
              >
                전화번호
              </label>

              <input
                id="welfare-register-phone"
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
              />
            </div>
          </div>

          <div className="auth-field">
            <label
              className="auth-label"
              htmlFor="welfare-register-login-id"
            >
              아이디 *
            </label>

            <div className="form-row-inline">
              <input
                id="welfare-register-login-id"
                className="auth-input"
                type="text"
                value={
                  form.loginId
                }
                onChange={
                  set('loginId')
                }
                placeholder="영문/숫자 조합"
                required
              />

              <button
                type="button"
                className="register-btn-outline inline-btn"
                onClick={
                  checkLoginId
                }
                disabled={
                  idChecking
                }
              >
                {idChecking
                  ? '확인 중'
                  : '중복확인'}
              </button>
            </div>

            {idCheckMsg && (
              <span
                className={
                  idChecked
                    ? 'id-check-ok'
                    : 'id-check-fail'
                }
              >
                {idCheckMsg}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label
              className="auth-label"
              htmlFor="welfare-register-email"
            >
              이메일
            </label>

            <input
              id="welfare-register-email"
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
                htmlFor="welfare-register-password"
              >
                비밀번호 *
              </label>

              <input
                id="welfare-register-password"
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
                htmlFor="welfare-register-password-confirm"
              >
                비밀번호 확인 *
              </label>

              <input
                id="welfare-register-password-confirm"
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
            to="/welfare/login"
            className="auth-login-text-button"
          >
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}