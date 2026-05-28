import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSosAlert,
  createSosCancelAlert,
  deleteAlert,
  deleteAlerts,
  deleteOldRequestAlerts,
  fetchLatestClimateAlerts,
  fetchSeniorAlerts,
  getCurrentSeniorId,
  readAlert,
} from "../api/userPageApi.js";
import CommonHeader from "./CommonHeader.jsx";
import "../css/user/UserCommonHeader.css";

const ALERT_TABS = ["전체", "긴급", "낙상", "복약", "기후", "요청", "읽지 않음"];
const REQUEST_CATEGORIES = new Set(["요청"]);

const formatKoreanDate = () => {
  const now = new Date();
  return now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
};

const getCurrentPosition = () => new Promise((resolve) => {
  if (!navigator.geolocation) {
    resolve(null);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
  );
});

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isToday = (value) => {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
};

const isWithinDays = (value, days) => {
  const date = toDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
};

const formatAlertTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAlertTitle = (alert) => {
  if (alert.title) return alert.title;
  switch (alert.type) {
    case "CALL_REQUEST":
      return "전화 요청";
    case "MEDICINE":
      return "복약 알림";
    case "FALL_DETECTED":
    case "FALL_RISK":
      return "낙상 감지";
    case "SAFE_ZONE":
    case "SAFE_ZONE_EXIT":
      return "안전 구역 이탈";
    case "SOS":
    case "SOS_CANCEL":
      return "SOS 알림";
    default:
      return "새 알림";
  }
};

const getAlertCategory = (type) => {
  switch (type) {
    case "CALL_REQUEST":
    case "SAFE_ZONE":
    case "SAFE_ZONE_EXIT":
    case "SOS":
      return "긴급";
    case "FALL_DETECTED":
    case "FALL_RISK":
      return "낙상";
    case "MEDICINE":
      return "복약";
    case "PROFILE_UPDATE_REQUEST":
    case "PROFILE_UPDATE":
    case "JOB_RECOMMEND":
    case "JOB_CONTACT_REQUEST":
    case "WELFARE_REQUEST":
      return "요청";
    default:
      return "기타";
  }
};

const isSafeZoneAlert = (type) => type === "SAFE_ZONE" || type === "SAFE_ZONE_EXIT";

const shouldShowAlert = (alert) => {
  const category = getAlertCategory(alert.type);
  const createdAt = alert.createdAt || alert.time;
  if (REQUEST_CATEGORIES.has(category)) return isWithinDays(createdAt, 30);
  return isToday(createdAt);
};

const normalizeUserAlert = (alert) => ({
  id: alert.id,
  key: `alert-${alert.id}`,
  title: getAlertTitle(alert),
  category: getAlertCategory(alert.type),
  message: alert.message || "새 알림이 도착했어요.",
  time: formatAlertTime(alert.createdAt || alert.time),
  isRead: alert.isRead === true,
  canRead: Boolean(alert.id) && !isSafeZoneAlert(alert.type),
  canDelete: Boolean(alert.id),
  requiresGuardianConfirm: isSafeZoneAlert(alert.type),
  danger: ["FALL_DETECTED", "FALL_RISK", "SAFE_ZONE", "SAFE_ZONE_EXIT", "SOS"].includes(alert.type),
  sortTime: toDate(alert.createdAt || alert.time)?.getTime() || 0,
});

const normalizeClimateAlert = (alert, index) => ({
  id: null,
  key: `climate-${alert.id ?? index}`,
  title: alert.type || alert.title || "기후 알림",
  category: "기후",
  message: alert.message || alert.description || "기후 위험 정보를 확인해주세요.",
  time: formatAlertTime(alert.createdAt || alert.baseTime || alert.time),
  isRead: true,
  canRead: false,
  canDelete: false,
  requiresGuardianConfirm: false,
  danger: alert.level === "warning" || alert.level === "danger",
  sortTime: toDate(alert.createdAt || alert.baseTime || alert.time)?.getTime() || 0,
});

