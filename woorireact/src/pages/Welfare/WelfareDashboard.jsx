import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, MapPin, MessageCircle, Phone, Route, Search } from "lucide-react";

import {
    fetchWelfareAlerts,
    fetchWelfareSeniors,
    requestSeniorInfoUpdate,
    searchSeniorExact,
    assignWelfareSenior,
    sendGuardianCheckInRequest,
    readWelfareAlert,
    readSeniorSosAlerts,
} from "../../api/welfareDashboardApi";
import CommonHeader from "../../components/CommonHeader.jsx";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";
import TripartiteChatModal from "../../components/TripartiteChatModal.jsx";
import { fetchUnreadChatCount } from "../../api/chatApi";
import WelfareSummaryCards from "../../components/welfare/WelfareSummaryCards";
import WelfareSeniorTable from "../../components/welfare/WelfareSeniorTable";
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
import { formatPhoneNumber } from "../../utils/common/phone.js";
import { searchPlacesByKakao } from "../../api/kakaoLocalApi.js";

import "../../css/welfare/WelfareDashboard.css";

const ITEM_PER_PAGE = 5;

const EMERGENCY_FILTER_VALUES = [
    "미응답 SOS",
    "보호자 미응답 SOS",
    "낙상 의심",
    "안전구역 이탈",
    "위험 알림",
];

const MISSING_INFO_NOTIFICATION_CATEGORY = "정보 미입력";
const INFO_UPDATE_COMPLETE_TYPES = new Set([
    "PROFILE_UPDATE_COMPLETE",
    "INFO_UPDATE_COMPLETE",
    "PROFILE_UPDATED",
    "PROFILE_UPDATE",
]);
const INFO_UPDATE_REQUEST_TYPES = new Set([
    "INFO_UPDATE_REQUEST",
    "PROFILE_UPDATE_REQUEST",
]);

