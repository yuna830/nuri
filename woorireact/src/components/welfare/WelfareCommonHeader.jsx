import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import CommonHeader from "../CommonHeader.jsx";
import TripartiteChatModal from "../TripartiteChatModal.jsx";
import { fetchWelfareAlerts, fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import { fetchUnreadChatCount } from "../../api/chatApi";
import { mapWelfareSenior, getSeniorReviewStatus } from "../../utils/welfare/welfareDashboardData";
import { shouldNotifyLastAccessDelay } from "../../utils/welfare/welfareTime";

function WelfareCommonHeader({ rightText, afterActions }) {
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
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [seniors, setSeniors] = useState([]);

    useEffect(() => {
        if (!currentWorker) return;
        let ignore = false;
        const load = async () => {
            try {
                const alerts = await fetchWelfareAlerts();
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
            fetchUnreadChatCount({ viewerRole: "WELFARE" })
                .then(setUnreadChatCount)
                .catch(() => {});
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
            .catch(() => {});
    }, [currentWorker]);

    const dbNotifications = dbWelfareAlerts.map((alert) => ({
        id: `db-${alert.id}`,
        seniorId: alert.seniorId,
        title: alert.title,
        message: alert.message,
        category: alert.type === "LAST_ACCESS" ? "복지" : "긴급",
        detailCategory: alert.type === "LAST_ACCESS" ? "기본 정보" : "안전구역 관리",
        danger: alert.type !== "LAST_ACCESS",
    }));

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
        if (shouldNotifyLastAccessDelay(senior.lastAccess)) {
            notifications.push({
                id: `${senior.id}-last-access`,
                seniorId: senior.id,
                title: "접속 확인 필요",
                message: `${senior.name} 대상자가 4시간 넘게 접속하지 않았습니다.`,
                category: "복지",
                detailCategory: "기본 정보",
            });
        }
        return notifications;
    });

    const activeNotifications = [...dbNotifications, ...seniorNotifications]
        .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
        .filter((n) => !dismissedNotifications.includes(n.id));

    const dismissNotification = (id) =>
        setDismissedNotifications((prev) => (prev.includes(id) ? prev : [...prev, id]));

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
                    isRead: false,
                    danger: n.danger === true || n.category === "긴급",
                    raw: n,
                }))}
                notificationTabs={["전체", "긴급", "정보 미입력", "일자리", "복지", "읽지 않음"]}
                onReadNotification={(raw) => dismissNotification(raw.id)}
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
                afterActions={afterActions}
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
                        .catch(() => {})
                }
            />
        </>
    );
}

export default WelfareCommonHeader;
