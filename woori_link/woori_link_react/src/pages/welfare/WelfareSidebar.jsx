import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  logout,
} from '../../api/authApi.js';

import {
  getWelfareAlerts,
} from '../../api/notificationApi.js';

import {
  clearUser,
  getUser,
} from '../../utils/auth.js';

import '../../css/guardian/GuardianSidebar.css';


const MENUS = [
  {
    label: '대시보드',
    path: '/welfare',
    icon: 'home',
  },
  {
    label: '대상자 목록',
    path: '/welfare/seniors',
    icon: 'senior',
  },
  {
    label: '에너지복지 신청 지원',
    path: '/welfare/energy-voucher',
    icon: 'welfare',
  },
  {
    label: '리콜 제품 조치 관리',
    path: '/welfare/recalled',
    icon: 'product',
  },
  {
    label: '마이페이지',
    path: '/welfare/mypage',
    icon: 'senior',
  },
];


function SidebarIcon({
  type,
}) {
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (type === 'senior') {
    return (
      <svg viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="7"
          r="3"
        />

        <path d="M6 21v-4a6 6 0 0 1 12 0v4" />
      </svg>
    );
  }

  if (type === 'product') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    );
  }

  if (type === 'schedule') {
    return (
      <svg viewBox="0 0 24 24">
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />

        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 5h16v12H8l-4 4V5Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}


function BellIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}


function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


function formatTime(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}


function getAlertId(alert) {
  return (
    alert?.id
    ?? alert?.alertId
    ?? ''
  );
}


function getAlertType(alert) {
  return String(
    alert?.type
    ?? alert?.alertType
    ?? alert?.category
    ?? '',
  ).toUpperCase();
}


function getConsultationRequestId(alert) {
  const directRequestId =
    alert?.consultationRequestId
    ?? alert?.requestId
    ?? alert?.referenceId
    ?? null;

  if (
    directRequestId !== null
    && directRequestId !== undefined
    && directRequestId !== ''
  ) {
    return String(
      directRequestId,
    );
  }

  const alertId =
    String(
      alert?.id
      ?? alert?.alertId
      ?? '',
    );

  const prefix =
    'energy-consultation-';

  if (
    alertId.startsWith(prefix)
  ) {
    return (
      alertId.slice(
        prefix.length,
      )
      || null
    );
  }

  return null;
}


function getWelfareAlertAction(alert) {
  const type =
    getAlertType(alert);

  const seniorId =
    alert?.seniorId
    ?? alert?.targetSeniorId
    ?? null;

  if (
    type ===
    'ENERGY_SUPPORT_CONSULTATION'
  ) {
    const consultationRequestId =
      getConsultationRequestId(
        alert,
      );

    const searchParams =
      new URLSearchParams();

    searchParams.set(
      'openConsultation',
      'true',
    );

    searchParams.set(
      'source',
      'ENERGY_SUPPORT',
    );

    if (seniorId) {
      searchParams.set(
        'seniorId',
        String(seniorId),
      );
    }

    if (consultationRequestId) {
      searchParams.set(
        'consultationRequestId',
        String(
          consultationRequestId,
        ),
      );
    }

    return {
      label: '상담 조율',

      path:
        `/welfare?${searchParams.toString()}`,
    };
  }

  if (
    type
    === 'SAFETY_SUPPORT_REQUEST'
  ) {
    return {
      label: '지원 확인',
      path: seniorId
        ? `/welfare/seniors/${seniorId}`
        : '/welfare/seniors',
    };
  }

  if (
    type
    === 'RECALL_PRODUCT_REGISTERED'
  ) {
    return {
      label: '제품 확인',
      path: '/welfare/recalled',
    };
  }

  if (
    type
    === 'GUARDIAN_UNREAD_CHECK_IN'
  ) {
    return {
      label: '안부 확인',
      path: seniorId
        ? `/welfare/seniors/${seniorId}`
        : '/welfare/seniors',
    };
  }

  if (
    type
    === 'VISIT_INTENT'
  ) {
    const searchParams =
      new URLSearchParams();

    if (seniorId) {
      searchParams.set(
        'seniorId',
        String(seniorId),
      );
    }

    return {
      label: '일정 확인',
      path: searchParams.toString()
        ? `/welfare/schedule?${searchParams.toString()}`
        : '/welfare/schedule',
    };
  }

  return null;
}


