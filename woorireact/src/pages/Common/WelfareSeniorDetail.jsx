import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
    findWelfareDemoCounselingRecords,
    findWelfareDemoSenior,
} from "../../data/welfareSeniorDemoData";
import { WELFARE_SENIOR_API_URL, COUNSELING_RECORDS_STORAGE_KEY } from "../../utils/welfare/welfareConstants";
import { getSavedAddedSeniors, getSavedCounselingRecords, saveWelfareDecision } from "../../utils/welfare/welfareStorage";
import {
    normalizeSenior,
    applySavedWelfareDecision,
    formatAgeGender,
    formatGps,
} from "../../utils/welfare/welfareSenior";
import WelfareHeader from "./WelfareHeader";

const DECISION_COLORS = {
    "적합" : {
        backgroundColor : "#e8f3ea",
        borderColor : "#86a788",
        color : "#3f6b45",
        activeBackgroundColor : "#86a788",
        activeColor : "#ffffff",
    },
    "보류" : {
        backgroundColor : "#fff5d6",
        borderColor : "#e0b13f",
        color : "#725214",
        activeBackgroundColor : "#f0c24d",
        activeColor : "#3e2d06",
    },
    "부적합" : {
        backgroundColor : "#ffe8e8",
        borderColor : "#d86969",
        color : "#9a3535",
        activeBackgroundColor : "#d86969",
        activeColor : "#ffffff",
    },
};

const findSavedSenior = (seniorId) =>
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

