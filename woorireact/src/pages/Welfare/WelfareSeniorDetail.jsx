import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import WelfareCommonHeader from "../../components/welfare/WelfareCommonHeader.jsx";

import {
    normalizeSenior,
    applySavedWelfareDecision,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";
import WelfarePolicyChatButton from "../../components/welfare/WelfarePolicyChatButton";
import {
    fetchWelfareSeniorDetail,
    requestGuardianConsultation,
    fetchSeniorAlerts,
    requestSeniorInfoUpdate,
} from "../../api/welfareDashboardApi";
import KakaoMap from "../../components/KakaoMap";

import { resolveUploadUrl } from "../../api/userPageApi.js";
import "../../css/welfare/WelfareSeniorDetail.css";

const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";

const getSavedCounselingRecords = () => {
    try {
        return JSON.parse(localStorage.getItem(COUNSELING_RECORDS_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
};

const findWelfareDemoCounselingRecords = () => [];

const INFO_UPDATE_REQUEST_GROUPS = [
    {
        key: "personal",
        label: "인적사항",
        fields: ["이름", "생년월일", "성별", "연락처", "주소"],
    },
    {
        key: "body",
        label: "신체정보",
        fields: ["키", "몸무게", "흡연 여부", "음주 여부", "알레르기 정보"],
    },
    {
        key: "medication",
        label: "복약정보",
        fields: ["복용 약", "복용 시작일", "복용 간격", "하루 복용 횟수"],
    },
    {
        key: "chronic",
        label: "만성질환",
        fields: ["당뇨", "고혈압", "심장질환", "관절질환", "수술 이력"],
    },
    {
        key: "mobility",
        label: "거동/인지/감각",
        fields: ["보행", "기억/판단", "시력", "청력", "최근 낙상 경험"],
    },
    {
        key: "welfare",
        label: "복지정보",
        fields: ["소득 구분", "가구 형태", "현재 받고 있는 복지 혜택", "복지 참고사항"],
    },
    {
        key: "activity",
        label: "활동 조건",
        fields: ["하루 최대 활동 시간", "이동 가능 거리", "쉬는 시간", "하기 어려운 작업"],
    },
    {
        key: "job",
        label: "일자리 희망조건",
        fields: ["희망 급여", "희망 요일", "희망 직종", "희망 근무 형태"],
    },
];

const formatPhoneForDetail = (value) => {
    const digits = String(value || "").replace(/\D/g, "");

    if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    return value || "연락처 없음";
};


const formatLastAccessForDetail = (value) => {
    if (!value || value === "기록 없음") {
        return {
            main: "기록 없음",
            sub: "아직 접속 기록이 없습니다.",
        };
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return {
            main: value,
            sub: "",
        };
    }

    const now = new Date();
    const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const main = date.toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    let sub = "방금 전 접속";
    if (diffMinutes >= 1 && diffMinutes < 60) sub = `${diffMinutes}분 전 접속`;
    if (diffHours >= 1 && diffHours < 24) sub = `${diffHours}시간 전 접속`;
    if (diffDays >= 1) sub = `${diffDays}일 전 접속`;

    return { main, sub };
};

const valueOrMissing = (value, fallback = "미입력") => {
    if (Array.isArray(value)) {
        return value.filter(Boolean).length ? value.filter(Boolean).join(", ") : fallback;
    }

    return value === null || value === undefined || String(value).trim() === "" ? fallback : value;
};

const readMedications = (healthInfo = {}) => {
    if (Array.isArray(healthInfo.medications)) {
        return healthInfo.medications;
    }

    if (typeof healthInfo.medicationsJson === "string") {
        try {
            const parsed = JSON.parse(healthInfo.medicationsJson);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
};

function WelfareSeniorDetail() {
    const { id } = useParams();
    const location = useLocation();
    const [senior, setSenior] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [counselingRecords, setCounselingRecords] = useState([]);
    const [selectedCounselingDate, setSelectedCounselingDate] = useState("");
    const [draftCounselingMemo, setDraftCounselingMemo] = useState("");
    const [isMemoEditing, setIsMemoEditing] = useState(false);
    const [memoStatusMessage, setMemoStatusMessage] = useState("");
    const [isSendingConsultRequest, setIsSendingConsultRequest] = useState(false);
    const [consultRequestStatusMessage, setConsultRequestStatusMessage] = useState("");
    const [isConsultRequestModalOpen, setIsConsultRequestModalOpen] = useState(false);
    const [consultRequestMemo, setConsultRequestMemo] = useState("");
    const [seniorAlerts, setSeniorAlerts] = useState([]);
    const [isInfoRequestModalOpen, setIsInfoRequestModalOpen] = useState(false);
    const [selectedInfoRequestKeys, setSelectedInfoRequestKeys] = useState([]);
    const [isSendingInfoRequest, setIsSendingInfoRequest] = useState(false);
    const [infoRequestStatusMessage, setInfoRequestStatusMessage] = useState("");
    
    const CATEGORY_LIST = ["기본 정보", "보호자 정보", "건강 정보", "안심구역 관리", "전화 및 상담기록"];
    const initialCategory = CATEGORY_LIST.includes(location.state?.category)
        ? location.state.category
        : "기본 정보";
    const [activeCategory, setActiveCategory] = useState(initialCategory);

    const applyLoadedSenior = (loadedSenior) => {
        const nextSenior = applySavedWelfareDecision(loadedSenior);
        const savedReviews = JSON.parse(localStorage.getItem("welfareWorkRequestStatus") || "{}");

        if (savedReviews[nextSenior.id]) {
            nextSenior.workRequestStatus = savedReviews[nextSenior.id];
        }

        const savedRecords = getSavedCounselingRecords();
        const nextRecords = savedRecords[nextSenior.id] || findWelfareDemoCounselingRecords(nextSenior.id);
        const sortedRecords = [...nextRecords].sort((a, b) => b.date.localeCompare(a.date));
        const firstDate = sortedRecords[0]?.date || new Date().toISOString().slice(0, 10);
        const firstRecord = sortedRecords.find((record) => record.date === firstDate);

        setSenior(nextSenior);
        setCounselingRecords(sortedRecords);
        setSelectedCounselingDate(firstDate);
        setDraftCounselingMemo(firstRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    const mapSeniorProfileResponse = (data) => {
        const seniorData = data?.senior || {};
        const healthInfo = data?.healthInfo || {};
        const jobPreference = data?.jobPreference || {};
        const safeZone = data?.safeZone || seniorData.safeZone || {};
        const lastGps = data?.lastGps || null;

        return normalizeSenior({
            id: seniorData.id,
            name: seniorData.name,
            age: seniorData.age,
            birthDate: seniorData.birthDate,
            gender: seniorData.gender,
            phone: seniorData.phone,
            profileImageUrl: seniorData.profileImageUrl,
            address: seniorData.address,
            region: seniorData.region || seniorData.address || "주소 미등록",
            city: seniorData.city,
            district: seniorData.district,
            dong: seniorData.dong,
            detailAddress: seniorData.detailAddress,
            guardianName: data?.guardianName || "",
            guardianPhone: data?.guardianPhone || "",
            guardianRelation: data?.relation || "보호 대상자",
            healthInfo,
            healthStatus: healthInfo.healthStatus || "양호",
            disabilityGrade: seniorData.disabilityGrade,
            disabilityType: seniorData.disabilityType,
            preferredWorkTime: healthInfo.maxHours ? `하루 ${healthInfo.maxHours}시간` : "미등록",
            workRequestStatus: seniorData.workRequestStatus || "미검토",
            welfareDecision: seniorData.welfareDecision || "미검토",
            welfareDecisionReason: seniorData.welfareDecisionReason || "",
            jobPreference,
            safeZone: safeZone?.id
                ? {
                    placeName: safeZone.name || safeZone.placeName || "안심구역",
                    address: safeZone.address || "주소 미등록",
                    radiusMeter: safeZone.radiusMeters || safeZone.radiusMeter || 500,
                    radiusMeters: safeZone.radiusMeters || safeZone.radiusMeter || 500,
                    centerLatitude: safeZone.centerLatitude,
                    centerLongitude: safeZone.centerLongitude,
                }
                : null,
            lastGps: lastGps?.latitude != null && lastGps?.longitude != null
                ? {
                    address: lastGps.address || "위치 미확인",
                    latitude: lastGps.latitude,
                    longitude: lastGps.longitude,
                    recordedAt: lastGps.receivedAt,
                }
                : null,
            lastAccess: seniorData.lastLoginAt || "기록 없음",
        });
    };

    useEffect(() => {
        let ignore = false;

        const loadSenior = async () => {
            try {
                setIsLoading(true);
                setMessage("");

                const data = await fetchWelfareSeniorDetail(id);
                const loadedSenior = mapSeniorProfileResponse(data);

                if (!ignore) {
                    applyLoadedSenior(loadedSenior);
                }
            } catch (error) {
                console.error("대상자 상세정보 로딩 실패:", error);

                if (!ignore) {
                    setSenior(null);
                    setMessage("대상자 상세정보를 불러오지 못했습니다.");
                }
            } finally {
                if (!ignore) {
                    setIsLoading(false);
                }
            }
        };

        loadSenior();

        return () => {
            ignore = true;
        };
    }, [id]);

    useEffect(() => {
        if (!senior?.id) return;

        let ignore = false;

        const loadSeniorAlerts = () => {
            fetchSeniorAlerts(senior.id)
                .then((data) => {
                    if (!ignore) {
                        setSeniorAlerts(Array.isArray(data) ? data : []);
                    }
                })
                .catch(() => {
                    if (!ignore) {
                        setSeniorAlerts([]);
                    }
                });
        };

        loadSeniorAlerts();

        const intervalId = window.setInterval(loadSeniorAlerts, 5000);

        const handleFocus = () => {
            loadSeniorAlerts();
        };

        window.addEventListener("focus", handleFocus);

        return () => {
            ignore = true;
            window.clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
        };
    }, [senior?.id]);

    const latestConsultRequest = seniorAlerts
        .filter((alert) => alert.type === "WELFARE_CONSULT_REQUEST")
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    const latestConsultResponseType = latestConsultRequest?.guardianResponseType || "";
    const hasImmediateConsultResponse = latestConsultResponseType === "now";
    const hasScheduledConsultResponse = latestConsultResponseType === "schedule";

    const consultRequestStatus = !latestConsultRequest
        ? "상담 요청 전"
        : hasImmediateConsultResponse
            ? "보호자 즉시 상담 가능"
            : hasScheduledConsultResponse
                ? "보호자 상담 일정 응답"
                : latestConsultRequest.isRead
                    ? "보호자 확인 완료"
                    : "보호자 확인 대기 중";

    const selectedCounselingRecord = useMemo(
        () => counselingRecords.find((record) => record.date === selectedCounselingDate),
        [counselingRecords, selectedCounselingDate]
    );

    const detail = getDetail(senior);
    const lastAccessDisplay = formatLastAccessForDetail(senior?.lastAccess);
    const healthInfo = senior?.healthInfo || {};
    const medications = readMedications(healthInfo);
    const safeZone = senior?.safeZone || {};
    const safeZoneRadius = safeZone.radiusMeters || safeZone.radiusMeter || 500;
    const safeZoneCenter = {
        lat: safeZone.centerLatitude ?? senior?.lastGps?.latitude ?? null,
        lng: safeZone.centerLongitude ?? senior?.lastGps?.longitude ?? null,
    };
    const hasSafeZoneCenter = safeZoneCenter.lat != null && safeZoneCenter.lng != null;

    const safeZoneForMap = hasSafeZoneCenter
        ? {
            centerLatitude: safeZoneCenter.lat,
            centerLongitude: safeZoneCenter.lng,
            radiusMeters: safeZoneRadius,
        }
        : null;
    const currentLocationForMap = senior?.lastGps
        ? { lat: senior.lastGps.latitude, lng: senior.lastGps.longitude }
        : null;
    const handleCounselingDateChange = (date) => {
        const nextRecord = counselingRecords.find((record) => record.date === date);

        setSelectedCounselingDate(date);
        setDraftCounselingMemo(nextRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    const handleCounselingMemoSave = () => {
        if (!senior || !selectedCounselingDate) {
            return;
        }

        const nextContent = draftCounselingMemo.trim();
        const nextRecords = [
            {
                id: `${senior.id}-${selectedCounselingDate}`,
                date: selectedCounselingDate,
                content: nextContent,
            },
            ...counselingRecords.filter((record) => record.date !== selectedCounselingDate),
        ].sort((a, b) => b.date.localeCompare(a.date));
        const savedRecords = getSavedCounselingRecords();

        localStorage.setItem(
            COUNSELING_RECORDS_STORAGE_KEY,
            JSON.stringify({
                ...savedRecords,
                [senior.id]: nextRecords,
            })
        );

        setCounselingRecords(nextRecords);
        setDraftCounselingMemo(nextContent);
        setIsMemoEditing(false);
        setMemoStatusMessage("전화 및 상담기록이 저장되었습니다.");
    };

    const handleCounselingMemoCancel = () => {
        setDraftCounselingMemo(selectedCounselingRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    function getDetail(target) {
        if (!target) {
            return {};
        }

        return {
            phone: target.phone,
            address: target.region,
            guardianName: target.guardianName,
            guardianPhone: target.guardianPhone,
            guardianRelation: target.guardianRelation,
            diseaseInfo: target.healthStatus === "위험" ? "고혈압 / 당뇨" : target.healthStatus === "주의" ? "관절 통증" : "특이사항 없음",
            walkingStatus: target.healthStatus === "위험" ? "장시간 보행 어려움" : target.healthStatus === "주의" ? "짧은 거리 보행 가능" : "보행 가능",
            currentLocation: target.locationStatus === "안전구역 이탈" ? "안심구역 외부" : "안심구역 내부",
        };
    }

    const getBadgeClass = (type, value) => {
        const classMap = {
            health: {
                "양호": "wsd-badge-health-good",
                "주의": "wsd-badge-health-caution",
                "위험": "wsd-badge-health-danger",
            },
            decision: {
                "미검토": "wsd-badge-decision-none",
                "검토중": "wsd-badge-decision-reviewing",
                "적합": "wsd-badge-decision-fit",
                "보류": "wsd-badge-decision-hold",
                "부적합": "wsd-badge-decision-reject",
            },
            alert: {
                "없음": "wsd-badge-alert-none",
                "SOS 요청": "wsd-badge-alert-sos",
                "일자리 요청": "wsd-badge-alert-job",
            },
        };

        return `wsd-badge ${classMap[type]?.[value] || "wsd-badge-alert-none"}`;
    };

    const renderField = ({ label, value, description, wide }) => (
        <div className={`wsd-info-field${wide ? " wsd-info-field-wide" : ""}`} key={label}>
            <span>{label}</span>
            <strong>
                {valueOrMissing(value)}
                {description && <small>{description}</small>}
            </strong>
        </div>
    );

    const renderFields = (items) => (
        <div className="wsd-info-grid">
            {items.map(renderField)}
        </div>
    );

    const handleGuardianConsultRequest = async () => {
        if (!senior?.id) return;

        try {
            setIsSendingConsultRequest(true);
            setConsultRequestStatusMessage("");

            await requestGuardianConsultation({
                seniorId: senior.id,
                message: consultRequestMemo.trim() || "복지사와 상담이 필요합니다.",
            });

            setConsultRequestStatusMessage("보호자에게 상담 요청을 보냈습니다.");
            setConsultRequestMemo("");
            setIsConsultRequestModalOpen(false);
        } catch (error) {
            console.error("보호자 상담 요청 전송 실패:", error);
            setConsultRequestStatusMessage("상담 요청 전송에 실패했습니다.");
        } finally {
            setIsSendingConsultRequest(false);
        }
    };

    const toggleInfoRequestKey = (key) => {
        setSelectedInfoRequestKeys((previousKeys) =>
            previousKeys.includes(key)
                ? previousKeys.filter((item) => item !== key)
                : [...previousKeys, key]
        );
    };

    const handleInfoUpdateRequest = async () => {
        if (!senior?.id || selectedInfoRequestKeys.length === 0) {
            setInfoRequestStatusMessage("수정을 요청할 항목을 하나 이상 선택해주세요.");
            return;
        }

        const selectedLabels = INFO_UPDATE_REQUEST_GROUPS
            .filter((group) => selectedInfoRequestKeys.includes(group.key))
            .map((group) => group.label);

        const confirmed = window.confirm(`${senior.name}님에게 ${selectedLabels.join(", ")} 정보수정 요청을 보내겠습니까?`);
        if (!confirmed) return;

        try {
            setIsSendingInfoRequest(true);
            setInfoRequestStatusMessage("");

            await requestSeniorInfoUpdate({
                seniorId: senior.id,
                missingFields: selectedLabels,
                toSenior: true,
                toGuardian: false,
            });

            setInfoRequestStatusMessage("사용자에게 정보수정 요청을 보냈습니다.");
            setSelectedInfoRequestKeys([]);
            setIsInfoRequestModalOpen(false);
        } catch (error) {
            console.error("정보수정 요청 전송 실패:", error);
            setInfoRequestStatusMessage("정보수정 요청 전송에 실패했습니다.");
        } finally {
            setIsSendingInfoRequest(false);
        }
    };

    const renderBasicInfo = () => (
        <section className="wsd-detail-section">
            <h2 className="wsd-section-title">기본 정보</h2>

            <div className="wsd-profile-summary-card">
                <div className="wsd-profile-photo-large">
                    {senior.profileImageUrl ? (
                        <img src={resolveUploadUrl(senior.profileImageUrl)} alt={`${senior.name} 프로필`} />
                    ) : (
                        <span>{senior.name?.slice(0, 1) || "?"}</span>
                    )}
                </div>
                <div>
                    <strong>{senior.name}</strong>
                    <span>{formatAgeGender(senior)}</span>
                    <p>{valueOrMissing(detail.address, "주소 미등록")}</p>
                </div>
            </div>

            {renderFields([
                { label: "이름", value: senior.name },
                { label: "생년월일", value: senior.birthDate },
                { label: "성별", value: senior.gender },
                { label: "연락처", value: formatPhoneForDetail(detail.phone) },
                { label: "주소", value: detail.address, wide: true },
                { label: "장애 등급", value: senior.disabilityGrade },
                { label: "장애 유형", value: senior.disabilityType },
                {
                    label: "마지막 접속",
                    value: lastAccessDisplay.main,
                    description: lastAccessDisplay.sub,
                    wide: true,
                },
            ])}
        </section>
    );

    const renderGuardianInfo = () => (
        <section className="wsd-detail-section">
            <div className="wsd-section-title-row">
                <h2 className="wsd-section-title">보호자 정보</h2>
            </div>

            {renderFields([
                { label: "보호자 이름", value: detail.guardianName },
                { label: "보호자 연락처", value: formatPhoneForDetail(detail.guardianPhone) },
                { label: "관계", value: detail.guardianRelation },
                { label: "상담 상태", value: consultRequestStatus },
                { label: "대상자", value: `${senior.name}${senior.age ? ` (${senior.age}세)` : ""}` },
                { label: "대상자 연락처", value: formatPhoneForDetail(detail.phone) },
                { label: "거주 지역", value: detail.address, wide: true },
            ])}

            <div className="wsd-consult-request-panel">
                <div>
                    <strong>보호자 상담 관리</strong>
                    <p>
                        복지 상담 확인이 필요할 때 보호자에게 상담 요청을 보낼 수 있습니다.
                    </p>
                </div>

                <button
                    type="button"
                    className="wsd-consult-request-button"
                    onClick={() => setIsConsultRequestModalOpen(true)}
                    disabled={isSendingConsultRequest}
                >
                    상담 요청 보내기
                </button>
            </div>

            {consultRequestStatusMessage && (
                <p className="wsd-status-message">{consultRequestStatusMessage}</p>
            )}
        </section>
    );

    const renderHealthInfo = () => {
        const hasValue = (value) => value != null && String(value).trim() !== "" && String(value).trim() !== "없음" && String(value).trim() !== "미입력";

        const cautionItems = [
            ["당뇨", healthInfo.diabetes],
            ["고혈압", healthInfo.hypertension],
            ["심장질환", healthInfo.heartDisease],
            ["관절질환", healthInfo.jointDisease],
            ["뇌졸중", healthInfo.stroke],
            ["신장질환", healthInfo.kidneyDisease],
            ["호흡기질환", healthInfo.lungDisease],
            ["간질환", healthInfo.liverDisease],
            ["암", healthInfo.cancer],
            ["보행 보조기구", healthInfo.walkingAid],
            ["기억/판단", healthInfo.dementia],
            ["시야", healthInfo.vision],
            ["청각", healthInfo.hearing],
            ["최근 낙상", healthInfo.recentFall],
            ["수술 이력", healthInfo.hasSurgery],
            ["수술 내용", healthInfo.surgeryDetail],
            ["기타 참고사항", healthInfo.otherDisease],
        ].filter(([, value]) => hasValue(value));

        return (
            <section className="wsd-detail-section">
                <h2 className="wsd-section-title">건강 정보</h2>

                <div className="wsd-health-summary-grid">
                    <article className="wsd-health-summary-card caution">
                        <span>주의 필요</span>
                        <strong>{cautionItems.length}개 항목</strong>
                        <p>{cautionItems.slice(0, 3).map(([label]) => label).join(" · ") || "특이사항 없음"}</p>
                    </article>

                    <article className="wsd-health-summary-card medicine">
                        <span>복약</span>
                        <strong>{medications.length}건 관리 중</strong>
                        <p>{medications.map((item) => item.name || item.medicineName || item.drugName).filter(Boolean).join(" · ") || "등록된 복약 없음"}</p>
                    </article>

                    <article className="wsd-health-summary-card activity">
                        <span>활동 조건</span>
                        <strong>{healthInfo.maxHours ? `하루 ${healthInfo.maxHours}시간 이내` : "미입력"}</strong>
                        <p>{valueOrMissing(healthInfo.maxDistance)}</p>
                    </article>
                </div>

                <div className="wsd-health-block">
                    <h3 className="wsd-inner-panel-title">주의 항목</h3>
                    {cautionItems.length > 0 ? (
                        <div className="wsd-caution-list">
                            {cautionItems.map(([label, value]) => (
                                <article className="wsd-caution-item" key={label}>
                                    <span>{label}</span>
                                    <strong>{valueOrMissing(value)}</strong>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="wsd-empty-panel">등록된 주의 항목이 없습니다.</p>
                    )}
                </div>
            </section>
        );
    };

    const renderSafeZoneInfo = () => (
        <section className="wsd-detail-section">
            <h2 className="wsd-section-title">안심구역 관리</h2>

            <div className="wsd-safezone-layout">
                <div className="wsd-safezone-map-card">
                    <KakaoMap
                        center={safeZoneCenter}
                        safeZone={safeZoneForMap}
                        currentLocation={currentLocationForMap}
                        zoom={5}
                        className="wsd-safezone-map"
                        safeZoneLabel={`${safeZone.placeName || "안심구역"} 중심`}
                        currentLabel="마지막 GPS"
                        fallback={<div className="wsd-map-fallback">지도를 불러오지 못했습니다.</div>}
                    />
                </div>

                <div className="wsd-safezone-summary">
                    {renderFields([
                        { label: "현재 위치", value: detail.currentLocation },
                        { label: "기준 장소명", value: safeZone.placeName },
                        { label: "주소", value: safeZone.address },
                        { label: "반경", value: `${safeZoneRadius}m` },
                        { label: "위치 상태", value: senior.locationStatus },
                        { label: "마지막 GPS", value: formatGps(senior.lastGps), wide: true },
                    ])}
                </div>
            </div>
        </section>
    );

    const renderActiveSection = () => {
        if (activeCategory === "기본 정보") return renderBasicInfo();
        if (activeCategory === "보호자 정보") return renderGuardianInfo();
        if (activeCategory === "건강 정보") return renderHealthInfo();
        if (activeCategory === "안심구역 관리") return renderSafeZoneInfo();

        return null;
    };

    return (
        <div className="wsd-page">
            <WelfareCommonHeader rightText="대상자 상세정보" />

            <main className="wsd-content">
                <div className="wsd-detail-header">
                    <div>
                        <Link to="/welfare" className="wsd-back-link">목록으로</Link>
                        <h1 className="wsd-title">{senior?.name || "대상자 상세정보"}</h1>
                        {senior && (
                            <p className="wsd-sub-text">{formatAgeGender(senior)} / {senior.region}</p>
                        )}
                    </div>
                </div>

                {isLoading && (
                    <div className="wsd-loading-backdrop" role="status" aria-live="polite">
                        <section className="wsd-loading-modal">
                            <div className="wsd-loading-spinner" />
                            <strong>상세정보를 불러오는 중입니다</strong>
                            <span>잠시만 기다려주세요.</span>
                        </section>
                    </div>
                )}
                {message && <p className="wsd-message wsd-message-error">{message}</p>}

                {senior && (
                    <>
                        <div className="wsd-status-group">
                            <span className={getBadgeClass("health", senior.healthStatus)}>{senior.healthStatus}</span>
                            <span className={getBadgeClass("alert", senior.alertStatus)}>{senior.alertStatus}</span>
                            <span className={getBadgeClass("decision", senior.welfareDecision)}>{senior.welfareDecision}</span>
                            <button
                                type="button"
                                className="wsd-small-button"
                                onClick={() => {
                                    setInfoRequestStatusMessage("");
                                    setIsInfoRequestModalOpen(true);
                                }}
                            >
                                정보수정 요청
                            </button>
                        </div>

                        <div className="wsd-category-layout">
                            <nav className="wsd-category-sidebar">
                                <div className="wsd-sidebar-profile-card">
                                    <div className="wsd-sidebar-profile-photo">
                                        {senior.profileImageUrl ? (
                                            <img src={resolveUploadUrl(senior.profileImageUrl)} alt={`${senior.name} 프로필`} />
                                        ) : (
                                            <span>{senior.name?.slice(0, 1) || "?"}</span>
                                        )}
                                    </div>
                                    <strong>{senior.name}</strong>
                                </div>

                                {CATEGORY_LIST.map((category) => (
                                    <button
                                        type="button"
                                        key={category}
                                        className={`wsd-category-item${activeCategory === category ? " wsd-category-item-active" : ""}`}
                                        onClick={() => setActiveCategory(category)}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </nav>

                            <div className="wsd-category-content">
                                {renderActiveSection()}

                                {activeCategory === "전화 및 상담기록" && (
                                    <section className="wsd-detail-section">
                                        <div className="wsd-memo-header">
                                            <div>
                                                <h2 className="wsd-section-title">전화 및 상담기록</h2>
                                            </div>

                                            {!isMemoEditing && (
                                                <button
                                                    type="button"
                                                    className="wsd-small-button"
                                                    onClick={() => {
                                                        setIsMemoEditing(true);
                                                        setMemoStatusMessage("");
                                                    }}
                                                >
                                                    수정
                                                </button>
                                            )}
                                        </div>

                                        <div className="wsd-date-search-row">
                                            <label className="wsd-date-label">
                                                조회 날짜
                                                <input
                                                    type="date"
                                                    value={selectedCounselingDate}
                                                    onChange={(event) => handleCounselingDateChange(event.target.value)}
                                                    className="wsd-date-input"
                                                />
                                            </label>
                                        </div>

                                        {latestConsultRequest?.guardianResponseType && (
                                            <div className="wsd-consult-action-strip">
                                                <div>
                                                    <strong>보호자가 지금 상담 가능합니다</strong>
                                                    <span>필요하면 바로 전화하거나 상담기록을 작성하세요.</span>
                                                </div>

                                                <div className="wsd-consult-action-buttons">
                                                    <a
                                                        className="wsd-call-link-button"
                                                        href={`tel:${String(detail.guardianPhone || "").replace(/\D/g, "")}`}
                                                    >
                                                        전화 걸기
                                                    </a>

                                                    <button
                                                        type="button"
                                                        className="wsd-secondary-action-button"
                                                        onClick={() => {
                                                            const today = new Date().toISOString().slice(0, 10);
                                                            const memo = `${senior.name}님 보호자가 지금 바로 상담 가능하다고 응답했습니다. 보호자 연락처: ${formatPhoneForDetail(detail.guardianPhone)}`;

                                                            setSelectedCounselingDate(today);
                                                            setDraftCounselingMemo(memo);
                                                            setIsMemoEditing(true);
                                                            setMemoStatusMessage("");
                                                        }}
                                                    >
                                                        기록 작성
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {isMemoEditing ? (
                                            <>
                                                <textarea
                                                    value={draftCounselingMemo}
                                                    onChange={(event) => setDraftCounselingMemo(event.target.value)}
                                                    className="wsd-memo-textarea"
                                                    placeholder="전화 및 상담기록을 입력하세요."
                                                />
                                                <div className="wsd-memo-action-row">
                                                    <button
                                                        type="button"
                                                        className="wsd-small-button"
                                                        onClick={handleCounselingMemoSave}
                                                    >
                                                        저장
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="wsd-hold-button"
                                                        onClick={handleCounselingMemoCancel}
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </>
                                        ) : selectedCounselingRecord?.content ? (
                                            <p className="wsd-memo-text">
                                                {selectedCounselingRecord.content}
                                            </p>
                                        ) : null}

                                        {memoStatusMessage && (
                                            <p className="wsd-status-message">{memoStatusMessage}</p>
                                        )}
                                    </section>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>

            {isInfoRequestModalOpen && (
                <div className="wsd-consult-modal-backdrop">
                    <section className="wsd-consult-modal wsd-info-request-modal">
                        <div className="wsd-consult-modal-header">
                            <h3>정보수정 요청</h3>

                            <button
                                type="button"
                                onClick={() => setIsInfoRequestModalOpen(false)}
                                disabled={isSendingInfoRequest}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="wsd-consult-modal-body">
                            <div className="wsd-consult-modal-summary">
                                <span>대상자</span>
                                <strong>{senior.name}</strong>
                                <small>{[formatAgeGender(senior), detail.address].filter(Boolean).join(" · ")}</small>
                            </div>

                            <div className="wsd-info-request-list">
                                {INFO_UPDATE_REQUEST_GROUPS.map((group) => (
                                    <label className="wsd-info-request-option" key={group.key}>
                                        <input
                                            type="checkbox"
                                            checked={selectedInfoRequestKeys.includes(group.key)}
                                            onChange={() => toggleInfoRequestKey(group.key)}
                                        />
                                        <span>
                                            <strong>{group.label}</strong>
                                            <small>{group.fields.join(", ")}</small>
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {infoRequestStatusMessage && (
                                <p className="wsd-status-message">{infoRequestStatusMessage}</p>
                            )}
                        </div>

                        <div className="wsd-consult-modal-actions">
                            <button
                                type="button"
                                onClick={() => setIsInfoRequestModalOpen(false)}
                                disabled={isSendingInfoRequest}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleInfoUpdateRequest}
                                disabled={isSendingInfoRequest || selectedInfoRequestKeys.length === 0}
                            >
                                요청 보내기
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isConsultRequestModalOpen && (
                <div className="wsd-consult-modal-backdrop">
                    <section className="wsd-consult-modal">
                        <div className="wsd-consult-modal-header">
                            <h3>보호자 상담 요청</h3>

                            <button
                                type="button"
                                onClick={() => setIsConsultRequestModalOpen(false)}
                                disabled={isSendingConsultRequest}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="wsd-consult-modal-body">
                            <div className="wsd-consult-modal-summary">
                                <span>보호자</span>
                                <strong>{valueOrMissing(detail.guardianName)}</strong>
                                <small>{formatPhoneForDetail(detail.guardianPhone)} · {valueOrMissing(detail.guardianRelation)}</small>
                            </div>

                            <div className="wsd-consult-modal-summary">
                                <span>대상자</span>
                                <strong>{senior.name}</strong>
                                <small>{[formatAgeGender(senior), detail.address].filter(Boolean).join(" · ")}</small>
                            </div>

                            <label>
                                요청 내용
                                <textarea
                                    value={consultRequestMemo}
                                    onChange={(event) => setConsultRequestMemo(event.target.value)}
                                    placeholder="상담 요청 내용을 입력하세요."
                                />
                            </label>
                        </div>

                        <div className="wsd-consult-modal-actions">
                            <button
                                type="button"
                                onClick={() => setIsConsultRequestModalOpen(false)}
                                disabled={isSendingConsultRequest}
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={handleGuardianConsultRequest}
                                disabled={isSendingConsultRequest}
                            >
                                {isSendingConsultRequest ? "전송 중..." : "요청 보내기"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <WelfarePolicyChatButton senior={senior} />
        </div>
    );
}

export default WelfareSeniorDetail;
