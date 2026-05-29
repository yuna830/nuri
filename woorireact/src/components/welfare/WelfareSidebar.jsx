import { useEffect, useState } from "react";
import { BriefcaseBusiness, ClipboardList, UserPlus, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchWelfareJobApplications } from "../../api/welfareJobApi";
import { fetchWelfareAlerts, fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import {
    isEmergencyPendingSenior,
    isPendingJobApplication,
} from "../../utils/welfare/welfareSummaryStats";

const SEEN_KEYS = {
    seniors: "woori-welfare-seen-senior-alerts",
    applications: "woori-welfare-seen-job-applications",
    jobs: "woori-jobs-seen-count",
};

const getWorkerFromSession = () => {
    try {
        const saved =
            sessionStorage.getItem("currentWelfareWorker") ||
            localStorage.getItem("currentWelfareWorker") ||
            sessionStorage.getItem("welfareWorker") ||
            localStorage.getItem("welfareWorker");
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
};

const getListFromPage = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    return [];
};

const hasUnreadAlert = (alerts) =>
    alerts.some((alert) => {
        const status = String(alert.status || alert.readStatus || "").toUpperCase();
        return alert.isRead !== true && !["READ", "DONE", "RESOLVED"].includes(status);
    });

const buildApplicationSignature = (applications) =>
    applications
        .filter(isPendingJobApplication)
        .map((application) =>
            [
                application.id,
                application.seniorId,
                application.jobId,
                application.status,
                application.updatedAt,
                application.requestedAt,
            ].join(":")
        )
        .sort()
        .join("|");

const buildSeniorAlertSignature = (alerts, seniors) => {
    const unreadAlertKeys = alerts
        .filter((alert) => hasUnreadAlert([alert]))
        .filter((alert) => {
            const text = `${alert.type || ""} ${alert.title || ""} ${alert.message || ""}`;
            return ["SOS", "긴급", "응급", "이탈", "낙상", "위험"].some((keyword) => text.includes(keyword));
        })
        .map((alert) =>
            [
                "alert",
                alert.id,
                alert.seniorId,
                alert.type,
                alert.title,
                alert.createdAt,
            ].join(":")
        );

    const seniorNotificationKeys = seniors
        .filter(isEmergencyPendingSenior)
        .map((senior) =>
            [
                "senior",
                senior.id,
                senior.alertStatus,
                senior.alertUpdatedAt || senior.updatedAt || "",
            ].join(":")
        );

    return [...unreadAlertKeys, ...seniorNotificationKeys].sort().join("|");
};

const fetchCachedJobCount = async () => {
    const response = await fetch("/api/job-cache");
    if (!response.ok) return 0;

    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
};

function WelfareSidebar({ active, onAddSenior, children }) {
    const worker = getWorkerFromSession();
    const workerId = worker?.id || worker?.worker?.id || worker?.welfareWorker?.id || null;
    const [hasSeniorAlerts, setHasSeniorAlerts] = useState(false);
    const [hasPendingApplications, setHasPendingApplications] = useState(false);
    const [hasNewJobPostings, setHasNewJobPostings] = useState(false);

    useEffect(() => {
        let ignore = false;

        const checkBadges = async () => {
            const [applications, alerts, seniors, cachedJobCount] = await Promise.all([
                fetchWelfareJobApplications(workerId).catch(() => []),
                fetchWelfareAlerts().catch(() => []),
                fetchWelfareSeniors({ page: 0, size: 100, welfareWorkerId: workerId }).catch(() => []),
                fetchCachedJobCount().catch(() => 0),
            ]);

            if (ignore) return;

            const seenJobCount = Number(localStorage.getItem(SEEN_KEYS.jobs) || 0);
            const seniorList = getListFromPage(seniors);
            const seniorSignature = buildSeniorAlertSignature(alerts, seniorList);
            const applicationSignature = buildApplicationSignature(applications);
            const seenSeniorSignature = localStorage.getItem(SEEN_KEYS.seniors) || "";
            const seenApplicationSignature = localStorage.getItem(SEEN_KEYS.applications) || "";

            if (active === "seniors") {
                localStorage.setItem(SEEN_KEYS.seniors, seniorSignature);
            }

            if (active === "job-applications") {
                localStorage.setItem(SEEN_KEYS.applications, applicationSignature);
            }

            setHasPendingApplications(Boolean(applicationSignature) && applicationSignature !== seenApplicationSignature);
            setHasSeniorAlerts(Boolean(seniorSignature) && seniorSignature !== seenSeniorSignature);
            setHasNewJobPostings(cachedJobCount > seenJobCount);
        };

        checkBadges();
        const timerId = window.setInterval(checkBadges, 30_000);

        return () => {
            ignore = true;
            window.clearInterval(timerId);
        };
    }, [active, workerId]);

    const showSeniorBadge = active !== "seniors" && hasSeniorAlerts;
    const showApplicationBadge = active !== "job-applications" && hasPendingApplications;
    const showJobPostingBadge = active !== "jobs" && hasNewJobPostings;

    return (
        <aside className="wd-sidebar">
            <div className="wd-sidebar-profile">
                <div className="wd-sidebar-avatar">
                    <UserRound size={26} />
                </div>
                <div>
                    <strong>{worker?.name || "복지사"} 복지사</strong>
                    <span>{worker?.center || "소속 기관 미등록"}</span>
                </div>
            </div>

            <nav className="wd-sidebar-nav">
                <Link
                    to="/welfare"
                    className={`wd-sidebar-item${active === "seniors" ? " wd-sidebar-item-active" : ""}`}
                >
                    <ClipboardList size={17} />
                    대상자 목록
                    {showSeniorBadge && <span className="wd-sidebar-new-badge">new</span>}
                </Link>

                <Link
                    to="/welfare/job-applications"
                    className={`wd-sidebar-item${active === "job-applications" ? " wd-sidebar-item-active" : ""}`}
                >
                    <UserPlus size={17} />
                    일자리 신청
                    {showApplicationBadge && <span className="wd-sidebar-new-badge">new</span>}
                </Link>

                <Link
                    to="/welfare/jobs"
                    className={`wd-sidebar-item${active === "jobs" ? " wd-sidebar-item-active" : ""}`}
                >
                    <BriefcaseBusiness size={17} />
                    일자리 공고
                    {showJobPostingBadge && <span className="wd-sidebar-new-badge">new</span>}
                </Link>

                <Link
                    to="/welfare/mypage"
                    className={`wd-sidebar-item${active === "mypage" ? " wd-sidebar-item-active" : ""}`}
                >
                    <UserRound size={17} />
                    마이페이지
                </Link>
            </nav>

            {onAddSenior && (
                <button
                    type="button"
                    className="wd-sidebar-add-button"
                    onClick={onAddSenior}
                >
                    <UserPlus size={17} />
                    대상자 추가
                </button>
            )}

            {children}
        </aside>
    );
}

export default WelfareSidebar;
