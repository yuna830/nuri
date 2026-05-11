import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BriefcaseBusiness, Search, UserPlus, X } from "lucide-react";
import { WELFARE_DEMO_SENIORS } from "../../data/welfareSeniorDemoData";

const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";
const WELFARE_DECISION_STORAGE_KEY = "welfareDecisions";
const WELFARE_DECISION_DETAIL_STORAGE_KEY = "welfareDecisionDetails";
const ADDED_SENIORS_STORAGE_KEY = "welfareAddedSeniors";
const LAST_ACCESS_ALERT_HOURS = 4;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

const FILTER_GROUPS = [
    { key : "healthStatus", label : "건강 상태", options : ["양호", "주의", "위험"] },
    { key : "locationStatus", label : "위치 상태", options : ["정상", "안전구역 이탈"] },
    { key : "alertStatus", label : "알림 상태", options : ["없음", "SOS 요청", "일자리 요청"] },
    { key : "workRequestStatus", label : "근로 요청 상태", options : ["검토", "미검토"] },
    { key : "jobRequestGroup", label : "일자리 요청", options : ["요청 있음", "미요청"] },
    { key : "jobMatchingStatus", label : "판단 단계", options : ["적합", "검토중", "보류", "부적합"] },
];

const ADD_SENIOR_INITIAL_FORM = {
    name : "",
    age : "",
    gender : "여성",
    region : "",
    healthStatus : "양호",
    locationStatus : "정상",
    alertStatus : "없음",
    workRequestStatus : "미검토",
    jobRequestCount : "0",
    safeZonePlaceName : "",
    safeZoneRadius : "500",
};

const createEmptyFilters = () =>
    FILTER_GROUPS.reduce((filters, group) => ({
        ...filters,
        [group.key] : [],
    }), {});

const readJsonStorage = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

const getSavedWelfareDecisions = () => readJsonStorage(WELFARE_DECISION_STORAGE_KEY, {});
const getSavedWelfareDecisionDetails = () => readJsonStorage(WELFARE_DECISION_DETAIL_STORAGE_KEY, {});
const getSavedAddedSeniors = () => readJsonStorage(ADDED_SENIORS_STORAGE_KEY, []);

const getJobRequestGroup = (senior) =>
    Number(senior.jobRequestCount || 0) > 0 || senior.alertStatus === "일자리 요청"
        ? "요청 있음"
        : "미요청";

const getJobRequestStatus = (count) =>
    Number(count || 0) > 0 ? `요청 ${Number(count)}건` : "미요청";

const normalizeAlertStatus = (status) => {
    return ["없음", "SOS 요청", "일자리 요청"].includes(status) ? status : "없음";
};

const normalizeSenior = (senior) => {
    const jobRequestCount = Number(senior.jobRequestCount ?? (senior.jobStatus === "미추천" ? 0 : 1));
    const welfareDecision = senior.welfareDecision || "미검토";

    return {
        ...senior,
        alertStatus : normalizeAlertStatus(senior.alertStatus),
        workRequestStatus : senior.workRequestStatus || (welfareDecision === "미검토" ? "미검토" : "검토"),
        jobRequestCount,
        jobRequestStatus : senior.jobRequestStatus || getJobRequestStatus(jobRequestCount),
        jobMatchingStatus : senior.jobMatchingStatus || (welfareDecision === "미검토" ? "검토중" : welfareDecision),
        welfareDecision,
        welfareDecisionReason : senior.welfareDecisionReason || "",
        safeZone : senior.safeZone || {
            placeName : `${senior.name || "대상자"} 자택`,
            radiusMeter : 500,
        },
        lastGps : senior.lastGps || {
            address : senior.region || "위치 미확인",
            latitude : 37.5665,
            longitude : 126.978,
            recordedAt : "기록 없음",
        },
    };
};

const applySavedWelfareDecisions = (seniors) => {
    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();

    return seniors.map((senior) => {
        const savedDetail = savedDecisionDetails[senior.id];
        const savedDecision = savedDetail?.decision || savedDecisions[senior.id];

        return normalizeSenior({
            ...senior,
            welfareDecision : savedDecision || senior.welfareDecision,
            jobMatchingStatus : savedDecision || senior.jobMatchingStatus,
            welfareDecisionReason : savedDetail?.reason ?? senior.welfareDecisionReason,
        });
    });
};

const getLastAccessHours = (lastAccess) => {
    if (!lastAccess) {
        return null;
    }

    const hourMatch = String(lastAccess).match(/(\d+)\s*시간/);

    if (hourMatch) {
        return Number(hourMatch[1]);
    }

    const minuteMatch = String(lastAccess).match(/(\d+)\s*분/);

    if (minuteMatch) {
        return Number(minuteMatch[1]) / 60;
    }

    return null;
};

const isNightTime = () => {
    const currentHour = new Date().getHours();

    return currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR;
};

const shouldHideLastAccess = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);

    return lastAccessHours != null && lastAccessHours <= LAST_ACCESS_ALERT_HOURS;
};

const shouldNotifyLastAccessDelay = (lastAccess) => {
    const lastAccessHours = getLastAccessHours(lastAccess);

    return !isNightTime() && lastAccessHours != null && lastAccessHours > LAST_ACCESS_ALERT_HOURS;
};

