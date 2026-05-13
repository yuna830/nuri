function WelfareSummaryCards({ counts }) {
    return (
        <div className="wd-summary-grid">
            <div className="wd-summary-box">
                <p className="wd-summary-label">전체 대상자</p>
                <p className="wd-summary-value">{counts.total}명</p>
            </div>

            <div className="wd-summary-box">
                <p className="wd-summary-label">일자리 신청</p>
                <p className="wd-summary-value">{counts.jobApplicants}명</p>
            </div>

            <div className="wd-summary-box">
                <p className="wd-summary-label">검토 대기</p>
                <p className="wd-summary-value">{counts.pendingReview}명</p>
            </div>

            <div className="wd-summary-box">
                <p className="wd-summary-label">검토 완료</p>
                <p className="wd-summary-value">{counts.completedReview}명</p>
            </div>
        </div>
    );
}

export default WelfareSummaryCards;
