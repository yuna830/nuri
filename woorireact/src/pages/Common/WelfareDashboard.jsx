import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BriefcaseBusiness, Search, UserPlus, UserRound, X } from "lucide-react";
import { WELFARE_DEMO_SENIORS } from "../../data/welfareSeniorDemoData";
import { WELFARE_SENIOR_API_URL, ADDED_SENIORS_STORAGE_KEY } from "../../utils/welfare/welfareConstants";
import { getSavedAddedSeniors } from "../../utils/welfare/welfareStorage";
import {
    getJobRequestGroup,
    getJobRequestStatus,
    normalizeSenior,
    applySavedWelfareDecisions,
    formatAgeGender,
    formatSeniorId,
} from "../../utils/welfare/welfareSenior";
import { shouldHideLastAccess, shouldNotifyLastAccessDelay } from "../../utils/welfare/welfareTime";
import WelfareHeader from "./WelfareHeader";
import "../../css/welfare/WelfareDashboard.css";

const FILTER_GROUPS = [
    { key : "healthStatus", label : "건강 상태", options : ["양호", "주의", "위험"] },
    { key : "locationStatus", label : "위치 상태", options : ["정상", "안전구역 이탈"] },
    { key : "alertStatus", label : "알림 상태", options : ["없음", "SOS 요청", "일자리 요청"] },
    { key : "regionDistrict", label : "거주 지역", options : [] },
    { key : "workRequestStatus", label : "확인여부", options : ["검토", "미검토"] },
];

const WORK_REQUEST_STATUS_STORAGE_KEY = "welfareWorkRequestStatus";
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "welfareDismissedNotifications";

