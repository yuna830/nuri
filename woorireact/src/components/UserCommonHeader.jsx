import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
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
import TripartiteChatModal from "./TripartiteChatModal.jsx";
import FontSizeControl from "./FontSizeControl.jsx";
import { fetchUnreadChatCount } from "../api/chatApi.js";
import { getProfileSectionFromInfoRequest } from "../utils/user/profileForm.js";
import "../css/user/UserCommonHeader.css";

const ALERT_TABS = ["전체", "읽지 않음", "긴급", "낙상", "복약", "기후", "요청"];
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
    case "INFO_UPDATE_REQUEST":
      return "정보수정 요청";
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
    case "INFO_UPDATE_REQUEST":
    case "PROFILE_UPDATE":
    case "JOB_RECOMMEND":
    case "JOB_CONTACT_REQUEST":
    case "WELFARE_REQUEST":
      return "요청";
    case "CHECK_IN_REPLY":
      return "답장";
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
  type: alert.type,
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
  canDelete: true,
  requiresGuardianConfirm: false,
  danger: alert.level === "warning" || alert.level === "danger",
  sortTime: toDate(alert.createdAt || alert.baseTime || alert.time)?.getTime() || 0,
});

const getLocalCareTeam = (seniorId) => {
  if (!seniorId) return null;

  try {
    const careTeamMap = JSON.parse(localStorage.getItem("seniorCareTeamMap") || "{}");
    return careTeamMap[String(seniorId)] || null;
  } catch {
    return null;
  }
};

const getGuardianPhoneFromProfile = (profile, seniorId) => {
  const localCareTeam = getLocalCareTeam(seniorId);

  return (
    profile?.guardian?.phone
    || profile?.guardianPhone
    || profile?.senior?.guardianPhone
    || localCareTeam?.guardianPhone
    || ""
  );
};

const toTelHref = (phone = "") => {
  const digits = String(phone).replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : "";
};

