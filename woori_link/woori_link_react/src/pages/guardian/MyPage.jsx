import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import GuardianLayout from './GuardianLayout.jsx';

import {
  deleteGuardianAccount,
  getGuardianProfile,
  getSeniorsByGuardian,
  regenerateGuardianInviteCode,
  updateGuardianNotifications,
  updateGuardianProfile,
  updateGuardianSeniorRelationship,
} from '../../api/guardianApi.js';

import {
  disconnectGuardianSenior,
} from '../../api/guardianRelationshipApi.js';

import {
  searchAddresses,
} from '../../api/addressApi.js';

import {
  clearUser,
} from '../../utils/auth.js';

import '../../css/guardian/MyPage.css';


const RELATIONSHIPS = [
  '자녀',
  '배우자',
  '형제·자매',
  '친척',
  '생활지원사',
  '기타',
];


const ALERT_SETTINGS = [
  {
    key: 'checkInAlertEnabled',
    label: '안부 미응답 알림',
    description:
      '정해진 시간 안에 안부 응답이 없을 때 알려드립니다.',
  },
  {
    key: 'fallAlertEnabled',
    label: '낙상 감지 알림',
    description:
      '낙상 위험이 감지되었을 때 알려드립니다.',
  },
  {
    key: 'safetyZoneAlertEnabled',
    label: '안전구역 이탈 알림',
    description:
      '어르신이 설정된 안전구역을 벗어났을 때 알려드립니다.',
  },
  {
    key: 'recallAlertEnabled',
    label: '리콜 제품 알림',
    description:
      '등록된 제품이 리콜 대상과 일치할 때 알려드립니다.',
  },
];


const DEFAULT_PROFILE = {
  name: '',
  phone: '',
  email: '',
  address: '',
  inviteCode: '',
  inviteCodeExpiresAt: null,

  checkInAlertEnabled: true,
  fallAlertEnabled: true,
  safetyZoneAlertEnabled: true,
  recallAlertEnabled: true,
};


function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
}


function getErrorMessage(
  error,
  fallbackMessage,
) {
  return (
    error
      ?.response
      ?.data
      ?.message
    || error
      ?.response
      ?.data
      ?.error
    || error?.message
    || fallbackMessage
  );
}


function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    },
  ).format(date);
}


function formatPhoneNumber(value = '') {
  const digits =
    String(value)
      .replace(/\D/g, '')
      .slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return [
      digits.slice(0, 3),
      digits.slice(3),
    ].join('-');
  }

  return [
    digits.slice(0, 3),
    digits.slice(3, 7),
    digits.slice(7),
  ].join('-');
}


function getAddressValue(item) {
  return (
    item?.roadAddress
    || item?.address
    || item?.jibunAddress
    || item?.addressName
    || ''
  );
}


function getAddressTitle(item) {
  return (
    item?.placeName
    || item?.roadAddress
    || item?.address
    || item?.jibunAddress
    || '주소'
  );
}


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}


