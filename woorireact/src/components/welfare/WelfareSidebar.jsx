import { BriefcaseBusiness, ClipboardList, UserPlus, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

const getWorkerFromSession = () => {
    try {
        const saved = sessionStorage.getItem("currentWelfareWorker") || localStorage.getItem("currentWelfareWorker");
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
};

function WelfareSidebar({ active }) {
    const worker = getWorkerFromSession();

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
                </Link>

                <Link
                    to="/welfare/job-applications"
                    className={`wd-sidebar-item${active === "job-applications" ? " wd-sidebar-item-active" : ""}`}
                >
                    <UserPlus size={17} />
                    일자리 신청
                </Link>

                <Link
                    to="/welfare/jobs"
                    className={`wd-sidebar-item${active === "jobs" ? " wd-sidebar-item-active" : ""}`}
                >
                    <BriefcaseBusiness size={17} />
                    일자리 공고
                </Link>

                <Link
                    to="/welfare/mypage"
                    className={`wd-sidebar-item${active === "mypage" ? " wd-sidebar-item-active" : ""}`}
                >
                    <UserRound size={17} />
                    마이페이지
                </Link>
            </nav>
        </aside>
    );
}

export default WelfareSidebar;