function WelfareDashboard(){
    const navigate = useNavigate();
    const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
    const [seniors, setSeniors] = useState([]);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
    const [seniorLoadError, setSeniorLoadError] = useState("");
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");
    const [filters, setFilters] = useState(createEmptyFilters);
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addSeniorForm, setAddSeniorForm] = useState(ADD_SENIOR_INITIAL_FORM);
    const [addSeniorError, setAddSeniorError] = useState("");
    const itemPerPage = 10;

    useEffect(() => {
        let ignore = false;

        const loadSeniors = async () => {
            try {
                setIsLoadingSeniors(true);
                setSeniorLoadError("");

                const response = await fetch(WELFARE_SENIOR_API_URL);

                if (!response.ok) {
                    throw new Error("Failed to load seniors");
                }

                const data = await response.json();
                const baseSeniors = data.length > 0 ? data : WELFARE_DEMO_SENIORS;

                if (!ignore) {
                    setSeniors(applySavedWelfareDecisions([...baseSeniors, ...getSavedAddedSeniors()]));
                }
            } catch {
                if (!ignore) {
                    setSeniorLoadError("");
                    setSeniors(applySavedWelfareDecisions([...WELFARE_DEMO_SENIORS, ...getSavedAddedSeniors()]));
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

    const getSeniorFilterValue = (senior, filterKey) => {
        if (filterKey === "jobRequestGroup") {
            return getJobRequestGroup(senior);
        }

        return senior[filterKey];
    };

    const isFilterMatched = (filterKey, selectedValues, senior) =>
        selectedValues.length === 0 || selectedValues.includes(getSeniorFilterValue(senior, filterKey));

    const filteredSeniors = seniors.filter((senior) => {
        const isMatchedByFilters = FILTER_GROUPS.every((group) =>
            isFilterMatched(group.key, filters[group.key], senior)
        );
        const normalizedKeyword = searchKeyword.trim().toLowerCase();
        const searchableValues = [
            senior.id,
            `ID ${String(senior.id).padStart(4, "0")}`,
            senior.name,
            senior.age,
            senior.gender,
            senior.region,
            senior.healthStatus,
            senior.lastAccess,
            senior.locationStatus,
            senior.alertStatus,
            senior.workRequestStatus,
            senior.jobRequestStatus,
            senior.jobMatchingStatus,
            senior.welfareDecision,
        ];
        const matchKeyword =
            normalizedKeyword === "" ||
            searchableValues.some((value) =>
                String(value ?? "").toLowerCase().includes(normalizedKeyword)
            );

        return isMatchedByFilters && matchKeyword;
    });

    const totalPages = Math.max(1, Math.ceil(filteredSeniors.length / itemPerPage));
    const startIndex = (currentPage - 1) * itemPerPage;
    const currentSeniors = [...filteredSeniors]
        .sort((a, b) => getPriorityRank(a) - getPriorityRank(b) || a.id - b.id)
        .slice(startIndex, startIndex + itemPerPage);

    function getPriorityRank(senior) {
        if (senior.alertStatus === "SOS 요청") {
            return 1;
        }

        if (senior.locationStatus === "안전구역 이탈") {
            return 2;
        }

        if (senior.healthStatus === "위험") {
            return 3;
        }

        if (senior.alertStatus === "일자리 요청") {
            return 4;
        }

        if (senior.workRequestStatus === "미검토") {
            return 5;
        }

        if (senior.healthStatus === "주의") {
            return 6;
        }

        return 7;
    }

    const activeFilterGroup =
        FILTER_GROUPS.find((group) => group.key === activeFilterKey) || FILTER_GROUPS[0];

    const toggleDraftFilter = (filterKey, option) => {
        setDraftFilters((previousFilters) => {
            const selectedValues = previousFilters[filterKey];
            const nextValues = selectedValues.includes(option)
                ? selectedValues.filter((value) => value !== option)
                : [...selectedValues, option];

            return {
                ...previousFilters,
                [filterKey] : nextValues,
            };
        });
    };

    const getFilterOptionCount = (filterKey, option) =>
        seniors.filter((senior) => getSeniorFilterValue(senior, filterKey) === option).length;

    const cloneFilters = (targetFilters) =>
        FILTER_GROUPS.reduce((nextFilters, group) => ({
            ...nextFilters,
            [group.key] : [...targetFilters[group.key]],
        }), {});

    const applyFilters = () => {
        setFilters(cloneFilters(draftFilters));
        setSearchKeyword(draftSearchKeyword.trim());
        setCurrentPage(1);
    };

    const summaryCounts = {
        total : seniors.length,
        sos : seniors.filter((senior) => senior.alertStatus === "SOS 요청").length,
        jobRequest : seniors.reduce((totalCount, senior) => (
            totalCount + Number(senior.jobRequestCount || 0)
        ), 0),
        unreviewed : seniors.filter((senior) => senior.workRequestStatus === "미검토").length,
    };

    const welfareNotifications = seniors.flatMap((senior) => {
        const notifications = [];

        if (senior.alertStatus === "SOS 요청") {
            notifications.push({
                id : `${senior.id}-sos`,
                seniorId : senior.id,
                title : "SOS 요청",
                message : `${senior.name} 대상자의 마지막 GPS 위치 확인이 필요합니다.`,
            });
        }

        if (senior.alertStatus === "일자리 요청") {
            notifications.push({
                id : `${senior.id}-job-request`,
                seniorId : senior.id,
                title : "일자리 요청",
                message : `${senior.name} 대상자가 ${senior.jobRequestStatus}을 보냈습니다.`,
            });
        }

        if (senior.locationStatus === "안전구역 이탈") {
            notifications.push({
                id : `${senior.id}-location`,
                seniorId : senior.id,
                title : "위치 상태 확인",
                message : `${senior.name} 대상자가 안전구역을 이탈했습니다.`,
            });
        }

        if (senior.healthStatus === "위험") {
            notifications.push({
                id : `${senior.id}-health`,
                seniorId : senior.id,
                title : "건강 상태 위험",
                message : `${senior.name} 대상자의 건강 상태가 위험입니다.`,
            });
        }

        if (shouldNotifyLastAccessDelay(senior.lastAccess)) {
            notifications.push({
                id : `${senior.id}-last-access`,
                seniorId : senior.id,
                title : "접속 확인 필요",
                message : `${senior.name} 대상자가 4시간 넘게 접속하지 않았습니다.`,
            });
        }

        return notifications;
    });

    const visibleNotifications = welfareNotifications.slice(0, 6);

    const formatAgeGender = (senior) => {
        const ageText = senior.age == null ? "나이 미입력" : `${senior.age}세`;
        const genderText = senior.gender || "성별 미입력";

        return `${ageText} / ${genderText}`;
    };

    const formatSeniorId = (seniorId) => `ID ${String(seniorId).padStart(4, "0")}`;

    const handleLogout = () => {
        sessionStorage.removeItem("currentWelfareWorker");
        navigate("/welfare-login");
    };

    const setAddFormValue = (key, value) => {
        setAddSeniorForm((previousForm) => ({
            ...previousForm,
            [key] : value,
        }));
    };

    const openAddModal = () => {
        setAddSeniorForm(ADD_SENIOR_INITIAL_FORM);
        setAddSeniorError("");
        setIsAddModalOpen(true);
    };

    const handleAddSenior = () => {
        const name = addSeniorForm.name.trim();
        const region = addSeniorForm.region.trim();
        const age = Number(addSeniorForm.age);
        const jobRequestCount = Number(addSeniorForm.jobRequestCount);
        const safeZoneRadius = Number(addSeniorForm.safeZoneRadius);

        if (!name) {
            setAddSeniorError("대상자 이름을 입력해주세요.");
            return;
        }

        if (!Number.isFinite(age) || age <= 0) {
            setAddSeniorError("나이를 숫자로 입력해주세요.");
            return;
        }

        if (!region) {
            setAddSeniorError("거주 지역을 입력해주세요.");
            return;
        }

        if (!Number.isFinite(safeZoneRadius) || safeZoneRadius <= 0) {
            setAddSeniorError("안심구역 반경을 숫자로 입력해주세요.");
            return;
        }

        const nextId = Math.max(0, ...seniors.map((senior) => Number(senior.id) || 0)) + 1;
        const normalizedAlertStatus =
            jobRequestCount > 0 && addSeniorForm.alertStatus === "없음"
                ? "일자리 요청"
                : addSeniorForm.alertStatus;
        const newSenior = normalizeSenior({
            id : nextId,
            name,
            age,
            gender : addSeniorForm.gender,
            region,
            healthStatus : addSeniorForm.healthStatus,
            lastAccess : "방금 전",
            locationStatus : addSeniorForm.locationStatus,
            alertStatus : normalizedAlertStatus,
            workRequestStatus : addSeniorForm.workRequestStatus,
            jobRequestCount,
            jobRequestStatus : getJobRequestStatus(jobRequestCount),
            jobMatchingStatus : "검토중",
            welfareDecision : "미검토",
            welfareDecisionReason : "",
            preferredWorkTime : "하루 3시간",
            safeZone : {
                placeName : addSeniorForm.safeZonePlaceName.trim() || `${name} 자택`,
                radiusMeter : safeZoneRadius,
            },
            lastGps : {
                address : region,
                latitude : 37.5665,
                longitude : 126.978,
                recordedAt : "방금 전",
            },
        });
        const savedAddedSeniors = getSavedAddedSeniors();

        localStorage.setItem(
            ADDED_SENIORS_STORAGE_KEY,
            JSON.stringify([newSenior, ...savedAddedSeniors])
        );
        setSeniors((previousSeniors) => [...previousSeniors, newSenior]);
        setIsAddModalOpen(false);
        setCurrentPage(1);
    };

    const getBadgeStyle = (type, value) => {
        const badgeColors = {
            health : {
                "양호" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "주의" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "위험" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
            alert : {
                "없음" : { backgroundColor : "#eeeeee", color : "#555" },
                "SOS 요청" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
                "일자리 요청" : { backgroundColor : "#dff3ff", color : "#176b92" },
            },
            workRequest : {
                "검토" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "미검토" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
            },
            jobRequest : {
                "미요청" : { backgroundColor : "#eeeeee", color : "#555" },
                "요청 있음" : { backgroundColor : "#dff3ff", color : "#176b92" },
            },
            matching : {
                "미검토" : { backgroundColor : "#eeeeee", color : "#555" },
                "검토중" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "적합" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "보류" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "부적합" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
        };

        return {
            ...styles.badge,
            ...(badgeColors[type]?.[value] || {
                backgroundColor : "#eeeeee",
                color : "#555",
            }),
        };
    };

    return (
        <div style = {styles.page}>
            <header style = {styles.topHeader}>
                <div style = {styles.brandArea}>
                    <div style = {styles.logoBox}>우리</div>
                    <strong style = {styles.serviceName}>우리</strong>
                    <span style = {styles.headerPageName}>복지사 대상자 관리</span>
                </div>

                {currentWorker && (
                    <div style = {styles.workerArea}>
                        <span style = {styles.workerName}>
                            {currentWorker.name} 복지사
                        </span>
                        {currentWorker.workerId && (
                            <span style = {styles.workerIdText}>{currentWorker.workerId}</span>
                        )}
                        <div style = {styles.notificationWrap}>
                            <button
                                type = "button"
                                style = {styles.notificationButton}
                                onClick = {() => setIsNotificationOpen((previousValue) => !previousValue)}
                                aria-label = "알림"
                            >
                                <Bell size = {17} />
                                {welfareNotifications.length > 0 && (
                                    <span style = {styles.notificationBadge}>
                                        {welfareNotifications.length}
                                    </span>
                                )}
                            </button>

                            {isNotificationOpen && (
                                <div style = {styles.notificationPanel}>
                                    <div style = {styles.notificationHeader}>
                                        <h2 style = {styles.notificationTitle}>알림</h2>
                                        <span style = {styles.notificationCountText}>
                                            {welfareNotifications.length}건
                                        </span>
                                    </div>

                                    {visibleNotifications.length === 0 ? (
                                        <p style = {styles.emptyNotification}>새 알림이 없습니다.</p>
                                    ) : (
                                        <div style = {styles.notificationList}>
                                            {visibleNotifications.map((notification) => (
                                                <button
                                                    type = "button"
                                                    key = {notification.id}
                                                    style = {styles.notificationItem}
                                                    onClick = {() => {
                                                        setIsNotificationOpen(false);
                                                        navigate(`/welfare/seniors/${notification.seniorId}`);
                                                    }}
                                                >
                                                    <strong style = {styles.notificationItemTitle}>
                                                        {notification.title}
                                                    </strong>
                                                    <span style = {styles.notificationItemMessage}>
                                                        {notification.message}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button
                            type = "button"
                            style = {styles.logoutButton}
                            onClick = {handleLogout}
                        >
                            로그아웃
                        </button>
                    </div>
                )}
            </header>

            <main style = {styles.content}>
                <div style = {styles.actionHeader}>
                    <div>
                        <h1 style = {styles.pageTitle}>대상자 목록</h1>
                        <p style = {styles.pageDescription}>SOS와 일자리 요청을 기준으로 확인할 대상을 정리합니다.</p>
                    </div>
                    <div style = {styles.headerButtonGroup}>
                        <Link to = "/welfare/jobs" style = {styles.jobShortcutButton}>
                            <BriefcaseBusiness size = {16} />
                            일자리 공고 보기
                        </Link>
                        <button
                            type = "button"
                            style = {styles.addSeniorButton}
                            onClick = {openAddModal}
                        >
                            <UserPlus size = {17} />
                            대상자 추가
                        </button>
                    </div>
                </div>

                <div style = {styles.summaryGrid}>
                    <div style = {styles.summaryBox}>
                        <p style = {styles.summaryLabel}>전체 대상자</p>
                        <p style = {styles.summaryValue}>{summaryCounts.total}명</p>
                    </div>
                    <div style = {styles.summaryBox}>
                        <p style = {styles.summaryLabel}>SOS 요청</p>
                        <p style = {styles.summaryValue}>{summaryCounts.sos}건</p>
                    </div>
                    <div style = {styles.summaryBox}>
                        <p style = {styles.summaryLabel}>일자리 요청</p>
                        <p style = {styles.summaryValue}>{summaryCounts.jobRequest}건</p>
                    </div>
                    <div style = {styles.summaryBox}>
                        <p style = {styles.summaryLabel}>근로 요청 미검토</p>
                        <p style = {styles.summaryValue}>{summaryCounts.unreviewed}명</p>
                    </div>
                </div>

                <section style = {styles.filterArea}>
                    <div style = {styles.filterBox}>
                        <div style = {styles.filterTabs}>
                            {FILTER_GROUPS.map((group) => {
                                const isActive = activeFilterKey === group.key;
                                const selectedCount = draftFilters[group.key].length;

                                return (
                                    <button
                                        type = "button"
                                        key = {group.key}
                                        style = {{
                                            ...styles.filterTab,
                                            ...(isActive ? styles.activeFilterTab : {}),
                                        }}
                                        onClick = {() => setActiveFilterKey(group.key)}
                                    >
                                        <span>{group.label}</span>
                                        {selectedCount > 0 && (
                                            <span
                                                style = {{
                                                    ...styles.filterCount,
                                                    ...(isActive ? styles.activeFilterCount : {}),
                                                }}
                                            >
                                                {selectedCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div style = {styles.checkboxPanel}>
                            <div style = {styles.checkboxPanelHeader}>
                                <strong style = {styles.checkboxPanelTitle}>{activeFilterGroup.label}</strong>
                                <span style = {styles.checkboxPanelHint}>선택하지 않으면 전체가 표시됩니다.</span>
                            </div>

                            <div style = {styles.checkboxGrid}>
                                {activeFilterGroup.options.map((option) => (
                                    <label
                                        key = {option}
                                        style = {styles.checkboxLabel}
                                    >
                                        <input
                                            type = "checkbox"
                                            checked = {draftFilters[activeFilterGroup.key].includes(option)}
                                            onChange = {() => toggleDraftFilter(activeFilterGroup.key, option)}
                                            style = {styles.checkboxInput}
                                        />
                                        <span>{option}</span>
                                        <span style = {styles.checkboxCount}>
                                            ({getFilterOptionCount(activeFilterGroup.key, option)})
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style = {styles.searchRow}>
                        <label
                            htmlFor = "senior-keyword-search"
                            style = {styles.keywordLabel}
                        >
                            검색어
                        </label>
                        <input
                            id = "senior-keyword-search"
                            type = "search"
                            value = {draftSearchKeyword}
                            placeholder = "이름, 거주 지역, 요청 상태 검색"
                            style = {styles.keywordInput}
                            onChange = {(event) => setDraftSearchKeyword(event.target.value)}
                            onKeyDown = {(event) => {
                                if (event.key === "Enter") {
                                    applyFilters();
                                }
                            }}
                        />
                        <button
                            type = "button"
                            style = {styles.searchButton}
                            onClick = {applyFilters}
                        >
                            <Search size = {15} />
                            검색
                        </button>
                    </div>
                </section>

                {isLoadingSeniors && (
                    <p style = {styles.dataMessage}>대상자 데이터를 불러오는 중입니다.</p>
                )}

                {seniorLoadError && (
                    <p style = {{ ...styles.dataMessage, color : "#b66b6b" }}>
                        {seniorLoadError}
                    </p>
                )}

                <div style = {styles.tableBox}>
                    <table style = {styles.table}>
                        <thead>
                            <tr>
                                <th style = {styles.th}>ID</th>
                                <th style = {styles.th}>이름</th>
                                <th style = {styles.th}>나이/성별</th>
                                <th style = {styles.th}>거주 지역</th>
                                <th style = {styles.th}>건강 상태</th>
                                <th style = {styles.th}>위치 상태</th>
                                <th style = {styles.th}>알림 상태</th>
                                <th style = {styles.th}>근로 요청 상태</th>
                                <th style = {styles.th}>일자리 요청 상태</th>
                                <th style = {styles.th}>판단 단계</th>
                                <th style = {styles.th}>마지막 접속</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentSeniors.map((senior) => (
                                <tr key = {senior.id}>
                                    <td style = {styles.td}>{formatSeniorId(senior.id)}</td>
                                    <td style = {styles.td}>
                                        <Link
                                            to = {`/welfare/seniors/${senior.id}`}
                                            style = {styles.nameLink}
                                        >
                                            {senior.name}
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>{formatAgeGender(senior)}</td>
                                    <td style = {styles.td}>{senior.region}</td>
                                    <td style = {styles.td}>
                                        <span style = {getBadgeStyle("health", senior.healthStatus)}>
                                            {senior.healthStatus}
                                        </span>
                                    </td>
                                    <td style = {styles.td}>{senior.locationStatus}</td>
                                    <td style = {styles.td}>
                                        <span style = {getBadgeStyle("alert", senior.alertStatus)}>
                                            {senior.alertStatus}
                                        </span>
                                    </td>
                                    <td style = {styles.td}>
                                        <span style = {getBadgeStyle("workRequest", senior.workRequestStatus)}>
                                            {senior.workRequestStatus}
                                        </span>
                                    </td>
                                    <td style = {styles.td}>
                                        <span style = {getBadgeStyle("jobRequest", getJobRequestGroup(senior))}>
                                            {senior.jobRequestStatus}
                                        </span>
                                    </td>
                                    <td style = {styles.td}>
                                        <span style = {getBadgeStyle("matching", senior.jobMatchingStatus)}>
                                            {senior.jobMatchingStatus}
                                        </span>
                                    </td>
                                    <td style = {styles.td}>
                                        {shouldHideLastAccess(senior.lastAccess) ? "" : senior.lastAccess}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style = {styles.pager}>
                    <button
                        type = "button"
                        style = {styles.smallButton}
                        onClick = {() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled = {currentPage === 1}
                    >
                        이전
                    </button>

                    {Array.from({ length : totalPages }, (_, index) => index + 1).map((pageNumber) => (
                        <button
                            type = "button"
                            key = {pageNumber}
                            style = {{
                                ...styles.smallButton,
                                opacity : currentPage === pageNumber ? 0.6 : 1,
                            }}
                            onClick = {() => setCurrentPage(pageNumber)}
                            disabled = {currentPage === pageNumber}
                        >
                            {pageNumber}
                        </button>
                    ))}

                    <button
                        type = "button"
                        style = {styles.smallButton}
                        onClick = {() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled = {currentPage === totalPages}
                    >
                        다음
                    </button>
                </div>
            </main>

            {isAddModalOpen && (
                <div style = {styles.modalBackdrop}>
                    <div style = {styles.modalBox}>
                        <div style = {styles.modalHeader}>
                            <div>
                                <h2 style = {styles.modalTitle}>대상자 추가</h2>
                                <p style = {styles.modalSubText}>복지사가 관리할 대상자 기본 정보와 안심구역 기준을 등록합니다.</p>
                            </div>
                            <button
                                type = "button"
                                style = {styles.iconButton}
                                onClick = {() => setIsAddModalOpen(false)}
                                aria-label = "닫기"
                            >
                                <X size = {18} />
                            </button>
                        </div>

                        {addSeniorError && <p style = {styles.formError}>{addSeniorError}</p>}

                        <div style = {styles.formGrid}>
                            <label style = {styles.formLabel}>
                                이름
                                <input
                                    style = {styles.formInput}
                                    value = {addSeniorForm.name}
                                    onChange = {(event) => setAddFormValue("name", event.target.value)}
                                    placeholder = "대상자 이름"
                                />
                            </label>
                            <label style = {styles.formLabel}>
                                나이
                                <input
                                    style = {styles.formInput}
                                    type = "number"
                                    min = "1"
                                    value = {addSeniorForm.age}
                                    onChange = {(event) => setAddFormValue("age", event.target.value)}
                                    placeholder = "나이"
                                />
                            </label>
                            <label style = {styles.formLabel}>
                                성별
                                <select
                                    style = {styles.formInput}
                                    value = {addSeniorForm.gender}
                                    onChange = {(event) => setAddFormValue("gender", event.target.value)}
                                >
                                    <option value = "여성">여성</option>
                                    <option value = "남성">남성</option>
                                </select>
                            </label>
                            <label style = {styles.formLabel}>
                                거주 지역
                                <input
                                    style = {styles.formInput}
                                    value = {addSeniorForm.region}
                                    onChange = {(event) => setAddFormValue("region", event.target.value)}
                                    placeholder = "서울시 동작구 상도동"
                                />
                            </label>
                            <label style = {styles.formLabel}>
                                건강 상태
                                <select
                                    style = {styles.formInput}
                                    value = {addSeniorForm.healthStatus}
                                    onChange = {(event) => setAddFormValue("healthStatus", event.target.value)}
                                >
                                    <option value = "양호">양호</option>
                                    <option value = "주의">주의</option>
                                    <option value = "위험">위험</option>
                                </select>
                            </label>
                            <label style = {styles.formLabel}>
                                위치 상태
                                <select
                                    style = {styles.formInput}
                                    value = {addSeniorForm.locationStatus}
                                    onChange = {(event) => setAddFormValue("locationStatus", event.target.value)}
                                >
                                    <option value = "정상">정상</option>
                                    <option value = "안전구역 이탈">안전구역 이탈</option>
                                </select>
                            </label>
                            <label style = {styles.formLabel}>
                                알림 상태
                                <select
                                    style = {styles.formInput}
                                    value = {addSeniorForm.alertStatus}
                                    onChange = {(event) => setAddFormValue("alertStatus", event.target.value)}
                                >
                                    <option value = "없음">없음</option>
                                    <option value = "SOS 요청">SOS 요청</option>
                                    <option value = "일자리 요청">일자리 요청</option>
                                </select>
                            </label>
                            <label style = {styles.formLabel}>
                                근로 요청 상태
                                <select
                                    style = {styles.formInput}
                                    value = {addSeniorForm.workRequestStatus}
                                    onChange = {(event) => setAddFormValue("workRequestStatus", event.target.value)}
                                >
                                    <option value = "미검토">미검토</option>
                                    <option value = "검토">검토</option>
                                </select>
                            </label>
                            <label style = {styles.formLabel}>
                                일자리 요청 건수
                                <input
                                    style = {styles.formInput}
                                    type = "number"
                                    min = "0"
                                    value = {addSeniorForm.jobRequestCount}
                                    onChange = {(event) => setAddFormValue("jobRequestCount", event.target.value)}
                                />
                            </label>
                            <label style = {styles.formLabel}>
                                안심구역 장소명
                                <input
                                    style = {styles.formInput}
                                    value = {addSeniorForm.safeZonePlaceName}
                                    onChange = {(event) => setAddFormValue("safeZonePlaceName", event.target.value)}
                                    placeholder = "자택"
                                />
                            </label>
                            <label style = {styles.formLabel}>
                                안심구역 반경(m)
                                <input
                                    style = {styles.formInput}
                                    type = "number"
                                    min = "1"
                                    value = {addSeniorForm.safeZoneRadius}
                                    onChange = {(event) => setAddFormValue("safeZoneRadius", event.target.value)}
                                />
                            </label>
                        </div>

                        <div style = {styles.modalActionRow}>
                            <button
                                type = "button"
                                style = {styles.secondaryButton}
                                onClick = {() => setIsAddModalOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                type = "button"
                                style = {styles.primaryButton}
                                onClick = {handleAddSenior}
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page : {
        minHeight : "100vh",
        backgroundColor : "var(--bg-color)",
        color : "var(--text-color)",
        boxSizing : "border-box",
    },
    topHeader : {
        height : "64px",
        padding : "0 max(28px, calc((100% - 1280px) / 2 + 28px))",
        borderBottom : "1px solid var(--border-color)",
        backgroundColor : "white",
        display : "flex",
        alignItems : "center",
        justifyContent : "space-between",
        boxSizing : "border-box",
    },
    brandArea : {
        display : "flex",
        alignItems : "center",
        gap : "12px",
        minWidth : 0,
    },
    logoBox : {
        width : "34px",
        height : "34px",
        borderRadius : "7px",
        backgroundColor : "var(--main-color)",
        color : "white",
        display : "grid",
        placeItems : "center",
        fontSize : "15px",
        fontWeight : "800",
        lineHeight : "1",
        flexShrink : 0,
    },
    serviceName : {
        fontSize : "22px",
        fontWeight : "800",
        color : "var(--text-color)",
    },
    headerPageName : {
        paddingLeft : "16px",
        borderLeft : "1px solid var(--border-color)",
        color : "#4B5563",
        fontSize : "15px",
        whiteSpace : "nowrap",
    },
    workerArea : {
        display : "flex",
        alignItems : "center",
        gap : "10px",
        position : "relative",
    },
    workerName : {
        color : "#4B5563",
        fontSize : "14px",
        fontWeight : "700",
        whiteSpace : "nowrap",
    },
    workerIdText : {
        color : "#777",
        fontSize : "12px",
        fontWeight : "700",
        whiteSpace : "nowrap",
    },
    logoutButton : {
        height : "34px",
        padding : "0 12px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        fontSize : "13px",
        fontWeight : "700",
        cursor : "pointer",
    },
    notificationWrap : {
        position : "relative",
    },
    notificationButton : {
        position : "relative",
        width : "36px",
        height : "34px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        display : "grid",
        placeItems : "center",
        cursor : "pointer",
    },
    notificationBadge : {
        position : "absolute",
        top : "-7px",
        right : "-7px",
        minWidth : "18px",
        height : "18px",
        padding : "0 5px",
        borderRadius : "999px",
        backgroundColor : "#b66b6b",
        color : "white",
        fontSize : "11px",
        fontWeight : "800",
        lineHeight : "18px",
        textAlign : "center",
    },
    notificationPanel : {
        position : "absolute",
        top : "42px",
        right : 0,
        width : "320px",
        maxHeight : "360px",
        overflowY : "auto",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        boxShadow : "0 10px 28px rgba(0, 0, 0, 0.14)",
        padding : "14px",
        zIndex : 30,
    },
    notificationHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "center",
        gap : "10px",
        marginBottom : "10px",
    },
    notificationTitle : {
        margin : 0,
        fontSize : "15px",
        fontWeight : "800",
    },
    notificationCountText : {
        color : "#666",
        fontSize : "12px",
        whiteSpace : "nowrap",
    },
    notificationList : {
        display : "flex",
        flexDirection : "column",
        gap : "8px",
    },
    notificationItem : {
        width : "100%",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "#fffef7",
        padding : "10px",
        textAlign : "left",
        cursor : "pointer",
    },
    notificationItemTitle : {
        display : "block",
        marginBottom : "4px",
        color : "var(--text-color)",
        fontSize : "13px",
        fontWeight : "800",
    },
    notificationItemMessage : {
        color : "#666",
        fontSize : "12px",
        lineHeight : "1.5",
    },
    emptyNotification : {
        margin : 0,
        padding : "18px 0",
        color : "#666",
        fontSize : "13px",
        textAlign : "center",
    },
    content : {
        width : "100%",
        maxWidth : "1280px",
        margin : "0 auto",
        padding : "28px",
        boxSizing : "border-box",
    },
    actionHeader : {
        display : "flex",
        alignItems : "center",
        justifyContent : "space-between",
        gap : "14px",
        marginBottom : "16px",
        flexWrap : "wrap",
    },
    pageTitle : {
        margin : 0,
        fontSize : "28px",
        fontWeight : "800",
    },
    pageDescription : {
        margin : "6px 0 0",
        color : "#666",
        fontSize : "15px",
    },
    addSeniorButton : {
        height : "40px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        gap : "7px",
        fontSize : "14px",
        fontWeight : "800",
        cursor : "pointer",
        whiteSpace : "nowrap",
    },
    headerButtonGroup : {
        display : "flex",
        alignItems : "center",
        justifyContent : "flex-end",
        gap : "8px",
        flexWrap : "wrap",
    },
    summaryGrid : {
        display : "grid",
        gridTemplateColumns : "repeat(4, minmax(0, 1fr))",
        gap : "12px",
        marginBottom : "16px",
    },
    summaryBox : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
    },
    summaryLabel : {
        margin : 0,
        fontSize : "13px",
        color : "#666",
    },
    summaryValue : {
        margin : "6px 0 0",
        fontSize : "24px",
        fontWeight : "800",
    },
    filterArea : {
        marginBottom : "16px",
    },
    filterBox : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "16px",
        marginBottom : "14px",
    },
    filterTabs : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px",
        marginBottom : "14px",
    },
    filterTab : {
        minHeight : "40px",
        padding : "0 12px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        color : "var(--text-color)",
        fontSize : "14px",
        fontWeight : "700",
        cursor : "pointer",
        display : "flex",
        alignItems : "center",
        justifyContent : "center",
        gap : "6px",
        whiteSpace : "nowrap",
    },
    activeFilterTab : {
        backgroundColor : "var(--main-color)",
        color : "white",
        borderColor : "var(--main-color)",
    },
    filterCount : {
        minWidth : "18px",
        height : "18px",
        padding : "0 6px",
        borderRadius : "999px",
        backgroundColor : "#edf3ee",
        color : "var(--main-color)",
        fontSize : "12px",
        lineHeight : "18px",
        textAlign : "center",
    },
    activeFilterCount : {
        backgroundColor : "rgba(255, 255, 255, 0.24)",
        color : "white",
    },
    checkboxPanel : {
        padding : "2px 0 0",
        marginBottom : "14px",
    },
    checkboxPanelHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "center",
        gap : "12px",
        marginBottom : "12px",
    },
    checkboxPanelTitle : {
        fontSize : "15px",
        fontWeight : "800",
    },
    checkboxPanelHint : {
        fontSize : "12px",
        color : "#666",
    },
    checkboxGrid : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px 16px",
    },
    checkboxLabel : {
        display : "flex",
        alignItems : "center",
        gap : "7px",
        color : "var(--text-color)",
        fontSize : "14px",
        cursor : "pointer",
        minWidth : 0,
    },
    checkboxInput : {
        width : "18px",
        height : "18px",
        margin : 0,
        accentColor : "var(--main-color)",
        cursor : "pointer",
    },
    checkboxCount : {
        color : "#777",
        fontSize : "12px",
    },
    searchRow : {
        display : "flex",
        alignItems : "center",
        gap : "8px",
        flexWrap : "wrap",
    },
    keywordLabel : {
        display : "inline-flex",
        alignItems : "center",
        height : "40px",
        marginRight : "2px",
        fontSize : "13px",
        fontWeight : "800",
        whiteSpace : "nowrap",
    },
    keywordInput : {
        flex : "1 1 340px",
        height : "40px",
        boxSizing : "border-box",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "0 12px",
        fontSize : "14px",
        color : "var(--text-color)",
        backgroundColor : "white",
        outline : "none",
    },
    jobShortcutButton : {
        height : "40px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        gap : "7px",
        fontSize : "14px",
        fontWeight : "800",
        textDecoration : "none",
        whiteSpace : "nowrap",
    },
    searchButton : {
        height : "40px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        gap : "6px",
        cursor : "pointer",
    },
    resetButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        cursor : "pointer",
    },
    dataMessage : {
        margin : "0 0 12px",
        fontSize : "14px",
        color : "#666",
    },
    tableBox : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        overflowX : "auto",
    },
    table : {
        width : "100%",
        borderCollapse : "collapse",
        fontSize : "14px",
        minWidth : "1040px",
    },
    th : {
        textAlign : "center",
        backgroundColor : "#f7f5e8",
        padding : "12px 10px",
        borderBottom : "1px solid var(--border-color)",
        whiteSpace : "nowrap",
    },
    td : {
        textAlign : "center",
        padding : "11px 10px",
        borderBottom : "1px solid var(--border-color)",
        verticalAlign : "middle",
    },
    nameLink : {
        color : "var(--text-color)",
        fontWeight : "800",
        textDecoration : "none",
    },
    badge : {
        display : "inline-block",
        padding : "5px 9px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "800",
        whiteSpace : "nowrap",
    },
    pager : {
        display : "flex",
        flexWrap : "wrap",
        justifyContent : "center",
        gap : "6px",
        marginTop : "16px",
    },
    smallButton : {
        padding : "7px 10px",
        borderRadius : "8px",
        fontSize : "13px",
        border : "none",
        cursor : "pointer",
        color : "white",
        backgroundColor : "var(--main-color)",
    },
    modalBackdrop : {
        position : "fixed",
        inset : 0,
        backgroundColor : "rgba(0, 0, 0, 0.45)",
        display : "flex",
        justifyContent : "center",
        alignItems : "center",
        padding : "24px",
        zIndex : 100,
    },
    modalBox : {
        width : "min(760px, 100%)",
        maxHeight : "85vh",
        overflowY : "auto",
        backgroundColor : "var(--bg-color)",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px",
        boxShadow : "0 20px 40px rgba(0, 0, 0, 0.25)",
    },
    modalHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "flex-start",
        gap : "12px",
        marginBottom : "16px",
    },
    modalTitle : {
        margin : 0,
        fontSize : "24px",
    },
    modalSubText : {
        margin : "6px 0 0",
        color : "#666",
        lineHeight : "1.5",
    },
    iconButton : {
        width : "34px",
        height : "34px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "var(--text-color)",
        display : "grid",
        placeItems : "center",
        cursor : "pointer",
        flexShrink : 0,
    },
    formError : {
        margin : "0 0 12px",
        padding : "10px 12px",
        borderRadius : "8px",
        backgroundColor : "#ffe1e1",
        color : "#8a2f2f",
        fontSize : "14px",
        fontWeight : "700",
    },
    formGrid : {
        display : "grid",
        gridTemplateColumns : "repeat(2, minmax(0, 1fr))",
        gap : "12px",
    },
    formLabel : {
        display : "flex",
        flexDirection : "column",
        gap : "7px",
        color : "#555",
        fontSize : "13px",
        fontWeight : "800",
    },
    formInput : {
        width : "100%",
        height : "40px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        color : "var(--text-color)",
        padding : "0 12px",
        outline : "none",
    },
    modalActionRow : {
        display : "flex",
        justifyContent : "flex-end",
        gap : "8px",
        marginTop : "18px",
    },
    primaryButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        fontWeight : "800",
        cursor : "pointer",
    },
    secondaryButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        fontWeight : "800",
        cursor : "pointer",
    },
};

export default WelfareDashboard;
