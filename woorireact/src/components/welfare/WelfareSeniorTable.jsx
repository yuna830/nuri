import { useNavigate } from "react-router-dom";
import { formatSeniorId } from "../../utils/welfare/welfareSenior";
import {
    formatSeniorNameInfo,
    getBadgeClass,
    getSeniorReviewStatus,
} from "../../utils/welfare/welfareDashboardData";
import { shouldHideLastAccess } from "../../utils/welfare/welfareTime";

function WelfareSeniorTable({ seniors }) {
    const navigate = useNavigate();
    const openDetail = (senior, category) => {
        navigate(`/welfare/seniors/${senior.id}`, { state: { category, senior } });
    };

    return (
        <div className="wd-table-box">
            <table className="wd-table" aria-label="대상자 목록">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>이름</th>
                        <th>거주 지역</th>
                        <th>건강 상태</th>
                        <th>알림 상태</th>
                        <th>확인여부</th>
                        <th>마지막 접속</th>
                    </tr>
                </thead>

                <tbody>
                    {seniors.map((senior) => (
                        <tr key={senior.id}>
                            <td>{formatSeniorId(senior.id)}</td>
                            <td>
                                <button
                                    type="button"
                                    className="wd-table-link-button wd-name-text"
                                    onClick={() => openDetail(senior, "기본 정보")}
                                >
                                    {formatSeniorNameInfo(senior)}
                                </button>
                            </td>
                            <td>
                                <button
                                    type="button"
                                    className="wd-table-link-button wd-cell-text"
                                    onClick={() => openDetail(senior, "기본 정보")}
                                >
                                    {senior.region}
                                </button>
                            </td>
                            <td>
                                <button
                                    type="button"
                                    className="wd-table-link-button"
                                    onClick={() => openDetail(senior, "건강 정보")}
                                >
                                    <span className={getBadgeClass("health", senior.healthStatus)}>{senior.healthStatus}</span>
                                </button>
                            </td>
                            <td><span className={getBadgeClass("alert", senior.alertStatus)}>{senior.alertStatus}</span></td>
                            <td>
                                <button
                                    type="button"
                                    className="wd-table-link-button"
                                    onClick={() => openDetail(senior, "일자리 요청 상태")}
                                >
                                    <span className={getBadgeClass("workRequest", getSeniorReviewStatus(senior))}>{getSeniorReviewStatus(senior)}</span>
                                </button>
                            </td>
                            <td><span className="wd-cell-text">{shouldHideLastAccess(senior.lastAccess) ? "" : senior.lastAccess}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default WelfareSeniorTable;
