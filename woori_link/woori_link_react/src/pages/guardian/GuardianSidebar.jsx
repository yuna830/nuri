import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  acknowledgeAlert,
  getGuardianAlerts,
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import { getUser } from '../../utils/auth.js';

import '../../css/guardian/GuardianSidebar.css';


const MENU_ITEMS = [
  {
    key: 'home',
    label: '홈',
    path: '/guardian',
    icon: 'home',
  },
  {
    key: 'seniors',
    label: '어르신 현황',
    path: '/guardian/seniors',
    icon: 'senior',
  },
  {
    key: 'safety',
    label: '제품·생활안전',
    path: '/guardian/safety',
    icon: 'product',
  },
  {
    key: 'welfare',
    label: '복지·안전 도우미',
    path: '/guardian/welfare',
    icon: 'chat',
  },
];


const UNREAD_STATUSES = [
  'NEW',
  'UNREAD',
  'OPEN',
  'PENDING',
  'IN_PROGRESS',
];


const ALERT_TYPE_LABELS = {
  CHECK_IN: '안부',
  CHECKIN: '안부',
  AI_CHECK: '안부',

  LOCATION: '위치',
  LOCATION_ANOMALY: '위치',

  GEOFENCE: '안전구역',
  GEOFENCE_EXIT: '안전구역',
  SAFETY_ZONE: '안전구역',

  RECALL: '리콜',
  PRODUCT_RECALL: '리콜',

  WEATHER: '기상',
  WEATHER_ALERT: '기상',

  WELFARE: '복지',
  VOUCHER: '복지',
  ENERGY_VOUCHER: '복지',

  SAFETY: '생활안전',
  ELECTRICITY: '생활안전',
  GAS: '생활안전',
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


function getAlertId(alert) {
  return alert?.id ?? alert?.alertId ?? null;
}


function getAlertSeniorId(alert) {
  return (
    alert?.seniorId
    ?? alert?.senior?.id
    ?? alert?.targetSeniorId
    ?? null
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


function getAlertStatus(alert) {
  return String(alert?.status ?? '').toUpperCase();
}


function isUnreadAlert(alert) {
  return UNREAD_STATUSES.includes(getAlertStatus(alert));
}


function getAlertTitle(alert) {
  return (
    alert?.title
    ?? alert?.subject
    ?? alert?.alertTitle
    ?? '확인할 알림이 있습니다.'
  );
}


function getAlertMessage(alert) {
  return (
    alert?.message
    ?? alert?.content
    ?? alert?.description
    ?? ''
  );
}


function getAlertTimestamp(alert) {
  return (
    alert?.occurredAt
    ?? alert?.sentAt
    ?? alert?.createdAt
    ?? alert?.updatedAt
    ?? alert?.timestamp
    ?? null
  );
}


function formatAlertTime(value) {
  if (!value) {
    return '시간 정보 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) {
    return '방금 전';
  }

  if (difference < hour) {
    return `${Math.floor(difference / minute)}분 전`;
  }

  if (difference < day) {
    return `${Math.floor(difference / hour)}시간 전`;
  }

  if (difference < day * 7) {
    return `${Math.floor(difference / day)}일 전`;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}


function getAlertTypeLabel(alert) {
  return ALERT_TYPE_LABELS[getAlertType(alert)] ?? '알림';
}


function getAlertSeniorName(alert, seniors) {
  if (alert?.seniorName) {
    return alert.seniorName;
  }

  if (alert?.senior?.name) {
    return alert.senior.name;
  }

  const seniorId = getAlertSeniorId(alert);

  const senior = seniors.find((item) => (
    String(item.id) === String(seniorId)
  ));

  return senior?.name ?? '담당 어르신';
}


function getAlertAction(alert) {
  const type = getAlertType(alert);
  const seniorId = getAlertSeniorId(alert);

  if (
    type.includes('RECALL')
    || type.includes('PRODUCT')
    || type.includes('ELECTRIC')
    || type.includes('GAS')
    || type.includes('SAFETY')
  ) {
    return {
      label: '제품 확인',
      path: seniorId
        ? `/guardian/safety?seniorId=${seniorId}`
        : '/guardian/safety',
    };
  }

  if (
    type.includes('WELFARE')
    || type.includes('VOUCHER')
  ) {
    return {
      label: '지원 내용 보기',
      path: seniorId
        ? `/guardian/welfare?seniorId=${seniorId}`
        : '/guardian/welfare',
    };
  }

  return {
    label: type.includes('LOCATION') || type.includes('GEOFENCE')
      ? '위치 확인'
      : '현황 확인',

    path: seniorId
      ? `/guardian/seniors?seniorId=${seniorId}`
      : '/guardian/seniors',
  };
}


function SidebarIcon({ type }) {
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.8 12 3l9 7.8v9.1a1.1 1.1 0 0 1-1.1 1.1h-5.2v-6.3H9.3V21H4.1A1.1 1.1 0 0 1 3 19.9Z" />
      </svg>
    );
  }

  if (type === 'senior') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </svg>
    );
  }

  if (type === 'product') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 7 8-4 8 4v10l-8 4-8-4Z" />
        <path d="m4 7 8 4 8-4M12 11v10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4A2.5 2.5 0 0 1 2 13.5v-8Z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  );
}


