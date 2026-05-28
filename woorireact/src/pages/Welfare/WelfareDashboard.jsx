import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    BriefcaseBusiness,
    ClipboardList,
    Search,
    UserPlus,
    UserRound,
} from "lucide-react";

import {
    fetchWelfareAlerts,
    fetchWelfareSeniors,
    getCachedWelfareSeniors,
} from "../../api/welfareDashboardApi";
import CommonHeader from "../../components/CommonHeader.jsx";
import WelfareSummaryCards from "../../components/welfare/WelfareSummaryCards";
import WelfareSeniorTable from "../../components/welfare/WelfareSeniorTable";
import WelfarePolicyQaButton from "../../components/welfare/WelfarePolicyQaButton";
import {
    getSeniorSummaryCounts,
    hasMissingRequiredSeniorInfo,
    isEmergencyPendingSenior,
} from "../../utils/welfare/welfareSummaryStats";
import {
    FILTER_GROUPS,
    SEOUL_DISTRICTS,
    createEmptyFilters,
    getRegionDistrict,
    getSeniorReviewStatus,
    mapWelfareSenior,
} from "../../utils/welfare/welfareDashboardData";
import { shouldNotifyLastAccessDelay } from "../../utils/welfare/welfareTime";

import "../../css/welfare/WelfareDashboard.css";

const ITEM_PER_PAGE = 6;

const EMERGENCY_FILTER_VALUES = [
    "미응답 SOS",
    "보호자 미응답 SOS",
    "낙상 의심",
    "안전구역 이탈",
    "위험 알림",
];

const getKeywordTokens = (keyword) =>
    keyword
        .toLowerCase()
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean);

const cloneFilters = (targetFilters) =>
    FILTER_GROUPS.reduce(
        (nextFilters, group) => ({
            ...nextFilters,
            [group.key]: [...targetFilters[group.key]],
        }),
        {}
    );

const WELFARE_READ_NOTIFICATIONS_KEY = "welfare:read-notifications";

const getSavedReadNotificationIds = () => {
    try {
        const savedIds = JSON.parse(localStorage.getItem(WELFARE_READ_NOTIFICATIONS_KEY) || "[]");
        return Array.isArray(savedIds) ? savedIds : [];
    } catch {
        return [];
    }
};

