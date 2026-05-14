import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Bell,
    BriefcaseBusiness,
    ClipboardList,
    Search,
    UserPlus,
    UserRound,
    X,
} from "lucide-react";

import { fetchWelfareAlerts, fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import CommonHeader from "../../components/CommonHeader.jsx";
import WelfareSummaryCards from "../../components/welfare/WelfareSummaryCards";
import WelfareSeniorTable from "../../components/welfare/WelfareSeniorTable";
import {
    FILTER_GROUPS,
    SEOUL_DISTRICTS,
    createEmptyFilters,
    getRegionDistrict,
    getSeniorReviewStatus,
    getSummaryCounts,
    mapWelfareSenior,
} from "../../utils/welfare/welfareDashboardData";
import { shouldNotifyLastAccessDelay } from "../../utils/welfare/welfareTime";

import "../../css/welfare/WelfareNotifications.css";
import "../../css/welfare/WelfareDashboard.css";

const ITEM_PER_PAGE = 6;

const getKeywordTokens = (keyword) =>
    keyword
        .toLowerCase()
        .split(/[\s,，]+/)
        .map((token) => token.trim())
        .filter(Boolean);

function WelfareDashboard() {
    const navigate = useNavigate();
    const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");

    const [seniors, setSeniors] = useState([]);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
    const [seniorLoadError, setSeniorLoadError] = useState("");
    const [dbWelfareAlerts, setDbWelfareAlerts] = useState([]);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [dismissedNotifications, setDismissedNotifications] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");
    const [filters, setFilters] = useState(createEmptyFilters);
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");
    const [isDetailedSearchOpen, setIsDetailedSearchOpen] = useState(false);

    useEffect(() => {
        let ignore = false;

        const loadSeniors = async () => {
            try {
                setIsLoadingSeniors(true);
                setSeniorLoadError("");

                const data = await fetchWelfareSeniors();
                const nextSeniors = Array.isArray(data) ? data.map(mapWelfareSenior) : [];

                if (!ignore) {
                    setSeniors(nextSeniors);
                }
            } catch (error) {
                console.error("대상자 데이터 로딩 실패:", error);

                if (!ignore) {
                    setSeniorLoadError("대상자 데이터를 불러오지 못했습니다.");
                    setSeniors([]);
                }
            } finally {
                if (!ignore) {
                    setIsLoadingSeniors(false);
                }
            }
        };

        loadSeniors();

        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        let ignore = false;

        const loadWelfareAlerts = async () => {
            try {
                const alerts = await fetchWelfareAlerts();

                if (!ignore) {
                    setDbWelfareAlerts(alerts);
                }
            } catch (error) {
                console.error("복지사 알림 로딩 실패:", error);

                if (!ignore) {
                    setDbWelfareAlerts([]);
                }
            }
        };

        loadWelfareAlerts();

        const timerId = setInterval(loadWelfareAlerts, 15000);

        return () => {
            ignore = true;
            clearInterval(timerId);
        };
    }, []);

    const regionOptions = useMemo(() => ["서울 전체", ...SEOUL_DISTRICTS], []);

    const getSeniorFilterValue = (senior, filterKey) => {
        if (filterKey === "regionDistrict") {
            return getRegionDistrict(senior.region);
        }

        if (filterKey === "workRequestStatus") {
            return getSeniorReviewStatus(senior);
        }

        return senior[filterKey];
    };

    const isFilterMatched = (filterKey, selectedValues, senior) => {
        if (selectedValues.length === 0 || selectedValues.includes("서울 전체")) {
            return true;
        }

        return selectedValues.includes(getSeniorFilterValue(senior, filterKey));
    };

    const filteredSeniors = useMemo(() => {
        const keywordTokens = getKeywordTokens(searchKeyword);

        return seniors.filter((senior) => {
            const isMatchedByFilters = FILTER_GROUPS.every((group) =>
                isFilterMatched(group.key, filters[group.key], senior)
            );

            const searchableValues = [
                senior.id,
                `ID ${String(senior.id).padStart(4, "0")}`,
                senior.name,
                senior.phone,
                senior.age,
                senior.gender,
                senior.region,
                senior.healthStatus,
                senior.lastAccess,
                senior.alertStatus,
                getSeniorReviewStatus(senior),
                senior.jobRequestStatus,
                senior.welfareDecision,
            ];

            const searchableText = searchableValues
                .map((value) => String(value ?? "").toLowerCase())
                .join(" ");

            const isMatchedByKeyword =
                keywordTokens.length === 0 ||
                keywordTokens.every((token) => searchableText.includes(token));

            return isMatchedByFilters && isMatchedByKeyword;
        });
    }, [filters, searchKeyword, seniors]);

    const getPriorityRank = (senior) => {
        if (senior.alertStatus === "미응답 SOS") return 1;
        if (senior.alertStatus === "일자리 신청") return 2;
        if (getSeniorReviewStatus(senior) === "미검토") return 3;

        return 4;
    };

    const totalPages = Math.max(1, Math.ceil(filteredSeniors.length / ITEM_PER_PAGE));

    const currentSeniors = filteredSeniors
        .slice()
        .sort((first, second) =>
            getPriorityRank(first) - getPriorityRank(second) ||
            Number(first.id) - Number(second.id)
        )
        .slice((currentPage - 1) * ITEM_PER_PAGE, currentPage * ITEM_PER_PAGE);

    const toggleDraftFilter = (filterKey, option) => {
        setDraftFilters((previousFilters) => {
            const selectedValues = previousFilters[filterKey];

            if (filterKey === "regionDistrict") {
                if (option === "서울 전체") {
                    return {
                        ...previousFilters,
                        [filterKey]: selectedValues.includes("서울 전체") ? [] : ["서울 전체"],
                    };
                }

                const withoutAll = selectedValues.filter((value) => value !== "서울 전체");

                return {
                    ...previousFilters,
                    [filterKey]: withoutAll.includes(option)
                        ? withoutAll.filter((value) => value !== option)
                        : [...withoutAll, option],
                };
            }

            return {
                ...previousFilters,
                [filterKey]: selectedValues.includes(option)
                    ? selectedValues.filter((value) => value !== option)
                    : [...selectedValues, option],
            };
        });
    };

    const getFilterOptionCount = (filterKey, option) => {
        if (option === "서울 전체") {
            return seniors.length;
        }

        return seniors.filter((senior) => getSeniorFilterValue(senior, filterKey) === option).length;
    };

    const cloneFilters = (targetFilters) =>
        FILTER_GROUPS.reduce((nextFilters, group) => ({
            ...nextFilters,
            [group.key]: [...targetFilters[group.key]],
        }), {});

    const applyFilters = () => {
        setFilters(cloneFilters(draftFilters));
        setSearchKeyword(draftSearchKeyword.trim());
        setCurrentPage(1);
    };

    const resetFilters = () => {
        const emptyFilters = createEmptyFilters();

        setDraftFilters(emptyFilters);
        setFilters(cloneFilters(emptyFilters));
        setDraftSearchKeyword("");
        setSearchKeyword("");
        setCurrentPage(1);
    };

    const dbWelfareNotifications = dbWelfareAlerts.map((alert) => ({
        id: `db-${alert.id}`,
        seniorId: alert.seniorId,
        title: alert.title,
        message: alert.message,
        detailCategory: alert.type === "LAST_ACCESS" ? "기본 정보" : "안심구역 관리",
    }));

    const welfareNotifications = seniors.flatMap((senior) => {
        const notifications = [];

        if (senior.alertStatus === "미응답 SOS") {
            notifications.push({
                id: `${senior.id}-sos`,
                seniorId: senior.id,
                title: "미응답 SOS",
                message: `${senior.name} 대상자의 SOS를 보호자가 아직 확인하지 않았습니다.`,
                detailCategory: "안심구역 관리",
            });
        }

        if (senior.alertStatus === "일자리 신청" && getSeniorReviewStatus(senior) !== "검토") {
            notifications.push({
                id: `${senior.id}-job-request`,
                seniorId: senior.id,
                title: "일자리 신청",
                message: `${senior.name} 대상자가 일자리 신청을 보냈습니다.`,
                detailCategory: "일자리 요청 상태",
            });
        }

        if (shouldNotifyLastAccessDelay(senior.lastAccess)) {
            notifications.push({
                id: `${senior.id}-last-access`,
                seniorId: senior.id,
                title: "접속 확인 필요",
                message: `${senior.name} 대상자가 4시간 넘게 접속하지 않았습니다.`,
                detailCategory: "기본 정보",
            });
        }

        return notifications;
    });

    const activeNotifications = [...dbWelfareNotifications, ...welfareNotifications].filter(
        (notification) => !dismissedNotifications.includes(notification.id)
    );

    const dismissNotification = (notificationId) => {
        setDismissedNotifications((previousIds) =>
            previousIds.includes(notificationId) ? previousIds : [...previousIds, notificationId]
        );
    };

    return (
        <div className="wd-page">
            <CommonHeader
                homePath="/welfare"
                actions={
                    <>
                        <button
                            type="button"
                            className="common-app-icon-button"
                            onClick={() => setIsNotificationOpen(true)}
                            aria-label="알림"
                        >
                            <Bell size={18} />
                            {activeNotifications.length > 0 && (
                                <span className="common-app-badge">
                                    {activeNotifications.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            className="common-app-danger-button"
                            onClick={() => alert("긴급 신고 기능을 연결해주세요.")}
                        >
                            긴급 신고
                        </button>
                    </>
                }
            />

            {isNotificationOpen && (
                <div
                    className="welfare-notification-overlay"
                    onClick={() => setIsNotificationOpen(false)}
                >
                    <aside
                        className="welfare-notification-panel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="welfare-notification-panel-header">
                            <h2>전체 알림</h2>
                            <button
                                type="button"
                                className="welfare-notification-close"
                                onClick={() => setIsNotificationOpen(false)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="welfare-notification-count">
                            {activeNotifications.length}건
                        </div>

                        <div className="welfare-notification-list">
                            {activeNotifications.length === 0 ? (
                                <p className="welfare-notification-empty">도착한 알림이 없습니다.</p>
                            ) : (
                                activeNotifications.map((notification) => (
                                    <article key={notification.id} className="welfare-notification-item">
                                        <button
                                            type="button"
                                            className="welfare-notification-dismiss"
                                            onClick={() => dismissNotification(notification.id)}
                                            aria-label="알림 삭제"
                                        >
                                            <X size={16} />
                                        </button>

                                        <button
                                            type="button"
                                            className="welfare-notification-content"
                                            onClick={() => {
                                                setIsNotificationOpen(false);

                                                if (notification.seniorId) {
                                                    navigate(`/welfare/seniors/${notification.seniorId}`, {
                                                        state: {
                                                            category: notification.detailCategory || "기본 정보",
                                                        },
                                                    });
                                                }
                                            }}
                                        >
                                            <strong>{notification.title}</strong>
                                            <span>{notification.message}</span>
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </aside>
                </div>
            )}

            <div className="wd-layout">
                <aside className="wd-sidebar">
                    <div className="wd-sidebar-profile">
                        <div className="wd-sidebar-avatar">
                            <UserRound size={26} />
                        </div>

                        <div>
                            <strong>{currentWorker?.name || "복지사"} 복지사</strong>
                            <span>{currentWorker?.center || "소속 기관 미등록"}</span>
                        </div>
                    </div>

                    <nav className="wd-sidebar-nav">
                        <Link to="/welfare" className="wd-sidebar-item wd-sidebar-item-active">
                            <ClipboardList size={17} />
                            대상자 목록
                        </Link>

                        <button
                            type="button"
                            className="wd-sidebar-item"
                            onClick={() => {
                                setActiveFilterKey("alertStatus");
                                setDraftFilters((previousFilters) => ({
                                    ...previousFilters,
                                    alertStatus: ["일자리 신청"],
                                }));
                                setFilters((previousFilters) => ({
                                    ...previousFilters,
                                    alertStatus: ["일자리 신청"],
                                }));
                                setCurrentPage(1);
                            }}
                        >
                            <UserPlus size={17} />
                            일자리 신청
                        </button>

                        <Link to="/welfare/jobs" className="wd-sidebar-item">
                            <BriefcaseBusiness size={17} />
                            일자리 공고
                        </Link>

                        <Link to="/welfare/mypage" className="wd-sidebar-item">
                            <UserRound size={17} />
                            마이페이지
                        </Link>
                    </nav>

                    <button
                        type="button"
                        className="wd-sidebar-add-button"
                        onClick={() => navigate("/signup")}
                    >
                        <UserPlus size={17} />
                        대상자 추가
                    </button>
                </aside>

                <main className="wd-content">
                    <WelfareSummaryCards counts={getSummaryCounts(seniors)} />

                    <section className="wd-filter-area">
                        <div className="wd-search-row">
                            <select
                                className="wd-condition-select"
                                value={activeFilterKey}
                                onChange={(event) => setActiveFilterKey(event.target.value)}
                                aria-label="검색 조건"
                            >
                                {FILTER_GROUPS.map((group) => (
                                    <option key={group.key} value={group.key}>
                                        {group.label}
                                    </option>
                                ))}
                            </select>

                            <input
                                id="senior-keyword-search"
                                className="wd-keyword-input"
                                type="search"
                                value={draftSearchKeyword}
                                placeholder="검색어를 입력하세요"
                                onChange={(event) => setDraftSearchKeyword(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        applyFilters();
                                    }
                                }}
                            />

                            <button type="button" className="wd-search-button" onClick={applyFilters}>
                                <Search size={15} />
                                검색
                            </button>

                            <button
                                type="button"
                                className={`wd-detail-search-button${isDetailedSearchOpen ? " active" : ""}`}
                                onClick={() => setIsDetailedSearchOpen((isOpen) => !isOpen)}
                            >
                                상세검색
                            </button>
                        </div>

                        {isDetailedSearchOpen && (
                            <div className="wd-detail-search-panel">
                                {FILTER_GROUPS.map((group) => {
                                    const groupOptions = group.key === "regionDistrict" ? regionOptions : group.options;

                                    return (
                                        <div key={group.key} className="wd-detail-filter-row">
                                            <strong>{group.label}</strong>

                                            <div className="wd-detail-filter-options">
                                                {groupOptions.map((option) => (
                                                    <label key={option} className="wd-checkbox-label">
                                                        <input
                                                            className="wd-checkbox-input"
                                                            type="checkbox"
                                                            checked={draftFilters[group.key].includes(option)}
                                                            onChange={() => toggleDraftFilter(group.key, option)}
                                                        />
                                                        <span>{option}</span>
                                                        <span className="wd-checkbox-count">
                                                            ({getFilterOptionCount(group.key, option)})
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        )}
                    </section>

                    {isLoadingSeniors && (
                        <p className="wd-data-message">대상자 데이터를 불러오는 중입니다.</p>
                    )}

                    {!isLoadingSeniors && seniorLoadError && (
                        <p className="wd-data-message wd-data-message-error">{seniorLoadError}</p>
                    )}

                    {!isLoadingSeniors && !seniorLoadError && currentSeniors.length === 0 && (
                        <p className="wd-data-message">등록된 대상자가 없습니다.</p>
                    )}

                    <WelfareSeniorTable seniors={currentSeniors} />

                    <div className="wd-pager">
                        <button
                            type="button"
                            className="wd-small-button"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                        >
                            이전
                        </button>

                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                                type="button"
                                key={pageNumber}
                                className="wd-small-button"
                                onClick={() => setCurrentPage(pageNumber)}
                                disabled={currentPage === pageNumber}
                            >
                                {pageNumber}
                            </button>
                        ))}

                        <button
                            type="button"
                            className="wd-small-button"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                        >
                            다음
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default WelfareDashboard;