function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </svg>
  );
}


function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


export default function GuardianSidebar({
  activeMenu,
  mobileOpen = false,
  onClose,
}) {
  const navigate = useNavigate();
  const currentUser = getUser();

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [seniors, setSeniors] = useState([]);

  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertError, setAlertError] = useState('');

  const [processingAlertId, setProcessingAlertId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);


  const unreadCount = useMemo(() => (
    alerts.filter(isUnreadAlert).length
  ), [alerts]);


  const sortedAlerts = useMemo(() => (
    [...alerts].sort((first, second) => (
      new Date(getAlertTimestamp(second) ?? 0).getTime()
      - new Date(getAlertTimestamp(first) ?? 0).getTime()
    ))
  ), [alerts]);


  const loadAlerts = useCallback(async ({
    showLoading = true,
  } = {}) => {
    if (showLoading) {
      setAlertsLoading(true);
    }

    setAlertError('');

    try {
      const [alertsResponse, seniorsResponse] = await Promise.all([
        getGuardianAlerts(),
        getSeniorsByGuardian(),
      ]);

      setAlerts(normalizeArray(alertsResponse.data));
      setSeniors(normalizeArray(seniorsResponse.data));
    } catch (error) {
      setAlertError(
        error.response?.data?.message
        || '알림을 불러오지 못했습니다.',
      );
    } finally {
      if (showLoading) {
        setAlertsLoading(false);
      }
    }
  }, []);


  useEffect(() => {
    loadAlerts();

    const intervalId = window.setInterval(() => {
      loadAlerts({
        showLoading: false,
      });
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadAlerts]);


  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  const handleMenuClick = (menu) => {
    setNotificationOpen(false);
    navigate(menu.path);

    if (onClose) {
      onClose();
    }
  };


  const handleAcknowledgeAlert = async (alert) => {
    const alertId = getAlertId(alert);

    if (!alertId) {
      return;
    }

    setProcessingAlertId(alertId);
    setAlertError('');

    try {
      await acknowledgeAlert(alertId, false);

      setAlerts((previous) => (
        previous.map((item) => (
          String(getAlertId(item)) === String(alertId)
            ? {
              ...item,
              status: 'READ',
            }
            : item
        ))
      ));
    } catch (error) {
      setAlertError(
        error.response?.data?.message
        || '알림 확인 처리에 실패했습니다.',
      );
    } finally {
      setProcessingAlertId(null);
    }
  };


  const handleMarkAllRead = async () => {
    const unreadAlerts = alerts.filter((alert) => (
      isUnreadAlert(alert)
      && getAlertId(alert)
    ));

    if (unreadAlerts.length === 0) {
      return;
    }

    setMarkingAll(true);
    setAlertError('');

    try {
      const results = await Promise.allSettled(
        unreadAlerts.map((alert) => (
          acknowledgeAlert(getAlertId(alert), false)
        )),
      );

      const failed = results.some((result) => (
        result.status === 'rejected'
      ));

      await loadAlerts({
        showLoading: false,
      });

      if (failed) {
        setAlertError(
          '일부 알림을 읽음 처리하지 못했습니다.',
        );
      }
    } finally {
      setMarkingAll(false);
    }
  };


  const handleAlertAction = async (alert) => {
    if (isUnreadAlert(alert)) {
      await handleAcknowledgeAlert(alert);
    }

    const action = getAlertAction(alert);

    setNotificationOpen(false);
    navigate(action.path);

    if (onClose) {
      onClose();
    }
  };


  const handleLogout = () => {
    const confirmed = window.confirm(
      '로그아웃하시겠습니까?',
    );

    if (!confirmed) {
      return;
    }

    [
      'user',
      'token',
      'accessToken',
      'guardianId',
    ].forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });

    navigate('/guardian/login', {
      replace: true,
    });
  };


  return (
    <>
      <button
        type="button"
        className={[
          'guardian-sidebar-overlay',
          mobileOpen
            ? 'guardian-sidebar-overlay--open'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClose}
        aria-label="사이드바 닫기"
      />

      <aside
        className={[
          'guardian-sidebar',
          mobileOpen
            ? 'guardian-sidebar--open'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="guardian-sidebar__top">
          <div className="guardian-sidebar__brand-row">
            <button
              type="button"
              className="guardian-sidebar__brand"
              onClick={() => navigate('/guardian')}
            >
              <span className="guardian-sidebar__logo">
                WOORI
              </span>

              <span className="guardian-sidebar__role">
                보호자
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
                onClick={() => (
                  setNotificationOpen((previous) => !previous)
                )}
                aria-label={`미확인 알림 ${unreadCount}건`}
              >
                <BellIcon />

                {unreadCount > 0 && (
                  <span className="guardian-sidebar__notification-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="guardian-sidebar__mobile-close"
                onClick={onClose}
                aria-label="사이드바 닫기"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <nav
            className="guardian-sidebar__navigation"
            aria-label="보호자 메뉴"
          >
            {MENU_ITEMS.map((menu) => {
              const active = activeMenu === menu.key;

              return (
                <button
                  type="button"
                  key={menu.key}
                  className={[
                    'guardian-sidebar__menu',
                    active
                      ? 'guardian-sidebar__menu--active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleMenuClick(menu)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="guardian-sidebar__menu-icon">
                    <SidebarIcon type={menu.icon} />
                  </span>

                  <span className="guardian-sidebar__menu-label">
                    {menu.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="guardian-sidebar__account">
          <div className="guardian-sidebar__account-copy">
            <strong>
              {currentUser?.name || '보호자'}
            </strong>

            <span>보호자 계정</span>
          </div>

          <button
            type="button"
            className="guardian-sidebar__logout"
            onClick={handleLogout}
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
            onClick={() => setNotificationOpen(false)}
            aria-label="알림 닫기"
          />

          <section
            className="guardian-notification-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-notification-title"
          >
            <header className="guardian-notification-panel__header">
              <div>
                <div className="guardian-notification-panel__title-row">
                  <h2 id="guardian-notification-title">
                    알림
                  </h2>

                  {unreadCount > 0 && (
                    <span>미확인 {unreadCount}건</span>
                  )}
                </div>

                <p>
                  최근 확인이 필요한 내용을 표시합니다.
                </p>
              </div>

              <button
                type="button"
                className="guardian-notification-panel__close"
                onClick={() => setNotificationOpen(false)}
                aria-label="알림 닫기"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="guardian-notification-panel__toolbar">
              <span>최근 알림 {sortedAlerts.length}건</span>

              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0 || markingAll}
              >
                {markingAll ? '처리 중...' : '모두 읽음'}
              </button>
            </div>

            {alertError && (
              <div className="guardian-notification-panel__error">
                {alertError}
              </div>
            )}

            <div className="guardian-notification-panel__content">
              {alertsLoading ? (
                <div className="guardian-notification-panel__state">
                  알림을 불러오는 중입니다.
                </div>
              ) : sortedAlerts.length === 0 ? (
                <div className="guardian-notification-panel__empty">
                  <span className="guardian-notification-panel__empty-icon">
                    <BellIcon />
                  </span>

                  <strong>새로운 알림이 없습니다.</strong>

                  <p>
                    확인할 내용이 생기면 이곳에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="guardian-notification-list">
                  {sortedAlerts.map((alert, index) => {
                    const alertId = (
                      getAlertId(alert)
                      ?? `alert-${index}`
                    );

                    const unread = isUnreadAlert(alert);
                    const action = getAlertAction(alert);

                    return (
                      <article
                        key={alertId}
                        className={[
                          'guardian-notification-item',
                          unread
                            ? 'guardian-notification-item--unread'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="guardian-notification-item__top">
                          <div className="guardian-notification-item__labels">
                            <span className="guardian-notification-item__type">
                              {getAlertTypeLabel(alert)}
                            </span>

                            {unread && (
                              <span className="guardian-notification-item__new">
                                새 알림
                              </span>
                            )}
                          </div>

                          <time>
                            {formatAlertTime(
                              getAlertTimestamp(alert),
                            )}
                          </time>
                        </div>

                        <div className="guardian-notification-item__copy">
                          <strong>
                            {getAlertSeniorName(alert, seniors)} 어르신
                          </strong>

                          <h3>{getAlertTitle(alert)}</h3>

                          {getAlertMessage(alert) && (
                            <p>{getAlertMessage(alert)}</p>
                          )}
                        </div>

                        <div className="guardian-notification-item__actions">
                          {unread ? (
                            <button
                              type="button"
                              className="guardian-notification-item__read-button"
                              onClick={() => (
                                handleAcknowledgeAlert(alert)
                              )}
                              disabled={
                                processingAlertId === getAlertId(alert)
                              }
                            >
                              {processingAlertId === getAlertId(alert)
                                ? '처리 중...'
                                : '읽음 처리'}
                            </button>
                          ) : (
                            <span className="guardian-notification-item__read-label">
                              확인됨
                            </span>
                          )}

                          <button
                            type="button"
                            className="guardian-notification-item__action-button"
                            onClick={() => handleAlertAction(alert)}
                          >
                            {action.label}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}