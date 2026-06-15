import { useNavigate } from "react-router-dom";
import { formatSeniorId } from "../../utils/welfare/welfareSenior";
import {
    formatSeniorNameInfo,
    getBadgeClass,
    getSeniorReviewStatus,
} from "../../utils/welfare/welfareDashboardData";
import { shouldHideLastAccess } from "../../utils/welfare/welfareTime";

function WelfareSeniorTable({ seniors, onSelectSenior }) {
    const navigate = useNavigate();

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
                        <tr
                            key={senior.id}
                            className={`wd-clickable-row${senior.alertStatus?.includes("SOS") ? " wd-row-sos" : ""}`}
                            onClick={() => {
                                if (onSelectSenior) {
                                    onSelectSenior(senior);
                                    return;
                                }

                                navigate(`/welfare/seniors/${senior.id}`);
                            }}
                        >
                            <td>{formatSeniorId(senior.id)}</td>
                            <td><span className="wd-name-text">{formatSeniorNameInfo(senior)}</span></td>
                            <td><span className="wd-cell-text">{senior.region}</span></td>
                            <td><span className={getBadgeClass("health", senior.healthStatus)}>{senior.healthStatus}</span></td>
                            <td><span className={getBadgeClass("alert", senior.alertStatus)}>{senior.alertStatus}</span></td>
                            <td><span className={getBadgeClass("workRequest", getSeniorReviewStatus(senior))}>{getSeniorReviewStatus(senior)}</span></td>
                            <td><span className="wd-cell-text">{shouldHideLastAccess(senior.lastAccess) ? "" : senior.lastAccess}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default WelfareSeniorTable;