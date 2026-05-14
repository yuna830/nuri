import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";

import {
    WELFARE_DEMO_JOBS,
    findWelfareDemoSenior,
} from "../../data/welfareSeniorDemoData";
import "../../css/welfare/WelfareJobPostings.css";

const JOB_CATEGORIES = [
    { label: "전체", value: "", keywords: [] },
    { label: "환경미화", value: "환경미화", keywords: ["환경", "정비", "미화", "청소"] },
    { label: "경비·보안", value: "경비·보안", keywords: ["경비", "보안", "안전"] },
    { label: "요양·돌봄", value: "요양·돌봄", keywords: ["요양", "돌봄", "간병", "보호"] },
    { label: "사무보조", value: "사무보조", keywords: ["사무", "행정", "전산", "문서", "안내", "민원", "자료"] },
    { label: "생산·제조", value: "생산·제조", keywords: ["생산", "제조", "포장", "조립"] },
    { label: "운전·배달", value: "운전·배달", keywords: ["운전", "배송", "배달", "택배"] },
    { label: "조리·식품", value: "조리·식품", keywords: ["조리", "급식", "식당", "주방", "배식"] },
    { label: "물류·유통", value: "물류·유통", keywords: ["물류", "유통", "매장", "판매"] },
    { label: "기타", value: "기타", keywords: [] },
];

const getRegionDistrict = (region = "") => {
    const districtMatch = String(region).match(/[가-힣]+구/);
    return districtMatch ? districtMatch[0] : "";
};

const getSavedAddedSeniors = () => [];

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

const categorizeWelfareJob = (job) => {
    const text = [
        job.title,
        job.organization,
        job.workPlace,
        job.jobType,
        job.employmentType,
    ].filter(Boolean).join(" ");

    for (const category of JOB_CATEGORIES) {
        if (!category.keywords.length) continue;
        if (category.keywords.some((keyword) => text.includes(keyword))) {
            return category.label;
        }
    }

    return "기타";
};

function WelfareJobPostings() {
    const { id } = useParams();
    const senior = id ? findWelfareSenior(id) : null;
    const allJobs = senior ? findRecommendedJobs(senior) : WELFARE_DEMO_JOBS;
    const [activeCategory, setActiveCategory] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [hideClosedJobs, setHideClosedJobs] = useState(true);

    const filteredJobs = allJobs.filter((job) => {
        const matchCategory = activeCategory === "" || categorizeWelfareJob(job) === activeCategory;
        const matchDeadline = !hideClosedJobs || job.deadlineStatus !== "마감";
        const keyword = searchKeyword.trim().toLowerCase();
        const matchKeyword =
            keyword === "" ||
            [job.title, job.organization, job.workPlace, job.deadlineStatus]
                .some((value) => String(value).toLowerCase().includes(keyword));

        return matchCategory && matchDeadline && matchKeyword;
    });

    const pageTitle = senior ? `${senior.name} 추천 공고` : "전체 일자리 공고";

    return (
        <div className="wj-page">
            <header className="wj-header">
        <div className="wj-brand-area">
            <Link to="/welfare" className="wj-service-name">
            우리 woori
            </Link>
        </div>

        <div className="wj-header-title">노인일자리 공고</div>
        </header>

            <main className="wj-content">
                {senior && (
                    <div className="wj-header-row">
                        <Link
                            to={`/welfare/seniors/${senior.id}`}
                            className="wj-back-link"
                        >
                            상세정보로
                        </Link>
                    </div>
                )}

                <div className="wj-layout">
                    <nav className="wj-sidebar" aria-label="직종 분류">
                        <strong className="wj-sidebar-title">직종 분류</strong>

                        {JOB_CATEGORIES.map((category) => (
                            <button
                                type="button"
                                key={category.label}
                                className={`wj-sidebar-item${activeCategory === category.value ? " wj-sidebar-item-active" : ""}`}
                                onClick={() => setActiveCategory(category.value)}
                            >
                                {category.label}
                            </button>
                        ))}
                    </nav>

                    <div className="wj-main-area">
                        <div className="wj-search-row">
                            <Search size={16} className="wj-search-icon" />

                            <input
                                type="search"
                                value={searchKeyword}
                                onChange={(event) => setSearchKeyword(event.target.value)}
                                placeholder="공고명, 기업명, 근무지 검색..."
                                className="wj-search-input"
                            />

                            <span className="wj-search-divider" />

                            <label className="wj-hide-closed-label">
                                <input
                                    type="checkbox"
                                    checked={hideClosedJobs}
                                    onChange={(event) => setHideClosedJobs(event.target.checked)}
                                    className="wj-hide-closed-checkbox"
                                />
                                마감 숨기기
                            </label>
                        </div>

                        <p className="wj-result-count">
                            {activeCategory === "" ? pageTitle : activeCategory} · {filteredJobs.length}건
                        </p>

                        {filteredJobs.length === 0 && (
                            <p className="wj-empty-text">검색 결과가 없습니다.</p>
                        )}

                        <div className="wj-job-list">
                            {filteredJobs.map((job) => {
                                const jobCategory = categorizeWelfareJob(job);

                                return (
                                    <article key={job.jobId} className="wj-job-card">
                                        <div className="wj-job-card-accent" />

                                        <div className="wj-job-card-top">
                                            <div>
                                                <h2 className="wj-job-title">{job.title}</h2>
                                                <p className="wj-organization">🏢 {job.organization}</p>
                                            </div>

                                            <div className="wj-badge-row">
                                                <span className="wj-job-type-badge">{jobCategory}</span>
                                                <span className="wj-employment-badge">{job.employmentType}</span>
                                            </div>
                                        </div>

                                        <div className="wj-job-meta">
                                            <span className="wj-meta-item">📍 {job.workPlace}</span>
                                            {job.workDays && (
                                                <span className="wj-meta-item">📋 {job.workDays}</span>
                                            )}
                                            <span className="wj-meta-item">📅 {job.recruitPeriod}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default WelfareJobPostings;
