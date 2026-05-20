import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/common/CommonHeader.css";
import "../css/user/UserCommonHeader.css";

const DEFAULT_NOTIFICATION_TABS = ["전체", "긴급", "낙상", "복약", "기후", "요청", "읽지 않음"];
const READ_STATUSES = new Set(["확인됨", "읽음", "확인함", "조치완료", "만남 완료", "read", "READ", "resolved", "RESOLVED"]);

function CommonHeader({
  logoText = "우리 woori",
  homePath = "/",
  rightText,
  actions,
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

  useEffect(() => {
    if (!notificationTabs.includes(activeNotificationTab)) {
      setActiveNotificationTab(notificationTabs[0] || "전체");
    }
  }, [activeNotificationTab, notificationTabs]);

  const headerClassName = ["common-app-header", className].filter(Boolean).join(" ");

  const normalizedNotifications = useMemo(
    () =>
      notifications.map((notification, index) => {
        const status = notification.status || notification.readStatus || "";

        return {
          key: notification.key || notification.id || `notification-${index}`,
          id: notification.id,
          title: notification.title || "새 알림",
          message: notification.message || "",
          category: notification.category || "정보",
          time: notification.time || notification.createdAt || "",
          isRead: notification.isRead === true || READ_STATUSES.has(status),
          danger:
            notification.danger === true ||
            notification.isSafeZone === true ||
            notification.severity === "danger",
          raw: notification.raw || notification,
        };
      }),
    [notifications]
  );

  const unreadCount = normalizedNotifications.filter((notification) => !notification.isRead).length;

  const filteredNotifications = useMemo(() => {
    if (activeNotificationTab === "전체") {
      return normalizedNotifications;
    }

    if (activeNotificationTab === "읽지 않음") {
      return normalizedNotifications.filter((notification) => !notification.isRead);
    }

    return normalizedNotifications.filter((notification) => notification.category === activeNotificationTab);
  }, [activeNotificationTab, normalizedNotifications]);

  const getTabCount = (tab) => {
    if (tab === "전체") {
      return normalizedNotifications.length;
    }

    if (tab === "읽지 않음") {
      return unreadCount;
    }

    return normalizedNotifications.filter((notification) => notification.category === tab).length;
  };

  const handleNotificationClick = (notification) => {
    onNotificationClick?.(notification.raw);
  };

  const handleReadClick = async (event, notification) => {
    event.stopPropagation();

    if (!notification.id || notification.isRead || !onReadNotification) return;
    await onReadNotification(notification.raw);
  };

  const getActionLabel = (notification) => {
    if (notification.raw?.isSosCancel) return "확인함";
    if (notification.raw?.isSafeZone) return "만남";
    return "조치완료";
  };

  const getReadLabel = (notification) => {
    if (notification.raw?.isSosCancel) return "확인함";
    if (notification.raw?.isSafeZone) return "만남 완료";
    return "조치완료";
  };

  const renderDefaultAction = (notification) => (
    notification.isRead ? (
      <em>{getReadLabel(notification)}</em>
    ) : (
      <button type="button" onClick={(event) => handleReadClick(event, notification)}>
        {getActionLabel(notification)}
      </button>
    )
  );

  return (
    <>
      <header className={headerClassName}>
        <div className="common-app-header-inner">
          <button
            className="common-app-logo"
            type="button"
            onClick={() => navigate(homePath)}
          >
            {logoText}
          </button>

          <div className="common-app-actions">
            {rightText && <span className="common-app-header-text">{rightText}</span>}

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

            {actions}
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
              <div className="uch-alert-tabs" role="tablist" aria-label="알림 분류">
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
            </div>

            <div className="uch-alert-panel-list">
              {filteredNotifications.length === 0 ? (
                <p className="uch-alert-empty">표시할 알림이 없습니다.</p>
              ) : (
                filteredNotifications.map((notification) => (
                  <article
                    key={notification.key}
                    className={`uch-alert-item common-alert-item ${notification.danger ? "danger" : ""} ${
                      notification.isRead ? "read" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="uch-alert-content">
                      <div className="uch-alert-meta">
                        <span className={notification.isRead ? "read" : "unread"}>
                          {notification.isRead ? getReadLabel(notification) : "확인 필요"}
                        </span>
                        <span>{notification.category}</span>
                      </div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      {notification.time && <span>{notification.time}</span>}
                    </div>

                    <div className="uch-alert-action">
                      {renderNotificationActions
                        ? renderNotificationActions(notification.raw, {
                            defaultAction: renderDefaultAction(notification),
                            onRead: (event) => handleReadClick(event, notification),
                            isRead: notification.isRead,
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