function WelfareDashboard() {
    const navigate = useNavigate();
    const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
    const initialCachedSeniors = getCachedWelfareSeniors({ page: 0, size: ITEM_PER_PAGE });
    const initialRawSeniors = Array.isArray(initialCachedSeniors)
        ? initialCachedSeniors
        : initialCachedSeniors?.content;
    const initialMappedSeniors = Array.isArray(initialRawSeniors)
        ? initialRawSeniors.map(mapWelfareSenior)
        : [];

    const [seniors, setSeniors] = useState(initialMappedSeniors);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(initialMappedSeniors.length === 0);
    const [seniorLoadError, setSeniorLoadError] = useState("");
    const [dbWelfareAlerts, setDbWelfareAlerts] = useState([]);
    const [dismissedNotifications, setDismissedNotifications] = useState(getSavedReadNotificationIds);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");
    const [filters, setFilters] = useState(createEmptyFilters);
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");
    const [isDetailedSearchOpen, setIsDetailedSearchOpen] = useState(false);
    const [summaryFilter, setSummaryFilter] = useState("all");
    const [serverTotalPages, setServerTotalPages] = useState(
        Array.isArray(initialCachedSeniors) ? 1 : Math.max(1, initialCachedSeniors?.totalPages || 1)
    );
    const [serverTotalSeniors, setServerTotalSeniors] = useState(
        Array.isArray(initialCachedSeniors)
            ? initialMappedSeniors.length
            : Number(initialCachedSeniors?.totalElements || initialMappedSeniors.length)
    );

    const openSeniorAssignmentGuide = () => {
        window.alert("대상자 추가는 관리자 페이지에서 복지사를 배정한 뒤 반영됩니다.");
    };

    useEffect(() => {
        let ignore = false;

        const loadSeniors = async () => {
            try {
                setIsLoadingSeniors(true);
                setSeniorLoadError("");

                const data = await fetchWelfareSeniors({
                    page: currentPage - 1,
                    size: ITEM_PER_PAGE,
                });
                const rawSeniors = Array.isArray(data) ? data : data.content;
                const nextSeniors = Array.isArray(rawSeniors) ? rawSeniors.map(mapWelfareSenior) : [];

                if (!ignore) {
                    setSeniors(nextSeniors);
                    setServerTotalPages(Array.isArray(data) ? 1 : Math.max(1, data.totalPages || 1));
                    setServerTotalSeniors(Array.isArray(data) ? nextSeniors.length : Number(data.totalElements || 0));
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
    }, [currentPage]);

    useEffect(() => {
        let ignore = false;

        const loadWelfareAlerts = async () => {
            try {
                const alerts = await fetchWelfareAlerts();

                if (!ignore) {
                    setDbWelfareAlerts(Array.isArray(alerts) ? alerts : []);
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

            const isMatchedBySummary =
                summaryFilter === "all" ||
                (summaryFilter === "emergency" && isEmergencyPendingSenior(senior)) ||
                (summaryFilter === "missingInfo" && hasMissingRequiredSeniorInfo(senior));

            return isMatchedByFilters && isMatchedByKeyword && isMatchedBySummary;
        });
    }, [filters, searchKeyword, seniors, summaryFilter]);

    const getPriorityRank = (senior) => {
        if (senior.alertStatus === "미응답 SOS") return 1;
        if (senior.alertStatus === "일자리 신청") return 2;
        if (getSeniorReviewStatus(senior) === "미검토") return 3;

        return 4;
    };

    const totalPages = Math.max(1, serverTotalPages);
    const seniorSummaryCounts = {
        ...getSeniorSummaryCounts(seniors),
        totalSeniors: serverTotalSeniors || seniors.length,
    };

    const currentSeniors = filteredSeniors
        .slice()
        .sort(
            (first, second) =>
                getPriorityRank(first) - getPriorityRank(second) ||
                Number(first.id) - Number(second.id)
        );

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

    const applyFilters = () => {
        setFilters(cloneFilters(draftFilters));
        setSearchKeyword(draftSearchKeyword.trim());
        setSummaryFilter("all");
        setCurrentPage(1);
    };

    const resetFilters = () => {
        const emptyFilters = createEmptyFilters();

        setDraftFilters(emptyFilters);
        setFilters(cloneFilters(emptyFilters));
        setDraftSearchKeyword("");
        setSearchKeyword("");
        setSummaryFilter("all");
        setCurrentPage(1);
    };

    const handleSeniorSummaryFilter = (key) => {
        setCurrentPage(1);
        setSummaryFilter(key);

        if (key === "all") {
            resetFilters();
            return;
        }

        if (key === "emergency") {
            setActiveFilterKey("alertStatus");
            setDraftFilters((previousFilters) => ({
                ...previousFilters,
                alertStatus: EMERGENCY_FILTER_VALUES,
            }));
            setFilters((previousFilters) => ({
                ...previousFilters,
                alertStatus: EMERGENCY_FILTER_VALUES,
            }));
            setSearchKeyword("");
            setDraftSearchKeyword("");
            return;
        }

        if (key === "missingInfo") {
            const emptyFilters = createEmptyFilters();

            setFilters(cloneFilters(emptyFilters));
            setDraftFilters(emptyFilters);
            setSearchKeyword("");
            setDraftSearchKeyword("");
        }
    };

    const dbWelfareNotifications = dbWelfareAlerts.map((alert) => ({
        id: `db-${alert.id}`,
        seniorId: alert.seniorId,
        title: alert.title,
        message: alert.message,
        category: alert.type === "LAST_ACCESS" ? "복지" : "긴급",
        detailCategory: alert.type === "LAST_ACCESS" ? "기본 정보" : "안전구역 관리",
        danger: alert.type !== "LAST_ACCESS",
    }));

    const welfareNotifications = seniors.flatMap((senior) => {
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

    const activeNotifications = [...dbWelfareNotifications, ...welfareNotifications].map((notification) => ({
        ...notification,
        isRead: dismissedNotifications.includes(notification.id),
    }));

    const dismissNotification = (notificationId) => {
        setDismissedNotifications((previousIds) => {
            const nextIds = previousIds.includes(notificationId)
                ? previousIds
                : [...previousIds, notificationId];

            localStorage.setItem(WELFARE_READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds));
            return nextIds;
        });
    };

    return (
        <div className="wd-page">
            <CommonHeader
                homePath="/welfare"
                showNotificationButton
                notifications={activeNotifications.map((notification) => ({
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    category: notification.category || notification.detailCategory || "정보",
                    time: notification.time,
                    isRead: notification.isRead,
                    danger: notification.danger === true || notification.category === "긴급",
                    raw: notification,
                }))}
                notificationTabs={["전체", "긴급", "정보 미입력", "일자리", "복지", "읽지 않음"]}
                onReadNotification={(notification) => dismissNotification(notification.id)}
                actions={
                    <button
                        className="common-app-danger-button"
                        type="button"
                        onClick={openSeniorAssignmentGuide}
                    >
                        대상자 추가
                    </button>
                }
            />

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

                        <Link to="/welfare/job-applications" className="wd-sidebar-item">
                            <UserPlus size={17} />
                            일자리 신청
                        </Link>

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
                        onClick={openSeniorAssignmentGuide}
                    >
                        <UserPlus size={17} />
                        대상자 추가
                    </button>
                </aside>

                <main className="wd-content">
                    <WelfareSummaryCards
                        mode="seniors"
                        counts={seniorSummaryCounts}
                        onFilter={handleSeniorSummaryFilter}
                    />

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
                            aria-label="이전 페이지"
                        >
                            &lt;
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
                            aria-label="다음 페이지"
                        >
                            &gt;
                        </button>
                    </div>
                </main>
            </div>

            <WelfarePolicyQaButton />
        </div>
    );
}

export default WelfareDashboard;