const isInfoUpdateCompleteAlert = (alert) => INFO_UPDATE_COMPLETE_TYPES.has(alert?.type);
const isInfoUpdateRequestAlert = (alert) => INFO_UPDATE_REQUEST_TYPES.has(alert?.type);

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
    const [checkInRequestedNotificationIds, setCheckInRequestedNotificationIds] = useState([]);
    const [infoUpdateRequestedSeniorIds, setInfoUpdateRequestedSeniorIds] = useState([]);
    const [agencyLinkTarget, setAgencyLinkTarget] = useState(null);
    const [agencyPlaces, setAgencyPlaces] = useState([]);
    const [isAgencyLoading, setIsAgencyLoading] = useState(false);
    const [agencyError, setAgencyError] = useState("");
    const [readSyntheticAlertIds, setReadSyntheticAlertIds] = useState([]);

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
                const alerts = await fetchWelfareAlerts({ welfareWorkerId: currentWorker.id });

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
                const data = await fetchWelfareSeniors({ welfareWorkerId: currentWorker.id });
                const raw = Array.isArray(data) ? data : data.content || [];
                if (!ignore) setNotificationSeniors(raw.map(mapWelfareSenior));
            } catch { /* silent */ }
        };
        load();
        const timerId = setInterval(load, 15000);
        return () => { ignore = true; clearInterval(timerId); };
    }, [currentWorker]);

    const loadUnreadChatCount = async () => {
        const count = await fetchUnreadChatCount({ viewerRole: "WELFARE", welfareWorkerId: currentWorker?.id }).catch(() => 0);
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
        const sourceSeniors = summaryFilter === "all" ? seniors : notificationSeniors;

        return sourceSeniors.filter((senior) => {
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
    }, [filters, searchKeyword, seniors, notificationSeniors, summaryFilter]);

    const getPriorityRank = (senior) => {
        if (senior.alertStatus === "미응답 SOS") return 1;
        if (senior.alertStatus === "일자리 신청") return 2;
        if (getSeniorReviewStatus(senior) === "미검토") return 3;

        return 4;
    };

    const isClientMode = summaryFilter !== "all";
    const sortedSeniors = filteredSeniors
        .slice()
        .sort(
            (first, second) =>
                getPriorityRank(first) - getPriorityRank(second) ||
                Number(second.id) - Number(first.id)
        );
    const totalPages = isClientMode
        ? Math.max(1, Math.ceil(sortedSeniors.length / ITEM_PER_PAGE))
        : Math.max(1, serverTotalPages);
    const currentSeniors = isClientMode
        ? sortedSeniors.slice((currentPage - 1) * ITEM_PER_PAGE, currentPage * ITEM_PER_PAGE)
        : sortedSeniors;

    const seniorSummaryCounts = {
        ...getSeniorSummaryCounts(notificationSeniors.length > 0 ? notificationSeniors : seniors),
        totalSeniors: serverTotalSeniors || seniors.length,
    };

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

    const dbWelfareNotifications = dbWelfareAlerts.map((alert) => {
        const isFallAlert = alert.type === "FALL_DETECTED" || alert.type === "FALL_RISK";
        const isLastAccessAlert = alert.type === "LAST_ACCESS";
        const isCheckInOkAlert = alert.type === "CHECK_IN_OK";

        return {
            id: `db-${alert.id}`,
            seniorId: alert.seniorId,
            seniorName: alert.seniorName,
            type: alert.type,
            title: isFallAlert
                ? "낙상 감지 알림"
                : isCheckInOkAlert
                    ? "보호자 안부 확인 완료"
                    : alert.title,
            message: isFallAlert
                ? `${alert.message || "대상자의 낙상이 감지되었습니다."} 보호자 확인 또는 대처 응답이 없으면 신고 조치를 검토해주세요.`
                : alert.message,
            category: isFallAlert ? "낙상" : isLastAccessAlert ? "복지" : isCheckInOkAlert ? "정보" : "긴급",
            detailCategory: isFallAlert ? "낙상 대응" : isLastAccessAlert ? "기본 정보" : isCheckInOkAlert ? "복지" : "안전구역 관리",
            danger: !isLastAccessAlert && !isCheckInOkAlert,
            statusLabel: isCheckInOkAlert ? null : undefined,
            isRead: alert.isRead === true,
            time: alert.createdAt
                ? new Date(alert.createdAt).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                })
                : "",
            raw: alert,
        };
    });

    const normalizedDbWelfareNotifications = dbWelfareNotifications.map((notification) => {
        const rawAlert = notification.raw || notification;
        const isInfoRequestAlert = isInfoUpdateRequestAlert(rawAlert);
        const isInfoCompleteAlert = isInfoUpdateCompleteAlert(rawAlert);

        if (!isInfoRequestAlert && !isInfoCompleteAlert) {
            return notification;
        }

        const seniorName = rawAlert.seniorName || notification.seniorName || "대상자";

        return {
            ...notification,
            title: isInfoCompleteAlert ? "정보 수정 완료" : "정보 입력 요청",
            message: rawAlert.message || (
                isInfoCompleteAlert
                    ? `${seniorName}님이 요청받은 정보를 수정했습니다. 변경 내용을 확인해주세요.`
                    : `${seniorName}님에게 보낸 정보 입력 요청이 아직 확인 대상입니다.`
            ),
            category: MISSING_INFO_NOTIFICATION_CATEGORY,
            detailCategory: "기본 정보",
            danger: false,
        };
    });

    const welfareNotifications = notificationSeniors.flatMap((senior) => {
        const notifications = [];

        if (senior.alertStatus === "미응답 SOS") {
            notifications.push({
                id: `${senior.id}-sos`,
                seniorId: senior.id,
                title: "미응답 SOS",
                message: "보호자 미응답 SOS가 있습니다.",
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

        const missingFields = getMissingSeniorInfoFields(senior);
        if (missingFields.length > 0) {
            const isInfoUpdateRequested = infoUpdateRequestedSeniorIds.includes(String(senior.id));

            notifications.push({
                id: `${senior.id}-missing-info`,
                seniorId: senior.id,
                seniorName: senior.name,
                title: isInfoUpdateRequested ? "정보 입력 요청 대기" : "정보 입력 필요",
                message: isInfoUpdateRequested
                    ? `${senior.name} 대상자에게 ${missingFields.join(", ")} 정보 입력을 요청했습니다. 아직 수정이 완료되지 않았습니다.`
                    : `${senior.name} 대상자의 ${missingFields.join(", ")} 정보가 비어 있습니다. 사용자 또는 보호자에게 정보 입력을 요청해주세요.`,
                category: MISSING_INFO_NOTIFICATION_CATEGORY,
                detailCategory: "기본 정보",
                danger: false,
                isRead: readSyntheticAlertIds.includes(`${senior.id}-missing-info`),  // 추가
            });
        }

        return notifications;
    });

    const checkInRepliedSeniorIds = new Set(
        normalizedDbWelfareNotifications
            .filter((notification) => notification.type === "CHECK_IN_OK")
            .map((notification) => String(notification.seniorId))
    );

    const isDirectSosNotification = (notification) => {
        const type = notification?.type || notification?.raw?.type;

        return type === "SOS";
    };

    const activeNotifications = [...normalizedDbWelfareNotifications, ...welfareNotifications]
        .filter((notification) => !isDirectSosNotification(notification))
        .filter((notification) => {
            if (notification.type !== "LAST_ACCESS") return true;
            return !checkInRepliedSeniorIds.has(String(notification.seniorId));
        })
        .filter((notification, index, source) =>
            source.findIndex((item) => item.id === notification.id) === index
        )
        .filter((notification) => !dismissedNotifications.includes(notification.id));

    const dismissNotification = (notificationId) => {
        setDismissedNotifications((previousIds) =>
            previousIds.includes(notificationId) ? previousIds : [...previousIds, notificationId]
        );
    };

    // 서버 id 추출 함수 추가
    const getServerAlertId = (notificationId) => {
        if (!notificationId) return null;

        const match = String(notificationId).match(/(\d+)$/);
        return match ? Number(match[1]) : null;
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

    const getSeniorLocationForAgency = (notification) => {
        const senior = seniors.find((item) => String(item.id) === String(notification?.seniorId));

        const lat =
            senior?.lastGps?.latitude ??
            senior?.lastLocation?.latitude ??
            senior?.currentLocation?.lat ??
            senior?.currentLocation?.latitude ??
            senior?.safeZone?.centerLatitude ??
            null;

        const lng =
            senior?.lastGps?.longitude ??
            senior?.lastLocation?.longitude ??
            senior?.currentLocation?.lng ??
            senior?.currentLocation?.longitude ??
            senior?.safeZone?.centerLongitude ??
            null;

        return {
            senior,
            lat: lat == null ? null : Number(lat),
            lng: lng == null ? null : Number(lng),
        };
    };

    const formatAgencyDistance = (value) => {
        const meters = Number(value);
        if (!Number.isFinite(meters)) return "";
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
        return `${meters}m`;
    };

    const openAgencyRoute = (place, currentLat, currentLng) => {
        const destination = `${encodeURIComponent(place.name)},${place.lat},${place.lon}`;
        const url = currentLat && currentLng
            ? `https://map.kakao.com/link/from/${encodeURIComponent("대상자 마지막 위치")},${currentLat},${currentLng}/to/${destination}`
            : `https://map.kakao.com/link/to/${destination}`;

        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleAgencyLinkLastAccessAlert = async (notification) => {
        if (!notification?.seniorId) return;

        const { senior, lat, lng } = getSeniorLocationForAgency(notification);
        const seniorName = notification.seniorName || senior?.name || "대상자";

        setAgencyLinkTarget({
            notification,
            senior,
            seniorName,
            lat,
            lng,
        });
        setAgencyPlaces([]);
        setAgencyError("");

        if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
            setAgencyError("대상자의 마지막 위치 정보가 없어 가까운 행정복지센터를 조회할 수 없습니다.");
            return;
        }

        setIsAgencyLoading(true);

        try {
            const keywords = ["행정복지센터", "주민센터", "동주민센터"];
            const results = [];

            for (const keyword of keywords) {
                const places = await searchPlacesByKakao(keyword, {
                    size: 5,
                    x: lng,
                    y: lat,
                    radius: 5000,
                });

                results.push(...places);
            }

            const uniquePlaces = Array.from(
                new Map(results.map((place) => [place.place_id || `${place.name}-${place.display_name}`, place])).values()
            )
                .sort((left, right) => Number(left.distance || 999999) - Number(right.distance || 999999))
                .slice(0, 5);

            if (uniquePlaces.length === 0) {
                setAgencyError("5km 이내에서 행정복지센터 또는 주민센터를 찾지 못했습니다.");
                return;
            }

            setAgencyPlaces(uniquePlaces);
        } catch (error) {
            console.error("기관 연계 장소 검색 실패:", error);
            setAgencyError("가까운 행정복지센터를 불러오지 못했습니다.");
        } finally {
            setIsAgencyLoading(false);
        }
    };

    const handleCompleteAgencyLink = () => {
        if (agencyLinkTarget?.notification?.id) {
            dismissNotification(agencyLinkTarget.notification.id);
        }

        setAgencyLinkTarget(null);
        setAgencyPlaces([]);
        setAgencyError("");
    };

    // CHECK_IN_OK 확인 처리 함수 추가
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
            console.error("안부 확인 완료 알림 읽음 처리 실패:", error);
            window.alert("알림 확인 처리에 실패했습니다.");
        }
    };

    const handleConfirmUnansweredSosAlert = async (notification, closeNotificationPanel) => {
        if (!notification?.seniorId) return;

        try {
            await readSeniorSosAlerts(notification.seniorId);

            setDbWelfareAlerts((previousAlerts) =>
                previousAlerts.map((alert) =>
                    alert.seniorId === notification.seniorId && alert.type === "UNANSWERED_SOS"
                        ? { ...alert, isRead: true }
                        : alert
                )
            );

            navigate(`/welfare/seniors/${notification.seniorId}`, {
                state: {
                    category: "기관 연계",
                    agencyLinkNeeded: true,
                },
            });

            closeNotificationPanel?.();
        } catch (error) {
            console.error("미응답 SOS 읽음 처리 실패:", error);
            window.alert("SOS 알림 확인 처리에 실패했습니다.");
        }
    };

    const renderWelfareNotificationActions = (
        notification,
        { defaultAction, closeNotificationPanel }
    ) => {
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

        if (notification?.type === "UNANSWERED_SOS" || notification?.title === "미응답 SOS") {
            return (
                <div className="welfare-alert-actions-below">
                    <button
                        type="button"
                        className="welfare-alert-primary-action"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleConfirmUnansweredSosAlert(notification, closeNotificationPanel);
                        }}
                    >
                        긴급 확인
                    </button>
                </div>
            );
        }

        if (!isLastAccessNotification(notification)) {
            return defaultAction;
        }

        const isRequested =
            checkInRequestedNotificationIds.includes(notification.id) ||
            notification.raw?.status === "CHECK_IN_REQUESTED" ||
            notification.statusLabel === "안부 확인 요청됨";

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

            setInfoUpdateRequestedSeniorIds((previousIds) => {
                const nextId = String(infoRequestTarget.id);
                return previousIds.includes(nextId) ? previousIds : [...previousIds, nextId];
            });
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
                    isRead: notification.isRead === true,
                    statusLabel: notification.statusLabel,
                    danger: notification.danger === true || notification.category === "긴급",
                    raw: {
                        ...notification,
                        type: notification.raw?.type || notification.type,
                        seniorName: notification.raw?.seniorName || notification.seniorName,
                        imageUrl: notification.raw?.imageAccessUrl || notification.raw?.imageUrl || notification.imageUrl || "",
                    },
                }))}
                notificationTabs={["전체", "긴급", "낙상", "정보 미입력", "일자리", "복지", "읽지 않음"]}
                onReadNotification={async (notification) => {
                    if (!notification?.id) return;

                    const isSyntheticAlert = String(notification.id).includes("-");

                    if (isSyntheticAlert) {
                        // 가상 알림 — dismiss 하지 않고 읽음 state만 업데이트
                        setReadSyntheticAlertIds((prev) =>
                            prev.includes(notification.id) ? prev : [...prev, notification.id]
                        );
                    } else {
                        try {
                            await readWelfareAlert(notification.id);
                            setDbWelfareAlerts((prev) =>
                                prev.map((alert) =>
                                    String(alert.id) === String(notification.id)
                                        ? { ...alert, isRead: true }
                                        : alert
                                )
                            );
                        } catch (error) {
                            console.error("알림 읽음 처리 실패:", error);
                        }
                    }
                }}
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

                renderNotificationActions={renderWelfareNotificationActions}
            />

            <TripartiteChatModal
                isOpen={isChatOpen}
                rooms={notificationSeniors.flatMap((senior) => [
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

            {agencyLinkTarget && (
                <div className="wd-agency-modal-backdrop" onClick={() => setAgencyLinkTarget(null)}>
                    <section className="wd-agency-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="wd-agency-modal-header">
                            <div>
                                <h2>근처 행정복지센터 연계</h2>
                                <p>
                                    {agencyLinkTarget.seniorName} 대상자의 마지막 위치를 기준으로 가까운 기관을 조회했어요.
                                </p>
                            </div>
                            <button type="button" onClick={() => setAgencyLinkTarget(null)}>
                                닫기
                            </button>
                        </div>

                        <div className="wd-agency-guide">
                            <strong>연계 안내</strong>
                            <p>
                                보호자와도 연락이 어려운 경우, 인근 행정복지센터의 찾아가는 보건복지팀 또는 복지 담당자에게
                                안부 확인을 요청할 수 있습니다.
                            </p>
                        </div>

                        {isAgencyLoading ? (
                            <div className="wd-agency-empty">가까운 기관을 찾는 중입니다.</div>
                        ) : agencyError ? (
                            <div className="wd-agency-empty danger">{agencyError}</div>
                        ) : (
                            <div className="wd-agency-list">
                                {agencyPlaces.map((place) => (
                                    <article className="wd-agency-card" key={place.place_id || `${place.name}-${place.display_name}`}>
                                        <div>
                                            <strong>{place.name}</strong>
                                            <span>
                                                <MapPin size={14} />
                                                {place.display_name}
                                            </span>
                                            {place.distance && <em>{formatAgencyDistance(place.distance)} 거리</em>}
                                        </div>

                                        <div className="wd-agency-actions">
                                            {place.phone && (
                                                <a href={`tel:${place.phone.replace(/[^0-9]/g, "")}`}>
                                                    <Phone size={15} />
                                                    전화
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => openAgencyRoute(place, agencyLinkTarget.lat, agencyLinkTarget.lng)}
                                            >
                                                <Route size={15} />
                                                길찾기
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        <div className="wd-agency-footer">
                            <button type="button" className="secondary" onClick={() => setAgencyLinkTarget(null)}>
                                취소
                            </button>
                            <button type="button" onClick={handleCompleteAgencyLink}>
                                <CheckCircle size={16} />
                                연계 완료
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <div className="wd-layout">
                <WelfareSidebar
                    active="seniors"
                    onAddSenior={openAddSeniorModal}
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
                                className={`wd-small-button${currentPage === pageNumber ? " wd-pager-current" : ""}`}
                                onClick={() => setCurrentPage(pageNumber)}
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
