import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
    normalizeSenior,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";
import {
    fetchWelfareSeniorDetail,
    getCachedWelfareSeniorById,
} from "../../api/welfareDashboardApi";
import { sendWelfareSeniorAlert } from "../../api/welfareAlertApi";
import WelfarePolicyQaButton from "../../components/welfare/WelfarePolicyQaButton";


import "../../css/welfare/WelfareSeniorDetail.css";

const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";
const WELFARE_DECISIONS_STORAGE_KEY = "welfareDecisions";
const WELFARE_DECISION_DETAILS_STORAGE_KEY = "welfareDecisionDetails";
const PROFILE_UPDATE_SECTION_OPTIONS = [
    { id: "personal", label: "인적사항" },
    { id: "body", label: "신체정보/알레르기" },
    { id: "medication", label: "복약정보" },
    { id: "chronic", label: "만성질환" },
    { id: "mobility", label: "거동/인지" },
    { id: "activity", label: "활동 조건" },
    { id: "job", label: "일자리 희망 조건" },
];

const getSavedAddedSeniors = () => [];

const findSavedSenior = (seniorId) =>
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

const readJsonStorage = (key, fallbackValue = {}) => {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        return saved && typeof saved === "object" ? saved : fallbackValue;
    } catch {
        return fallbackValue;
    }
};

const getSavedCounselingRecords = () => readJsonStorage(COUNSELING_RECORDS_STORAGE_KEY);

const findWelfareDemoCounselingRecords = (seniorId) => [
    {
        id: `${seniorId}-${new Date().toISOString().slice(0, 10)}`,
        date: new Date().toISOString().slice(0, 10),
        content: "아직 등록된 상담 기록이 없습니다.",
    },
];

const saveWelfareDecision = (seniorId, decision, reason = "") => {
    const savedDecisions = readJsonStorage(WELFARE_DECISIONS_STORAGE_KEY);
    const savedDetails = readJsonStorage(WELFARE_DECISION_DETAILS_STORAGE_KEY);

    localStorage.setItem(
        WELFARE_DECISIONS_STORAGE_KEY,
        JSON.stringify({
            ...savedDecisions,
            [seniorId]: decision,
        })
    );

    localStorage.setItem(
        WELFARE_DECISION_DETAILS_STORAGE_KEY,
        JSON.stringify({
            ...savedDetails,
            [seniorId]: { decision, reason },
        })
    );
};

const unwrapSeniorDetail = (data) => {
    if (!data) return null;
    if (data.senior) return data.senior;
    if (data.profile?.senior) return data.profile.senior;
    return data;
};

const applySavedWelfareDecisionSafe = (target) => {
    if (!target) return target;

    const savedDecisions = readJsonStorage(WELFARE_DECISIONS_STORAGE_KEY);
    const savedDecisionDetails = readJsonStorage(WELFARE_DECISION_DETAILS_STORAGE_KEY);
    const savedDetail = savedDecisionDetails[target.id];
    const savedDecision = savedDetail?.decision || savedDecisions[target.id];

    return normalizeSenior({
        ...target,
        welfareDecision: savedDecision || target.welfareDecision,
        jobMatchingStatus: savedDecision || target.jobMatchingStatus,
        welfareDecisionReason: savedDetail?.reason ?? target.welfareDecisionReason,
    });
};

function WelfareSeniorDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const initialSenior = location.state?.senior || getCachedWelfareSeniorById(id) || null;
    const [senior, setSenior] = useState(initialSenior ? normalizeSenior(initialSenior) : null);
    const [isLoading, setIsLoading] = useState(!initialSenior);
    const [message, setMessage] = useState("");
    const [counselingRecords, setCounselingRecords] = useState([]);
    const [selectedCounselingDate, setSelectedCounselingDate] = useState("");
    const [draftCounselingMemo, setDraftCounselingMemo] = useState("");
    const [isMemoEditing, setIsMemoEditing] = useState(false);
    const [memoStatusMessage, setMemoStatusMessage] = useState("");
    const [draftDecision, setDraftDecision] = useState("미검토");
    const [draftRejectionReason, setDraftRejectionReason] = useState("");
    const [decisionStatusMessage, setDecisionStatusMessage] = useState("");
    const [isSendingWelfareAlert, setIsSendingWelfareAlert] = useState(false);
    const [welfareAlertStatusMessage, setWelfareAlertStatusMessage] = useState("");
    const [profileRequestSection, setProfileRequestSection] = useState(PROFILE_UPDATE_SECTION_OPTIONS[0].id);
    const initialCategory = location.state?.category === "복지사 소견"
        ? "일자리 요청 상태"
        : location.state?.category || "기본 정보";
    const [activeCategory, setActiveCategory] = useState(initialCategory);

    const CATEGORY_LIST = ["기본 정보", "보호자 정보", "건강 정보", "안심구역 관리", "일자리 요청 상태", "전화 및 상담기록"];

    const applyLoadedSenior = (loadedSenior) => {
        const unwrappedSenior = unwrapSeniorDetail(loadedSenior);
        if (!unwrappedSenior) {
            setMessage("대상자 상세정보를 불러오지 못했습니다.");
            return;
        }

        const previousSenior = senior || location.state?.senior || getCachedWelfareSeniorById(id) || {};
        const nextSenior = applySavedWelfareDecisionSafe({
            ...previousSenior,
            ...unwrappedSenior,
        });
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
        setDraftDecision(nextSenior.welfareDecision || "미검토");
        setDraftRejectionReason(nextSenior.welfareDecisionReason || "");
        setDecisionStatusMessage("");
        setCounselingRecords(sortedRecords);
        setSelectedCounselingDate(firstDate);
        setDraftCounselingMemo(firstRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    useEffect(() => {
        let ignore = false;

        const loadSenior = async () => {
            try {
                setIsLoading(true);
                setMessage("");

                const data = await fetchWelfareSeniorDetail(id);

                if (!ignore) {
                    applyLoadedSenior(data);
                }
            } catch {
                if (!ignore) {
                    const fallbackSenior = location.state?.senior || getCachedWelfareSeniorById(id) || findSavedSenior(id);

                    if (fallbackSenior) {
                        applyLoadedSenior(fallbackSenior);
                    } else {
                        setMessage("대상자 상세정보를 불러오지 못했습니다.");
                    }
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
    const detailSections = senior
        ? [
            {
                title: "기본 정보",
                items: [
                    { label: "이름", value: senior.name },
                    { label: "나이/성별", value: formatAgeGender(senior) },
                    { label: "연락처", value: detail.phone },
                    { label: "주소", value: detail.address },
                    { label: "마지막 접속", value: senior.lastAccess || "기록 없음" },
                ],
            },
            {
                title: "보호자 정보",
                items: [
                    { label: "보호자 이름", value: detail.guardianName },
                    { label: "보호자 연락처", value: detail.guardianPhone },
                    { label: "관계", value: detail.guardianRelation },
                ],
            },
            {
                title: "건강 정보",
                items: [
                    { label: "건강 상태", value: senior.healthStatus },
                    { label: "기저질환", value: detail.diseaseInfo },
                    { label: "보행 가능 여부", value: detail.walkingStatus },
                    { label: "근무 가능 시간", value: senior.preferredWorkTime },
                ],
            },
            {
                title: "안심구역 관리",
                items: [
                    { label: "현재 위치", value: detail.currentLocation },
                    { label: "기준 장소명", value: senior.safeZone.placeName },
                    { label: "반경", value: `${senior.safeZone.radiusMeter}m` },
                    { label: "위치 상태", value: senior.locationStatus },
                    { label: "마지막 GPS", value: formatGps(senior.lastGps) },
                ],
            },
            {
                title: "일자리 요청 상태",
                items: [
                    { label: "요청 건수", value: senior.jobRequestStatus },
                    { label: "검토 여부", value: senior.workRequestStatus },
                    { label: "적합 여부", value: senior.welfareDecision },
                    { label: "부적합 사유", value: senior.welfareDecisionReason || "등록된 사유 없음" },
                ],
            },
        ]
        : [];

    async function handleDecisionSave() {
        const reason = draftDecision === "부적합" ? draftRejectionReason.trim() : "";

        if (draftDecision === "부적합" && !reason) {
            setDecisionStatusMessage("부적합일 경우 사유를 입력해주세요.");
            return;
        }

        try {
            setDecisionStatusMessage("");

            const response = await fetch(`/api/seniors/${id}/decision`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    decision: draftDecision,
                    reason,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to update decision");
            }

            const updatedSenior = await response.json();
            saveWelfareDecision(id, draftDecision, reason);
            setSenior(applySavedWelfareDecisionSafe({
                ...updatedSenior,
                workRequestStatus: "검토",
                jobMatchingStatus: draftDecision,
                welfareDecision: draftDecision,
                welfareDecisionReason: reason,
            }));
        } catch {
            saveWelfareDecision(id, draftDecision, reason);
            setSenior((currentSenior) => (
                currentSenior
                    ? normalizeSenior({
                        ...currentSenior,
                        workRequestStatus: "검토",
                        jobMatchingStatus: draftDecision,
                        welfareDecision: draftDecision,
                        welfareDecisionReason: reason,
                    })
                    : currentSenior
            ));
        }

        setDecisionStatusMessage(
            draftDecision === "부적합"
                ? "부적합 사유가 일자리 요청 상태에 반영되었습니다."
                : "판정 정보가 일자리 요청 상태에 저장되었습니다."
        );
    }

    const handleSendWelfareAlert = async (kind) => {
        if (!senior || isSendingWelfareAlert) return;

        const selectedProfileSection = PROFILE_UPDATE_SECTION_OPTIONS.find(
            (option) => option.id === profileRequestSection
        ) || PROFILE_UPDATE_SECTION_OPTIONS[0];

        const alertPayload = kind === "profile"
            ? {
                type: "PROFILE_UPDATE_REQUEST",
                title: `${selectedProfileSection.label} 수정 요청`,
                message: `${senior.name}님, 담당 복지사가 ${selectedProfileSection.label} 확인 및 수정을 요청했습니다.`,
                extra: {
                    profileSection: selectedProfileSection.id,
                    profileSectionLabel: selectedProfileSection.label,
                },
            }
            : {
                type: "WELFARE_REQUEST",
                title: "복지사 상담 요청",
                message: `${senior.name}님, 담당 복지사가 상담 확인을 요청했습니다.`,
            };

        try {
            setIsSendingWelfareAlert(true);
            setWelfareAlertStatusMessage("");

            await sendWelfareSeniorAlert({
                seniorId: senior.id,
                ...alertPayload,
            });

            setWelfareAlertStatusMessage("사용자 알림으로 요청을 보냈습니다.");
        } catch {
            setWelfareAlertStatusMessage("요청 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsSendingWelfareAlert(false);
        }
    };

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

        const targetName = target.name || "대상자";
        const targetInitial = targetName.slice(0, 1) || "대";
        const targetId = target.id ?? id ?? "";

        return {
            phone: target.phone || `010-1000-${String(targetId).padStart(4, "0")}`,
            address: target.region || target.address || "주소 미입력",
            guardianName: target.guardianName || `${targetInitial}보호자`,
            guardianPhone: target.guardianPhone || `010-2000-${String(targetId).padStart(4, "0")}`,
            guardianRelation: target.gender === "여성" ? "자녀" : "배우자",
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

    return (
        <div className="wsd-page">
            <header className="wsd-header">
                <div className="wsd-brand-area">
                    <button
                        type="button"
                        className="wsd-service-name"
                        onClick={() => navigate("/welfare")}
                    >
                        우리 woori
                    </button>
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

                    {senior && (
                        <div className="wsd-request-panel">
                            <div className="wsd-request-title">사용자에게 요청 보내기</div>
                            <label className="wsd-request-field">
                                <span>수정 요청 항목</span>
                                <select
                                    value={profileRequestSection}
                                    onChange={(event) => setProfileRequestSection(event.target.value)}
                                    disabled={isSendingWelfareAlert}
                                >
                                    {PROFILE_UPDATE_SECTION_OPTIONS.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="wsd-request-button-row">
                                <button
                                    type="button"
                                    className="wsd-request-button"
                                    onClick={() => handleSendWelfareAlert("profile")}
                                    disabled={isSendingWelfareAlert}
                                >
                                    정보 수정 요청
                                </button>
                                <button
                                    type="button"
                                    className="wsd-request-button wsd-request-button-secondary"
                                    onClick={() => handleSendWelfareAlert("counseling")}
                                    disabled={isSendingWelfareAlert}
                                >
                                    상담 요청
                                </button>
                            </div>
                            {welfareAlertStatusMessage && (
                                <p className="wsd-request-message">{welfareAlertStatusMessage}</p>
                            )}
                        </div>
                    )}
                </div>

                {isLoading && <p className="wsd-message">상세정보를 불러오는 중입니다.</p>}
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
                                {detailSections
                                    .filter((section) => section.title === activeCategory)
                                    .map((section) => (
                                        <section key={section.title} className="wsd-detail-section">
                                            <h2 className="wsd-section-title">{section.title}</h2>

                                            <div className="wsd-section-fields">
                                                {section.items.map((item) => (
                                                    <div
                                                        key={`${section.title}-${item.label}`}
                                                        className="wsd-detail-row"
                                                    >
                                                        <span className="wsd-detail-label">{item.label}</span>
                                                        {item.label === "검토 여부" ? (
                                                            <strong className={`wsd-detail-value ${senior.workRequestStatus === "검토" ? "wsd-review-complete" : "wsd-review-pending"}`}>
                                                                {senior.workRequestStatus}
                                                            </strong>
                                                        ) : (
                                                            <strong className="wsd-detail-value">{item.value}</strong>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {section.title === "일자리 요청 상태" && (
                                                <>
                                                    <div className="wsd-decision-option-row">
                                                        {["적합", "보류", "부적합"].map((decision) => (
                                                            <button
                                                                type="button"
                                                                key={decision}
                                                                className={getDecisionButtonClass(decision)}
                                                                onClick={() => setDraftDecision(decision)}
                                                            >
                                                                {decision}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {draftDecision === "부적합" && (
                                                        <textarea
                                                            value={draftRejectionReason}
                                                            onChange={(event) => setDraftRejectionReason(event.target.value)}
                                                            className="wsd-reason-textarea"
                                                            placeholder="부적합 사유를 입력해주세요."
                                                        />
                                                    )}

                                                    <div className="wsd-memo-action-row">
                                                        <button
                                                            type="button"
                                                            className="wsd-small-button"
                                                            onClick={handleDecisionSave}
                                                        >
                                                            판정 저장
                                                        </button>
                                                    </div>

                                                    {decisionStatusMessage && (
                                                        <p className="wsd-status-message">{decisionStatusMessage}</p>
                                                    )}

                                                    <div className="wsd-job-action-row">
                                                        {senior.workRequestStatus === "미검토" && (
                                                            <button
                                                                type="button"
                                                                className="wsd-review-save-button"
                                                                onClick={() => {
                                                                    setSenior((prev) => ({ ...prev, workRequestStatus: "검토" }));
                                                                    const savedReviews = JSON.parse(localStorage.getItem("welfareWorkRequestStatus") || "{}");
                                                                    savedReviews[senior.id] = "검토";
                                                                    localStorage.setItem("welfareWorkRequestStatus", JSON.stringify(savedReviews));
                                                                }}
                                                            >
                                                                검토 완료
                                                            </button>
                                                        )}

                                                        <Link
                                                            to={`/welfare/seniors/${senior.id}/jobs`}
                                                            className="wsd-job-link-button"
                                                        >
                                                            추천 공고 보기
                                                        </Link>

                                                        <Link
                                                            to="/welfare/jobs"
                                                            className="wsd-secondary-job-link-button"
                                                        >
                                                            전체 공고 보기
                                                        </Link>
                                                    </div>
                                                </>
                                            )}
                                        </section>
                                    ))}

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
