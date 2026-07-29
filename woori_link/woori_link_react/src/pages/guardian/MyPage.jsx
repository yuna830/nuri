import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import GuardianLayout from './GuardianLayout.jsx';
import EnergyInformationModal from './EnergyInformationModal.jsx';
import ConsentManagement from '../../components/common/ConsentManagement.jsx';

import {
  deleteGuardianAccount,
  getGuardianProfile,
  getSeniorsByGuardian,
  regenerateGuardianInviteCode,
  updateGuardianNotifications,
  updateGuardianProfile,
} from '../../api/guardianApi.js';

import {
  searchAddresses,
} from '../../api/addressApi.js';

import {
  getActiveEnergySupportConsultation,
  getEnergySupportCompletion,
} from '../../api/energySupportApi.js';

import {
  clearUser,
} from '../../utils/auth.js';

import '../../css/guardian/MyPage.css';


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


function getInviteCodeStatus(
  expiresAt,
) {
  if (!expiresAt) {
    return '발급 필요';
  }

  const expiresDate =
    new Date(expiresAt);

  if (
    Number.isNaN(
      expiresDate.getTime(),
    )
  ) {
    return '확인 필요';
  }

  const now = new Date();

  if (
    expiresDate.getTime()
    < now.getTime()
  ) {
    return '만료됨';
  }

  const remainingDays =
    Math.ceil(
      (
        expiresDate.getTime()
        - now.getTime()
      )
      / (
        1000
        * 60
        * 60
        * 24
      ),
    );

  if (remainingDays <= 3) {
    return '만료 임박';
  }

  return '사용 가능';
}


function isConsultationActive(status) {
  return (
    status === 'REQUESTED'
    || status === 'IN_PROGRESS'
  );
}


