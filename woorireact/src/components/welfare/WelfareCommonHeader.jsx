import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import CommonHeader from "../CommonHeader.jsx";
import TripartiteChatModal from "../TripartiteChatModal.jsx";
import {
    assignWelfareSenior,
    fetchWelfareAlerts,
    fetchWelfareSeniors,
    readWelfareAlert,
    searchSeniorExact,
    sendGuardianCheckInRequest,
} from "../../api/welfareDashboardApi";
import { fetchUnreadChatCount } from "../../api/chatApi";
import { mapWelfareSenior, getSeniorReviewStatus } from "../../utils/welfare/welfareDashboardData";

import { formatPhoneNumber } from "../../utils/common/phone.js";

function WelfareCommonHeader({ rightText }) {
    const navigate = useNavigate();
    const currentWorker = useMemo(() => {
        try {
            return JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
        } catch {
            return null;
        }
    }, []);

    const [dbWelfareAlerts, setDbWelfareAlerts] = useState([]);
    const [dismissedNotifications, setDismissedNotifications] = useState([]);
    const [checkInRequestedNotificationIds, setCheckInRequestedNotificationIds] = useState([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [seniors, setSeniors] = useState([]);
    const [isAddSeniorModalOpen, setIsAddSeniorModalOpen] = useState(false);
    const [addSeniorForm, setAddSeniorForm] = useState({ name: "", phone: "" });
    const [addSeniorStatus, setAddSeniorStatus] = useState("");
    const [isAddingSenior, setIsAddingSenior] = useState(false);

    useEffect(() => {
        if (!currentWorker) return;
        let ignore = false;
        const load = async () => {
            try {
                const alerts = await fetchWelfareAlerts({ welfareWorkerId: currentWorker.id });
                if (!ignore) setDbWelfareAlerts(Array.isArray(alerts) ? alerts : []);
            } catch {
                if (!ignore) setDbWelfareAlerts([]);
            }
        };
        load();
        const timerId = setInterval(load, 15000);
        return () => {
            ignore = true;
            clearInterval(timerId);
        };
    }, [currentWorker]);

    useEffect(() => {
        if (!currentWorker) return;
        const load = () =>
            fetchUnreadChatCount({ viewerRole: "WELFARE", welfareWorkerId: currentWorker.id })
                .then(setUnreadChatCount)
                .catch(() => { });
        load();
        const timerId = setInterval(load, 5000);
        return () => clearInterval(timerId);
    }, [currentWorker]);

    useEffect(() => {
        if (!currentWorker?.id) return;
        fetchWelfareSeniors({ page: 0, size: 100, welfareWorkerId: currentWorker.id })
            .then((data) => {
                const raw = Array.isArray(data) ? data : data.content || [];
                setSeniors(raw.map(mapWelfareSenior));
            })
            .catch(() => { });
    }, [currentWorker]);

    const dbNotifications = dbWelfareAlerts.map((alert) => {
        const isLastAccessAlert = alert.type === "LAST_ACCESS";
        const isCheckInOkAlert = alert.type === "CHECK_IN_OK";

        return {
            id: `db-${alert.id}`,
            seniorId: alert.seniorId,
            seniorName: alert.seniorName,
            type: alert.type,
            title: isCheckInOkAlert ? "보호자 안부 확인 완료" : alert.title,
            message: alert.message,
            category: isLastAccessAlert ? "복지" : isCheckInOkAlert ? "정보" : "긴급",
            detailCategory: isLastAccessAlert ? "기본 정보" : isCheckInOkAlert ? "복지" : "안전구역 관리",
            danger: !isLastAccessAlert && !isCheckInOkAlert,
            statusLabel: isCheckInOkAlert ? null : undefined,
            isRead: alert.isRead === true,
        };
    });

    const seniorNotifications = seniors.flatMap((senior) => {
        const notifications = [];
        if (senior.alertStatus === "미응답 SOS") {
            notifications.push({
                id: `${senior.id}-sos`,
                seniorId: senior.id,
                title: "미응답 SOS",
                message: `${senior.name} 대상자의 SOS를 보호자가 아직 확인하지 않았습니다.`,
                category: "긴급",
                detailCategory: "안전구역 관리",
                danger: true,
            });
        }
        if (senior.alertStatus === "일자리 신청" && getSeniorReviewStatus(senior) !== "검토") {
            notifications.push({
                id: `${senior.id}-job-request`,
                seniorId: senior.id,
                title: "일자리 신청",
                message: `${senior.name} 대상자가 일자리 신청을 보냈습니다.`,
                category: "일자리",
                detailCategory: "일자리 요청 상태",
            });
        }

        return notifications;
    });

    const checkInRepliedSeniorIds = new Set(
        dbNotifications
            .filter((notification) => notification.type === "CHECK_IN_OK")
            .map((notification) => String(notification.seniorId))
    );

    const activeNotifications = [...dbNotifications, ...seniorNotifications]
        .filter((notification) => {
            if (notification.type !== "LAST_ACCESS") return true;
            return !checkInRepliedSeniorIds.has(String(notification.seniorId));
        })
        .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
        .filter((n) => !dismissedNotifications.includes(n.id));

    const dismissNotification = (id) =>
        setDismissedNotifications((prev) => (prev.includes(id) ? prev : [...prev, id]));

    const getServerAlertId = (notificationId) => {
        if (!notificationId) return null;

        const match = String(notificationId).match(/(\d+)$/);
        return match ? Number(match[1]) : null;
    };

    const handleConfirmCheckInOkAlert = async (notification) => {
        const serverAlertId = getServerAlertId(notification.id);

        if (!serverAlertId) return;

        try {
            await readWelfareAlert(serverAlertId);

            setDbWelfareAlerts((previousAlerts) =>
                previousAlerts.map((alert) =>
                    `db-${alert.id}` === notification.id
                        ? { ...alert, isRead: true }
                        : alert
                )
            );
        } catch (error) {
            console.error("안부 확인 완료 알림 확인 처리 실패:", error);
            window.alert("알림 확인 처리에 실패했습니다.");
        }
    };

    const handleSendGuardianCheckInRequest = async (notification) => {
        if (!notification?.seniorId) return;

        const seniorName = notification.seniorName || "대상자";

        await sendGuardianCheckInRequest({
            seniorId: notification.seniorId,
            message: `${seniorName} 대상자가 4시간 이상 접속하지 않았습니다. 안부 확인 후 복지사에게 알려주세요.`,
        });

        setCheckInRequestedNotificationIds((previousIds) =>
            previousIds.includes(notification.id)
                ? previousIds
                : [...previousIds, notification.id]
        );
    };

    const handleResolveLastAccessAlert = (notification) => {
        dismissNotification(notification.id);
    };

    const handleAgencyLinkLastAccessAlert = (notification) => {
        if (notification?.seniorId) {
            navigate(`/welfare/seniors/${notification.seniorId}`, {
                state: {
                    category: "기관 연계",
                    agencyLinkNeeded: true,
                },
            });
        }

        dismissNotification(notification.id);
    };

    const isLastAccessNotification = (notification) => {
        const text = [
            notification?.type,
            notification?.title,
            notification?.message,
        ].filter(Boolean).join(" ");

        return (
            text.includes("LAST_ACCESS") ||
            text.includes("장시간 미접속") ||
            text.includes("접속 확인 필요")
        );
    };

    const renderWelfareNotificationActions = (notification, { defaultAction }) => {
        if (notification?.type === "CHECK_IN_OK") {
            if (notification.isRead) return null;

            return (
                <div className="welfare-alert-actions-below">
                    <button
                        type="button"
                        className="welfare-alert-secondary-action"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleConfirmCheckInOkAlert(notification);
                        }}
                    >
                        확인
                    </button>
                </div>
            );
        }

        if (!isLastAccessNotification(notification)) {
            return defaultAction;
        }

        const isRequested = checkInRequestedNotificationIds.includes(notification.id);

        if (!isRequested) {
            return (
                <div className="welfare-alert-actions-below">
                    <button
                        type="button"
                        className="welfare-alert-primary-action"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleSendGuardianCheckInRequest(notification);
                        }}
                    >
                        안부 확인 요청
                    </button>
                </div>
            );
        }

        return (
            <div className="welfare-alert-actions-below two">
                <button
                    type="button"
                    className="welfare-alert-secondary-action"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleResolveLastAccessAlert(notification);
                    }}
                >
                    확인 완료
                </button>
                <button
                    type="button"
                    className="welfare-alert-primary-action"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleAgencyLinkLastAccessAlert(notification);
                    }}
                >
                    기관 연계
                </button>
            </div>
        );
    };

    const openAddSeniorModal = () => {
        setAddSeniorForm({ name: "", phone: "" });
        setAddSeniorStatus("");
        setIsAddSeniorModalOpen(true);
    };

    const handleAddSenior = async () => {
        if (!currentWorker?.id) return;
        const name = addSeniorForm.name.trim();
        const phone = addSeniorForm.phone.trim();
        if (!name || !phone) {
            setAddSeniorStatus("대상자 이름과 전화번호를 모두 입력해주세요.");
            return;
        }
        try {
            setIsAddingSenior(true);
            setAddSeniorStatus("");
            const matches = await searchSeniorExact({ name, phone });
            const target = matches[0]?.senior || matches[0];
            if (!target?.id) {
                setAddSeniorStatus("일치하는 대상자를 찾지 못했습니다. 이름과 전화번호를 확인해주세요.");
                return;
            }
            await assignWelfareSenior({ seniorId: target.id, welfareWorkerId: currentWorker.id });
            setIsAddSeniorModalOpen(false);
            navigate("/welfare");
        } catch {
            setAddSeniorStatus("대상자 추가에 실패했습니다.");
        } finally {
            setIsAddingSenior(false);
        }
    };

    const chatRooms = seniors.flatMap((senior) => [
        {
            roomType: "SENIOR_WELFARE",
            seniorId: senior.id,
            title: `${senior.name || "대상자"} 사용자`,
            subtitle: "사용자와 1:1 대화",
        },
        {
            roomType: "GUARDIAN_WELFARE",
            seniorId: senior.id,
            title: `${senior.name || "대상자"} 보호자`,
            subtitle: "보호자와 1:1 대화",
        },
    ]);

    return (
        <>
            <CommonHeader
                homePath="/welfare"
                rightText={rightText}
                showNotificationButton
                notifications={activeNotifications.map((n) => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    category: n.category || n.detailCategory || "정보",
                    time: n.time,
                    isRead: n.isRead === true,
                    statusLabel: n.statusLabel,
                    danger: n.danger === true || n.category === "긴급",
                    raw: {
                        ...n,
                        type: n.raw?.type || n.type,
                        imageUrl: n.raw?.imageAccessUrl || n.raw?.imageUrl || n.imageUrl || "",
                    },
                }))}
                notificationTabs={["전체", "긴급", "정보 미입력", "일자리", "복지", "읽지 않음"]}
                onReadNotification={(raw) => dismissNotification(raw.id)}
                renderNotificationActions={renderWelfareNotificationActions}
                onNotificationClick={(raw) => {
                    if (raw.seniorId) {
                        navigate(`/welfare/seniors/${raw.seniorId}`, {
                            state: { category: raw.detailCategory || "기본 정보" },
                        });
                    }
                }}
                actions={
                    <button
                        className="common-app-icon-button"
                        type="button"
                        onClick={() => setIsChatOpen(true)}
                        aria-label="메시지"
                    >
                        <MessageCircle size={19} />
                        {unreadChatCount > 0 && <span className="common-app-badge">{unreadChatCount}</span>}
                    </button>
                }
                afterActions={
                    <button
                        className="common-app-danger-button"
                        type="button"
                        onClick={openAddSeniorModal}
                    >
                        대상자 추가
                    </button>
                }
            />
            <TripartiteChatModal
                isOpen={isChatOpen}
                rooms={chatRooms}
                senderRole="WELFARE"
                senderId={currentWorker?.id}
                senderName={currentWorker?.name || "복지사"}
                onClose={() => setIsChatOpen(false)}
                onReadChange={() =>
                    fetchUnreadChatCount({ viewerRole: "WELFARE" })
                        .then(setUnreadChatCount)
                        .catch(() => { })
                }
            />
            {isAddSeniorModalOpen && (
                <div className="wd-modal-backdrop" onClick={() => setIsAddSeniorModalOpen(false)}>
                    <section className="wd-info-request-modal wd-add-senior-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="wd-info-request-header">
                            <h2>대상자 추가</h2>
                            <button
                                type="button"
                                className="wd-info-request-close"
                                onClick={() => setIsAddSeniorModalOpen(false)}
                                disabled={isAddingSenior}
                            >
                                닫기
                            </button>
                        </div>
                        <div className="wd-add-senior-form">
                            <label>
                                대상자 이름
                                <input
                                    type="text"
                                    value={addSeniorForm.name}
                                    onChange={(e) => setAddSeniorForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="예: 김우리"
                                />
                            </label>
                            <label>
                                전화번호
                                <input
                                    type="tel"
                                    value={addSeniorForm.phone}
                                    onChange={(e) => setAddSeniorForm((f) => ({ ...f, phone: formatPhoneNumber(e.target.value) }))}
                                    placeholder="예: 010-1234-5678"
                                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSenior(); }}
                                />
                            </label>
                        </div>
                        {addSeniorStatus && (
                            <p className="wd-info-request-fields wd-add-senior-status">{addSeniorStatus}</p>
                        )}
                        <div className="wd-info-request-actions">
                            <button
                                type="button"
                                className="wd-info-request-cancel"
                                onClick={() => setIsAddSeniorModalOpen(false)}
                                disabled={isAddingSenior}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="wd-info-request-submit"
                                onClick={handleAddSenior}
                                disabled={isAddingSenior}
                            >
                                추가하기
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

export default WelfareCommonHeader;
