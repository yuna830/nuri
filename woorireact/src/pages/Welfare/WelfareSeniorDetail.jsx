import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
    normalizeSenior,
    applySavedWelfareDecision,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";
import WelfarePolicyQaButton from "../../components/welfare/WelfarePolicyQaButton";
import { fetchWelfareSeniorDetail } from "../../api/welfareDashboardApi";
import KakaoMap from "../../components/KakaoMap";

import "../../css/welfare/WelfareSeniorDetail.css";

const getSavedAddedSeniors = () => [];

const findSavedSenior = (seniorId) =>
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";

const getSavedCounselingRecords = () => {
    try {
        return JSON.parse(localStorage.getItem(COUNSELING_RECORDS_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
};

const findWelfareDemoCounselingRecords = () => [];

const saveWelfareDecision = (seniorId, decision, reason) => {
    const savedDecisionDetails = JSON.parse(localStorage.getItem("welfareDecisionDetails") || "{}");

    localStorage.setItem(
        "welfareDecisionDetails",
        JSON.stringify({
            ...savedDecisionDetails,
            [seniorId]: {
                decision,
                reason,
            },
        })
    );
};

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

const splitCsv = (value) => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
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

const formatBmi = (height, weight) => {
    const heightNumber = Number(height);
    const weightNumber = Number(weight);

    if (!heightNumber || !weightNumber) {
        return "미입력";
    }

    const bmi = weightNumber / ((heightNumber / 100) ** 2);
    return bmi.toFixed(1);
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
    
    const CATEGORY_LIST = ["기본 정보", "보호자 정보", "건강 정보", "안심구역 관리", "전화 및 상담기록"];
    const HEALTH_CATEGORY_LIST = ["신체 정보", "질환/주의 항목"];
    
    const initialCategory = CATEGORY_LIST.includes(location.state?.category)
        ? location.state.category
        : "기본 정보";
    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [activeHealthCategory, setActiveHealthCategory] = useState("신체 정보");

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

    const selectedCounselingRecord = useMemo(
        () => counselingRecords.find((record) => record.date === selectedCounselingDate),
        [counselingRecords, selectedCounselingDate]
    );

    const detail = getDetail(senior);
    const lastAccessDisplay = formatLastAccessForDetail(senior?.lastAccess);
    const healthInfo = senior?.healthInfo || {};
    const medications = readMedications(healthInfo);
    const jobPreference = senior?.jobPreference || {};
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
    const disabledWork = splitCsv(healthInfo.disabledWork);
    const hopeDays = splitCsv(jobPreference.hopeDays);
    const hopeJobType = splitCsv(jobPreference.hopeJobType);
    const hopeCondition = splitCsv(jobPreference.hopeCondition);

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

        const nextContent = draftCounselingMemo.trim() || "전화 및 상담기록이 없습니다.";
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

    const getDecisionButtonClass = (decision) =>
        `wsd-decision-option-button wsd-decision-${decision === "적합" ? "fit" : decision === "보류" ? "hold" : "reject"}${draftDecision === decision ? " wsd-decision-active" : ""}`;

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

    const renderChipGroup = (label, values) => {
        const list = splitCsv(values);

        return (
            <div className="wsd-chip-group" key={label}>
                <span>{label}</span>
                <div>
                    {list.length > 0 ? (
                        list.map((value) => <strong key={`${label}-${value}`}>{value}</strong>)
                    ) : (
                        <strong className="wsd-chip-muted">미입력</strong>
                    )}
                </div>
            </div>
        );
    };

    const isVisibleHealthItem = (value) => {
        const text = String(value || "").trim();
        return text && !["없음", "미입력", "해당 없음", "아니오", "무"].includes(text);
    };

    const renderImportantHealthItems = (items) => {
        const visibleItems = items.filter(([, value]) => isVisibleHealthItem(value));

        if (visibleItems.length === 0) {
            return <p className="wsd-empty-panel">주의가 필요한 건강 항목이 없습니다.</p>;
        }

        return renderFields(
            visibleItems.map(([label, value]) => ({
                label,
                value,
                wide: true,
            }))
        );
    };

    const renderBasicInfo = () => (
        <section className="wsd-detail-section">
            <h2 className="wsd-section-title">기본 정보</h2>

            <div className="wsd-profile-summary-card">
                <div className="wsd-profile-photo-large">
                    {senior.profileImageUrl ? (
                        <img src={senior.profileImageUrl} alt={`${senior.name} 프로필`} />
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
            <h2 className="wsd-section-title">보호자 정보</h2>
            {renderFields([
                { label: "보호자 이름", value: detail.guardianName },
                { label: "보호자 연락처", value: formatPhoneForDetail(detail.guardianPhone) },
                { label: "관계", value: detail.guardianRelation },
            ])}
        </section>
    );

    const renderHealthInfo = () => {
        const chronicItems = [
            ["당뇨", healthInfo.diabetes],
            ["고혈압", healthInfo.hypertension],
            ["심장질환", healthInfo.heartDisease],
            ["관절질환", healthInfo.jointDisease],
            ["뇌졸중", healthInfo.stroke],
            ["신장질환", healthInfo.kidneyDisease],
            ["호흡기질환", healthInfo.lungDisease],
            ["간질환", healthInfo.liverDisease],
            ["암", healthInfo.cancer],
        ];

        const mobilityItems = [
            ["보행 보조기구", healthInfo.walkingAid],
            ["치매/인지 어려움", healthInfo.dementia],
            ["시력 어려움", healthInfo.vision],
            ["청력 어려움", healthInfo.hearing],
            ["최근 낙상 경험", healthInfo.recentFall],
            ["수술 이력", healthInfo.hasSurgery],
        ];

        return (
            <section className="wsd-detail-section">
                <h2 className="wsd-section-title">건강 정보</h2>

                <div className="wsd-inner-tab-list">
                    {HEALTH_CATEGORY_LIST.map((category) => (
                        <button
                            type="button"
                            key={category}
                            className={`wsd-inner-tab${activeHealthCategory === category ? " wsd-inner-tab-active" : ""}`}
                            onClick={() => setActiveHealthCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {activeHealthCategory === "신체 정보" && (
                    <div className="wsd-inner-panel">
                        {renderFields([
                            ["키", healthInfo.height ? `${healthInfo.height}cm` : ""],
                            ["몸무게", healthInfo.weight ? `${healthInfo.weight}kg` : ""],
                            ["BMI", formatBmi(healthInfo.height, healthInfo.weight)],
                            ["흡연", healthInfo.smoking],
                            ["음주", healthInfo.drinking],
                            ["알레르기", healthInfo.allergies],
                        ].map(([label, value]) => ({ label, value })))}

                        <div className="wsd-health-activity-section">
                            <h3 className="wsd-inner-panel-title">활동 조건</h3>

                            <div className="wsd-activity-condition-panel">
                                <div className="wsd-activity-range">
                                    <div>
                                        <span>하루 최대 활동 시간</span>
                                        <strong>{healthInfo.maxHours ? `${healthInfo.maxHours}시간 이내` : "미입력"}</strong>
                                    </div>

                                    <div>
                                        <span>이동 가능 거리</span>
                                        <strong>{valueOrMissing(healthInfo.maxDistance)}</strong>
                                    </div>
                                </div>

                                <div className="wsd-activity-limits">
                                    <span>하기 어려운 작업</span>
                                    <strong>
                                        {splitCsv(disabledWork).length > 0
                                            ? splitCsv(disabledWork).join(" · ")
                                            : "미입력"}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeHealthCategory === "질환/주의 항목" && (
                    <div className="wsd-inner-panel">
                        {renderImportantHealthItems([
                            ...chronicItems,
                            ...mobilityItems,
                            ["수술 내용", healthInfo.surgeryDetail],
                            ["기타 건강 참고사항", healthInfo.otherDisease],
                        ])}

                        <div className="wsd-medication-section">
                            <h3 className="wsd-inner-panel-title">복약 정보</h3>

                            <div className="wsd-medication-list">
                                {medications.length > 0 ? (
                                    medications.map((medicine, index) => (
                                        <article className="wsd-medication-card" key={`${medicine.name || "medicine"}-${index}`}>
                                            <div>
                                                <strong>{valueOrMissing(medicine.name || medicine.medicineName || medicine.drugName)}</strong>
                                            </div>

                                            <dl>
                                                <div>
                                                    <dt>시작일</dt>
                                                    <dd>{valueOrMissing(medicine.startDate)}</dd>
                                                </div>
                                                <div>
                                                    <dt>간격</dt>
                                                    <dd>{medicine.intervalHours ? `${medicine.intervalHours}시간` : valueOrMissing(medicine.interval)}</dd>
                                                </div>
                                                <div>
                                                    <dt>하루 횟수</dt>
                                                    <dd>{valueOrMissing(medicine.timesPerDay || medicine.dailyCount)}</dd>
                                                </div>
                                            </dl>
                                        </article>
                                    ))
                                ) : (
                                    <p className="wsd-empty-panel">등록된 복약 정보가 없습니다.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
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
            <header className="wsd-header">
                <div className="wsd-brand-area">
                    <Link to="/welfare" className="wsd-service-name">우리 woori</Link>
                </div>

                <div className="wsd-header-title">대상자 상세정보</div>
            </header>

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
                        </div>

                        <div className="wsd-category-layout">
                            <nav className="wsd-category-sidebar">
                                <div className="wsd-sidebar-profile-card">
                                    <div className="wsd-sidebar-profile-photo">
                                        {senior.profileImageUrl ? (
                                            <img src={senior.profileImageUrl} alt={`${senior.name} 프로필`} />
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
                                        ) : (
                                            <p className="wsd-memo-text">
                                                {selectedCounselingRecord?.content || "해당 날짜의 전화 및 상담기록이 없습니다."}
                                            </p>
                                        )}

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

            <WelfarePolicyQaButton senior={senior} />
        </div>
    );
}

export default WelfareSeniorDetail;