function WelfareSeniorDetail(){
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
                title : "기본 정보",
                items : [
                    { label : "이름", value : senior.name },
                    { label : "나이/성별", value : formatAgeGender(senior) },
                    { label : "연락처", value : detail.phone },
                    { label : "주소", value : detail.address },
                    { label : "마지막 접속", value : senior.lastAccess || "기록 없음" },
                ],
            },
            {
                title : "보호자 정보",
                items : [
                    { label : "보호자 이름", value : detail.guardianName },
                    { label : "보호자 연락처", value : detail.guardianPhone },
                    { label : "관계", value : detail.guardianRelation },
                ],
            },
            {
                title : "건강 정보",
                items : [
                    { label : "건강 상태", value : senior.healthStatus },
                    { label : "기저질환", value : detail.diseaseInfo },
                    { label : "보행 가능 여부", value : detail.walkingStatus },
                    { label : "근무 가능 시간", value : senior.preferredWorkTime },
                ],
            },
            {
                title : "안심구역 관리",
                items : [
                    { label : "현재 위치", value : detail.currentLocation },
                    { label : "기준 장소명", value : senior.safeZone.placeName },
                    { label : "반경", value : `${senior.safeZone.radiusMeter}m` },
                    { label : "위치 상태", value : senior.locationStatus },
                    { label : "마지막 GPS", value : formatGps(senior.lastGps) },
                ],
            },
            {
                title : "일자리 요청 상태",
                items : [
                    { label : "요청 건수", value : senior.jobRequestStatus },
                    { label : "검토 여부", value : senior.workRequestStatus },
                    { label : "적합 여부", value : senior.welfareDecision },
                    { label : "부적합 사유", value : senior.welfareDecisionReason || "등록된 사유 없음" },
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
                method : "PATCH",
                headers : {
                    "Content-Type" : "application/json",
                },
                body : JSON.stringify({
                    decision : draftDecision,
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
                workRequestStatus : "검토",
                jobMatchingStatus : draftDecision,
                welfareDecision : draftDecision,
                welfareDecisionReason : reason,
            }));
        } catch {
            saveWelfareDecision(id, draftDecision, reason);
            setSenior((currentSenior) => (
                currentSenior
                    ? normalizeSenior({
                        ...currentSenior,
                        workRequestStatus : "검토",
                        jobMatchingStatus : draftDecision,
                        welfareDecision : draftDecision,
                        welfareDecisionReason : reason,
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
                id : `${senior.id}-${selectedCounselingDate}`,
                date : selectedCounselingDate,
                content : nextContent,
            },
            ...counselingRecords.filter((record) => record.date !== selectedCounselingDate),
        ].sort((a, b) => b.date.localeCompare(a.date));
        const savedRecords = getSavedCounselingRecords();

        localStorage.setItem(
            COUNSELING_RECORDS_STORAGE_KEY,
            JSON.stringify({
                ...savedRecords,
                [senior.id] : nextRecords,
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
            phone : target.phone || `010-1000-${String(target.id).padStart(4, "0")}`,
            address : target.region,
            guardianName : `${target.name[0]}보호자`,
            guardianPhone : `010-2000-${String(target.id).padStart(4, "0")}`,
            guardianRelation : target.gender === "여성" ? "자녀" : "배우자",
            diseaseInfo : target.healthStatus === "위험" ? "고혈압 / 당뇨" : target.healthStatus === "주의" ? "관절 통증" : "특이사항 없음",
            walkingStatus : target.healthStatus === "위험" ? "장시간 보행 어려움" : target.healthStatus === "주의" ? "짧은 거리 보행 가능" : "보행 가능",
            currentLocation : target.locationStatus === "안전구역 이탈" ? "안심구역 외부" : "안심구역 내부",
        };
    }

    const getBadgeStyle = (type, value) => {
        const badgeColors = {
            health : {
                "양호" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "주의" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "위험" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
            decision : {
                "미검토" : { backgroundColor : "#eeeeee", color : "#555" },
                "검토중" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "적합" : {
                    backgroundColor : DECISION_COLORS["적합"].backgroundColor,
                    color : DECISION_COLORS["적합"].color,
                },
                "보류" : {
                    backgroundColor : DECISION_COLORS["보류"].backgroundColor,
                    color : DECISION_COLORS["보류"].color,
                },
                "부적합" : {
                    backgroundColor : DECISION_COLORS["부적합"].backgroundColor,
                    color : DECISION_COLORS["부적합"].color,
                },
            },
            request : {
                "검토" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "미검토" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
            },
            alert : {
                "없음" : { backgroundColor : "#eeeeee", color : "#555" },
                "SOS 요청" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
                "일자리 요청" : { backgroundColor : "#dff3ff", color : "#176b92" },
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

    const getDecisionOptionButtonStyle = (decision, isActive) => {
        const colors = DECISION_COLORS[decision] || DECISION_COLORS["적합"];

        return {
            ...styles.decisionOptionButton,
            borderColor : colors.borderColor,
            backgroundColor : isActive ? colors.activeBackgroundColor : colors.backgroundColor,
            color : isActive ? colors.activeColor : colors.color,
            boxShadow : isActive ? "0 4px 10px rgba(0, 0, 0, 0.08)" : "none",
        };
    };

    return (
        <div style = {styles.page}>
            <WelfareHeader pageName = "대상자 상세정보" />

            <main style = {styles.content}>
                <div style = {styles.detailHeader}>
                    <div>
                        <Link to = "/welfare" style = {styles.backLink}>목록으로</Link>
                        <h1 style = {styles.title}>{senior?.name || "대상자 상세정보"}</h1>
                        {senior && (
                            <p style = {styles.subText}>{formatAgeGender(senior)} / {senior.region}</p>
                        )}
                    </div>
                </div>

                {isLoading && <p style = {styles.message}>상세정보를 불러오는 중입니다.</p>}
                {message && <p style = {{ ...styles.message, color : "#b66b6b" }}>{message}</p>}

                {senior && (
                    <>
                        <div style = {styles.statusGroup}>
                            <span style = {getBadgeStyle("health", senior.healthStatus)}>{senior.healthStatus}</span>
                            <span style = {getBadgeStyle("alert", senior.alertStatus)}>{senior.alertStatus}</span>
                            <span style = {getBadgeStyle("decision", senior.welfareDecision)}>{senior.welfareDecision}</span>
                        </div>

                        <div style = {styles.categoryLayout}>
                            <nav style = {styles.categorySidebar}>
                                {CATEGORY_LIST.map((category) => (
                                    <button
                                        type = "button"
                                        key = {category}
                                        style = {{
                                            ...styles.categoryItem,
                                            ...(activeCategory === category ? styles.activeCategoryItem : {}),
                                        }}
                                        onClick = {() => setActiveCategory(category)}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </nav>

                            <div style = {styles.categoryContent}>
                                {detailSections
                                    .filter((section) => section.title === activeCategory)
                                    .map((section) => (
                                        <section
                                            key = {section.title}
                                            style = {styles.detailSection}
                                        >
                                            <h2 style = {styles.sectionTitle}>{section.title}</h2>
                                            <div style = {styles.sectionFields}>
                                                {section.items.map((item) => (
                                                    <div
                                                        key = {`${section.title}-${item.label}`}
                                                        style = {styles.detailRow}
                                                    >
                                                        <span style = {styles.detailLabel}>{item.label}</span>
                                                        {item.label === "검토 여부" ? (
                                                            <strong style = {{
                                                                ...styles.detailValue,
                                                                color : senior.workRequestStatus === "검토" ? "#4a7c4f" : "#e05252",
                                                            }}>
                                                                {senior.workRequestStatus}
                                                            </strong>
                                                        ) : (
                                                            <strong style = {styles.detailValue}>{item.value}</strong>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {section.title === "일자리 요청 상태" && (
                                                <>
                                                    <div style = {styles.decisionOptionRow}>
                                                        {["적합", "보류", "부적합"].map((decision) => (
                                                            <button
                                                                type = "button"
                                                                key = {decision}
                                                                style = {getDecisionOptionButtonStyle(decision, draftDecision === decision)}
                                                                onClick = {() => setDraftDecision(decision)}
                                                            >
                                                                {decision}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {draftDecision === "부적합" && (
                                                        <textarea
                                                            value = {draftRejectionReason}
                                                            onChange = {(event) => setDraftRejectionReason(event.target.value)}
                                                            style = {styles.reasonTextarea}
                                                            placeholder = "부적합 사유를 입력해주세요."
                                                        />
                                                    )}

                                                    <div style = {styles.memoActionRow}>
                                                        <button
                                                            type = "button"
                                                            style = {styles.smallButton}
                                                            onClick = {handleDecisionSave}
                                                        >
                                                            판정 저장
                                                        </button>
                                                    </div>

                                                    {decisionStatusMessage && (
                                                        <p style = {styles.memoStatusMessage}>{decisionStatusMessage}</p>
                                                    )}

                                                    <div style = {styles.jobActionRow}>
                                                        {senior.workRequestStatus === "미검토" && (
                                                            <button
                                                                type = "button"
                                                                style = {styles.reviewSaveButton}
                                                                onClick = {() => {
                                                                    setSenior((prev) => ({ ...prev, workRequestStatus : "검토" }));
                                                                    const savedReviews = JSON.parse(localStorage.getItem("welfareWorkRequestStatus") || "{}");
                                                                    savedReviews[senior.id] = "검토";
                                                                    localStorage.setItem("welfareWorkRequestStatus", JSON.stringify(savedReviews));
                                                                }}
                                                            >
                                                                검토 완료
                                                            </button>
                                                        )}
                                                        <Link
                                                            to = {`/welfare/seniors/${senior.id}/jobs`}
                                                            style = {styles.jobLinkButton}
                                                        >
                                                            추천 공고 보기
                                                        </Link>
                                                        <Link
                                                            to = "/welfare/jobs"
                                                            style = {styles.secondaryJobLinkButton}
                                                        >
                                                            전체 공고 보기
                                                        </Link>
                                                    </div>
                                                </>
                                            )}
                                        </section>
                                    ))
                                }

                                {activeCategory === "전화 및 상담기록" && (
                                    <section style = {styles.detailSection}>
                                        <div style = {styles.memoHeader}>
                                            <div>
                                                <h2 style = {styles.sectionTitle}>전화 및 상담기록</h2>
                                            </div>

                                            {!isMemoEditing && (
                                                <button
                                                    type = "button"
                                                    style = {styles.smallButton}
                                                    onClick = {() => {
                                                        setIsMemoEditing(true);
                                                        setMemoStatusMessage("");
                                                    }}
                                                >
                                                    수정
                                                </button>
                                            )}
                                        </div>

                                        <div style = {styles.dateSearchRow}>
                                            <label style = {styles.dateLabel}>
                                                조회 날짜
                                                <input
                                                    type = "date"
                                                    value = {selectedCounselingDate}
                                                    onChange = {(event) => handleCounselingDateChange(event.target.value)}
                                                    style = {styles.dateInput}
                                                />
                                            </label>
                                        </div>

                                        {isMemoEditing ? (
                                            <>
                                                <textarea
                                                    value = {draftCounselingMemo}
                                                    onChange = {(event) => setDraftCounselingMemo(event.target.value)}
                                                    style = {styles.memoTextarea}
                                                    placeholder = "전화 및 상담기록을 입력하세요."
                                                />
                                                <div style = {styles.memoActionRow}>
                                                    <button
                                                        type = "button"
                                                        style = {styles.smallButton}
                                                        onClick = {handleCounselingMemoSave}
                                                    >
                                                        저장
                                                    </button>
                                                    <button
                                                        type = "button"
                                                        style = {styles.holdButton}
                                                        onClick = {handleCounselingMemoCancel}
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p style = {styles.memoText}>
                                            {selectedCounselingRecord?.content || "해당 날짜의 전화 및 상담기록이 없습니다."}
                                            </p>
                                        )}

                                        {memoStatusMessage && (
                                            <p style = {styles.memoStatusMessage}>{memoStatusMessage}</p>
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

const styles = {
    page : {
        minHeight : "100vh",
        backgroundColor : "var(--bg-color)",
        color : "var(--text-color)",
        boxSizing : "border-box",
    },
    content : {
        width : "100%",
        maxWidth : "1280px",
        margin : "0 auto",
        padding : "28px",
        boxSizing : "border-box",
    },
    categoryLayout : {
        display : "grid",
        gridTemplateColumns : "200px 1fr",
        gap : "20px",
        alignItems : "flex-start",
    },
    categorySidebar : {
        display : "flex",
        flexDirection : "column",
        gap : "4px",
        position : "sticky",
        top : "92px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "12px",
    },
    categoryItem : {
        width : "100%",
        padding : "10px 14px",
        borderRadius : "7px",
        border : "none",
        backgroundColor : "transparent",
        color : "var(--text-color)",
        fontSize : "14px",
        fontWeight : "700",
        textAlign : "left",
        cursor : "pointer",
    },
    activeCategoryItem : {
        backgroundColor : "var(--main-color)",
        color : "white",
    },
    categoryContent : {
        flex : 1,
        minWidth : 0,
    },
    detailHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "flex-start",
        gap : "16px",
        marginBottom : "18px",
    },
    backLink : {
        display : "inline-block",
        marginBottom : "10px",
        color : "var(--main-color)",
        fontSize : "14px",
        fontWeight : "700",
        textDecoration : "none",
    },
    title : {
        margin : 0,
        fontSize : "28px",
    },
    subText : {
        margin : "6px 0 0",
        color : "#666",
    },
    statusGroup : {
        display : "flex",
        alignItems : "center",
        gap : "10px",
        flexWrap : "wrap",
        justifyContent : "flex-start",
        margin : "16px 0 22px",
    },
    headerActions : {
        display : "flex",
        alignItems : "center",
        justifyContent : "flex-end",
        gap : "10px",
        flexWrap : "wrap",
    },
    detailList : {
        display : "grid",
        gridTemplateColumns : "1fr",
        gap : "14px",
    },
    detailSection : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        boxSizing : "border-box",
    },
    sectionTitle : {
        margin : "0 0 18px",
        fontSize : "22px",
        fontWeight : "800",
    },
    sectionFields : {
        display : "grid",
        gridTemplateColumns : "1fr",
        gap : "14px",
    },
    detailRow : {
        display : "grid",
        gridTemplateColumns : "180px minmax(0, 1fr)",
        alignItems : "center",
        gap : "18px",
        padding : "14px 0",
        borderTop : "1px solid var(--border-color)",
    },
    detailLabel : {
        color : "#666",
        fontSize : "15px",
        fontWeight : "700",
    },
    detailValue : {
        color : "var(--text-color)",
        fontSize : "20px",
        fontWeight : "700",
        lineHeight : "1.45",
        wordBreak : "keep-all",
    },
    reviewToggleButton : {
        padding : "6px 16px",
        fontSize : "15px",
        fontWeight : "700",
        color : "#fff",
        border : "none",
        borderRadius : "6px",
        cursor : "pointer",
        width : "fit-content",
    },
    reviewSaveButton : {
        padding : "8px 18px",
        fontSize : "14px",
        fontWeight : "700",
        color : "#fff",
        backgroundColor : "#4a7c4f",
        border : "none",
        borderRadius : "8px",
        cursor : "pointer",
    },
    jobActionRow : {
        display : "flex",
        justifyContent : "flex-end",
        flexWrap : "wrap",
        gap : "8px",
        marginTop : "18px",
        paddingTop : "16px",
        borderTop : "1px solid var(--border-color)",
    },
    jobLinkButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        fontSize : "14px",
        fontWeight : "800",
        textDecoration : "none",
        whiteSpace : "nowrap",
    },
    secondaryJobLinkButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        fontSize : "14px",
        fontWeight : "800",
        textDecoration : "none",
        whiteSpace : "nowrap",
    },
    scheduleSection : {
        marginTop : "14px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        boxSizing : "border-box",
    },
    scheduleHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "center",
        gap : "12px",
        marginBottom : "16px",
    },
    scheduleCount : {
        color : "#666",
        fontSize : "14px",
        fontWeight : "700",
    },
    scheduleList : {
        display : "grid",
        gridTemplateColumns : "1fr",
        gap : "12px",
    },
    scheduleItem : {
        borderTop : "1px solid var(--border-color)",
        padding : "16px 0 2px",
    },
    scheduleTopLine : {
        display : "flex",
        alignItems : "center",
        gap : "8px",
        marginBottom : "8px",
    },
    scheduleStatus : {
        display : "inline-block",
        padding : "5px 9px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "800",
        whiteSpace : "nowrap",
    },
    scheduleType : {
        color : "#666",
        fontSize : "14px",
        fontWeight : "700",
    },
    scheduleTitle : {
        display : "block",
        color : "var(--text-color)",
        fontSize : "21px",
        fontWeight : "800",
        lineHeight : "1.45",
        wordBreak : "keep-all",
    },
    scheduleMeta : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px 16px",
        marginTop : "8px",
        color : "#666",
        fontSize : "15px",
        fontWeight : "700",
    },
    emptyScheduleText : {
        margin : 0,
        padding : "18px 0 0",
        borderTop : "1px solid var(--border-color)",
        color : "#666",
        fontSize : "15px",
    },
    decisionSection : {
        marginTop : "14px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        boxSizing : "border-box",
    },
    decisionOptionRow : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px",
        borderTop : "1px solid var(--border-color)",
        paddingTop : "16px",
    },
    decisionOptionButton : {
        minWidth : "86px",
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        backgroundColor : "white",
        color : "var(--main-color)",
        fontSize : "14px",
        fontWeight : "800",
        cursor : "pointer",
    },
    reasonTextarea : {
        width : "100%",
        minHeight : "96px",
        marginTop : "12px",
        boxSizing : "border-box",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
        color : "var(--text-color)",
        fontSize : "15px",
        fontFamily : "inherit",
        lineHeight : "1.6",
        resize : "vertical",
        outline : "none",
    },
    memoSection : {
        marginTop : "14px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        boxSizing : "border-box",
    },
    memoHeader : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "flex-start",
        gap : "14px",
        marginBottom : "16px",
    },
    memoSubText : {
        margin : "-8px 0 0",
        color : "#666",
        fontSize : "14px",
    },
    dateSearchRow : {
        display : "flex",
        alignItems : "flex-end",
        justifyContent : "space-between",
        gap : "12px",
        flexWrap : "wrap",
        borderTop : "1px solid var(--border-color)",
        paddingTop : "16px",
        marginBottom : "12px",
    },
    dateLabel : {
        display : "flex",
        flexDirection : "column",
        gap : "7px",
        color : "#666",
        fontSize : "13px",
        fontWeight : "800",
    },
    dateInput : {
        height : "38px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "0 10px",
        backgroundColor : "white",
        color : "var(--text-color)",
        outline : "none",
    },
    dateChipRow : {
        display : "flex",
        flexWrap : "wrap",
        gap : "6px",
    },
    dateChip : {
        height : "34px",
        padding : "0 10px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "var(--text-color)",
        fontSize : "13px",
        fontWeight : "700",
        cursor : "pointer",
    },
    activeDateChip : {
        backgroundColor : "var(--main-color)",
        borderColor : "var(--main-color)",
        color : "white",
    },
    memoText : {
        margin : 0,
        padding : "18px",
        color : "var(--text-color)",
        fontSize : "18px",
        fontWeight : "700",
        lineHeight : "1.6",
        whiteSpace : "pre-wrap",
        wordBreak : "keep-all",
        backgroundColor : "#fffef7",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
    },
    memoTextarea : {
        width : "100%",
        minHeight : "160px",
        boxSizing : "border-box",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
        color : "var(--text-color)",
        fontSize : "17px",
        fontFamily : "inherit",
        lineHeight : "1.6",
        resize : "vertical",
        outline : "none",
    },
    memoActionRow : {
        display : "flex",
        justifyContent : "flex-end",
        gap : "8px",
        marginTop : "12px",
    },
    memoStatusMessage : {
        margin : "10px 0 0",
        color : "var(--main-color)",
        fontSize : "13px",
        fontWeight : "700",
    },
    badge : {
        display : "inline-block",
        padding : "6px 11px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "800",
        lineHeight : "1",
        whiteSpace : "nowrap",
    },
    smallButton : {
        padding : "9px 14px",
        borderRadius : "8px",
        fontSize : "14px",
        border : "none",
        cursor : "pointer",
        color : "white",
        backgroundColor : "var(--main-color)",
    },
    holdButton : {
        padding : "9px 14px",
        borderRadius : "8px",
        fontSize : "14px",
        border : "1px solid var(--main-color)",
        cursor : "pointer",
        color : "var(--text-color)",
        backgroundColor : "#f7f5e8",
    },
    message : {
        margin : "0 0 12px",
        fontSize : "14px",
        color : "#666",
    },
};

export default WelfareSeniorDetail;
