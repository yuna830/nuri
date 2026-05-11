import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
    findWelfareDemoCounselingRecords,
    findWelfareDemoSchedules,
    findWelfareDemoSenior,
} from "../../data/welfareSeniorDemoData";

const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";
const COUNSELING_RECORDS_STORAGE_KEY = "welfareCounselingRecords";
const SOS_REQUESTS_STORAGE_KEY = "welfareSosRequests";
const WELFARE_DECISION_STORAGE_KEY = "welfareDecisions";
const WELFARE_DECISION_DETAIL_STORAGE_KEY = "welfareDecisionDetails";
const ADDED_SENIORS_STORAGE_KEY = "welfareAddedSeniors";

const readJsonStorage = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

const getSavedAddedSeniors = () => readJsonStorage(ADDED_SENIORS_STORAGE_KEY, []);
const getSavedWelfareDecisions = () => readJsonStorage(WELFARE_DECISION_STORAGE_KEY, {});
const getSavedWelfareDecisionDetails = () => readJsonStorage(WELFARE_DECISION_DETAIL_STORAGE_KEY, {});
const getSavedCounselingRecords = () => readJsonStorage(COUNSELING_RECORDS_STORAGE_KEY, {});

const getJobRequestStatus = (count) =>
    Number(count || 0) > 0 ? `요청 ${Number(count)}건` : "미요청";

const normalizeAlertStatus = (status) => {
    return ["없음", "SOS 요청", "일자리 요청"].includes(status) ? status : "없음";
};

