import { Link, useParams } from "react-router-dom";
import {
    findWelfareDemoSenior,
    WELFARE_DEMO_JOBS,
} from "../../data/welfareSeniorDemoData";

const ADDED_SENIORS_STORAGE_KEY = "welfareAddedSeniors";

const getSavedAddedSeniors = () => {
    try {
        return JSON.parse(localStorage.getItem(ADDED_SENIORS_STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
};

const getRegionDistrict = (region = "") => {
    const districtMatch = String(region).match(/[가-힣]+구/);

    return districtMatch ? districtMatch[0] : "";
};

const findWelfareSenior = (seniorId) =>
    findWelfareDemoSenior(seniorId) ||
    getSavedAddedSeniors().find((senior) => String(senior.id) === String(seniorId));

const findRecommendedJobs = (senior) => {
    const district = getRegionDistrict(senior.region);

    return WELFARE_DEMO_JOBS.filter((job) =>
        job.deadlineStatus !== "마감" &&
        district !== "" &&
        job.workPlace.includes(district) &&
        senior.healthStatus !== "위험"
    );
};

function WelfareJobPostings(){
    const { id } = useParams();
    const senior = id ? findWelfareSenior(id) : null;
    const jobs = senior ? findRecommendedJobs(senior) : WELFARE_DEMO_JOBS;
    const pageTitle = senior ? `${senior.name} 추천 공고` : "전체 일자리 공고";
    const pageDescription = senior
        ? `${senior.region} 기준으로 마감되지 않은 추천 공고를 확인합니다.`
        : "노인일자리 API 연동 전까지 임시 공고 데이터로 화면 흐름을 확인합니다.";

    const getStatusStyle = (status) => ({
        ...styles.statusBadge,
        ...(status === "마감"
            ? { backgroundColor : "#eeeeee", color : "#555" }
            : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" }),
    });

    return (
        <div style = {styles.page}>
            <header style = {styles.topHeader}>
                <div style = {styles.brandArea}>
                    <div style = {styles.logoBox}>우리</div>
                    <strong style = {styles.serviceName}>우리</strong>
                    <span style = {styles.headerPageName}>노인일자리 공고</span>
                </div>
            </header>

            <main style = {styles.content}>
                <div style = {styles.headerRow}>
                    <div>
                        <Link
                            to = {senior ? `/welfare/seniors/${senior.id}` : "/welfare"}
                            style = {styles.backLink}
                        >
                            {senior ? "상세정보로" : "목록으로"}
                        </Link>
                        <h1 style = {styles.title}>{pageTitle}</h1>
                        <p style = {styles.subText}>{pageDescription}</p>
                    </div>

                    {senior && (
                        <Link to = "/welfare/jobs" style = {styles.secondaryButton}>
                            전체 공고 보기
                        </Link>
                    )}
                </div>

                {senior && jobs.length === 0 && (
                    <section style = {styles.emptyBox}>
                        <strong style = {styles.emptyTitle}>추천 가능한 공고가 없습니다.</strong>
                        <p style = {styles.emptyText}>
                            현재는 거주 지역, 마감 여부, 건강 상태 기준으로만 임시 추천을 계산합니다.
                        </p>
                    </section>
                )}

                <div style = {styles.jobList}>
                    {jobs.map((job) => (
                        <article key = {job.jobId} style = {styles.jobCard}>
                            <div style = {styles.jobHeader}>
                                <div>
                                    <div style = {styles.badgeRow}>
                                        <span style = {getStatusStyle(job.deadlineStatus)}>
                                            {job.deadlineStatus}
                                        </span>
                                        <span style = {styles.typeBadge}>{job.employmentType}</span>
                                    </div>
                                    <h2 style = {styles.jobTitle}>{job.title}</h2>
                                    <p style = {styles.organization}>{job.organization}</p>
                                </div>

                                <div style = {styles.scoreBox}>
                                    <span style = {styles.scoreLabel}>적합도</span>
                                    <strong style = {styles.scoreValue}>{job.suitabilityScore}점</strong>
                                </div>
                            </div>

                            <div style = {styles.infoGrid}>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>근무지</span>
                                    <strong style = {styles.infoValue}>{job.workPlace}</strong>
                                </div>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>직종</span>
                                    <strong style = {styles.infoValue}>{job.jobType}</strong>
                                </div>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>근무 시간</span>
                                    <strong style = {styles.infoValue}>{job.workDays} / {job.workTime}</strong>
                                </div>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>임금</span>
                                    <strong style = {styles.infoValue}>{job.wage}</strong>
                                </div>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>접수 일정</span>
                                    <strong style = {styles.infoValue}>{job.recruitPeriod}</strong>
                                </div>
                                <div style = {styles.infoItem}>
                                    <span style = {styles.infoLabel}>공고 ID</span>
                                    <strong style = {styles.infoValue}>{job.jobId}</strong>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
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
    headerRow : {
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
        fontSize : "15px",
    },
    secondaryButton : {
        height : "38px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        color : "var(--main-color)",
        backgroundColor : "white",
        display : "inline-flex",
        alignItems : "center",
        justifyContent : "center",
        fontSize : "14px",
        fontWeight : "800",
        textDecoration : "none",
        whiteSpace : "nowrap",
    },
    emptyBox : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        marginBottom : "14px",
    },
    emptyTitle : {
        display : "block",
        fontSize : "20px",
        fontWeight : "800",
        marginBottom : "6px",
    },
    emptyText : {
        margin : 0,
        color : "#666",
        fontSize : "15px",
        lineHeight : "1.6",
    },
    jobList : {
        display : "grid",
        gridTemplateColumns : "1fr",
        gap : "14px",
    },
    jobCard : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "22px 24px",
        boxSizing : "border-box",
    },
    jobHeader : {
        display : "flex",
        justifyContent : "space-between",
        gap : "16px",
        alignItems : "flex-start",
        marginBottom : "16px",
    },
    badgeRow : {
        display : "flex",
        flexWrap : "wrap",
        gap : "6px",
        marginBottom : "8px",
    },
    statusBadge : {
        display : "inline-block",
        padding : "5px 9px",
        borderRadius : "999px",
        fontSize : "12px",
        fontWeight : "800",
    },
    typeBadge : {
        display : "inline-block",
        padding : "5px 9px",
        borderRadius : "999px",
        backgroundColor : "#fff3c4",
        color : "#6b5b12",
        fontSize : "12px",
        fontWeight : "800",
    },
    jobTitle : {
        margin : 0,
        color : "var(--text-color)",
        fontSize : "24px",
        fontWeight : "800",
        lineHeight : "1.35",
        wordBreak : "keep-all",
    },
    organization : {
        margin : "6px 0 0",
        color : "#666",
        fontSize : "15px",
        fontWeight : "700",
    },
    scoreBox : {
        minWidth : "90px",
        textAlign : "right",
    },
    scoreLabel : {
        display : "block",
        color : "#666",
        fontSize : "12px",
        fontWeight : "700",
    },
    scoreValue : {
        display : "block",
        marginTop : "4px",
        color : "var(--main-color)",
        fontSize : "24px",
        fontWeight : "900",
    },
    infoGrid : {
        display : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(220px, 1fr))",
        gap : "12px",
        borderTop : "1px solid var(--border-color)",
        paddingTop : "16px",
    },
    infoItem : {
        display : "flex",
        flexDirection : "column",
        gap : "5px",
        minWidth : 0,
    },
    infoLabel : {
        color : "#666",
        fontSize : "13px",
        fontWeight : "700",
    },
    infoValue : {
        color : "var(--text-color)",
        fontSize : "16px",
        fontWeight : "800",
        lineHeight : "1.45",
        wordBreak : "keep-all",
    },
};

export default WelfareJobPostings;