export default function WelfareSidebar() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const user =
    getUser('WELFARE_WORKER')
    || getUser();

  const [
    notificationOpen,
    setNotificationOpen,
  ] = useState(false);

  const [
    alerts,
    setAlerts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    deletingAll,
    setDeletingAll,
  ] = useState(false);

  const [
    dismissedIds,
    setDismissedIds,
  ] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          'welfareDismissedAlertIds',
        ) || '[]',
      );
    } catch {
      return [];
    }
  });

  const [
    seenIds,
    setSeenIds,
  ] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          'welfareSeenAlertIds',
        ) || '[]',
      );
    } catch {
      return [];
    }
  });


  const loadAlerts =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError('');

          const response =
            await getWelfareAlerts();

          const nextAlerts =
            Array.isArray(
              response?.data,
            )
              ? response.data
              : [];

          setAlerts(
            nextAlerts.filter(
              (alert) => (
                !dismissedIds.includes(
                  getAlertId(alert),
                )
              ),
            ),
          );
        } catch (requestError) {
          console.error(
            '복지사 알림 조회 실패:',
            requestError,
          );

          setError(
            '알림을 불러오지 못했습니다.',
          );
        } finally {
          setLoading(false);
        }
      },
      [dismissedIds],
    );


  useEffect(() => {
    loadAlerts();

    const timer =
      window.setInterval(
        loadAlerts,
        60000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [loadAlerts]);


  useEffect(() => {
    if (!notificationOpen) {
      return undefined;
    }

    const onKeyDown =
      (event) => {
        if (
          event.key === 'Escape'
        ) {
          setNotificationOpen(
            false,
          );
        }
      };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [notificationOpen]);


  const unreadCount =
    useMemo(
      () => (
        alerts.filter(
          (alert) => (
            !seenIds.includes(
              getAlertId(alert),
            )
          ),
        ).length
      ),
      [
        alerts,
        seenIds,
      ],
    );


  function markAllRead() {
    const nextIds =
      alerts
        .map(
          (alert) => (
            getAlertId(alert)
          ),
        )
        .filter(Boolean);

    const mergedIds = [
      ...new Set([
        ...seenIds,
        ...nextIds,
      ]),
    ];

    setSeenIds(
      mergedIds,
    );

    localStorage.setItem(
      'welfareSeenAlertIds',
      JSON.stringify(
        mergedIds,
      ),
    );
  }


  function markRead(alertId) {
    if (
      !alertId
      || seenIds.includes(
        alertId,
      )
    ) {
      return;
    }

    const nextIds = [
      ...seenIds,
      alertId,
    ];

    setSeenIds(
      nextIds,
    );

    localStorage.setItem(
      'welfareSeenAlertIds',
      JSON.stringify(
        nextIds,
      ),
    );
  }


  function handleAlertAction(alert) {
    const action =
      getWelfareAlertAction(
        alert,
      );

    if (!action) {
      return;
    }

    markRead(
      getAlertId(alert),
    );

    setNotificationOpen(
      false,
    );

    navigate(
      action.path,
    );
  }


  function deleteAllAlerts() {
    if (
      alerts.length === 0
      || deletingAll
    ) {
      return;
    }

    setDeletingAll(true);

    const alertIds =
      alerts
        .map(
          (alert) => (
            getAlertId(alert)
          ),
        )
        .filter(Boolean);

    const nextIds = [
      ...new Set([
        ...dismissedIds,
        ...alertIds,
      ]),
    ];

    setDismissedIds(
      nextIds,
    );

    localStorage.setItem(
      'welfareDismissedAlertIds',
      JSON.stringify(
        nextIds,
      ),
    );

    setAlerts([]);
    setDeletingAll(false);
  }


  async function handleLogout() {
    try {
      await logout();
    } catch (requestError) {
      console.error(
        '복지사 로그아웃 요청 실패:',
        requestError,
      );
    } finally {
      clearUser();

      navigate(
        '/welfare/login',
        {
          replace: true,
        },
      );
    }
  }


  function isActive(path) {
    if (path === '/welfare') {
      return (
        location.pathname
        === path
      );
    }

    return (
      location.pathname
        .startsWith(path)
    );
  }


  return (
    <>
      <aside className="guardian-sidebar welfare-sidebar">
        <div className="guardian-sidebar__top">
          <div className="guardian-sidebar__brand-row">
            <button
              type="button"
              className="guardian-sidebar__brand"
              onClick={() => {
                navigate(
                  '/welfare',
                );
              }}
            >
              <span className="guardian-sidebar__logo">
                WOORI
              </span>

              <span className="guardian-sidebar__role">
                복지사
              </span>
            </button>

            <div className="guardian-sidebar__brand-actions">
              <button
                type="button"
                className={[
                  'guardian-sidebar__notification-button',

                  notificationOpen
                    ? 'guardian-sidebar__notification-button--active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setNotificationOpen(
                    true,
                  );

                  loadAlerts();
                }}
                aria-label={
                  `알림 ${unreadCount}건`
                }
              >
                <BellIcon />

                {unreadCount > 0 && (
                  <span className="guardian-sidebar__notification-badge">
                    {unreadCount > 99
                      ? '99+'
                      : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <nav className="guardian-sidebar__navigation">
            {MENUS.map(
              (menu) => (
                <button
                  key={menu.path}
                  type="button"
                  className={[
                    'guardian-sidebar__menu',

                    isActive(
                      menu.path,
                    )
                      ? 'guardian-sidebar__menu--active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    navigate(
                      menu.path,
                    );
                  }}
                >
                  <span className="guardian-sidebar__menu-icon">
                    <SidebarIcon
                      type={menu.icon}
                    />
                  </span>

                  <span className="guardian-sidebar__menu-label">
                    {menu.label}
                  </span>
                </button>
              ),
            )}
          </nav>
        </div>

        <div className="guardian-sidebar__account">
          <div className="guardian-sidebar__account-copy">
            <strong>
              {user?.name
                || '담당자'}
            </strong>

            <span>
              복지사 계정
            </span>
          </div>

          <button
            type="button"
            className="guardian-sidebar__logout"
            onClick={
              handleLogout
            }
          >
            로그아웃
          </button>
        </div>
      </aside>

      {notificationOpen && (
        <>
          <button
            type="button"
            className="guardian-notification-overlay"
            onClick={() => {
              setNotificationOpen(
                false,
              );
            }}
            aria-label="알림 닫기"
          />

          <section
            className="guardian-notification-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welfare-notification-title"
          >
            <header className="guardian-notification-panel__header">
              <div>
                <div className="guardian-notification-panel__title-row">
                  <h2 id="welfare-notification-title">
                    알림
                  </h2>

                  {unreadCount > 0 && (
                    <span>
                      미확인 {unreadCount}건
                    </span>
                  )}
                </div>

                <p>
                  담당 대상자의 주요 안전 및 업무 알림입니다.
                </p>
              </div>

              <button
                type="button"
                className="guardian-notification-panel__close"
                onClick={() => {
                  setNotificationOpen(
                    false,
                  );
                }}
                aria-label="알림 닫기"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="guardian-notification-panel__toolbar">
              <span>
                최근 알림 {alerts.length}건
              </span>

              <div className="guardian-notification-panel__toolbar-actions">
                <button
                  type="button"
                  onClick={
                    markAllRead
                  }
                  disabled={
                    unreadCount === 0
                    || deletingAll
                  }
                >
                  모두 확인
                </button>

                <button
                  type="button"
                  className="guardian-notification-panel__delete-all"
                  onClick={
                    deleteAllAlerts
                  }
                  disabled={
                    alerts.length === 0
                    || deletingAll
                  }
                >
                  모두 삭제
                </button>
              </div>
            </div>

            {error && (
              <div className="guardian-notification-panel__error">
                {error}
              </div>
            )}

            <div className="guardian-notification-panel__content">
              {loading
                && alerts.length === 0 ? (
                <div className="guardian-notification-panel__state">
                  알림을 불러오는 중입니다.
                </div>
              ) : alerts.length === 0 ? (
                <div className="guardian-notification-panel__empty">
                  <span className="guardian-notification-panel__empty-icon">
                    <BellIcon />
                  </span>

                  <strong>
                    새로운 알림이 없습니다.
                  </strong>

                  <p>
                    확인이 필요한 내용이 생기면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="guardian-notification-list">
                  {alerts.map(
                    (alert) => {
                      const alertId =
                        getAlertId(alert);

                      const alertType =
                        getAlertType(alert);

                      const unread =
                        !seenIds.includes(
                          alertId,
                        );

                      const isRecall =
                        alertType
                        === 'RECALL_PRODUCT_REGISTERED';

                      const isImmediateStop =
                        isRecall
                        && alert.actionType
                        === 'IMMEDIATE_STOP';

                      const action =
                        getWelfareAlertAction(
                          alert,
                        );

                      const isEnergyConsultation =
                        alertType
                        === 'ENERGY_SUPPORT_CONSULTATION';

                      return (
                        <article
                          key={alertId}
                          className={[
                            'guardian-notification-item',
                            'welfare-notification-item',

                            unread
                              ? 'welfare-notification-item--unread'
                              : 'welfare-notification-item--read',

                            isImmediateStop
                              ? 'welfare-notification-item--danger'
                              : '',

                            isRecall
                              && !isImmediateStop
                              ? 'welfare-notification-item--recall'
                              : '',

                            isEnergyConsultation
                              ? 'welfare-notification-item--consultation'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="welfare-notification-item__heading">
                            <h3>
                              {alert.title
                                || '담당 대상자 업무 알림'}
                            </h3>

                            <div className="welfare-notification-item__meta">
                              <time>
                                {formatTime(
                                  alert.createdAt,
                                )}
                              </time>

                              {action ? (
                                <button
                                  type="button"
                                  className={[
                                    'welfare-notification-item__action-button',

                                    isEnergyConsultation
                                      ? 'welfare-notification-item__action-button--consultation'
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  onClick={() => {
                                    handleAlertAction(
                                      alert,
                                    );
                                  }}
                                >
                                  {action.label}
                                </button>
                              ) : unread ? (
                                <button
                                  type="button"
                                  className="welfare-notification-item__read-button"
                                  onClick={() => {
                                    markRead(
                                      alertId,
                                    );
                                  }}
                                >
                                  확인
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="guardian-notification-item__copy">
                            {alert.message && (
                              <p>
                                {alert.message}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