export function UserCommonHeader({ showSos = true, onSosClick }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingSos, setPendingSos] = useState(() => localStorage.getItem("pending_sos") === "true");
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [activeAlertTab, setActiveAlertTab] = useState(ALERT_TABS[0]);
  const [recentlyReadKeys, setRecentlyReadKeys] = useState([]);
  const [selectedAlertKeys, setSelectedAlertKeys] = useState([]);
  const [deletingAlerts, setDeletingAlerts] = useState(false);
  const [infoRequestAlert, setInfoRequestAlert] = useState(null);
  const [dismissedInfoRequestIds, setDismissedInfoRequestIds] = useState([]);
  const alertTabsRef = useRef(null);

  const isFilled = (value) => {
    return value !== null && value !== undefined && String(value).trim() !== "";
  };

  const isInfoRequestResolved = (alert, profile) => {
    const senior = profile?.senior || {};
    const message = alert?.message || "";

    if (message.includes("성별") && !isFilled(senior.gender)) {
      return false;
    }

    if (message.includes("생년월일") && !isFilled(senior.birthDate)) {
      return false;
    }

    if (message.includes("연락처") && !isFilled(senior.phone)) {
      return false;
    }

    if (message.includes("주소") && !isFilled(senior.region || senior.address)) {
      return false;
    }

    return true;
  };

  const loadAlerts = async ({ silent = false } = {}) => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) {
      setAlerts([]);
      return;
    }

    if (!silent) setLoadingAlerts(true);

    try {
      deleteOldRequestAlerts(seniorId).catch(() => {});

      const [seniorAlerts, climateAlerts, currentProfile] = await Promise.all([
        fetchSeniorAlerts(seniorId).catch(() => []),
        fetchLatestClimateAlerts(seniorId).catch(() => []),
        fetch(`http://localhost:8080/api/seniors/${seniorId}`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);

      const resolvedInfoRequestAlerts = seniorAlerts.filter((alert) =>
        alert.type === "INFO_UPDATE_REQUEST"
        && alert.isRead !== true
        && isInfoRequestResolved(alert, currentProfile)
      );

      resolvedInfoRequestAlerts.forEach((alert) => {
        readAlert(alert.id).catch(() => {});
      });

      const nextInfoRequestAlert = seniorAlerts.find((alert) =>
        alert.type === "INFO_UPDATE_REQUEST"
        && alert.isRead !== true
        && !dismissedInfoRequestIds.includes(String(alert.id))
        && !isInfoRequestResolved(alert, currentProfile)
      );

      if (nextInfoRequestAlert) {
        setInfoRequestAlert(nextInfoRequestAlert);
      } else {
        setInfoRequestAlert(null);
      }

      const resolvedInfoRequestIds = new Set(
        resolvedInfoRequestAlerts.map((alert) => alert.id)
      );

      const combined = [
        ...seniorAlerts
          .filter((alert) => !resolvedInfoRequestIds.has(alert.id))
          .filter(shouldShowAlert)
          .map(normalizeUserAlert),
        ...climateAlerts
          .filter((alert) => isToday(alert.createdAt || alert.baseTime || alert.time))
          .map(normalizeClimateAlert),
      ]
        .sort((a, b) => {
          if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
          return b.sortTime - a.sortTime;
        })
        .slice(0, 40);

      setAlerts(combined);
      setSelectedAlertKeys((prev) => prev.filter((key) => combined.some((alert) => alert.key === key)));
    } finally {
      if (!silent) setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const timerId = setInterval(() => loadAlerts({ silent: true }), 30000);
    return () => clearInterval(timerId);
  }, []);

  const unreadCount = alerts.filter((alert) => !alert.isRead).length;
  const filteredAlerts = useMemo(() => alerts.filter((alert) => {
    if (activeAlertTab === "전체") return true;
    if (activeAlertTab === "읽지 않음") return !alert.isRead || recentlyReadKeys.includes(alert.key);
    return alert.category === activeAlertTab;
  }), [activeAlertTab, alerts, recentlyReadKeys]);

  const deletableFilteredAlerts = filteredAlerts.filter((alert) => alert.canDelete);
  const selectedDeletableIds = selectedAlertKeys
    .map((key) => alerts.find((alert) => alert.key === key))
    .filter((alert) => alert?.canDelete)
    .map((alert) => alert.id);

  const getTabCount = (tab) => {
    if (tab === "전체") return alerts.length;
    if (tab === "읽지 않음") return unreadCount;
    return alerts.filter((alert) => alert.category === tab).length;
  };

  const openSos = () => {
    if (onSosClick) {
      onSosClick();
      return;
    }
    setShowModal(true);
  };

  const openAlertPanel = () => {
    setIsAlertPanelOpen(true);
    loadAlerts();
  };

  const scrollAlertTabs = (direction) => {
    const currentIndex = ALERT_TABS.indexOf(activeAlertTab);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), ALERT_TABS.length - 1);
    setActiveAlertTab(ALERT_TABS[nextIndex]);
  };

  useEffect(() => {
    const activeTabButton = alertTabsRef.current?.querySelector("[data-active='true']");
    activeTabButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setSelectedAlertKeys([]);
  }, [activeAlertTab]);

  const toggleAlertSelection = (key) => {
    setSelectedAlertKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const toggleAllFiltered = () => {
    const keys = deletableFilteredAlerts.map((alert) => alert.key);
    const allSelected = keys.length > 0 && keys.every((key) => selectedAlertKeys.includes(key));
    setSelectedAlertKeys((prev) => (
      allSelected
        ? prev.filter((key) => !keys.includes(key))
        : [...new Set([...prev, ...keys])]
    ));
  };

  const handleReadAlert = async (targetAlert) => {
    if (targetAlert.requiresGuardianConfirm || !targetAlert.canRead || !targetAlert.id) return;

    try {
      await readAlert(targetAlert.id);
      setRecentlyReadKeys((prev) => [...new Set([...prev, targetAlert.key])].slice(-20));
      setAlerts((prev) => prev.map((alert) => (
        alert.key === targetAlert.key ? { ...alert, isRead: true } : alert
      )));
    } catch (error) {
      console.error("알림 확인 실패:", error);
      window.alert("알림 확인 처리에 실패했습니다.");
    }
  };

  const removeAlertsFromList = (ids) => {
    setAlerts((prev) => prev.filter((alert) => !ids.includes(alert.id)));
    setSelectedAlertKeys([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedDeletableIds.length === 0 || deletingAlerts) return;
    setDeletingAlerts(true);
    try {
      if (selectedDeletableIds.length === 1) {
        await deleteAlert(selectedDeletableIds[0]);
      } else {
        await deleteAlerts(selectedDeletableIds);
      }
      removeAlertsFromList(selectedDeletableIds);
    } catch (error) {
      console.error("알림 삭제 실패:", error);
      window.alert("알림 삭제에 실패했습니다.");
    } finally {
      setDeletingAlerts(false);
    }
  };

  const handleDeleteAllFiltered = async () => {
    const ids = deletableFilteredAlerts.map((alert) => alert.id);
    if (ids.length === 0 || deletingAlerts) return;
    setDeletingAlerts(true);
    try {
      await deleteAlerts(ids);
      removeAlertsFromList(ids);
    } catch (error) {
      console.error("알림 전체 삭제 실패:", error);
      window.alert("알림 삭제에 실패했습니다.");
    } finally {
      setDeletingAlerts(false);
    }
  };

  const confirmSos = async () => {
    setShowModal(false);
    const seniorId = getCurrentSeniorId();

    if (!seniorId) {
      window.alert("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const position = await getCurrentPosition();
      await createSosAlert({
        seniorId: Number(seniorId),
        latitude: position?.latitude,
        longitude: position?.longitude,
      });
      localStorage.setItem("pending_sos", "true");
      setPendingSos(true);
    } catch (error) {
      console.error("SOS 전송 실패:", error);
      window.alert("SOS 전송에 실패했습니다. 보호자에게 직접 연락해주세요.");
    }
  };

  const cancelPendingSos = async () => {
    const seniorId = getCurrentSeniorId();

    if (seniorId) {
      const position = await getCurrentPosition();
      await createSosCancelAlert({
        seniorId: Number(seniorId),
        latitude: position?.latitude,
        longitude: position?.longitude,
      }).catch((error) => {
        console.error("SOS 잘못 누름 알림 실패:", error);
      });
    }

    localStorage.removeItem("pending_sos");
    setPendingSos(false);
    window.alert("보호자에게 잘못 누름 알림을 보냈어요.");
  };

  return (
    <>
      <CommonHeader
        homePath="/user"
        rightText={formatKoreanDate()}
        actions={
          <>
            <button className="common-app-icon-button uch-alert-button" type="button" onClick={openAlertPanel} aria-label="알림">
              🔔
              {unreadCount > 0 && <span className="common-app-badge">{unreadCount}</span>}
            </button>
            {showSos ? (
              <button className="common-app-danger-button" type="button" onClick={openSos}>
                🚨 SOS 알림 요청
              </button>
            ) : null}
          </>
        }
      />

      {infoRequestAlert && (
        <div className="uch-info-request-backdrop">
          <section className="uch-info-request-modal">
            <h2>정보 입력 요청</h2>
            <p>{infoRequestAlert.message || "미입력 정보를 확인하고 입력해주세요."}</p>

            <div className="uch-info-request-actions">
              <button
                type="button"
                onClick={() => {
                  setDismissedInfoRequestIds((prev) => [
                    ...prev,
                    String(infoRequestAlert.id),
                  ]);
                  setInfoRequestAlert(null);
                }}
              >
                나중에
              </button>

              <button
                type="button"
                onClick={async () => {
                  setInfoRequestAlert(null);

                  if (infoRequestAlert.id) {
                    await readAlert(infoRequestAlert.id).catch(() => {});
                  }

                  navigate("/profile");
                }}
              >
                정보 입력하기
              </button>
            </div>
          </section>
        </div>
      )}

      {isAlertPanelOpen && (
        <div className="uch-alert-backdrop" onClick={() => setIsAlertPanelOpen(false)}>
          <section className="uch-alert-panel" onClick={(event) => event.stopPropagation()}>
            <div className="uch-alert-panel-header">
              <div>
                <h2>전체 알림</h2>
                <p>오늘 알림과 최근 30일 요청 알림을 확인할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setIsAlertPanelOpen(false)}>
                닫기
              </button>
            </div>

            <div className="uch-alert-tabs-wrap">
              <button className="uch-alert-tabs-arrow" type="button" onClick={() => scrollAlertTabs(-1)} aria-label="이전 알림 카테고리">
                &lt;
              </button>
              <div className="uch-alert-tabs" ref={alertTabsRef} role="tablist" aria-label="알림 분류">
                {ALERT_TABS.map((tab) => {
                  const count = getTabCount(tab);
                  return (
                    <button
                      key={tab}
                      className={activeAlertTab === tab ? "active" : ""}
                      data-active={activeAlertTab === tab}
                      type="button"
                      onClick={() => setActiveAlertTab(tab)}
                    >
                      <span>{tab}</span>
                      {count > 0 && <em>{count}</em>}
                    </button>
                  );
                })}
              </div>
              <button className="uch-alert-tabs-arrow" type="button" onClick={() => scrollAlertTabs(1)} aria-label="다음 알림 카테고리">
                &gt;
              </button>
            </div>

            <div className="uch-alert-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={deletableFilteredAlerts.length > 0 && deletableFilteredAlerts.every((alert) => selectedAlertKeys.includes(alert.key))}
                  disabled={deletableFilteredAlerts.length === 0}
                  onChange={toggleAllFiltered}
                />
                전체 선택
              </label>
              <div>
                <button type="button" disabled={selectedDeletableIds.length === 0 || deletingAlerts} onClick={handleDeleteSelected}>
                  선택 삭제
                </button>
                <button type="button" disabled={deletableFilteredAlerts.length === 0 || deletingAlerts} onClick={handleDeleteAllFiltered}>
                  전체 삭제
                </button>
              </div>
            </div>

            <div className="uch-alert-panel-list">
              {loadingAlerts ? (
                <p className="uch-alert-empty">알림을 불러오는 중...</p>
              ) : filteredAlerts.length === 0 ? (
                <p className="uch-alert-empty">도착한 알림이 없습니다.</p>
              ) : (
                filteredAlerts.map((userAlert) => (
                  <article key={userAlert.key} className={`uch-alert-item ${userAlert.danger ? "danger" : ""} ${userAlert.isRead ? "read" : ""}`}>
                    <label className="uch-alert-select">
                      <input
                        type="checkbox"
                        checked={selectedAlertKeys.includes(userAlert.key)}
                        disabled={!userAlert.canDelete}
                        onChange={() => toggleAlertSelection(userAlert.key)}
                        aria-label="알림 선택"
                      />
                    </label>
                    <div className="uch-alert-content">
                      <div className="uch-alert-meta">
                        <span className={userAlert.isRead ? "read" : "unread"}>
                          {userAlert.isRead ? "확인됨" : "확인 필요"}
                        </span>
                        <span>{userAlert.category}</span>
                      </div>
                      <strong>{userAlert.title}</strong>
                      <p>{userAlert.message}</p>
                      {userAlert.time && <span>{userAlert.time}</span>}
                    </div>
                    <div className="uch-alert-action">
                      {userAlert.requiresGuardianConfirm ? (
                        <em className="waiting">보호자 확인 대기</em>
                      ) : userAlert.canRead ? (
                        userAlert.isRead ? (
                          <em>확인됨</em>
                        ) : (
                          <button type="button" onClick={() => handleReadAlert(userAlert)}>
                            확인
                          </button>
                        )
                      ) : (
                        <em>정보</em>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {!onSosClick && pendingSos && (
        <div className="uch-sos-pending">
          <div>
            <strong>SOS가 보호자에게 전송되었어요.</strong>
            <p>실수로 눌렀다면 아래 버튼을 눌러 표시를 취소해 주세요.</p>
          </div>
          <button type="button" onClick={cancelPendingSos}>
            잘못 눌렀어요
          </button>
        </div>
      )}

      {!onSosClick && showModal && (
        <div className="uch-overlay" onClick={() => setShowModal(false)}>
          <div className="uch-modal" onClick={(event) => event.stopPropagation()}>
            <div className="uch-modal-ico">🚨</div>
            <div className="uch-modal-title">SOS를 보내시겠어요?</div>
            <div className="uch-modal-desc">
              보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.
            </div>
            <div className="uch-modal-row">
              <button className="uch-modal-cancel" type="button" onClick={() => setShowModal(false)}>취소</button>
              <button className="uch-modal-ok" type="button" onClick={confirmSos}>보내기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function UserSubHeader({
  title,
  right,
  onBack,
  backLabel = "← 돌아가기",
  maxWidth = 1280,
}) {
  return (
    <div className="uch-sub">
      <div className="uch-sub-inner" style={{ "--uch-sub-max": `${maxWidth}px` }}>
        {onBack && (
          <button className="uch-back" type="button" onClick={onBack}>
            {backLabel}
          </button>
        )}
        <div className="uch-title">{title}</div>
        {right && <div className="uch-sub-right">{right}</div>}
      </div>
    </div>
  );
}