export function UserCommonHeader({ showSos = true, onSosClick }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [pendingSos, setPendingSos] = useState(() => localStorage.getItem("pending_sos") === "true");
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [activeAlertTab, setActiveAlertTab] = useState(ALERT_TABS[0]);
  const [recentlyReadKeys, setRecentlyReadKeys] = useState([]);
  const [selectedAlertKeys, setSelectedAlertKeys] = useState([]);
  const [deletingAlerts, setDeletingAlerts] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const alertTabsRef = useRef(null);
  const deletedAlertKeysRef = useRef([]);

  const currentSeniorForChat = useMemo(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("currentSenior") || "null");
      return saved?.senior || saved || null;
    } catch {
      return null;
    }
  }, []);
  const [guardianPhone, setGuardianPhone] = useState(() =>
    getGuardianPhoneFromProfile(currentSeniorForChat, getCurrentSeniorId())
  );

  const isFilled = (value) => {
    return value !== null && value !== undefined && String(value).trim() !== "";
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
        fetch(`/api/seniors/${seniorId}`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);
      const nextGuardianPhone = getGuardianPhoneFromProfile(currentProfile, seniorId);
      setGuardianPhone((previousPhone) => nextGuardianPhone || previousPhone);

      const combined = [
        ...seniorAlerts
          .filter((alert) => !["SOS", "SOS_CANCEL"].includes(alert.type))
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

      const visibleCombined = combined.filter((alert) => !deletedAlertKeysRef.current.includes(alert.key));

      setAlerts(visibleCombined);
      setSelectedAlertKeys((prev) => prev.filter((key) => visibleCombined.some((alert) => alert.key === key)));
    } finally {
      if (!silent) setLoadingAlerts(false);
    }
  };

  useEffect(() => {
     
    loadAlerts();
    const timerId = setInterval(() => loadAlerts({ silent: true }), 30000);
    return () => clearInterval(timerId);
  }, []);

  const loadUnreadChatCount = async () => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) {
      setUnreadChatCount(0);
      return;
    }

    const count = await fetchUnreadChatCount({
      viewerRole: "SENIOR",
      seniorId,
    }).catch(() => 0);

    setUnreadChatCount(count);
  };

  useEffect(() => {
     
    loadUnreadChatCount();
    const timerId = setInterval(loadUnreadChatCount, 5000);
    return () => clearInterval(timerId);
  }, []);

  const unreadCount = alerts.filter((alert) => !alert.isRead).length;
  const filteredAlerts = useMemo(() => alerts.filter((alert) => {
    if (activeAlertTab === "전체") return true;
    if (activeAlertTab === "읽지 않음") return !alert.isRead || recentlyReadKeys.includes(alert.key);
    return alert.category === activeAlertTab;
  }), [activeAlertTab, alerts, recentlyReadKeys]);

  const deletableFilteredAlerts = filteredAlerts.filter((alert) => alert.canDelete);
  const selectedDeletableAlerts = selectedAlertKeys
    .map((key) => alerts.find((alert) => alert.key === key))
    .filter((alert) => alert?.canDelete);
  const selectedDeletableIds = selectedDeletableAlerts
    .filter((alert) => alert.id)
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

  useEffect(() => {
    if (!isAlertPanelOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAlertPanelOpen]);

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

  const handleCallGuardianFromAlert = async (targetAlert) => {
    const telHref = toTelHref(guardianPhone);

    if (!telHref) {
      window.alert("보호자 연락처가 없습니다.");
      return;
    }

    await handleReadAlert(targetAlert);
    setIsAlertPanelOpen(false);
    window.location.href = telHref;
  };

  const removeAlertsFromList = (keys) => {
    deletedAlertKeysRef.current = [...new Set([...deletedAlertKeysRef.current, ...keys])];
    setAlerts((prev) => prev.filter((alert) => !keys.includes(alert.key)));
    setSelectedAlertKeys([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedDeletableAlerts.length === 0 || deletingAlerts) return;
    setDeletingAlerts(true);
    try {
      if (selectedDeletableIds.length === 1) {
        await deleteAlert(selectedDeletableIds[0]);
      } else if (selectedDeletableIds.length > 1) {
        await deleteAlerts(selectedDeletableIds);
      }
      removeAlertsFromList(selectedDeletableAlerts.map((alert) => alert.key));
    } catch (error) {
      console.error("알림 삭제 실패:", error);
      window.alert("알림 삭제에 실패했습니다.");
    } finally {
      setDeletingAlerts(false);
    }
  };

  const handleDeleteAllFiltered = async () => {
    const ids = deletableFilteredAlerts.filter((alert) => alert.id).map((alert) => alert.id);
    const keys = deletableFilteredAlerts.map((alert) => alert.key);
    if (keys.length === 0 || deletingAlerts) return;
    setDeletingAlerts(true);
    try {
      if (ids.length > 0) {
        await deleteAlerts(ids);
      }
      removeAlertsFromList(keys);
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
            <FontSizeControl />
            <button className="common-app-icon-button" type="button" onClick={() => setIsChatOpen(true)} aria-label="메시지">
              <MessageCircle size={19} />
              {unreadChatCount > 0 && <span className="common-app-badge">{unreadChatCount}</span>}
            </button>
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

      <TripartiteChatModal
        isOpen={isChatOpen}
        seniorId={currentSeniorForChat?.id || getCurrentSeniorId()}
        seniorName={currentSeniorForChat?.name || "사용자"}
        rooms={[
          {
            roomType: "SENIOR_GUARDIAN",
            seniorId: currentSeniorForChat?.id || getCurrentSeniorId(),
            title: "보호자",
            subtitle: "보호자와 1:1 대화",
          },
          {
            roomType: "SENIOR_WELFARE",
            seniorId: currentSeniorForChat?.id || getCurrentSeniorId(),
            title: "복지사",
            subtitle: "담당 복지사와 1:1 대화",
          },
        ]}
        senderRole="SENIOR"
        senderId={currentSeniorForChat?.id || Number(getCurrentSeniorId())}
        senderName={currentSeniorForChat?.name || "사용자"}
        onReadChange={loadUnreadChatCount}
        onClose={() => setIsChatOpen(false)}
      />


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
                <button type="button" disabled={selectedDeletableAlerts.length === 0 || deletingAlerts} onClick={handleDeleteSelected}>
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
                  <article key={userAlert.key} className={`uch-alert-item common-alert-item ${userAlert.danger ? "danger" : ""} ${userAlert.isRead ? "read" : ""}`}>
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
                        <div className="uch-alert-meta-tags">
                          {userAlert.isRead && (
                            <span className="read">{"확인됨"}</span>
                          )}
                          <span className={`category ${userAlert.danger ? "danger" : ""}`}>
                            {userAlert.category}
                          </span>
                        </div>
                        {userAlert.time && (
                          <span className="uch-alert-time-inline">{userAlert.time}</span>
                        )}
                      </div>
                      {userAlert.type !== "CHECK_IN_REPLY" && (
                        <div className="uch-alert-title-row">
                          <strong>{userAlert.title}</strong>
                        </div>
                      )}
                      <p>{userAlert.message}</p>
                    </div>
                    <div className="uch-alert-action">
                      {userAlert.requiresGuardianConfirm ? (
                        <em className="waiting">보호자 확인 대기</em>
                      ) : userAlert.type === "CALL_REQUEST" && !userAlert.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleCallGuardianFromAlert(userAlert)}
                        >
                          보호자에게 전화
                        </button>
                      ) : userAlert.type === "INFO_UPDATE_REQUEST" && !userAlert.isRead ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleReadAlert(userAlert);
                            setIsAlertPanelOpen(false);
                            navigate(`/profile?section=${getProfileSectionFromInfoRequest(userAlert.message)}&alertId=${userAlert.id}`);
                          }}
                        >
                          수정하기
                        </button>
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
