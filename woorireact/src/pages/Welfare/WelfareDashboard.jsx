import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search } from "lucide-react";

import {
    assignWelfareSenior,
    fetchWelfareAlerts,
    fetchWelfareSeniors,
    requestSeniorInfoUpdate,
    searchSeniorExact,
} from "../../api/welfareDashboardApi";
import CommonHeader from "../../components/CommonHeader.jsx";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";
import TripartiteChatModal from "../../components/TripartiteChatModal.jsx";
import { fetchUnreadChatCount } from "../../api/chatApi";
import WelfareSummaryCards from "../../components/welfare/WelfareSummaryCards";
import WelfareSeniorTable from "../../components/welfare/WelfareSeniorTable";
import WelfarePolicyChatButton from "../../components/welfare/WelfarePolicyChatButton";
import {
    getMissingSeniorInfoFields,
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
import { formatPhoneNumber } from "../../utils/common/phone.js";

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

function WelfareDashboard() {
    const navigate = useNavigate();
    const currentWorker = useMemo(() => {
        try {
            return JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
        } catch {
            return null;
        }
    }, []);

    const [seniors, setSeniors] = useState([]);
    const [notificationSeniors, setNotificationSeniors] = useState([]);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
    const [seniorLoadError, setSeniorLoadError] = useState("");
    const [dbWelfareAlerts, setDbWelfareAlerts] = useState([]);
    const [dismissedNotifications, setDismissedNotifications] = useState([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");
    const [filters, setFilters] = useState(createEmptyFilters);
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");
    const [isDetailedSearchOpen, setIsDetailedSearchOpen] = useState(false);
    const [summaryFilter, setSummaryFilter] = useState("all");
    const [serverTotalPages, setServerTotalPages] = useState(1);
    const [serverTotalSeniors, setServerTotalSeniors] = useState(0);
    const [infoRequestTarget, setInfoRequestTarget] = useState(null);
    const [infoRequestTargets, setInfoRequestTargets] = useState({
        toSenior: true,
        toGuardian: true,
    });
    const [seniorReloadKey, setSeniorReloadKey] = useState(0);
    const [isAddSeniorModalOpen, setIsAddSeniorModalOpen] = useState(false);
    const [addSeniorForm, setAddSeniorForm] = useState({ name: "", phone: "" });
    const [addSeniorStatus, setAddSeniorStatus] = useState("");
    const [isAddingSenior, setIsAddingSenior] = useState(false);

    useEffect(() => {
        if (!currentWorker) {
            navigate("/wlogin", { replace: true });
        }
    }, [currentWorker, navigate]);

    useEffect(() => {
        if (!currentWorker) return;

        let ignore = false;

        const loadSeniors = async () => {
            try {
                setIsLoadingSeniors(true);
                setSeniorLoadError("");

                const data = await fetchWelfareSeniors({
                    page: currentPage - 1,
                    size: ITEM_PER_PAGE,
                    welfareWorkerId: currentWorker.id,
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
    }, [currentPage, currentWorker, seniorReloadKey]);

    useEffect(() => {
        if (!currentWorker) return;

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
    }, [currentWorker]);

    useEffect(() => {
        if (!currentWorker?.id) return;
        let ignore = false;
        const load = async () => {
            try {
                const data = await fetchWelfareSeniors({ page: 0, size: 100, welfareWorkerId: currentWorker.id });
                const raw = Array.isArray(data) ? data : data.content || [];
                if (!ignore) setNotificationSeniors(raw.map(mapWelfareSenior));
            } catch { /* silent */ }
        };
        load();
        const timerId = setInterval(load, 15000);
        return () => { ignore = true; clearInterval(timerId); };
    }, [currentWorker]);

    const loadUnreadChatCount = async () => {
        const count = await fetchUnreadChatCount({ viewerRole: "WELFARE" }).catch(() => 0);
        setUnreadChatCount(count);
    };

    useEffect(() => {
        if (!currentWorker) return;

        loadUnreadChatCount();
        const timerId = setInterval(loadUnreadChatCount, 5000);
        return () => clearInterval(timerId);
    }, [currentWorker]);

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

    const welfareNotifications = notificationSeniors.flatMap((senior) => {
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

    const activeNotifications = [...dbWelfareNotifications, ...welfareNotifications]
        .filter((notification, index, source) =>
            source.findIndex((item) => item.id === notification.id) === index
        )
        .filter((notification) => !dismissedNotifications.includes(notification.id));
    const dismissNotification = (notificationId) => {
        setDismissedNotifications((previousIds) =>
            previousIds.includes(notificationId) ? previousIds : [...previousIds, notificationId]
        );
    };

    const handleSelectSenior = (senior) => {
        if (summaryFilter === "missingInfo") {
            setInfoRequestTarget(senior);
            setInfoRequestTargets({
                toSenior: true,
                toGuardian: Boolean(senior.hasGuardian),
            });
            return;
        }

        navigate(`/welfare/seniors/${senior.id}`);
    };

    const handleSendInfoRequest = async () => {
        if (!infoRequestTarget) return;

        const missingFields = getMissingSeniorInfoFields(infoRequestTarget);

        if (!infoRequestTargets.toSenior && !infoRequestTargets.toGuardian) {
            alert("요청 대상을 선택해주세요.");
            return;
        }

        try {
            const createdAlerts = await requestSeniorInfoUpdate({
                seniorId: infoRequestTarget.id,
                missingFields,
                toSenior: infoRequestTargets.toSenior,
                toGuardian: infoRequestTargets.toGuardian,
            });

            const hasGuardianAlert = createdAlerts.some((alert) => alert.guardianId);
            const hasSeniorAlert = createdAlerts.some((alert) => alert.seniorId && !alert.guardianId);

            if (infoRequestTargets.toGuardian && !hasGuardianAlert) {
                alert("사용자에게 요청은 보냈지만, 연결된 보호자가 없어 보호자 알림은 전송되지 않았습니다.");
            } else if (infoRequestTargets.toSenior && !hasSeniorAlert) {
                alert("보호자에게 요청은 보냈지만, 사용자 알림은 전송되지 않았습니다.");
            } else {
                alert("정보 입력 요청을 보냈습니다.");
            }

            setInfoRequestTarget(null);
        } catch (error) {
            console.error("정보 입력 요청 실패:", error);
            alert("정보 입력 요청을 보내지 못했습니다.");
        }
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

            await assignWelfareSenior({
                seniorId: target.id,
                welfareWorkerId: currentWorker.id,
            });

            setIsAddSeniorModalOpen(false);
            setCurrentPage(1);
            setSeniorReloadKey((key) => key + 1);
        } catch (error) {
            console.error("대상자 추가 실패:", error);
            setAddSeniorStatus("대상자 추가에 실패했습니다.");
        } finally {
            setIsAddingSenior(false);
        }
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
                    isRead: false,
                    danger: notification.danger === true || notification.category === "긴급",
                    raw: notification,
                }))}
                notificationTabs={["전체", "긴급", "정보 미입력", "일자리", "복지", "읽지 않음"]}
                onReadNotification={(notification) => dismissNotification(notification.id)}
                onNotificationClick={(notification) => {
                    if (notification.seniorId) {
                        navigate(`/welfare/seniors/${notification.seniorId}`, {
                            state: {
                                category: notification.detailCategory || "기본 정보",
                            },
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
                rooms={seniors.flatMap((senior) => [
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
                ])}
                senderRole="WELFARE"
                senderId={currentWorker?.id}
                senderName={currentWorker?.name || "복지사"}
                onReadChange={loadUnreadChatCount}
                onClose={() => setIsChatOpen(false)}
            />

            <div className="wd-layout">
                <WelfareSidebar
                    active="seniors"
                    onAddSenior={openAddSeniorModal}
                    policyChatSlot={
                        <WelfarePolicyChatButton
                            variant="sidebar"
                            seniorOptions={currentSeniors}
                        />
                    }
                />

                <main className="wd-content">
                    <WelfareSummaryCards
                        mode="seniors"
                        counts={seniorSummaryCounts}
                        activeKey={summaryFilter}
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

                    <WelfareSeniorTable
                        seniors={currentSeniors}
                        onSelectSenior={handleSelectSenior}
                    />

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

            {isAddSeniorModalOpen && (
                <div className="wd-modal-backdrop" onClick={() => setIsAddSeniorModalOpen(false)}>
                    <section className="wd-info-request-modal wd-add-senior-modal" onClick={(event) => event.stopPropagation()}>
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
                                    onChange={(event) => setAddSeniorForm((form) => ({ ...form, name: event.target.value }))}
                                    placeholder="예: 김우리"
                                />
                            </label>

                            <label>
                                전화번호
                                <input
                                    type="tel"
                                    value={addSeniorForm.phone}
                                    onChange={(event) =>
                                        setAddSeniorForm((form) => ({
                                            ...form,
                                            phone: formatPhoneNumber(event.target.value),
                                        }))
                                    }
                                    placeholder="예: 010-1234-5678"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            handleAddSenior();
                                        }
                                    }}
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

            {infoRequestTarget && (
                <div className="wd-modal-backdrop" onClick={() => setInfoRequestTarget(null)}>
                    <section className="wd-info-request-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="wd-info-request-header">
                            <h2>정보 입력 요청</h2>

                            <button
                                type="button"
                                className="wd-info-request-close"
                                onClick={() => setInfoRequestTarget(null)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="wd-info-request-fields">
                            <span>미입력 항목</span>
                            <strong>{getMissingSeniorInfoFields(infoRequestTarget).join(", ")}</strong>
                        </div>

                        <div className="wd-info-request-options">
                            <label className="wd-info-request-option">
                                <input
                                    type="checkbox"
                                    checked={infoRequestTargets.toSenior}
                                    onChange={(event) =>
                                        setInfoRequestTargets((prev) => ({
                                            ...prev,
                                            toSenior: event.target.checked,
                                        }))
                                    }
                                />
                                <span>사용자에게 요청</span>
                            </label>

                            <label className="wd-info-request-option">
                                <input
                                    type="checkbox"
                                    checked={infoRequestTargets.toGuardian}
                                    disabled={!infoRequestTarget?.hasGuardian}
                                    onChange={(event) =>
                                        setInfoRequestTargets((prev) => ({
                                            ...prev,
                                            toGuardian: event.target.checked,
                                        }))
                                    }
                                />
                                <span>
                                    {infoRequestTarget?.hasGuardian
                                        ? "보호자에게 요청"
                                        : "보호자에게 요청 (연결된 보호자 없음)"}
                                </span>
                            </label>
                        </div>

                        <div className="wd-info-request-actions">
                            <button
                                type="button"
                                className="wd-info-request-cancel"
                                onClick={() => setInfoRequestTarget(null)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="wd-info-request-submit"
                                onClick={handleSendInfoRequest}
                            >
                                요청 보내기
                            </button>
                        </div>
                    </section>
                </div>
            )}

        </div>
    );
}

export default WelfareDashboard;
