import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";

import "../../css/welfare/WelfareJobPostings.css";

const JOB_CATEGORIES = [
    { key: "전체", label: "전체" },
    { key: "안내", label: "안내" },
    { key: "환경 정비", label: "환경 정비" },
    { key: "실내 보조", label: "실내 보조" },
    { key: "복지 보조", label: "복지 보조" },
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

function WelfareJobPostings() {
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
                    <strong className="wj-service-name">우리 woori</strong>
                </div>

                <div className="wj-header-title">노인일자리 공고</div>
            </header>

            <main className="wj-content">
                <div className="wj-header-row">
                    <Link
                        to={senior ? `/welfare/seniors/${senior.id}` : "/welfare"}
                        className="wj-back-link"
                    >
                        {senior ? "상세정보로" : "목록으로"}
                    </Link>
                </div>

                <div className="wj-layout">
                    <nav className="wj-sidebar">
                        <strong className="wj-sidebar-title">직종 분류</strong>

                        {JOB_CATEGORIES.map((category) => (
                            <button
                                type="button"
                                key={category.key}
                                className={`wj-sidebar-item${activeCategory === category.key ? " wj-sidebar-item-active" : ""}`}
                                onClick={() => setActiveCategory(category.key)}
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
                            {activeCategory === "전체" ? pageTitle : activeCategory} · {filteredJobs.length}건
                        </p>

                        {filteredJobs.length === 0 && (
                            <p className="wj-empty-text">검색 결과가 없습니다.</p>
                        )}

                        <div className="wj-job-list">
                            {filteredJobs.map((job) => (
                                <article key={job.jobId} className="wj-job-card">
                                    <div className="wj-job-card-top">
                                        <div>
                                            <h2 className="wj-job-title">{job.title}</h2>
                                            <p className="wj-organization">{job.organization}</p>
                                        </div>

                                        <div className="wj-badge-row">
                                            <span className="wj-job-type-badge">{job.jobType}</span>
                                            <span className="wj-employment-badge">{job.employmentType}</span>
                                        </div>
                                    </div>

                                    <div className="wj-job-meta">
                                        <span className="wj-meta-item">📍 {job.workPlace}</span>
                                        <span className="wj-meta-item">📅 {job.recruitPeriod}</span>
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

export default WelfareJobPostings;
