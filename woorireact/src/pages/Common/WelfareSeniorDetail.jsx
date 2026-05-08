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
                        <div style = {styles.detailGrid}>
                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>기본 정보</h2>
                                <p style = {styles.detailText}>이름 : {senior.name}</p>
                                <p style = {styles.detailText}>나이/성별 : {formatAgeGender(senior)}</p>
                                <p style = {styles.detailText}>연락처 : {detail.phone}</p>
                                <p style = {styles.detailText}>주소 : {detail.address}</p>
                            </section>

                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>보호자 정보</h2>
                                <p style = {styles.detailText}>보호자 이름 : {detail.guardianName}</p>
                                <p style = {styles.detailText}>보호자 연락처 : {detail.guardianPhone}</p>
                                <p style = {styles.detailText}>관계 : {detail.guardianRelation}</p>
                            </section>

                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>건강 정보</h2>
                                <p style = {styles.detailText}>건강 상태 : {senior.healthStatus}</p>
                                <p style = {styles.detailText}>기저질환 : {detail.diseaseInfo}</p>
                                <p style = {styles.detailText}>복약정보 : {detail.medicationInfo}</p>
                                <p style = {styles.detailText}>보행 가능 여부 : {detail.walkingStatus}</p>
                            </section>

                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>신체 정보</h2>
                                <p style = {styles.detailText}>시력 : {detail.visionStatus}</p>
                                <p style = {styles.detailText}>청력 : {detail.hearingStatus}</p>
                                <p style = {styles.detailText}>손 사용 능력 : {detail.handUseStatus}</p>
                                <p style = {styles.detailText}>근무 가능 시간 : {detail.availableWorkTime}</p>
                            </section>

                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>위치 정보</h2>
                                <p style = {styles.detailText}>현재 위치 : {detail.currentLocation}</p>
                                <p style = {styles.detailText}>자주 가는 장소 : {detail.frequentPlace}</p>
                                <p style = {styles.detailText}>안심구역 : {detail.safeZone}</p>
                                <p style = {styles.detailText}>위치 상태 : {senior.locationStatus}</p>
                            </section>

                            <section style = {styles.detailSection}>
                                <h2 style = {styles.sectionTitle}>일자리 정보</h2>
                                <p style = {styles.detailText}>추천받은 일자리 : {detail.recommendedJob}</p>
                                <p style = {styles.detailText}>일자리 매칭 상태 : {senior.jobStatus}</p>
                                <p style = {styles.detailText}>복지사 판단 : {senior.welfareDecision}</p>
                            </section>
                        </div>

                        <section style = {styles.memoBox}>
                            <h2 style = {styles.sectionTitle}>상담 기록</h2>
                            <p style = {styles.detailText}>복지사가 남긴 메모 : {detail.counselingMemo}</p>
                        </section>

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
    detailGrid : {
        display : "grid",
        gridTemplateColumns : "repeat(2, minmax(0, 1fr))",
        gap : "12px",
    },
    detailSection : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
    },
    sectionTitle : {
        margin : "0 0 10px",
        fontSize : "16px",
    },
    detailText : {
        margin : "6px 0",
        fontSize : "14px",
    },
    memoBox : {
        marginTop : "12px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
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
