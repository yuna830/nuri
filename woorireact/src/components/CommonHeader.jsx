import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAlerts } from "../api/userPageApi.js";
import "../css/user/UserCommonHeader.css";
import "../css/common/CommonHeader.css";

const DEFAULT_NOTIFICATION_TABS = ["전체", "읽지 않음", "긴급", "낙상", "복약", "기후", "요청"];
const READ_STATUSES = new Set(["확인됨", "읽음", "확인함", "조치완료", "만남 완료", "read", "READ", "resolved", "RESOLVED"]);

function CommonHeader({
  logoText = "우리 woori",
  homePath = "/",
  afterLogo,
  rightText,
  actions,
  afterActions,
  className = "",
  notifications = [],
  notificationTabs = DEFAULT_NOTIFICATION_TABS,
  showNotificationButton = false,
  onReadNotification,
  onNotificationClick,
  renderNotificationActions,
}) {
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState(notificationTabs[0] || "전체");
  const [selectedNotificationKeys, setSelectedNotificationKeys] = useState([]);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState([]);
  const [isDeletingNotifications, setIsDeletingNotifications] = useState(false);
  const notificationTabsRef = useRef(null);

  useEffect(() => {
    if (!notificationTabs.includes(activeNotificationTab)) {

      setActiveNotificationTab(notificationTabs[0] || "전체");
    }
  }, [activeNotificationTab, notificationTabs]);

  const headerClassName = ["common-app-header", className].filter(Boolean).join(" ");

  const normalizedNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => !hiddenNotificationIds.includes(String(notification.id)))
        .map((notification, index) => {
          const status = notification.status || notification.readStatus || "";

          return {
            key: notification.key || notification.id || `notification-${index}`,
            id: notification.id,
            title: notification.title || "새 알림",
            message: notification.message || "",
            category: notification.category || "정보",
            time: notification.time || notification.createdAt || "",
            isRead: notification.isRead === true || READ_STATUSES.has(status),
            statusLabel: notification.statusLabel,
            danger:
              notification.danger === true ||
              notification.isSafeZone === true ||
              notification.severity === "danger",
            raw: notification.raw || notification,
          };
        }),
    [hiddenNotificationIds, notifications]
  );

  const unreadCount = normalizedNotifications.filter((notification) => !notification.isRead).length;

  const filteredNotifications = useMemo(() => {
    if (activeNotificationTab === "전체") {
      return normalizedNotifications;
    }

    if (activeNotificationTab === "읽지 않음" || activeNotificationTab === "미확인") {
      return normalizedNotifications.filter((notification) => !notification.isRead);
    }

    return normalizedNotifications.filter((notification) => notification.category === activeNotificationTab);
  }, [activeNotificationTab, normalizedNotifications]);

  const getTabCount = (tab) => {
    if (tab === "전체") {
      return normalizedNotifications.length;
    }

    if (tab === "읽지 않음" || tab === "미확인") {
      return unreadCount;
    }

    return normalizedNotifications.filter((notification) => notification.category === tab).length;
  };

  const handleNotificationClick = (notification) => {
    if (!onNotificationClick) return;
    onNotificationClick?.(notification.raw);
  };

  const scrollNotificationTabs = (direction) => {
    const currentIndex = notificationTabs.indexOf(activeNotificationTab);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), notificationTabs.length - 1);
    setActiveNotificationTab(notificationTabs[nextIndex]);
  };

  useEffect(() => {
    const activeTabButton = notificationTabsRef.current?.querySelector("[data-active='true']");
    activeTabButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

    setSelectedNotificationKeys([]);
  }, [activeNotificationTab]);

  useEffect(() => {
    if (!isNotificationOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNotificationOpen]);

  const handleReadClick = async (event, notification) => {
    event.stopPropagation();

    if (!notification.id || notification.isRead || !onReadNotification) return;
    await onReadNotification(notification.raw);
  };

  const getActionLabel = (notification) => {
    const type = notification.raw?.type || notification.type;
    const title = notification.title || notification.raw?.title || "";
    const category = notification.category || notification.raw?.category || "";

    if (notification.raw?.isSosCancel || type === "SOS_CANCEL") {
      return "확인함";
    }

    if (notification.raw?.isSafeZone || type === "SAFE_ZONE" || type === "SAFE_ZONE_EXIT") {
      return "만남";
    }

    if (type === "INFO_UPDATE_REQUEST") {
      return "정보 입력";
    }

    if (type === "INFO_UPDATE_COMPLETE" || type === "PROFILE_UPDATE") {
      return "확인";
    }

    if (type === "CHECK_IN_OK") {
      return "확인";
    }

    if (
      type === "WELFARE_CONSULT_REQUEST" ||
      type === "WELFARE_CONSULTATION" ||
      type === "CONSULT_REQUEST" ||
      type === "CONSULTATION_REQUEST" ||
      title.includes("상담")
    ) {
      return "상담 선택";
    }

    if (
      type === "SOS" ||
      title.includes("SOS") ||
      category === "긴급"
    ) {
      return "긴급 확인";
    }

    return "확인";
  };

  const getReadLabel = (notification) => {
    const type = notification.raw?.type || notification.type;
    const title = notification.title || notification.raw?.title || "";
    const category = notification.category || notification.raw?.category || "";

    if (notification.raw?.isSosCancel || type === "SOS_CANCEL") {
      return "확인됨";
    }

    if (notification.raw?.isSafeZone || type === "SAFE_ZONE" || type === "SAFE_ZONE_EXIT") {
      return "만남 완료";
    }

    if (
      type === "SOS" ||
      title.includes("SOS") ||
      category === "긴급"
    ) {
      return "긴급 확인됨";
    }

    return "확인됨";
  };

  const renderDefaultAction = (notification) => (
    notification.isRead ? null : (
      <button type="button" onClick={(event) => handleReadClick(event, notification)}>
        {getActionLabel(notification)}
      </button>
    )
  );

  const getServerAlertId = (id) => {
    if (id == null) return null;
    const value = String(id);
    const match = value.match(/(?:^|-)(local-alert-)?(\d+)$/);
    if (!match) return null;
    return Number(match[2]);
  };

  const deletableFilteredNotifications = filteredNotifications.filter((notification) => notification.id);
  const selectedDeletableNotifications = selectedNotificationKeys
    .map((key) => filteredNotifications.find((notification) => notification.key === key))
    .filter((notification) => notification?.id);
  const selectedDeletableNotificationIds = selectedDeletableNotifications
    .map((notification) => getServerAlertId(notification.id))
    .filter((id) => id != null);

  const toggleNotificationSelection = (key) => {
    setSelectedNotificationKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const toggleAllFilteredNotifications = () => {
    const keys = deletableFilteredNotifications.map((notification) => notification.key);
    const allSelected = keys.length > 0 && keys.every((key) => selectedNotificationKeys.includes(key));
    setSelectedNotificationKeys((prev) => (
      allSelected
        ? prev.filter((key) => !keys.includes(key))
        : [...new Set([...prev, ...keys])]
    ));
  };

  const removeNotificationsFromList = (notificationsToHide) => {
    const stringIds = notificationsToHide.map((notification) => String(notification.id));
    setHiddenNotificationIds((prev) => [...new Set([...prev, ...stringIds])]);
    setSelectedNotificationKeys([]);
  };

  const handleDeleteSelectedNotifications = async () => {
    if (selectedDeletableNotifications.length === 0 || isDeletingNotifications) return;
    setIsDeletingNotifications(true);
    try {
      if (selectedDeletableNotificationIds.length > 0) {
        await deleteAlerts(selectedDeletableNotificationIds);
      }
      removeNotificationsFromList(selectedDeletableNotifications);
    } finally {
      setIsDeletingNotifications(false);
    }
  };

  const handleDeleteAllFilteredNotifications = async () => {
    const ids = deletableFilteredNotifications
      .map((notification) => getServerAlertId(notification.id))
      .filter((id) => id != null);
    if (deletableFilteredNotifications.length === 0 || isDeletingNotifications) return;
    setIsDeletingNotifications(true);
    try {
      if (ids.length > 0) {
        await deleteAlerts(ids);
      }
      removeNotificationsFromList(deletableFilteredNotifications);
    } finally {
      setIsDeletingNotifications(false);
    }
  };

  return (
    <>
      <header className={headerClassName}>
        <div className="common-app-header-inner">
          <div className="common-app-logo-group">
            <button
              className="common-app-logo"
              type="button"
              onClick={() => navigate(homePath)}
            >
              {logoText}
            </button>

            {afterLogo}
          </div>

          <div className="common-app-actions">
            {rightText && <span className="common-app-header-text">{rightText}</span>}

            {actions}

            {showNotificationButton && (
              <button
                className="common-app-icon-button uch-alert-button"
                type="button"
                onClick={() => setIsNotificationOpen(true)}
                aria-label="알림"
              >
                🔔
                {unreadCount > 0 && <span className="common-app-badge">{unreadCount}</span>}
              </button>
            )}

            {afterActions}
          </div>
        </div>
      </header>

      {isNotificationOpen && (
        <div className="uch-alert-backdrop" onClick={() => setIsNotificationOpen(false)}>
          <section className="uch-alert-panel" onClick={(event) => event.stopPropagation()}>
            <div className="uch-alert-panel-header">
              <div>
                <h2>전체 알림</h2>
                <p>오늘 알림과 최근 요청 알림을 확인할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setIsNotificationOpen(false)}>
                닫기
              </button>
            </div>

            <div className="uch-alert-tabs-wrap common-alert-tabs-wrap">
              <button
                className="uch-alert-tabs-arrow"
                type="button"
                onClick={() => scrollNotificationTabs(-1)}
                aria-label="이전 알림 카테고리"
              >
                &lt;
              </button>
              <div className="uch-alert-tabs" ref={notificationTabsRef} role="tablist" aria-label="알림 분류">
                {notificationTabs.map((tab) => {
                  const count = getTabCount(tab);

                  return (
                    <button
                      key={tab}
                      className={activeNotificationTab === tab ? "active" : ""}
                      data-active={activeNotificationTab === tab}
                      type="button"
                      onClick={() => setActiveNotificationTab(tab)}
                    >
                      <span>{tab}</span>
                      {count > 0 && <em>{count}</em>}
                    </button>
                  );
                })}
              </div>
              <button
                className="uch-alert-tabs-arrow"
                type="button"
                onClick={() => scrollNotificationTabs(1)}
                aria-label="다음 알림 카테고리"
              >
                &gt;
              </button>
            </div>

            <div className="uch-alert-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={deletableFilteredNotifications.length > 0 && deletableFilteredNotifications.every((notification) => selectedNotificationKeys.includes(notification.key))}
                  disabled={deletableFilteredNotifications.length === 0}
                  onChange={toggleAllFilteredNotifications}
                />
                전체 선택
              </label>
              <div>
                <button type="button" disabled={selectedDeletableNotifications.length === 0 || isDeletingNotifications} onClick={handleDeleteSelectedNotifications}>
                  선택 삭제
                </button>
                <button type="button" disabled={deletableFilteredNotifications.length === 0 || isDeletingNotifications} onClick={handleDeleteAllFilteredNotifications}>
                  전체 삭제
                </button>
              </div>
            </div>

            <div className="uch-alert-panel-list">
              {filteredNotifications.length === 0 ? (
                <p className="uch-alert-empty">표시할 알림이 없습니다.</p>
              ) : (
                filteredNotifications.map((notification) => (
                  <article
                    key={notification.key}
                    className={`uch-alert-item common-alert-item ${onNotificationClick ? "clickable" : ""} ${notification.danger && !notification.isRead ? "danger" : ""} ${notification.isRead ? "read" : ""}`}
                    onClick={onNotificationClick ? () => handleNotificationClick(notification) : undefined}
                  >
                    <label className="uch-alert-select">
                      <input
                        type="checkbox"
                        checked={selectedNotificationKeys.includes(notification.key)}
                        disabled={!notification.id}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleNotificationSelection(notification.key)}
                        aria-label="알림 선택"
                      />
                    </label>
                    <div className="uch-alert-content">
                      {/* <div className="uch-alert-meta">
                        {notification.statusLabel !== null && (
                          <span className={notification.isRead ? "read" : "unread"}>
                            {notification.statusLabel || (notification.isRead ? getReadLabel(notification) : "확인 필요")}
                          </span>
                        )}
                        <span>{notification.category}</span>
                      </div>
                      <div className="uch-alert-title-row">
                        <strong>{notification.title}</strong>
                        {notification.time && (
                          <span className="uch-alert-time-inline">{notification.time}</span>
                        )}
                      </div> */}
                      <div className="uch-alert-meta">
                        <div className="uch-alert-meta-tags">
                          {notification.isRead && notification.statusLabel !== null && (
                            <span className="read">
                              {notification.statusLabel || getReadLabel(notification)}
                            </span>
                          )}
                          <span className={`category ${notification.category === "긴급" ? "danger" : ""}`}>
                            {notification.category}
                          </span>
                        </div>
                        {notification.time && (
                          <span className="uch-alert-time-inline">{notification.time}</span>
                        )}
                      </div>
                      <div className="uch-alert-title-row">
                        <strong>{notification.title}</strong>
                      </div>

                      <p>{notification.message}</p>
                      {notification.raw?.imageUrl && (
                        <img
                          className="uch-alert-thumbnail"
                          src={notification.raw.imageUrl}
                          alt={`${notification.title} 사진`}
                        />
                      )}
                    </div>

                    <div className="uch-alert-action">
                      {renderNotificationActions
                        ? renderNotificationActions(notification.raw, {
                          defaultAction: renderDefaultAction(notification),
                          onRead: (event) => handleReadClick(event, notification),
                          isRead: notification.isRead,
                          closeNotificationPanel: () => setIsNotificationOpen(false),
                        })
                        : renderDefaultAction(notification)}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default CommonHeader;