function getSeniorEnergyStatus(
  energyStatus,
) {
  if (energyStatus?.completed === true) {
    return 'COMPLETED';
  }

  if (
    energyStatus?.consultationStatus
    === 'IN_PROGRESS'
  ) {
    return 'IN_PROGRESS';
  }

  if (
    energyStatus?.consultationStatus
    === 'REQUESTED'
  ) {
    return 'REQUESTED';
  }

  return 'INCOMPLETE';
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
    energyInformationStatus,
    setEnergyInformationStatus,
  ] = useState({});

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
    message,
    setMessage,
  ] = useState('');

  const [
    messageType,
    setMessageType,
  ] = useState('success');

  const [
    addressResults,
    setAddressResults,
  ] = useState([]);

  const [
    addressSearching,
    setAddressSearching,
  ] = useState(false);

  const [
    selectedEnergySenior,
    setSelectedEnergySenior,
  ] = useState(null);


  const seniorInformationSummary = useMemo(() => {
    const completedCount =
      seniors.filter((senior) => (
        energyInformationStatus[
          senior.id
        ]?.completed === true
      )).length;

    const consultationCount =
      seniors.filter((senior) => {
        const status =
          energyInformationStatus[
          senior.id
          ];

        return (
          status?.completed !== true
          && isConsultationActive(
            status?.consultationStatus,
          )
        );
      }).length;

    const incompleteCount =
      seniors.length
      - completedCount
      - consultationCount;

    return {
      totalCount:
        seniors.length,

      completedCount,

      consultationCount,

      incompleteCount:
        Math.max(
          incompleteCount,
          0,
        ),
    };
  }, [
    seniors,
    energyInformationStatus,
  ]);


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
      3000,
    );
  }


  function openEnergyInformationModal(
    senior,
  ) {
    setSelectedEnergySenior(
      senior,
    );
  }


  function closeEnergyInformationModal() {
    setSelectedEnergySenior(
      null,
    );
  }


  function handleEnergyInformationSaved(
    savedData,
  ) {
    const seniorId =
      savedData?.seniorId;

    if (!seniorId) {
      return;
    }

    const remainingMissingCount =
      typeof savedData
        ?.remainingMissingCount
        === 'number'
        ? savedData.remainingMissingCount
        : null;

    const completed =
      savedData?.completed === true
      && remainingMissingCount === 0;

    setEnergyInformationStatus(
      (current) => {
        const previousStatus =
          current[seniorId]
          ?? {};

        const receivedConsultation =
          savedData?.consultation
          ?? null;

        const consultationRequested =
          savedData
            ?.consultationRequested
          === true;

        let nextConsultationStatus =
          previousStatus
            .consultationStatus
          ?? null;

        let nextConsultation =
          previousStatus
            .consultation
          ?? null;

        if (receivedConsultation) {
          nextConsultationStatus =
            receivedConsultation.status
            ?? nextConsultationStatus;

          nextConsultation =
            receivedConsultation;
        } else if (
          consultationRequested
          && !isConsultationActive(
            nextConsultationStatus,
          )
        ) {
          nextConsultationStatus =
            'REQUESTED';
        }

        if (completed) {
          nextConsultationStatus = null;
          nextConsultation = null;
        }

        return {
          ...current,

          [seniorId]: {
            ...previousStatus,

            remainingMissingCount,
            completed,

            consultationRequested:
              !completed
              && isConsultationActive(
                nextConsultationStatus,
              ),

            consultationStatus:
              nextConsultationStatus,

            consultation:
              nextConsultation,
          },
        };
      },
    );

    if (completed) {
      showMessage(
        '에너지복지 필수 정보 입력을 완료했습니다.',
      );

      return;
    }

    if (
      savedData
        ?.consultationRequested
      === true
    ) {
      showMessage(
        typeof remainingMissingCount
          === 'number'
          ? `입력한 정보를 저장하고 담당 복지사에게 미입력 ${remainingMissingCount}개 항목의 확인을 요청했습니다.`
          : '입력한 정보를 저장하고 담당 복지사에게 확인을 요청했습니다.',
      );

      return;
    }

    showMessage(
      typeof remainingMissingCount
        === 'number'
        ? `입력한 정보를 저장했습니다. 필수 미입력 ${remainingMissingCount}개 항목은 보완 필요 상태로 유지됩니다.`
        : '입력한 에너지복지 정보를 저장했습니다.',
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

        const seniorItems =
          normalizeArray(
            seniorsResponse?.data,
          );

        setProfile({
          ...DEFAULT_PROFILE,
          ...(profileResponse?.data ?? {}),
        });

        setSeniors(
          seniorItems,
        );

        /*
         * 어르신별 진행 중인 상담 요청 상태 조회
         *
         * 한 명의 요청 조회가 실패해도
         * 마이페이지 전체가 실패하지 않도록
         * Promise.allSettled를 사용한다.
         */
        const energyStatusResults =
          await Promise.all(
            seniorItems.map(
              async (senior) => {
                const [
                  completionResult,
                  consultationResult,
                ] = await Promise.allSettled([
                  getEnergySupportCompletion(
                    senior.id,
                  ),

                  getActiveEnergySupportConsultation(
                    senior.id,
                  ),
                ]);

                return {
                  completion:
                    completionResult.status
                      === 'fulfilled'
                      ? completionResult.value
                      : null,

                  consultation:
                    consultationResult.status
                      === 'fulfilled'
                      ? consultationResult.value
                      : null,
                };
              },
            ),
          );

        if (cancelled) {
          return;
        }

        const nextStatus =
          seniorItems.reduce(
            (
              result,
              senior,
              index,
            ) => {
              const statusData =
                energyStatusResults[index]
                ?? {
                  completion: null,
                  consultation: null,
                };

              const completion =
                statusData.completion;

              const consultation =
                statusData.consultation;

              result[senior.id] = {
                remainingMissingCount:
                  typeof completion?.missingCount
                    === 'number'
                    ? completion.missingCount
                    : null,

                completed:
                  completion?.completed
                  === true,

                consultationRequested:
                  isConsultationActive(
                    consultation?.status,
                  ),

                consultationStatus:
                  consultation?.status
                  ?? null,

                consultation:
                  consultation
                  ?? null,
              };

              return result;
            },
            {},
          );

        setEnergyInformationStatus(
          nextStatus,
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
                className="guardian-mypage__card guardian-profile-card"
                onSubmit={saveProfile}
              >
                <div className="guardian-profile-row">
                  <label>
                    이름

                    <input
                      type="text"
                      value={profile.name ?? ''}
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
                      value={profile.email ?? ''}
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

                  <div>
                    <dt>
                      코드 상태
                    </dt>

                    <dd
                      className={[
                        'guardian-invite-card__status',

                        getInviteCodeStatus(
                          profile.inviteCodeExpiresAt,
                        ) === '사용 가능'
                          ? 'guardian-invite-card__status--active'
                          : '',

                        getInviteCodeStatus(
                          profile.inviteCodeExpiresAt,
                        ) === '만료 임박'
                          ? 'guardian-invite-card__status--warning'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {getInviteCodeStatus(
                        profile.inviteCodeExpiresAt,
                      )}
                    </dd>
                  </div>
                </dl>

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

            <section className="guardian-mypage__card guardian-senior-information-card">
              <div className="guardian-mypage__card-title">
                <div>
                  <h2>
                    연결된 어르신 에너지 정보
                  </h2>

                  <p>
                    에너지복지 필수 정보와 담당 복지사 확인 요청 상태를 관리합니다.
                  </p>
                </div>

                <span>
                  에너지복지 관리
                </span>
              </div>

              {seniorInformationSummary.totalCount === 0 ? (
                <div className="guardian-senior-information-empty">
                  <strong>
                    연결된 어르신이 없습니다.
                  </strong>

                  <p>
                    초대 코드를 전달해 어르신 계정과 먼저 연결해 주세요.
                  </p>
                </div>
              ) : (
                <>
                  <div className="guardian-senior-information-summary">
                    <article>
                      <span>
                        연결된 어르신
                      </span>

                      <strong>
                        {seniorInformationSummary.totalCount}명
                      </strong>
                    </article>

                    <article>
                      <span>
                        정보 입력 완료
                      </span>

                      <strong className="complete">
                        {seniorInformationSummary.completedCount}명
                      </strong>
                    </article>

                    <article>
                      <span>
                        복지사 확인 요청
                      </span>

                      <strong className="required">
                        {seniorInformationSummary.consultationCount}명
                      </strong>
                    </article>

                    <article>
                      <span>
                        정보 보완 필요
                      </span>

                      <strong className="required">
                        {seniorInformationSummary.incompleteCount}명
                      </strong>
                    </article>
                  </div>

                  <div className="guardian-senior-information-list">
                    {seniors.map(
                      (senior) => {
                        const energyStatus =
                          energyInformationStatus[
                          senior.id
                          ] ?? {};

                        const displayStatus =
                          getSeniorEnergyStatus(
                            energyStatus,
                          );

                        const remainingMissingCount =
                          energyStatus
                            .remainingMissingCount;

                        return (
                          <article
                            key={senior.id}
                            className={[
                              'guardian-senior-information-item',

                              displayStatus
                                === 'COMPLETED'
                                ? 'guardian-senior-information-item--complete'
                                : 'guardian-senior-information-item--required',
                            ].join(' ')}
                          >
                            <div className="guardian-senior-information-item__person">
                              <span>
                                {senior.name
                                  ?.slice(
                                    0,
                                    1,
                                  )
                                  || '어'}
                              </span>

                              <div>
                                <strong>
                                  {senior.name
                                    || '이름 미확인'} 님
                                </strong>

                                <small>
                                  {senior.guardianRelationship
                                    || '관계 미설정'}
                                </small>
                              </div>
                            </div>

                            <div className="guardian-senior-information-item__status">
                              {displayStatus === 'COMPLETED' && (
                                <>
                                  <strong className="complete">
                                    정보 입력 완료
                                  </strong>

                                  <small>
                                    에너지복지 검토에 필요한 필수 정보가 모두 입력되었습니다.
                                  </small>
                                </>
                              )}

                              {displayStatus === 'REQUESTED' && (
                                <>
                                  <strong className="required">
                                    복지사 확인 요청 완료
                                  </strong>

                                  <small>
                                    담당 복지사가 확인 요청을 검토할 예정입니다.
                                  </small>
                                </>
                              )}

                              {displayStatus === 'IN_PROGRESS' && (
                                <>
                                  <strong className="required">
                                    복지사 확인 중
                                  </strong>

                                  <small>
                                    담당 복지사가 미입력 필수 정보를 확인하고 있습니다.
                                  </small>
                                </>
                              )}

                              {displayStatus === 'INCOMPLETE' && (
                                <>
                                  <strong className="required">
                                    {typeof remainingMissingCount
                                      === 'number'
                                      ? `필수 ${remainingMissingCount}개 항목 보완 필요`
                                      : '에너지복지 정보 확인 필요'}
                                  </strong>

                                  <small>
                                    확인 가능한 정보를 입력하고, 모르는 필수 항목은 복지사에게 요청할 수 있습니다.
                                  </small>
                                </>
                              )}
                            </div>

                            <div className="guardian-senior-information-item__actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  openEnergyInformationModal(
                                    senior,
                                  );
                                }}
                              >
                                {displayStatus === 'COMPLETED'
                                  ? '정보 수정'
                                  : displayStatus === 'REQUESTED'
                                    ? '요청 내용 확인'
                                    : displayStatus === 'IN_PROGRESS'
                                      ? '진행 상태 확인'
                                      : '정보 보완'}
                              </button>
                            </div>
                          </article>
                        );
                      },
                    )}
                  </div>

                  <div className="guardian-senior-information-footer">
                    <strong>
                      안내
                    </strong>

                    <p>
                      정보 저장만으로 복지사에게 알림이 전달되지는 않습니다. 보호자가 상담 요청을 선택한 경우에만 담당 복지사에게 확인 요청이 전달됩니다.
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="guardian-mypage__card guardian-preference-card">
              <div className="guardian-preference-card__column">
                <ConsentManagement role="guardian" embedded />
              </div>

              <div className="guardian-preference-card__column guardian-preference-card__column--notifications">
                <div className="guardian-mypage__card-title">
                  <div>
                    <h2>알림 설정</h2>
                    <p>돌봄 상황별 알림 수신 여부를 설정할 수 있습니다.</p>
                  </div>
                </div>

                <div className="guardian-notification-settings">
                  {ALERT_SETTINGS.map((setting) => {
                    const enabled = profile[setting.key] !== false;
                    const saving = notificationSavingKey === setting.key;

                    return (
                      <div key={setting.key} className="guardian-notification-setting">
                        <div className="guardian-notification-setting__copy">
                          <strong>{setting.label}</strong>
                          <p>{setting.description}</p>
                        </div>

                        <label
                          className={[
                            'guardian-toggle',
                            enabled ? 'guardian-toggle--enabled' : '',
                            saving ? 'guardian-toggle--saving' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={Boolean(notificationSavingKey)}
                            aria-label={`${setting.label} ${enabled ? '사용 중' : '사용 안 함'}`}
                            onChange={(event) => {
                              saveNotificationSetting(setting.key, event.target.checked);
                            }}
                          />
                          <span className="guardian-toggle__track" aria-hidden="true">
                            <span className="guardian-toggle__thumb" />
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {selectedEnergySenior && (
          <EnergyInformationModal
            senior={selectedEnergySenior}
            onClose={
              closeEnergyInformationModal
            }
            onSaved={
              handleEnergyInformationSaved
            }
          />
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
      </main>
    </GuardianLayout>
  );
}