export default function GuardianMyPage() {
  const navigate = useNavigate();

  const [
    profile,
    setProfile,
  ] = useState({
    ...DEFAULT_PROFILE,
  });

  const [
    seniors,
    setSeniors,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    profileSaving,
    setProfileSaving,
  ] = useState(false);

  const [
    notificationSavingKey,
    setNotificationSavingKey,
  ] = useState('');

  const [
    regeneratingCode,
    setRegeneratingCode,
  ] = useState(false);

  const [
    deletingAccount,
    setDeletingAccount,
  ] = useState(false);

  const [
    disconnecting,
    setDisconnecting,
  ] = useState(false);

  const [
    relationshipSavingId,
    setRelationshipSavingId,
  ] = useState(null);

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    messageType,
    setMessageType,
  ] = useState('success');

  const [
    seniorsModalOpen,
    setSeniorsModalOpen,
  ] = useState(false);

  const [
    disconnectTarget,
    setDisconnectTarget,
  ] = useState(null);

  const [
    addressResults,
    setAddressResults,
  ] = useState([]);

  const [
    addressSearching,
    setAddressSearching,
  ] = useState(false);


  function showMessage(
    text,
    type = 'success',
  ) {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(
      () => {
        setMessage('');
      },
      2500,
    );
  }


  useEffect(() => {
    let cancelled = false;

    async function loadMyPage() {
      setLoading(true);

      try {
        const [
          profileResponse,
          seniorsResponse,
        ] = await Promise.all([
          getGuardianProfile(),
          getSeniorsByGuardian(),
        ]);

        if (cancelled) {
          return;
        }

        setProfile({
          ...DEFAULT_PROFILE,
          ...(profileResponse?.data ?? {}),
        });

        setSeniors(
          normalizeArray(
            seniorsResponse?.data,
          ),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        showMessage(
          getErrorMessage(
            error,
            '마이페이지 정보를 불러오지 못했습니다.',
          ),
          'error',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMyPage();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (
        disconnectTarget
        || disconnecting
      ) {
        return;
      }

      setSeniorsModalOpen(false);
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    disconnectTarget,
    disconnecting,
  ]);


  async function saveProfile(event) {
    event.preventDefault();

    if (profileSaving) {
      return;
    }

    const name =
      String(
        profile.name ?? '',
      ).trim();

    const phone =
      String(
        profile.phone ?? '',
      ).trim();

    const email =
      String(
        profile.email ?? '',
      ).trim();

    const address =
      String(
        profile.address ?? '',
      ).trim();

    if (!name) {
      showMessage(
        '이름을 입력해 주세요.',
        'error',
      );

      return;
    }

    if (!phone) {
      showMessage(
        '전화번호를 입력해 주세요.',
        'error',
      );

      return;
    }

    if (!email) {
      showMessage(
        '이메일을 입력해 주세요.',
        'error',
      );

      return;
    }

    setProfileSaving(true);

    try {
      const response =
        await updateGuardianProfile({
          name,
          phone,
          email,
          address,
        });

      setProfile(
        (current) => ({
          ...current,
          ...(response?.data ?? {}),
        }),
      );

      showMessage(
        '보호자 정보를 저장했습니다.',
      );
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          '보호자 정보를 저장하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setProfileSaving(false);
    }
  }


  async function saveNotificationSetting(
    key,
    enabled,
  ) {
    if (notificationSavingKey) {
      return;
    }

    const previousValue =
      profile[key] !== false;

    const nextProfile = {
      ...profile,
      [key]: enabled,
    };

    setProfile(nextProfile);
    setNotificationSavingKey(key);

    try {
      const payload =
        ALERT_SETTINGS.reduce(
          (
            result,
            setting,
          ) => ({
            ...result,

            [setting.key]:
              nextProfile[
              setting.key
              ] !== false,
          }),
          {},
        );

      const response =
        await updateGuardianNotifications(
          payload,
        );

      setProfile(
        (current) => ({
          ...current,
          ...(response?.data ?? payload),
        }),
      );

      showMessage(
        '알림 설정을 저장했습니다.',
      );
    } catch (error) {
      setProfile(
        (current) => ({
          ...current,
          [key]: previousValue,
        }),
      );

      showMessage(
        getErrorMessage(
          error,
          '알림 설정을 저장하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setNotificationSavingKey('');
    }
  }


  async function changeRelationship(
    seniorId,
    relationship,
  ) {
    if (relationshipSavingId) {
      return;
    }

    const previousSenior =
      seniors.find(
        (senior) => (
          String(senior.id)
          === String(seniorId)
        ),
      );

    setRelationshipSavingId(
      seniorId,
    );

    setSeniors(
      (current) => (
        current.map(
          (senior) => (
            String(senior.id)
              === String(seniorId)
              ? {
                ...senior,
                guardianRelationship:
                  relationship,
              }
              : senior
          ),
        )
      ),
    );

    try {
      const response =
        await updateGuardianSeniorRelationship(
          seniorId,
          relationship,
        );

      setSeniors(
        (current) => (
          current.map(
            (senior) => (
              String(senior.id)
                === String(seniorId)
                ? {
                  ...senior,
                  ...(response?.data ?? {
                    guardianRelationship:
                      relationship,
                  }),
                }
                : senior
            ),
          )
        ),
      );

      showMessage(
        '어르신과의 관계를 저장했습니다.',
      );
    } catch (error) {
      if (previousSenior) {
        setSeniors(
          (current) => (
            current.map(
              (senior) => (
                String(senior.id)
                  === String(seniorId)
                  ? previousSenior
                  : senior
              ),
            )
          ),
        );
      }

      showMessage(
        getErrorMessage(
          error,
          '관계 정보를 저장하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setRelationshipSavingId(null);
    }
  }


  async function confirmDisconnect() {
    if (
      !disconnectTarget?.id
      || disconnecting
    ) {
      return;
    }

    const target =
      disconnectTarget;

    setDisconnecting(true);

    try {
      await disconnectGuardianSenior(
        target.id,
      );

      setSeniors(
        (current) => (
          current.filter(
            (senior) => (
              String(senior.id)
              !== String(
                target.id,
              )
            ),
          )
        ),
      );

      showMessage(
        `${target.name} 님과의 연결을 해제했습니다.`,
      );

      setDisconnectTarget(null);
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          '어르신과의 연결을 해제하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setDisconnecting(false);
    }
  }


  async function regenerateCode() {
    if (regeneratingCode) {
      return;
    }

    const confirmed =
      window.confirm(
        '기존 초대 코드는 더 이상 사용할 수 없습니다.\n'
        + '이미 연결된 어르신은 유지됩니다.\n\n'
        + '초대 코드를 재발급하시겠습니까?',
      );

    if (!confirmed) {
      return;
    }

    setRegeneratingCode(true);

    try {
      const response =
        await regenerateGuardianInviteCode();

      setProfile(
        (current) => ({
          ...current,
          ...(response?.data ?? {}),
        }),
      );

      showMessage(
        '초대 코드를 재발급했습니다.',
      );
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          '초대 코드를 재발급하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setRegeneratingCode(false);
    }
  }


  async function copyInviteCode() {
    const inviteCode =
      String(
        profile.inviteCode ?? '',
      ).trim();

    if (!inviteCode) {
      showMessage(
        '복사할 초대 코드가 없습니다.',
        'error',
      );

      return;
    }

    try {
      await navigator
        .clipboard
        .writeText(
          inviteCode,
        );

      showMessage(
        '초대 코드를 복사했습니다.',
      );
    } catch {
      showMessage(
        `초대 코드: ${inviteCode}`,
      );
    }
  }


  async function deleteAccount() {
    if (deletingAccount) {
      return;
    }

    const confirmed =
      window.confirm(
        '계정을 탈퇴하면 모든 어르신 연결이 해제됩니다.\n'
        + '탈퇴한 계정은 복구할 수 없습니다.\n\n'
        + '정말 탈퇴하시겠습니까?',
      );

    if (!confirmed) {
      return;
    }

    setDeletingAccount(true);

    try {
      await deleteGuardianAccount();

      clearUser(
        'GUARDIAN',
      );

      navigate(
        '/guardian/login',
        {
          replace: true,
        },
      );
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          '계정을 탈퇴하지 못했습니다.',
        ),
        'error',
      );

      setDeletingAccount(false);
    }
  }


  async function searchGuardianAddress() {
    const keyword =
      String(
        profile.address ?? '',
      ).trim();

    if (!keyword) {
      showMessage(
        '검색할 주소를 입력해 주세요.',
        'error',
      );

      return;
    }

    if (addressSearching) {
      return;
    }

    setAddressSearching(true);
    setAddressResults([]);

    try {
      const response =
        await searchAddresses(
          keyword,
        );

      const results =
        normalizeArray(
          response?.data,
        );

      setAddressResults(
        results,
      );

      if (results.length === 0) {
        showMessage(
          '검색된 주소가 없습니다.',
          'error',
        );
      }
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          '주소를 검색하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setAddressSearching(false);
    }
  }


  function selectAddress(item) {
    const address =
      getAddressValue(item);

    if (!address) {
      return;
    }

    setProfile(
      (current) => ({
        ...current,
        address,
      }),
    );

    setAddressResults([]);
  }

  return (
    <GuardianLayout
      activeMenu="mypage"
    >
      <main className="guardian-mypage">
        <header className="guardian-mypage__heading">
          <div>
            <h1>
              마이페이지
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="guardian-mypage__loading">
            마이페이지 정보를 불러오는 중입니다.
          </div>
        ) : (
          <div className="guardian-mypage__sections">
            <div className="guardian-mypage__two-column">
              <form
                className="guardian-mypage__card"
                onSubmit={saveProfile}
              >
                <div className="guardian-mypage__card-title">
                  <h2>
                    보호자 기본 정보
                  </h2>

                  <span>
                    계정 정보
                  </span>
                </div>

                <div className="guardian-profile-row">
                  <label>
                    이름

                    <input
                      type="text"
                      value={
                        profile.name ?? ''
                      }
                      disabled={profileSaving}
                      onChange={(event) => {
                        setProfile(
                          (current) => ({
                            ...current,
                            name:
                              event.target.value,
                          }),
                        );
                      }}
                    />
                  </label>

                  <label>
                    이메일

                    <input
                      type="email"
                      value={
                        profile.email ?? ''
                      }
                      disabled={profileSaving}
                      onChange={(event) => {
                        setProfile(
                          (current) => ({
                            ...current,
                            email:
                              event.target.value,
                          }),
                        );
                      }}
                    />
                  </label>
                </div>

                <div className="guardian-profile-row guardian-profile-row--address">
                  <label>
                    전화번호

                    <input
                      type="tel"
                      maxLength={13}
                      value={
                        formatPhoneNumber(
                          profile.phone,
                        )
                      }
                      disabled={profileSaving}
                      onChange={(event) => {
                        setProfile(
                          (current) => ({
                            ...current,
                            phone:
                              formatPhoneNumber(
                                event.target.value,
                              ),
                          }),
                        );
                      }}
                    />
                  </label>

                  <label>
                    주소

                    <div className="guardian-address-search">
                      <input
                        type="text"
                        value={
                          profile.address ?? ''
                        }
                        disabled={profileSaving}
                        placeholder="도로명 또는 장소명 입력"
                        onChange={(event) => {
                          setProfile(
                            (current) => ({
                              ...current,
                              address:
                                event.target.value,
                            }),
                          );

                          setAddressResults([]);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key
                            === 'Enter'
                          ) {
                            event.preventDefault();

                            searchGuardianAddress();
                          }
                        }}
                      />

                      <button
                        type="button"
                        disabled={
                          addressSearching
                          || profileSaving
                        }
                        onClick={
                          searchGuardianAddress
                        }
                      >
                        {addressSearching
                          ? '검색 중'
                          : '검색'}
                      </button>
                    </div>
                  </label>

                  {addressResults.length > 0 && (
                    <div className="guardian-address-results">
                      {addressResults
                        .slice(
                          0,
                          5,
                        )
                        .map(
                          (
                            item,
                            index,
                          ) => (
                            <button
                              type="button"
                              key={[
                                getAddressValue(
                                  item,
                                ),
                                index,
                              ].join('-')}
                              onClick={() => {
                                selectAddress(
                                  item,
                                );
                              }}
                            >
                              <strong>
                                {getAddressTitle(
                                  item,
                                )}
                              </strong>

                              <span>
                                {getAddressValue(
                                  item,
                                )}
                              </span>
                            </button>
                          ),
                        )}
                    </div>
                  )}
                </div>

                <div className="guardian-profile-actions">
                  <button
                    type="submit"
                    className="guardian-mypage__save-button"
                    disabled={
                      profileSaving
                      || deletingAccount
                    }
                  >
                    {profileSaving
                      ? '저장 중...'
                      : '정보 저장'}
                  </button>

                  <button
                    type="button"
                    className="guardian-profile-actions__delete"
                    disabled={
                      profileSaving
                      || deletingAccount
                    }
                    onClick={deleteAccount}
                  >
                    {deletingAccount
                      ? '탈퇴 처리 중...'
                      : '계정 탈퇴'}
                  </button>
                </div>
              </form>

              <section className="guardian-mypage__card guardian-invite-card">
                <div className="guardian-mypage__card-title">
                  <h2>
                    초대 코드 관리
                  </h2>

                  <span>
                    어르신과 연결
                  </span>
                </div>

                <strong className="guardian-invite-card__code">
                  {profile.inviteCode
                    || '발급된 코드 없음'}
                </strong>

                <dl>
                  <div>
                    <dt>
                      유효 기간
                    </dt>

                    <dd>
                      {profile.inviteCodeExpiresAt
                        ? `${formatDate(
                          profile.inviteCodeExpiresAt,
                        )}까지`
                        : '-'}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="guardian-invite-card__senior-button"
                  onClick={() => {
                    setSeniorsModalOpen(
                      true,
                    );
                  }}
                >
                  <span>
                    연결된 어르신 관리
                  </span>

                  <strong>
                    {seniors.length}
                    명
                  </strong>

                  <ArrowIcon />
                </button>

                <div className="guardian-invite-card__actions">
                  <button
                    type="button"
                    disabled={
                      !profile.inviteCode
                    }
                    onClick={copyInviteCode}
                  >
                    코드 복사
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={regeneratingCode}
                    onClick={regenerateCode}
                  >
                    {regeneratingCode
                      ? '재발급 중...'
                      : '코드 재발급'}
                  </button>
                </div>
              </section>
            </div>

            <section className="guardian-mypage__card">
              <div className="guardian-mypage__card-title">
                <h2>
                  알림 설정
                </h2>
              </div>

              <div className="guardian-notification-settings">
                {ALERT_SETTINGS.map(
                  (setting) => {
                    const enabled =
                      profile[
                      setting.key
                      ] !== false;

                    const saving =
                      notificationSavingKey
                      === setting.key;

                    return (
                      <div
                        key={setting.key}
                        className="guardian-notification-setting"
                      >
                        <div className="guardian-notification-setting__copy">
                          <strong>
                            {setting.label}
                          </strong>

                          <p>
                            {setting.description}
                          </p>
                        </div>

                        <label
                          className={[
                            'guardian-toggle',

                            enabled
                              ? 'guardian-toggle--enabled'
                              : '',

                            saving
                              ? 'guardian-toggle--saving'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={
                              Boolean(
                                notificationSavingKey,
                              )
                            }
                            aria-label={[
                              setting.label,

                              enabled
                                ? '사용 중'
                                : '사용 안 함',
                            ].join(' ')}
                            onChange={(event) => {
                              saveNotificationSetting(
                                setting.key,
                                event.target.checked,
                              );
                            }}
                          />

                          <span
                            className="guardian-toggle__track"
                            aria-hidden="true"
                          >
                            <span className="guardian-toggle__thumb" />
                          </span>
                        </label>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        )}

        {message && (
          <div
            className={[
              'guardian-mypage__message',

              messageType === 'error'
                ? 'guardian-mypage__message--error'
                : 'guardian-mypage__message--success',
            ].join(' ')}
          >
            {message}
          </div>
        )}

        {seniorsModalOpen && (
          <div
            className="guardian-senior-management-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target
                === event.currentTarget
              ) {
                setSeniorsModalOpen(
                  false,
                );
              }
            }}
          >
            <section
              className="guardian-senior-management-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="guardian-senior-management-title"
            >
              <header className="guardian-senior-management-modal__header">
                <div>
                  <h2
                    id="guardian-senior-management-title"
                  >
                    연결된 어르신
                  </h2>

                  <p>
                    보호자 본인을 기준으로 어르신과의 관계를 설정하거나 연결을 해제할 수 있습니다.
                  </p>
                </div>

                <button
                  type="button"
                  className="guardian-senior-management-modal__close"
                  aria-label="연결된 어르신 관리 닫기"
                  onClick={() => {
                    setSeniorsModalOpen(
                      false,
                    );
                  }}
                >
                  <CloseIcon />
                </button>
              </header>

              <div className="guardian-senior-management-modal__summary">
                <span>
                  현재 연결
                </span>

                <strong>
                  {seniors.length}
                  명
                </strong>
              </div>

              <div className="guardian-senior-management-modal__content">
                {seniors.length === 0 ? (
                  <div className="guardian-senior-management-modal__empty">
                    <strong>
                      연결된 어르신이 없습니다.
                    </strong>

                    <p>
                      초대 코드를 전달해 어르신 계정과 연결해 주세요.
                    </p>
                  </div>
                ) : (
                  <div className="guardian-senior-management-list">
                    {seniors.map(
                      (senior) => (
                        <article
                          key={senior.id}
                          className="guardian-senior-management-item"
                        >
                          <div className="guardian-senior-management-item__profile">
                            <div className="guardian-senior-management-item__avatar">
                              {String(
                                senior.name
                                || '어',
                              ).slice(
                                0,
                                1,
                              )}
                            </div>

                            <div>
                              <strong>
                                {senior.name
                                  || '이름 미확인'}
                                {' '}
                                님
                              </strong>

                              <span>
                                연결일
                                {' '}
                                {formatDate(
                                  senior.guardianLinkedAt,
                                )}
                              </span>
                            </div>
                          </div>

                          <label className="guardian-senior-management-item__relationship">
                            <span>
                              관계
                            </span>

                            <select
                              value={
                                senior.guardianRelationship
                                ?? ''
                              }
                              disabled={
                                relationshipSavingId
                                === senior.id
                              }
                              onChange={(event) => {
                                changeRelationship(
                                  senior.id,
                                  event.target.value,
                                );
                              }}
                            >
                              <option value="">
                                관계 선택
                              </option>

                              {RELATIONSHIPS.map(
                                (relationship) => (
                                  <option
                                    key={relationship}
                                    value={relationship}
                                  >
                                    {relationship}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <div className="guardian-senior-management-item__actions">
                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                setDisconnectTarget(
                                  senior,
                                );
                              }}
                            >
                              연결 해제
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>

              <footer className="guardian-senior-management-modal__footer">
                <button
                  type="button"
                  onClick={() => {
                    setSeniorsModalOpen(
                      false,
                    );
                  }}
                >
                  닫기
                </button>
              </footer>
            </section>
          </div>
        )}

        {disconnectTarget && (
          <div
            className="guardian-mypage__modal guardian-mypage__modal--disconnect"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target
                === event.currentTarget
                && !disconnecting
              ) {
                setDisconnectTarget(
                  null,
                );
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="guardian-disconnect-title"
            >
              <h2
                id="guardian-disconnect-title"
              >
                {disconnectTarget.name}
                {' '}
                님과의 연결을 해제하시겠습니까?
              </h2>

              <p>
                연결을 해제하면 위치, 안부, 알림 정보를 확인할 수 없습니다.
              </p>

              <div>
                <button
                  type="button"
                  className="secondary"
                  disabled={disconnecting}
                  onClick={() => {
                    setDisconnectTarget(
                      null,
                    );
                  }}
                >
                  취소
                </button>

                <button
                  type="button"
                  className="danger"
                  disabled={disconnecting}
                  onClick={confirmDisconnect}
                >
                  {disconnecting
                    ? '해제 중...'
                    : '연결 해제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </GuardianLayout>
  );
}