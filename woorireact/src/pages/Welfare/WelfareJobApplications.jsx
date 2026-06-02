import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import WelfareCommonHeader from "../../components/welfare/WelfareCommonHeader.jsx";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";

import {
    fetchWelfareJobApplications,
    updateWelfareJobApplicationStatus,
} from "../../api/welfareJobApi";
import WelfareSummaryCards from "../../components/welfare/WelfareSummaryCards";
import {
    getJobApplicationSummaryCounts,
    isCompletedJobApplication,
    isPendingJobApplication,
    isPhoneConsultationJobApplication,
} from "../../utils/welfare/welfareSummaryStats";
import WelfarePolicyChatButton from "../../components/welfare/WelfarePolicyChatButton";


import "../../css/welfare/WelfareDashboard.css";
import "../../css/welfare/WelfareJobApplications.css";

const getFilteredApplicationsBySummary = (applications, filter) => {
    if (filter === "pending") {
        return applications.filter(isPendingJobApplication);
    }

    if (filter === "phone") {
        return applications.filter(isPhoneConsultationJobApplication);
    }

    if (filter === "completed") {
        return applications.filter(isCompletedJobApplication);
    }

    return applications;
};

const getCurrentWelfareWorkerId = () => {
    try {
        const saved =
            sessionStorage.getItem("currentWelfareWorker") ||
            localStorage.getItem("currentWelfareWorker") ||
            sessionStorage.getItem("welfareWorker") ||
            localStorage.getItem("welfareWorker");
        const parsed = saved ? JSON.parse(saved) : null;
        return parsed?.id || parsed?.worker?.id || parsed?.welfareWorker?.id || null;
    } catch {
        return null;
    }
};

function WelfareJobApplications() {
    const [applications, setApplications] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [summaryFilter, setSummaryFilter] = useState("all");

    useEffect(() => {
        let ignore = false;

        const loadApplications = async (silent = false) => {
            try {
                if (!silent) setIsLoading(true);
                setLoadError("");

                const data = await fetchWelfareJobApplications(getCurrentWelfareWorkerId());

                if (!ignore) {
                    setApplications(data);
                }
            } catch {
                if (!ignore) {
                    setLoadError("일자리 신청 내역을 불러오지 못했습니다.");
                    setApplications([]);
                }
            } finally {
                if (!ignore) {
                    if (!silent) setIsLoading(false);
                }
            }
        };

        loadApplications();
        const timerId = window.setInterval(() => loadApplications(true), 30000);

        return () => {
            ignore = true;
            window.clearInterval(timerId);
        };
    }, []);

    const filteredApplications = useMemo(() => {
        const bySummary = getFilteredApplicationsBySummary(applications, summaryFilter);
        const keyword = searchKeyword.trim().toLowerCase();

        if (!keyword) {
            return bySummary;
        }

        return bySummary.filter((application) =>
            [
                application.seniorName,
                application.seniorId,
                application.jobTitle,
                application.organization,
                application.status,
                application.phone,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        );
    }, [applications, summaryFilter, searchKeyword]);

    const handleStatusChange = async (applicationId, status) => {
        try {
            const updated = await updateWelfareJobApplicationStatus(applicationId, status);

            setApplications((previousApplications) =>
                previousApplications.map((application) =>
                    application.id === applicationId ? updated : application
                )
            );
        } catch {
            alert("상태 변경에 실패했습니다.");
        }
    };

    return (
        <div className="wd-page">
            <WelfareCommonHeader rightText="일자리 신청 관리" />

            <div className="wd-layout">
                <WelfareSidebar active="job-applications" />

                <main className="wja-main">
                    <WelfareSummaryCards
                    mode="jobs"
                    counts={getJobApplicationSummaryCounts(applications)}
                    activeKey={summaryFilter}
                    onFilter={(key) => setSummaryFilter(key)}
                    />

                    <div className="wja-search-row">
                        <Search size={16} />
                        <input
                            type="search"
                            value={searchKeyword}
                            onChange={(event) => setSearchKeyword(event.target.value)}
                            placeholder="대상자, 공고명, 기관명 검색"
                        />
                    </div>

                    {isLoading && <p className="wja-state-text">일자리 신청 내역을 불러오는 중입니다.</p>}
                    {!isLoading && loadError && <p className="wja-state-text wja-state-error">{loadError}</p>}

                    {!isLoading && !loadError && (
                        <div className="wja-table-wrap">
                            <table className="wja-table">
                                <thead>
                                    <tr>
                                        <th>대상자</th>
                                        <th>공고명</th>
                                        <th>기관</th>
                                        <th>신청일</th>
                                        <th>연락처</th>
                                        <th>처리</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredApplications.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="wja-empty-cell">
                                                {summaryFilter === "all"
                                                    ? "일자리 신청 내역이 없습니다."
                                                    : "해당 상태의 신청이 없습니다."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredApplications.map((application) => (
                                            <tr key={application.id}>
                                                <td>
                                                    <strong>{application.seniorName}</strong>
                                                    <span>ID {application.seniorId}</span>
                                                </td>
                                                <td>{application.jobTitle}</td>
                                                <td>{application.organization}</td>
                                                <td>{application.requestedAt}</td>
                                                <td>{application.phone || "-"}</td>
                                                <td>
                                                    <select
                                                        className="wja-status-select"
                                                        value={application.status || "검토 대기"}
                                                        onChange={(event) =>
                                                            handleStatusChange(application.id, event.target.value)
                                                        }
                                                    >
                                                        <option value="검토 대기">검토 대기</option>
                                                        <option value="전화상담요청">전화 상담 요청</option>
                                                        <option value="배정 완료">배정 완료</option>
                                                        <option value="반려">반려</option>
                                                        <option value="취소 처리">취소 처리</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

        </div>
    );
}

export default WelfareJobApplications;
