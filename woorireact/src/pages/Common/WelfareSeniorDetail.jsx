import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";

function WelfareSeniorDetail(){
    const { id } = useParams();
    const [senior, setSenior] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");

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
                    setSenior(data);
                }
            } catch (error) {
                if (!ignore) {
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

    const handleDecision = async (decision) => {
        try {
            setMessage("");

            const response = await fetch(`${WELFARE_SENIOR_API_URL}/${id}/decision`, {
                method : "PATCH",
                headers : {
                    "Content-Type" : "application/json",
                },
                body : JSON.stringify({ decision }),
            });

            if (!response.ok) {
                throw new Error("Failed to update decision");
            }

            const updatedSenior = await response.json();
            setSenior(updatedSenior);
        } catch (error) {
            setMessage("복지사 판단을 저장하지 못했습니다.");
        }
    };

    const formatAgeGender = (target) => {
        if (!target) {
            return "-";
        }

        const ageText = target.age == null ? "나이 미입력" : `${target.age}세`;
        const genderText = target.gender || "성별 미입력";

        return `${ageText} / ${genderText}`;
    };

    const getBadgeStyle = (type, value) => {
        const badgeColors = {
            health : {
                "양호" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "주의" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "위험" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
            decision : {
                "미검토" : { backgroundColor : "#eeeeee", color : "#555" },
                "적합" : { backgroundColor : "#dff3ff", color : "#176b92" },
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

    const getDetail = (target) => {
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
            medicationInfo : target.alertStatus === "미복용" ? "복약 확인 필요" : "정상 복용",
            walkingStatus : target.healthStatus === "위험" ? "장시간 보행 어려움" : target.healthStatus === "주의" ? "짧은 거리 보행 가능" : "보행 가능",
            visionStatus : target.age >= 80 ? "시력 저하" : "정상",
            hearingStatus : target.age >= 82 ? "청력 저하" : "정상",
            handUseStatus : "양손 사용 가능",
            availableWorkTime : target.healthStatus === "위험" ? "하루 2시간" : "하루 3시간",
            currentLocation : target.locationStatus === "안전구역 이탈" ? "안심구역 외부" : "자택",
            frequentPlace : "주민센터 / 복지관",
            safeZone : "자택 반경 500m",
            counselingMemo : target.healthStatus === "위험"
                ? "건강 상태 확인이 필요하며 무리한 업무는 피해야 함"
                : "가벼운 업무 중심으로 일자리 추천 가능",
            recommendedJob : target.jobStatus === "미추천" ? "추천 일자리 없음" : "복지관 안내 보조",
        };
    };

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
                    { label : "복약정보", value : detail.medicationInfo },
                    { label : "보행 가능 여부", value : detail.walkingStatus },
                ],
            },
            {
                title : "신체 정보",
                items : [
                    { label : "시력", value : detail.visionStatus },
                    { label : "청력", value : detail.hearingStatus },
                    { label : "손 사용 능력", value : detail.handUseStatus },
                    { label : "근무 가능 시간", value : detail.availableWorkTime },
                ],
            },
            {
                title : "위치 정보",
                items : [
                    { label : "현재 위치", value : detail.currentLocation },
                    { label : "자주 가는 장소", value : detail.frequentPlace },
                    { label : "안심구역", value : detail.safeZone },
                    { label : "위치 상태", value : senior.locationStatus },
                ],
            },
            {
                title : "일자리 정보",
                items : [
                    { label : "추천받은 일자리", value : detail.recommendedJob },
                    { label : "일자리 매칭 상태", value : senior.jobStatus },
                    { label : "복지사 판단", value : senior.welfareDecision },
                ],
            },
            {
                title : "상담 기록",
                items : [
                    { label : "복지사가 남긴 메모", value : detail.counselingMemo },
                ],
            },
        ]
        : [];

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
                        <Link to = "/" style = {styles.backLink}>목록으로</Link>
                        <h1 style = {styles.title}>{senior?.name || "대상자 상세정보"}</h1>
                        {senior && (
                            <p style = {styles.subText}>{formatAgeGender(senior)} / {senior.region}</p>
                        )}
                    </div>

                    {senior && (
                        <div style = {styles.statusGroup}>
                            <span style = {getBadgeStyle("health", senior.healthStatus)}>{senior.healthStatus}</span>
                            <span style = {getBadgeStyle("decision", senior.welfareDecision)}>{senior.welfareDecision}</span>
                        </div>
                    )}
                </div>

                {isLoading && <p style = {styles.message}>상세정보를 불러오는 중입니다.</p>}
                {message && <p style = {{ ...styles.message, color : "#b66b6b" }}>{message}</p>}

                {senior && (
                    <>
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
                                </section>
                            ))}
                        </div>

                        <div style = {styles.decisionBar}>
                            <button type = "button" style = {styles.smallButton} onClick = {() => handleDecision("적합")}>
                                적합
                            </button>
                            <button type = "button" style = {styles.holdButton} onClick = {() => handleDecision("보류")}>
                                보류
                            </button>
                            <button type = "button" style = {styles.dangerButton} onClick = {() => handleDecision("부적합")}>
                                부적합
                            </button>
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
        justifyContent : "flex-end",
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
        fontSize : "21px",
        fontWeight : "700",
        lineHeight : "1.45",
        wordBreak : "keep-all",
    },
    decisionBar : {
        display : "flex",
        justifyContent : "flex-end",
        gap : "8px",
        marginTop : "16px",
    },
    badge : {
        display : "inline-block",
        padding : "5px 9px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "700",
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
    dangerButton : {
        padding : "9px 14px",
        borderRadius : "8px",
        fontSize : "14px",
        border : "none",
        cursor : "pointer",
        color : "white",
        backgroundColor : "#b66b6b",
    },
    message : {
        margin : "0 0 12px",
        fontSize : "14px",
        color : "#666",
    },
};

export default WelfareSeniorDetail;