const normalizeSenior = (senior) => {
    if (!senior) {
        return senior;
    }

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
        preferredWorkTime : senior.preferredWorkTime || "하루 3시간",
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

const applySavedWelfareDecision = (target) => {
    if (!target) {
        return target;
    }

    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();
    const savedDetail = savedDecisionDetails[target.id];
    const savedDecision = savedDetail?.decision || savedDecisions[target.id];

    return normalizeSenior({
        ...target,
        welfareDecision : savedDecision || target.welfareDecision,
        jobMatchingStatus : savedDecision || target.jobMatchingStatus,
        welfareDecisionReason : savedDetail?.reason ?? target.welfareDecisionReason,
    });
};

const saveWelfareDecision = (seniorId, decision, reason) => {
    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();

    localStorage.setItem(
        WELFARE_DECISION_STORAGE_KEY,
        JSON.stringify({
            ...savedDecisions,
            [seniorId] : decision,
        })
    );
    localStorage.setItem(
        WELFARE_DECISION_DETAIL_STORAGE_KEY,
        JSON.stringify({
            ...savedDecisionDetails,
            [seniorId] : {
                decision,
                reason,
                deliveredAt : new Date().toISOString(),
            },
        })
    );
};

const findSavedSenior = (seniorId) =>
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

const formatGps = (gps) => {
    if (!gps) {
        return "GPS 위치 정보 없음";
    }

    return `${gps.address} (${gps.latitude}, ${gps.longitude})`;
};

function WelfareSeniorDetail(){
    const { id } = useParams();
    const [senior, setSenior] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [counselingRecords, setCounselingRecords] = useState([]);
    const [selectedCounselingDate, setSelectedCounselingDate] = useState("");
    const [draftCounselingMemo, setDraftCounselingMemo] = useState("");
    const [isMemoEditing, setIsMemoEditing] = useState(false);
    const [memoStatusMessage, setMemoStatusMessage] = useState("");
    const [isSosModalOpen, setIsSosModalOpen] = useState(false);
    const [sosStatusMessage, setSosStatusMessage] = useState("");
    const [draftDecision, setDraftDecision] = useState("미검토");
    const [draftRejectionReason, setDraftRejectionReason] = useState("");
    const [decisionStatusMessage, setDecisionStatusMessage] = useState("");

    const applyLoadedSenior = (loadedSenior) => {
        const nextSenior = applySavedWelfareDecision(loadedSenior);
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
    const schedules = senior
        ? senior.schedules || findWelfareDemoSchedules(senior.id)
        : [];
    const detailSections = senior
        ? [
            {
                title : "기본 정보",
                items : [
                    { label : "이름", value : senior.name },
                    { label : "나이/성별", value : formatAgeGender(senior) },
                    { label : "연락처", value : detail.phone },
                    { label : "주소", value : detail.address },
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
                    { label : "근로 요청 상태", value : senior.workRequestStatus },
                    { label : "일자리 매칭 단계", value : senior.jobMatchingStatus },
                    { label : "복지사 판단", value : senior.welfareDecision },
                    { label : "부적합 사유", value : senior.welfareDecisionReason || "등록된 사유 없음" },
                ],
            },
        ]
        : [];

    async function handleDecisionSave() {
        const reason = draftDecision === "부적합" ? draftRejectionReason.trim() : draftRejectionReason.trim();

        if (draftDecision === "부적합" && !reason) {
            setDecisionStatusMessage("부적합일 경우 전달할 사유를 입력해주세요.");
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
                ? "부적합 사유가 저장되어 전달 항목에 반영되었습니다."
                : "복지사 판단이 저장되었습니다."
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

        const nextContent = draftCounselingMemo.trim() || "상담 기록이 없습니다.";
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
        setMemoStatusMessage("상담 기록이 저장되었습니다.");
    };

    const handleCounselingMemoCancel = () => {
        setDraftCounselingMemo(selectedCounselingRecord?.content || "");
        setIsMemoEditing(false);
        setMemoStatusMessage("");
    };

    const handleSosRequest = () => {
        if (senior) {
            const savedRequests = readJsonStorage(SOS_REQUESTS_STORAGE_KEY, []);
            const nextRequest = {
                id : `${senior.id}-${Date.now()}`,
                seniorId : senior.id,
                seniorName : senior.name,
                createdAt : new Date().toISOString(),
                status : "보호자 알림 전송",
                lastGps : senior.lastGps,
            };

            localStorage.setItem(
                SOS_REQUESTS_STORAGE_KEY,
                JSON.stringify([nextRequest, ...savedRequests])
            );
        }

        setSosStatusMessage("보호자에게 SOS 조치 알림과 마지막 GPS 위치를 전송했습니다.");
        setIsSosModalOpen(true);
    };

    const handleEmergencyReport = (agency) => {
        setSosStatusMessage(`${agency} 신고 확인이 완료되었습니다. 실제 신고는 시연용으로 전송되지 않습니다.`);
        setIsSosModalOpen(false);
    };

    function formatAgeGender(target) {
        if (!target) {
            return "-";
        }

        const ageText = target.age == null ? "나이 미입력" : `${target.age}세`;
        const genderText = target.gender || "성별 미입력";

        return `${ageText} / ${genderText}`;
    }

    function getDetail(target) {
        if (!target) {
            return {};
        }

        return {
            phone : `010-1000-${String(target.id).padStart(4, "0")}`,
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
                "적합" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "보류" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "부적합" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
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

    const getScheduleStatusStyle = (status) => {
        const statusColors = {
            "예정" : { backgroundColor : "#dff3ff", color : "#176b92" },
            "완료" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
            "보류" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
            "취소" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
        };

        return {
            ...styles.scheduleStatus,
            ...(statusColors[status] || statusColors["취소"]),
        };
    };

    return (
        <div style = {styles.page}>
            <header style = {styles.topHeader}>
                <div style = {styles.brandArea}>
                    <div style = {styles.logoBox}>우리</div>
                    <strong style = {styles.serviceName}>우리</strong>
                    <span style = {styles.headerPageName}>대상자 상세정보</span>
                </div>
            </header>

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
                {sosStatusMessage && <p style = {{ ...styles.message, color : "#b66b6b" }}>{sosStatusMessage}</p>}

                {senior && (
                    <>
                        <div style = {styles.statusActionRow}>
                            <div style = {styles.statusGroup}>
                                <span style = {getBadgeStyle("health", senior.healthStatus)}>{senior.healthStatus}</span>
                                <span style = {getBadgeStyle("alert", senior.alertStatus)}>{senior.alertStatus}</span>
                                <span style = {getBadgeStyle("decision", senior.welfareDecision)}>{senior.welfareDecision}</span>
                            </div>
                            <button
                                type = "button"
                                style = {styles.sosButton}
                                onClick = {handleSosRequest}
                            >
                                SOS 조치
                            </button>
                        </div>
                        <div style = {styles.detailList}>
                            {detailSections.map((section) => (
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
                                                <strong style = {styles.detailValue}>{item.value}</strong>
                                            </div>
                                        ))}
                                    </div>
                                    {section.title === "일자리 요청 상태" && (
                                        <div style = {styles.jobActionRow}>
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
                                    )}
                                </section>
                            ))}
                        </div>

                        <section style = {styles.decisionSection}>
                            <div style = {styles.memoHeader}>
                                <div>
                                    <h2 style = {styles.sectionTitle}>복지사 판단</h2>
                                    <p style = {styles.memoSubText}>일자리 매칭 단계와 부적합 사유를 상세 화면에서 관리합니다.</p>
                                </div>
                            </div>

                            <div style = {styles.decisionOptionRow}>
                                {["적합", "보류", "부적합"].map((decision) => (
                                    <button
                                        type = "button"
                                        key = {decision}
                                        style = {{
                                            ...styles.decisionOptionButton,
                                            ...(draftDecision === decision ? styles.activeDecisionOptionButton : {}),
                                        }}
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
                                    placeholder = "부적합 사유를 작성하면 대상자/보호자 전달 항목에 반영됩니다."
                                />
                            )}

                            <div style = {styles.memoActionRow}>
                                <button
                                    type = "button"
                                    style = {styles.smallButton}
                                    onClick = {handleDecisionSave}
                                >
                                    판단 저장
                                </button>
                            </div>

                            {decisionStatusMessage && (
                                <p style = {styles.memoStatusMessage}>{decisionStatusMessage}</p>
                            )}
                        </section>

                        <section style = {styles.scheduleSection}>
                            <div style = {styles.scheduleHeader}>
                                <h2 style = {{ ...styles.sectionTitle, margin : 0 }}>일정 현황</h2>
                                <span style = {styles.scheduleCount}>{schedules.length}건</span>
                            </div>

                            {schedules.length === 0 ? (
                                <p style = {styles.emptyScheduleText}>등록된 일정이 없습니다.</p>
                            ) : (
                                <div style = {styles.scheduleList}>
                                    {schedules.map((schedule) => (
                                        <article
                                            key = {schedule.id}
                                            style = {styles.scheduleItem}
                                        >
                                            <div style = {styles.scheduleTopLine}>
                                                <span style = {getScheduleStatusStyle(schedule.status)}>
                                                    {schedule.status}
                                                </span>
                                                <span style = {styles.scheduleType}>{schedule.type}</span>
                                            </div>
                                            <strong style = {styles.scheduleTitle}>{schedule.title}</strong>
                                            <div style = {styles.scheduleMeta}>
                                                <span>{schedule.scheduledAt}</span>
                                                <span>{schedule.place}</span>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section style = {styles.memoSection}>
                            <div style = {styles.memoHeader}>
                                <div>
                                    <h2 style = {styles.sectionTitle}>상담 기록</h2>
                                    <p style = {styles.memoSubText}>날짜 기준으로 상담 내용을 조회하고 수정합니다.</p>
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
                                <div style = {styles.dateChipRow}>
                                    {counselingRecords.map((record) => (
                                        <button
                                            type = "button"
                                            key = {record.id}
                                            style = {{
                                                ...styles.dateChip,
                                                ...(selectedCounselingDate === record.date ? styles.activeDateChip : {}),
                                            }}
                                            onClick = {() => handleCounselingDateChange(record.date)}
                                        >
                                            {record.date}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isMemoEditing ? (
                                <>
                                    <textarea
                                        value = {draftCounselingMemo}
                                        onChange = {(event) => setDraftCounselingMemo(event.target.value)}
                                        style = {styles.memoTextarea}
                                        placeholder = "상담 기록을 입력하세요."
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
                                    {selectedCounselingRecord?.content || "해당 날짜의 상담 기록이 없습니다."}
                                </p>
                            )}

                            {memoStatusMessage && (
                                <p style = {styles.memoStatusMessage}>{memoStatusMessage}</p>
                            )}
                        </section>
                    </>
                )}
            </main>

            {isSosModalOpen && senior && (
                <div style = {styles.modalBackdrop}>
                    <div style = {styles.sosModal}>
                        <h2 style = {styles.sosModalTitle}>SOS 조치</h2>
                        <p style = {styles.sosModalText}>
                            {senior.name} 대상자의 보호자에게 SOS 알림과 마지막 GPS 위치를 전송했습니다.
                        </p>
                        <div style = {styles.gpsBox}>
                            <strong style = {styles.gpsTitle}>마지막 GPS</strong>
                            <span>{formatGps(senior.lastGps)}</span>
                            <span>기록 시각: {senior.lastGps.recordedAt}</span>
                        </div>

                        <div style = {styles.sosModalActions}>
                            <button
                                type = "button"
                                style = {styles.report119Button}
                                onClick = {() => handleEmergencyReport("119")}
                            >
                                119 신고하기
                            </button>
                            <button
                                type = "button"
                                style = {styles.report112Button}
                                onClick = {() => handleEmergencyReport("112")}
                            >
                                112 신고하기
                            </button>
                            <button
                                type = "button"
                                style = {styles.cancelButton}
                                onClick = {() => setIsSosModalOpen(false)}
                            >
                                닫기
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
        boxSizing : "border-box",
    },
    brandArea : {
        display : "flex",
        alignItems : "center",
        gap : "12px",
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
    },
    content : {
        width : "100%",
        maxWidth : "1280px",
        margin : "0 auto",
        padding : "28px",
        boxSizing : "border-box",
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
        gap : "8px",
        flexWrap : "wrap",
        justifyContent : "flex-start",
    },
    headerActions : {
        display : "flex",
        alignItems : "center",
        justifyContent : "flex-end",
        gap : "10px",
        flexWrap : "wrap",
    },
    statusActionRow : {
        display : "flex",
        alignItems : "center",
        justifyContent : "space-between",
        gap : "12px",
        flexWrap : "wrap",
        margin : "-4px 0 16px",
    },
    sosButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "#b66b6b",
        color : "white",
        fontSize : "14px",
        fontWeight : "800",
        cursor : "pointer",
        whiteSpace : "nowrap",
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
    activeDecisionOptionButton : {
        backgroundColor : "var(--main-color)",
        color : "white",
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
        padding : "5px 9px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "800",
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
    modalBackdrop : {
        position : "fixed",
        inset : 0,
        backgroundColor : "rgba(0, 0, 0, 0.42)",
        display : "flex",
        alignItems : "center",
        justifyContent : "center",
        padding : "24px",
        zIndex : 100,
    },
    sosModal : {
        width : "100%",
        maxWidth : "500px",
        backgroundColor : "white",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        padding : "24px",
        boxShadow : "0 18px 42px rgba(0, 0, 0, 0.24)",
    },
    sosModalTitle : {
        margin : "0 0 12px",
        color : "#8a2f2f",
        fontSize : "24px",
        fontWeight : "800",
    },
    sosModalText : {
        margin : 0,
        color : "var(--text-color)",
        fontSize : "15px",
        lineHeight : "1.7",
    },
    gpsBox : {
        display : "flex",
        flexDirection : "column",
        gap : "6px",
        marginTop : "14px",
        padding : "14px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "#fffef7",
        color : "var(--text-color)",
        fontSize : "14px",
        lineHeight : "1.5",
    },
    gpsTitle : {
        color : "#8a2f2f",
        fontSize : "14px",
        fontWeight : "800",
    },
    sosModalActions : {
        display : "flex",
        justifyContent : "flex-end",
        flexWrap : "wrap",
        gap : "8px",
        marginTop : "22px",
    },
    report119Button : {
        padding : "10px 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "#b66b6b",
        color : "white",
        fontSize : "14px",
        fontWeight : "800",
        cursor : "pointer",
    },
    report112Button : {
        padding : "10px 14px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "#4f8fb8",
        color : "white",
        fontSize : "14px",
        fontWeight : "800",
        cursor : "pointer",
    },
    cancelButton : {
        padding : "10px 14px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "var(--text-color)",
        fontSize : "14px",
        fontWeight : "700",
        cursor : "pointer",
    },
};

export default WelfareSeniorDetail;