const ADD_SENIOR_INITIAL_FORM = {
    name : "",
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

const getKeywordTokens = (keyword) =>
    keyword
        .toLowerCase()
        .split(/[\s,，]+/)
        .map((token) => token.trim())
        .filter(Boolean);

const formatPhoneNumber = (digits) => {
    if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    return digits;
};

const parseAddSeniorIdentity = (value) => {
    const tokens = value.trim().split(/[\s,，]+/).filter(Boolean);
    const nameParts = [];
    const phoneParts = [];

    tokens.forEach((token) => {
        const digits = token.replace(/\D/g, "");

        if (digits && /^[\d+\-().]+$/.test(token)) {
            phoneParts.push(digits);
            return;
        }

        nameParts.push(token);
    });

    const phoneDigits = phoneParts.join("");

    return {
        name : nameParts.join(" ").trim(),
        phone : phoneDigits.length >= 9 ? formatPhoneNumber(phoneDigits) : "",
        phoneDigits,
    };
};

const getSeniorPhoneDigits = (senior) => {
    const phone = senior.phone || `010-1000-${String(senior.id).padStart(4, "0")}`;

    return phone.replace(/\D/g, "");
};

const readSavedWorkRequestStatus = () => {
    try {
        return JSON.parse(localStorage.getItem(WORK_REQUEST_STATUS_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
};

const readDismissedNotifications = () => {
    try {
        const savedIds = JSON.parse(localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY) || "[]");

        return Array.isArray(savedIds) ? savedIds : [];
    } catch {
        return [];
    }
};

function WelfareDashboard(){
    const navigate = useNavigate();
    const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
    const [seniors, setSeniors] = useState([]);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
    const [seniorLoadError, setSeniorLoadError] = useState("");
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [dismissedNotifications, setDismissedNotifications] = useState(readDismissedNotifications);
    const notificationRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");
    const [filters, setFilters] = useState(createEmptyFilters);
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addSeniorForm, setAddSeniorForm] = useState(ADD_SENIOR_INITIAL_FORM);
    const [addSeniorError, setAddSeniorError] = useState("");
    const [addSeniorSearchMessage, setAddSeniorSearchMessage] = useState("");
    const itemPerPage = 10;
    const addSeniorIdentity = parseAddSeniorIdentity(addSeniorForm.name);
    const hasEnglishInAddSeniorIdentity = /[A-Za-z]/.test(addSeniorForm.name);
    const isAddSeniorIdentityComplete =
        Boolean(addSeniorIdentity.name && addSeniorIdentity.phone) && !hasEnglishInAddSeniorIdentity;
    const savedWorkRequestStatus = readSavedWorkRequestStatus();
    const matchedAddSenior = isAddSeniorIdentityComplete
        ? seniors.find((senior) =>
            senior.name === addSeniorIdentity.name &&
            getSeniorPhoneDigits(senior) === addSeniorIdentity.phoneDigits
        )
        : null;

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
                    setSeniorLoadError("서버 연결 실패 — 데모 데이터로 표시 중입니다.");
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

    useEffect(() => {
        if (!isNotificationOpen) {
            return;
        }

        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isNotificationOpen]);

    const getRegionDistrict = (region) => {
        const match = String(region || "").match(/[가-힣]+구/);
        return match ? match[0] : "기타";
    };

    const regionOptions = (() => {
        const allDistricts = [
            "강남구", "강동구", "강북구", "강서구", "관악구",
            "광진구", "구로구", "금천구", "노원구", "도봉구",
            "동대문구", "동작구", "마포구", "서대문구", "서초구",
            "성동구", "성북구", "송파구", "양천구", "영등포구",
            "용산구", "은평구", "종로구", "중구", "중랑구",
        ];
        return ["서울 전체", ...allDistricts];
    })();

    const getSeniorFilterValue = (senior, filterKey) => {
        if (filterKey === "jobRequestGroup") {
            return getJobRequestGroup(senior);
        }

        if (filterKey === "regionDistrict") {
            return getRegionDistrict(senior.region);
        }

        if (filterKey === "workRequestStatus") {
            return getSeniorReviewStatus(senior);
        }

        return senior[filterKey];
    };

    const getSeniorReviewStatus = (senior) =>
        savedWorkRequestStatus[senior.id] || senior.workRequestStatus || "미검토";

    const isFilterMatched = (filterKey, selectedValues, senior) => {
        if (selectedValues.length === 0 || selectedValues.includes("서울 전체")) {
            return true;
        }

        return selectedValues.includes(getSeniorFilterValue(senior, filterKey));
    };

    const filteredSeniors = seniors.filter((senior) => {
        const isMatchedByFilters = FILTER_GROUPS.every((group) =>
            isFilterMatched(group.key, filters[group.key], senior)
        );
        const keywordTokens = getKeywordTokens(searchKeyword);
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
            senior.locationStatus,
            senior.alertStatus,
            getSeniorReviewStatus(senior),
            senior.jobRequestStatus,
            senior.jobMatchingStatus,
            senior.welfareDecision,
        ];
        const searchableText = searchableValues
            .map((value) => String(value ?? "").toLowerCase())
            .join(" ");
        const matchKeyword =
            keywordTokens.length === 0 ||
            keywordTokens.every((token) => searchableText.includes(token));

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

        if (getSeniorReviewStatus(senior) === "미검토") {
            return 5;
        }

        if (senior.healthStatus === "주의") {
            return 6;
        }

        return 7;
    }

    const activeFilterGroup = (() => {
        const group = FILTER_GROUPS.find((g) => g.key === activeFilterKey) || FILTER_GROUPS[0];

        if (group.key === "regionDistrict") {
            return { ...group, options : regionOptions };
        }

        return group;
    })();

    const toggleDraftFilter = (filterKey, option) => {
        setDraftFilters((previousFilters) => {
            const selectedValues = previousFilters[filterKey];

            if (filterKey === "regionDistrict") {
                if (option === "서울 전체") {
                    const nextValues = selectedValues.includes("서울 전체") ? [] : ["서울 전체"];
                    return { ...previousFilters, [filterKey] : nextValues };
                }

                const withoutAll = selectedValues.filter((v) => v !== "서울 전체");
                const nextValues = withoutAll.includes(option)
                    ? withoutAll.filter((v) => v !== option)
                    : [...withoutAll, option];

                return { ...previousFilters, [filterKey] : nextValues };
            }

            const nextValues = selectedValues.includes(option)
                ? selectedValues.filter((value) => value !== option)
                : [...selectedValues, option];

            return {
                ...previousFilters,
                [filterKey] : nextValues,
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
            [group.key] : [...targetFilters[group.key]],
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

    const summaryCounts = {
        total : seniors.length,
        sos : seniors.filter((senior) => senior.alertStatus === "SOS 요청").length,
        jobRequest : seniors.reduce((totalCount, senior) => (
            totalCount + Number(senior.jobRequestCount || 0)
        ), 0),
        unreviewed : seniors.filter((senior) => getSeniorReviewStatus(senior) === "미검토").length,
    };

    const welfareNotifications = seniors.flatMap((senior) => {
        const notifications = [];

        if (senior.alertStatus === "SOS 요청") {
            notifications.push({
                id : `${senior.id}-sos`,
                seniorId : senior.id,
                title : "SOS 요청",
                message : `${senior.name} 대상자가 SOS 도움을 요청했습니다. 즉시 확인이 필요합니다.`,
                detailCategory : "안심구역 관리",
            });
        }

        if (senior.alertStatus === "일자리 요청") {
            if (getSeniorReviewStatus(senior) !== "검토") {
                notifications.push({
                    id : `${senior.id}-job-request`,
                    seniorId : senior.id,
                    title : "일자리 요청",
                    message : `${senior.name} 대상자가 ${senior.jobRequestStatus}을 보냈습니다.`,
                    detailCategory : "일자리 요청 상태",
                });
            }
        }

        if (senior.locationStatus === "안전구역 이탈") {
            notifications.push({
                id : `${senior.id}-location`,
                seniorId : senior.id,
                title : "위치 상태 확인",
                message : `${senior.name} 대상자가 안전구역을 이탈했습니다.`,
                detailCategory : "안심구역 관리",
            });
        }

        if (senior.healthStatus === "위험") {
            notifications.push({
                id : `${senior.id}-health`,
                seniorId : senior.id,
                title : "건강 상태 위험",
                message : `${senior.name} 대상자의 건강 상태가 위험입니다.`,
                detailCategory : "건강 정보",
            });
        }

        if (shouldNotifyLastAccessDelay(senior.lastAccess)) {
            notifications.push({
                id : `${senior.id}-last-access`,
                seniorId : senior.id,
                title : "접속 확인 필요",
                message : `${senior.name} 대상자가 4시간 넘게 접속하지 않았습니다.`,
                detailCategory : "기본 정보",
            });
        }

        return notifications;
    });

    const callRequests = JSON.parse(localStorage.getItem("welfareCallRequests") || "[]");
    const callNotifications = callRequests.map((req) => ({
        id : `call-${req.id}`,
        seniorId : req.seniorId || null,
        title : "📞 전화 요청",
        message : `${req.seniorName} 대상자가 전화를 요청했습니다.`,
        phone : req.phone || null,
    }));

    const allNotifications = [...callNotifications, ...welfareNotifications];

    const activeNotifications = allNotifications.filter(
        (notification) => !dismissedNotifications.includes(notification.id)
    );
    const visibleNotifications = activeNotifications.slice(0, 10);

    const dismissNotification = (notificationId) => {
        setDismissedNotifications((prev) => {
            if (prev.includes(notificationId)) {
                return prev;
            }

            const nextDismissedNotifications = [...prev, notificationId];
            localStorage.setItem(
                DISMISSED_NOTIFICATIONS_STORAGE_KEY,
                JSON.stringify(nextDismissedNotifications)
            );

            return nextDismissedNotifications;
        });
    };

    const setAddFormValue = (key, value) => {
        setAddSeniorError(
            key === "name" && /[A-Za-z]/.test(value)
                ? "이름은 한글로 입력해주세요. 영문은 사용할 수 없습니다."
                : ""
        );
        setAddSeniorSearchMessage("");
        setAddSeniorForm((previousForm) => ({
            ...previousForm,
            [key] : value,
        }));
    };

    const openAddModal = () => {
        setAddSeniorForm(ADD_SENIOR_INITIAL_FORM);
        setAddSeniorError("");
        setAddSeniorSearchMessage("");
        setIsAddModalOpen(true);
    };

    const validateAddSeniorIdentity = () => {
        if (hasEnglishInAddSeniorIdentity) {
            setAddSeniorError("이름은 한글로 입력해주세요. 영문은 사용할 수 없습니다.");
            return false;
        }

        if (!addSeniorIdentity.name || !addSeniorIdentity.phone) {
            setAddSeniorError("이름과 연락처를 모두 입력해주세요. 쉼표(,) 또는 공백으로 구분할 수 있습니다.");
            return false;
        }

        return true;
    };

    const handleAddSeniorSearch = () => {
        if (!validateAddSeniorIdentity()) {
            return;
        }

        setAddSeniorError("");
        setAddSeniorSearchMessage(
            matchedAddSenior
                ? `${matchedAddSenior.name} 대상자가 이미 등록되어 있습니다.`
                : "일치하는 대상자가 없습니다. 신규 등록해주세요."
        );
    };

    const handleAddSenior = () => {
        if (!validateAddSeniorIdentity()) {
            return;
        }

        const name = addSeniorIdentity.name;
        const phone = addSeniorIdentity.phone;
        const region = addSeniorForm.region.trim() || "거주 지역 미입력";
        const jobRequestCount = Number(addSeniorForm.jobRequestCount);
        const safeZoneRadius = Number(addSeniorForm.safeZoneRadius);

        if (matchedAddSenior) {
            setAddSeniorError("이미 등록된 대상자입니다.");
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
            phone,
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

    const getBadgeClass = (type, value) => {
        const classMap = {
            health : { "양호" : "health-good", "주의" : "health-caution", "위험" : "health-danger" },
            alert : { "없음" : "alert-none", "SOS 요청" : "alert-sos", "일자리 요청" : "alert-job" },
            workRequest : { "검토" : "work-reviewed", "미검토" : "work-unreviewed" },
            jobRequest : { "미요청" : "job-none", "요청 있음" : "job-requested" },
            matching : { "미검토" : "match-unreviewed", "검토중" : "match-reviewing", "적합" : "match-suitable", "보류" : "match-hold", "부적합" : "match-unsuitable" },
        };

        return `wd-badge ${classMap[type]?.[value] || "alert-none"}`;
    };

    return (
        <div style = {styles.page}>
            <WelfareHeader pageName = "복지사 대상자 관리">
                {currentWorker && (
                    <div style = {styles.workerArea}>
                        <span style = {styles.workerName}>{currentWorker.name} 복지사</span>
                        {currentWorker.center && (
                            <span style = {styles.workerIdText}>{currentWorker.center}</span>
                        )}
                        <Link to = "/welfare/mypage" style = {styles.myPageButton}>
                            <UserRound size = {14} />
                            마이페이지
                        </Link>

                        <div style = {styles.notificationWrap} ref = {notificationRef}>
                            <button
                                type = "button"
                                style = {styles.notificationButton}
                                onClick = {() => setIsNotificationOpen((previousValue) => !previousValue)}
                                aria-label = "알림"
                                aria-expanded = {isNotificationOpen}
                            >
                                <Bell size = {17} />
                                {activeNotifications.length > 0 && (
                                    <span style = {styles.notificationBadge}>{activeNotifications.length}</span>
                                )}
                            </button>

                            {isNotificationOpen && (
                                <div style = {styles.notificationPanel}>
                                    <div style = {styles.notificationHeader}>
                                        <h2 style = {styles.notificationTitle}>알림</h2>
                                        <span style = {styles.notificationCountText}>
                                            {activeNotifications.length}건
                                        </span>
                                    </div>

                                    {visibleNotifications.length === 0 ? (
                                        <p style = {styles.emptyNotification}>새 알림이 없습니다.</p>
                                    ) : (
                                        <div style = {styles.notificationList}>
                                            {visibleNotifications.map((notification) => (
                                                <div
                                                    key = {notification.id}
                                                    style = {styles.notificationItem}
                                                >
                                                    <button
                                                        type = "button"
                                                        style = {styles.notificationDismiss}
                                                        onClick = {(event) => {
                                                            event.stopPropagation();
                                                            dismissNotification(notification.id);
                                                        }}
                                                        aria-label = "알림 삭제"
                                                    >
                                                        <X size = {14} />
                                                    </button>
                                                    {notification.phone ? (
                                                        <div style = {styles.notificationItemContent}>
                                                            <strong style = {styles.notificationItemTitle}>
                                                                {notification.title}
                                                            </strong>
                                                            <span style = {styles.notificationItemMessage}>
                                                                {notification.message}
                                                            </span>
                                                            <a
                                                                href = {`tel:${notification.phone}`}
                                                                style = {styles.callButton}
                                                                onClick = {(event) => event.stopPropagation()}
                                                            >
                                                                📞 {notification.phone} 전화 걸기
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type = "button"
                                                            style = {styles.notificationItemContent}
                                                            onClick = {() => {
                                                                dismissNotification(notification.id);
                                                                setIsNotificationOpen(false);
                                                                navigate(
                                                                    `/welfare/seniors/${notification.seniorId}`,
                                                                    { state : { category : notification.detailCategory || "기본 정보" } }
                                                                );
                                                            }}
                                                        >
                                                            <strong style = {styles.notificationItemTitle}>
                                                                {notification.title}
                                                            </strong>
                                                            <span style = {styles.notificationItemMessage}>
                                                                {notification.message}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <a href = "tel:119" style = {styles.emergencyHeaderButton}>
                            긴급 신고
                        </a>
                    </div>
                )}
            </WelfareHeader>

            <main style = {styles.content}>
                <div style = {styles.actionHeader}>
                    <div>
                        <h1 style = {styles.pageTitle}>대상자 목록</h1>
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
                    <div style = {styles.searchRow}>
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

                    <div style = {styles.filterTopRow}>
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
                        <button
                            type = "button"
                            style = {styles.filterResetButton}
                            onClick = {resetFilters}
                        >
                            초기화
                        </button>
                    </div>

                    <div style = {styles.checkboxPanel}>
                        <div style = {styles.checkboxPanelHeader}>
                            <strong style = {styles.checkboxPanelTitle}>{activeFilterGroup.label}</strong>
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

                </section>

                {isLoadingSeniors && (
                    <p style = {styles.dataMessage}>대상자 데이터를 불러오는 중입니다.</p>
                )}

                {seniorLoadError && (
                    <p style = {{ ...styles.dataMessage, color : "#6b5b12", backgroundColor : "#fff3c4", padding : "10px 14px", borderRadius : "8px" }}>
                        {seniorLoadError}
                    </p>
                )}

                <div style = {styles.tableBox}>
                    <table style = {styles.table} aria-label = "대상자 목록">
                        <thead>
                            <tr>
                                <th style = {styles.th}>ID</th>
                                <th style = {styles.th}>이름</th>
                                <th style = {styles.th}>나이/성별</th>
                                <th style = {styles.th}>거주 지역</th>
                                <th style = {styles.th}>건강 상태</th>
                                <th style = {styles.th}>위치 상태</th>
                                <th style = {styles.th}>알림 상태</th>
                                <th style = {styles.th}>확인여부</th>
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
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "기본 정보" }} style = {styles.cellLink}>
                                            {formatAgeGender(senior)}
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "기본 정보" }} style = {styles.cellLink}>
                                            {senior.region}
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "건강 정보" }} style = {styles.cellLink}>
                                            <span className = {getBadgeClass("health", senior.healthStatus)}>
                                                {senior.healthStatus}
                                            </span>
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "안심구역 관리" }} style = {styles.cellLink}>
                                            {senior.locationStatus}
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link
                                            to = {`/welfare/seniors/${senior.id}`}
                                            state = {{ category : senior.alertStatus === "SOS 요청" ? "안심구역 관리" : "일자리 요청 상태" }}
                                            style = {styles.cellLink}
                                        >
                                            <span className = {getBadgeClass("alert", (() => {
                                                if (senior.alertStatus === "일자리 요청") {
                                                    if (getSeniorReviewStatus(senior) === "검토") return "없음";
                                                }
                                                return senior.alertStatus;
                                            })())}>
                                                {(() => {
                                                    if (senior.alertStatus === "일자리 요청") {
                                                        if (getSeniorReviewStatus(senior) === "검토") return "없음";
                                                    }
                                                    return senior.alertStatus;
                                                })()}
                                            </span>
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "일자리 요청 상태" }} style = {styles.cellLink}>
                                            <span className = {getBadgeClass("workRequest", getSeniorReviewStatus(senior))}>
                                                {getSeniorReviewStatus(senior)}
                                            </span>
                                        </Link>
                                    </td>
                                    <td style = {styles.td}>
                                        <Link to = {`/welfare/seniors/${senior.id}`} state = {{ category : "기본 정보" }} style = {styles.cellLink}>
                                            {shouldHideLastAccess(senior.lastAccess) ? "" : senior.lastAccess}
                                        </Link>
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
                    <div style = {styles.modalBox} role = "dialog" aria-modal = "true" aria-labelledby = "add-senior-title">
                        <div style = {styles.modalHeader}>
                            <div>
                                <h2 style = {styles.modalTitle} id = "add-senior-title">대상자 추가</h2>
                                <p style = {styles.modalSubText}>기존 사용자를 검색해서 연결하거나 새로 등록합니다.</p>
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

                        <div style = {styles.addSearchRow}>
                            <input
                                style = {styles.addSearchInput}
                                value = {addSeniorForm.name}
                                onChange = {(event) => setAddFormValue("name", event.target.value)}
                                placeholder = "이름과 연락처 입력 (예: 김민지, 010-0000-0000)"
                                onKeyDown = {(event) => {
                                    if (event.key === "Enter") {
                                        handleAddSeniorSearch();
                                    }
                                }}
                            />
                            <button
                                type = "button"
                                style = {{
                                    ...styles.primaryButton,
                                    ...(!isAddSeniorIdentityComplete ? styles.disabledButton : {}),
                                }}
                                onClick = {handleAddSeniorSearch}
                                disabled = {!isAddSeniorIdentityComplete}
                            >
                                검색
                            </button>
                        </div>

                        {addSeniorError && <p style = {styles.formError}>{addSeniorError}</p>}
                        {addSeniorSearchMessage && (
                            <p
                                style = {{
                                    ...styles.addSearchResult,
                                    ...(matchedAddSenior ? styles.addSearchResultFound : {}),
                                }}
                            >
                                {addSeniorSearchMessage}
                            </p>
                        )}

                        <p style = {styles.addSearchHint}>
                            이름은 한글로, 연락처는 숫자로 입력해주세요. 쉼표(,) 또는 공백으로 구분할 수 있습니다.
                        </p>

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
                                style = {{
                                    ...styles.primaryButton,
                                    ...(!isAddSeniorIdentityComplete ? styles.disabledButton : {}),
                                }}
                                onClick = {handleAddSenior}
                                disabled = {!isAddSeniorIdentityComplete}
                            >
                                대상자 등록
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
    myPageButton : {
        height : "34px",
        padding : "0 11px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        fontSize : "13px",
        fontWeight : "700",
        textDecoration : "none",
        display : "inline-flex",
        alignItems : "center",
        gap : "5px",
        whiteSpace : "nowrap",
    },
    emergencyHeaderButton : {
        height : "34px",
        padding : "0 13px",
        borderRadius : "8px",
        border : "1px solid #b66b6b",
        backgroundColor : "#b66b6b",
        color : "white",
        fontSize : "13px",
        fontWeight : "700",
        textDecoration : "none",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        whiteSpace : "nowrap",
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
        top : "46px",
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
        position : "relative",
        width : "100%",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "#fffef7",
        padding : "10px",
        textAlign : "left",
    },
    notificationDismiss : {
        position : "absolute",
        top : "6px",
        right : "6px",
        width : "22px",
        height : "22px",
        borderRadius : "4px",
        border : "none",
        backgroundColor : "transparent",
        color : "#999",
        display : "grid",
        placeItems : "center",
        cursor : "pointer",
        padding : 0,
    },
    notificationItemContent : {
        display : "block",
        width : "100%",
        border : "none",
        backgroundColor : "transparent",
        padding : 0,
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
    callButton : {
        display : "inline-block",
        marginTop : "6px",
        padding : "5px 10px",
        fontSize : "12px",
        fontWeight : "600",
        color : "#fff",
        backgroundColor : "#4a7c4f",
        borderRadius : "6px",
        textDecoration : "none",
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
    filterTopRow : {
        display : "flex",
        alignItems : "flex-start",
        justifyContent : "space-between",
        gap : "12px",
        marginBottom : "14px",
    },
    filterTabs : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px",
        flex : "1 1 auto",
    },
    filterResetButton : {
        minHeight : "40px",
        padding : "0 12px",
        borderRadius : "7px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "#555",
        fontSize : "12px",
        fontWeight : "800",
        cursor : "pointer",
        whiteSpace : "nowrap",
    },
    filterTab : {
        minHeight : "40px",
        padding : "0 12px",
        border : "1px solid #bfd4c0",
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
        backgroundColor : "white",
        color : "var(--main-color)",
        borderColor : "var(--main-color)",
        boxShadow : "none",
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
        backgroundColor : "#edf3ee",
        color : "#777",
    },
    checkboxPanel : {
        padding : "2px 0 0",
    },
    checkboxPanelHeader : {
        display : "flex",
        alignItems : "center",
        gap : "12px",
        marginBottom : "12px",
    },
    checkboxPanelTitle : {
        fontSize : "15px",
        fontWeight : "800",
    },
    checkboxPanelHint : {
        margin : "10px 0 0",
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
        marginBottom : "14px",
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
    cellLink : {
        color : "inherit",
        textDecoration : "none",
        cursor : "pointer",
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
    addSearchRow : {
        display : "flex",
        alignItems : "center",
        gap : "8px",
        marginBottom : "14px",
    },
    addSearchInput : {
        flex : "1 1 auto",
        height : "44px",
        boxSizing : "border-box",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "0 14px",
        fontSize : "15px",
        color : "var(--text-color)",
        backgroundColor : "white",
        outline : "none",
    },
    addSearchHint : {
        margin : "0 0 16px",
        fontSize : "13px",
        color : "#666",
        textAlign : "center",
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
    addSearchResult : {
        margin : "0 0 12px",
        padding : "10px 12px",
        borderRadius : "8px",
        backgroundColor : "#fff3c4",
        color : "#6b5b12",
        fontSize : "14px",
        fontWeight : "800",
        textAlign : "center",
    },
    addSearchResultFound : {
        backgroundColor : "rgba(134, 167, 136, 0.18)",
        color : "#48644b",
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
    disabledButton : {
        opacity : 0.55,
        cursor : "not-allowed",
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
