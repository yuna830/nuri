import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
    findWelfareDemoCounselingRecords,
    findWelfareDemoSenior,
} from "../../data/welfareSeniorDemoData";
import {
    normalizeSenior,
    applySavedWelfareDecision,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";

import "../../css/welfare/WelfareSeniorDetail.css";

const findSavedSenior = (seniorId) =>
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

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
    const [draftDecision, setDraftDecision] = useState("미검토");
    const [draftRejectionReason, setDraftRejectionReason] = useState("");
    const [decisionStatusMessage, setDecisionStatusMessage] = useState("");
    const initialCategory = location.state?.category === "복지사 소견"
        ? "일자리 요청 상태"
        : location.state?.category || "기본 정보";
    const [activeCategory, setActiveCategory] = useState(initialCategory);

    const CATEGORY_LIST = ["기본 정보", "보호자 정보", "건강 정보", "안심구역 관리", "일자리 요청 상태", "전화 및 상담기록"];

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

                const response = await fetch(`${WELFARE_SENIOR_API_URL}/${id}`);

                if (!response.ok) {
                    throw new Error("Failed to load senior");
                }

                const data = await response.json();

                if (!ignore) {
                    applyLoadedSenior(data);
                }
            } catch {
                if (!ignore) {
                    const fallbackSenior = findSavedSenior(id) || findWelfareDemoSenior(id);

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

            const response = await fetch(`${WELFARE_SENIOR_API_URL}/${id}/decision`, {
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
            setSenior(applySavedWelfareDecision({
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
            phone: target.phone || `010-1000-${String(target.id).padStart(4, "0")}`,
            address: target.region,
            guardianName: `${target.name[0]}보호자`,
            guardianPhone: `010-2000-${String(target.id).padStart(4, "0")}`,
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
                    <strong className="wsd-service-name">우리 woori</strong>
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
        </div>
    );
}

export default WelfareSeniorDetail;
