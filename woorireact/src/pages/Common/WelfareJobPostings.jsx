import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import {
    findWelfareDemoSenior,
    WELFARE_DEMO_JOBS,
} from "../../data/welfareSeniorDemoData";
import { getSavedAddedSeniors } from "../../utils/welfare/welfareStorage";
import WelfareHeader from "./WelfareHeader";

const JOB_CATEGORIES = [
    { key : "전체", label : "전체" },
    { key : "안내", label : "안내" },
    { key : "환경 정비", label : "환경 정비" },
    { key : "실내 보조", label : "실내 보조" },
    { key : "복지 보조", label : "복지 보조" },
];

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
    const allJobs = senior ? findRecommendedJobs(senior) : WELFARE_DEMO_JOBS;
    const [activeCategory, setActiveCategory] = useState("전체");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [hideClosedJobs, setHideClosedJobs] = useState(true);

    const filteredJobs = allJobs.filter((job) => {
        const matchCategory = activeCategory === "전체" || job.jobType === activeCategory;
        const matchDeadline = !hideClosedJobs || job.deadlineStatus !== "마감";
        const keyword = searchKeyword.trim().toLowerCase();
        const matchKeyword = keyword === "" || [
            job.title, job.organization, job.workPlace, job.deadlineStatus,
        ].some((v) => String(v).toLowerCase().includes(keyword));
        return matchCategory && matchDeadline && matchKeyword;
    });

    const pageTitle = senior ? `${senior.name} 추천 공고` : "전체 일자리 공고";

    return (
        <div style = {styles.page}>
            <WelfareHeader pageName = "노인일자리 공고" />

            <main style = {styles.content}>
                <div style = {styles.headerRow}>
                    <Link
                        to = {senior ? `/welfare/seniors/${senior.id}` : "/welfare"}
                        style = {styles.backLink}
                    >
                        {senior ? "상세정보로" : "목록으로"}
                    </Link>
                </div>

                <div style = {styles.layout}>
                    <nav style = {styles.sidebar}>
                        <strong style = {styles.sidebarTitle}>직종 분류</strong>
                        {JOB_CATEGORIES.map((cat) => (
                            <button
                                type = "button"
                                key = {cat.key}
                                style = {{
                                    ...styles.sidebarItem,
                                    ...(activeCategory === cat.key ? styles.activeSidebarItem : {}),
                                }}
                                onClick = {() => setActiveCategory(cat.key)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </nav>

                    <div style = {styles.mainArea}>
                        <div style = {styles.searchRow}>
                            <Search size = {16} style = {{ color : "#999", flexShrink : 0 }} />
                            <input
                                type = "search"
                                value = {searchKeyword}
                                onChange = {(e) => setSearchKeyword(e.target.value)}
                                placeholder = "공고명, 기업명, 근무지 검색..."
                                style = {styles.searchInput}
                            />
                            <span style = {styles.searchDivider} />
                            <label style = {styles.hideClosedLabel}>
                                <input
                                    type = "checkbox"
                                    checked = {hideClosedJobs}
                                    onChange = {(event) => setHideClosedJobs(event.target.checked)}
                                    style = {styles.hideClosedCheckbox}
                                />
                                마감 숨기기
                            </label>
                        </div>

                        <p style = {styles.resultCount}>
                            {activeCategory === "전체" ? pageTitle : activeCategory} · {filteredJobs.length}건
                        </p>

                        {filteredJobs.length === 0 && (
                            <p style = {styles.emptyText}>검색 결과가 없습니다.</p>
                        )}

                        <div style = {styles.jobList}>
                            {filteredJobs.map((job) => (
                                <article key = {job.jobId} style = {styles.jobCard}>
                                    <div style = {styles.jobCardTop}>
                                        <div>
                                            <h2 style = {styles.jobTitle}>{job.title}</h2>
                                            <p style = {styles.organization}>{job.organization}</p>
                                        </div>
                                        <div style = {styles.badgeRow}>
                                            <span style = {styles.jobTypeBadge}>{job.jobType}</span>
                                            <span style = {styles.employmentBadge}>{job.employmentType}</span>
                                        </div>
                                    </div>
                                    <div style = {styles.jobMeta}>
                                        <span style = {styles.metaItem}>📍 {job.workPlace}</span>
                                        <span style = {styles.metaItem}>📅 {job.recruitPeriod}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
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
    content : {
        width : "100%",
        maxWidth : "1280px",
        margin : "0 auto",
        padding : "28px",
        boxSizing : "border-box",
    },
    headerRow : {
        marginBottom : "18px",
    },
    backLink : {
        color : "var(--main-color)",
        fontSize : "14px",
        fontWeight : "700",
        textDecoration : "none",
    },
    layout : {
        display : "grid",
        gridTemplateColumns : "200px 1fr",
        gap : "20px",
        alignItems : "flex-start",
    },
    sidebar : {
        display : "flex",
        flexDirection : "column",
        gap : "4px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "14px",
        position : "sticky",
        top : "92px",
    },
    sidebarTitle : {
        fontSize : "13px",
        fontWeight : "800",
        color : "#666",
        marginBottom : "8px",
    },
    sidebarItem : {
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
    activeSidebarItem : {
        backgroundColor : "var(--main-color)",
        color : "white",
    },
    mainArea : {
        minWidth : 0,
    },
    searchRow : {
        display : "flex",
        alignItems : "center",
        gap : "10px",
        padding : "0 14px",
        height : "44px",
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        marginBottom : "14px",
    },
    searchInput : {
        flex : 1,
        minWidth : 0,
        height : "100%",
        border : "none",
        outline : "none",
        fontSize : "14px",
        color : "var(--text-color)",
        backgroundColor : "transparent",
    },
    searchDivider : {
        width : "1px",
        height : "20px",
        backgroundColor : "var(--border-color)",
        flexShrink : 0,
    },
    hideClosedLabel : {
        display : "inline-flex",
        alignItems : "center",
        gap : "6px",
        color : "var(--main-color)",
        fontSize : "13px",
        fontWeight : "800",
        whiteSpace : "nowrap",
        cursor : "pointer",
        flexShrink : 0,
    },
    hideClosedCheckbox : {
        width : "16px",
        height : "16px",
        margin : 0,
        accentColor : "var(--main-color)",
        cursor : "pointer",
    },
    resultCount : {
        margin : "0 0 14px",
        fontSize : "14px",
        fontWeight : "700",
        color : "#555",
    },
    emptyText : {
        color : "#666",
        fontSize : "14px",
        textAlign : "center",
        padding : "40px 0",
    },
    jobList : {
        display : "flex",
        flexDirection : "column",
        gap : "12px",
    },
    jobCard : {
        backgroundColor : "white",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "18px 22px",
    },
    jobCardTop : {
        display : "flex",
        justifyContent : "space-between",
        alignItems : "flex-start",
        gap : "12px",
        marginBottom : "10px",
    },
    jobTitle : {
        margin : 0,
        fontSize : "17px",
        fontWeight : "800",
        color : "var(--text-color)",
        lineHeight : "1.4",
    },
    organization : {
        margin : "4px 0 0",
        fontSize : "13px",
        color : "#666",
        fontWeight : "700",
    },
    badgeRow : {
        display : "flex",
        gap : "6px",
        flexShrink : 0,
    },
    jobTypeBadge : {
        padding : "4px 9px",
        borderRadius : "999px",
        backgroundColor : "rgba(134, 167, 136, 0.22)",
        color : "#48644b",
        fontSize : "12px",
        fontWeight : "800",
        whiteSpace : "nowrap",
    },
    employmentBadge : {
        padding : "4px 9px",
        borderRadius : "999px",
        backgroundColor : "#eeeeee",
        color : "#555",
        fontSize : "12px",
        fontWeight : "800",
        whiteSpace : "nowrap",
    },
    jobMeta : {
        display : "flex",
        flexWrap : "wrap",
        gap : "8px 16px",
        fontSize : "13px",
        color : "#666",
    },
    metaItem : {
        whiteSpace : "nowrap",
    },
};

export default WelfareJobPostings;
