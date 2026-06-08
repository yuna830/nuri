import { ShieldCheck, UserCheck, UserRound, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import {
  getGuardianSeniorNames,
  getSeniorGuardians,
  getSeniorWelfareWorker,
  getWorkerSeniorCount,
} from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { sortRecentFirst } from "./adminListUtils";
import { useAdminData } from "./useAdminData";

function AdminDashboard() {
  const { seniors, welfareWorkers, guardians, welfareById, guardianById, isLoading, loadError } = useAdminData();

  const needsConnectionCount = seniors.filter((senior) => {
    const worker = getSeniorWelfareWorker(senior, welfareById);
    const seniorGuardians = getSeniorGuardians(senior, guardianById);

    return !worker || seniorGuardians.length === 0;
  }).length;

  const summaryCards = [
    { label: "보호대상자", value: seniors.length, icon: UserRound },
    { label: "\ubcf5\uc9c0\uc0ac", value: welfareWorkers.length, icon: ShieldCheck },
    { label: "\ubcf4\ud638\uc790", value: guardians.length, icon: UsersRound },
    {
      label: "연결 필요 보호대상자",
      value: needsConnectionCount,
      icon: UserCheck,
      to: "/admin/seniors?filter=unlinked",
      hint: "\ubcf4\ud638\uc790 \ub610\ub294 \ubcf5\uc9c0\uc0ac \uc5f0\uacb0 \ud544\uc694",
    },
  ];
  const recentSeniors = sortRecentFirst(seniors).slice(0, 5);
  const recentWelfareWorkers = sortRecentFirst(welfareWorkers).slice(0, 5);
  const recentGuardians = sortRecentFirst(guardians).slice(0, 5);

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>{"\uad00\ub9ac\uc790 \ub300\uc2dc\ubcf4\ub4dc"}</h1>
        <p>{"\uc11c\ube44\uc2a4 \ud68c\uc6d0 \uc5f0\uacb0 \uc0c1\ud0dc\uc640 \uacc4\uc815 \ud604\ud669\uc744 \ud55c\ub208\uc5d0 \ud655\uc778\ud569\ub2c8\ub2e4."}</p>
      </header>

      {loadError ? (
        <p className="admin-error-note">{loadError}</p>
      ) : isLoading ? (
        <p className="admin-empty">{"\uad00\ub9ac\uc790 \ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4."}</p>
      ) : (
        <>
          <section className="admin-summary-grid" aria-label="\uc804\uccb4 \ud604\ud669">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.label}
                  className={`admin-summary-card${card.to ? " clickable" : ""}`}
                  to={card.to || "#"}
                  onClick={(event) => {
                    if (!card.to) event.preventDefault();
                  }}
                >
                  <div>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    {card.hint ? <em>{card.hint}</em> : null}
                  </div>
                  <Icon size={28} />
                </Link>
              );
            })}
          </section>

          <section className="admin-section">
            <header className="admin-page-header">
              <h1>{"최근 가입 보호대상자 현황"}</h1>
              <p>{"최근 가입한 보호대상자 5명의 연결 상태를 확인합니다."}</p>
            </header>

            <div className="admin-table-box">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{"\uc774\ub984"}</th>
                    <th>{"\ub098\uc774"}</th>
                    <th>{"\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac"}</th>
                    <th>{"\uc5f0\uacb0 \ubcf4\ud638\uc790"}</th>
                    <th>{"\uc0c1\ud0dc"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSeniors.map((senior) => {
                    const worker = getSeniorWelfareWorker(senior, welfareById);
                    const seniorGuardians = getSeniorGuardians(senior, guardianById);

                    return (
                      <tr key={senior.id} className={senior.active ? "" : "admin-inactive-row"}>
                        <td className="admin-name-cell">{senior.name}</td>
                        <td>{senior.age ? `${senior.age}\uc138` : "-"}</td>
                        <td>{worker?.name || <span className="admin-badge warning">{"\ubbf8\ubc30\uc815"}</span>}</td>
                        <td>{seniorGuardians.map((guardian) => guardian.name).join(", ") || "-"}</td>
                        <td>
                          <span className={`admin-badge ${senior.active ? "active" : "inactive"}`}>
                            {senior.active ? "\ud65c\uc131" : "\ube44\ud65c\uc131"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-detail-grid">
            <div className="admin-panel">
              <h2>{"\ubcf5\uc9c0\uc0ac \ub2f4\ub2f9 \ud604\ud669"}</h2>
              <div className="admin-linked-list">
                {recentWelfareWorkers.map((worker) => (
                  <div key={worker.id} className="admin-linked-item">
                    <strong>{worker.name}</strong>
                    <span>{`${worker.center} / 담당 보호대상자 ${getWorkerSeniorCount(worker.id, seniors)}명`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-panel">
              <h2>{"\ubcf4\ud638\uc790 \uc5f0\uacb0 \ud604\ud669"}</h2>
              <div className="admin-linked-list">
                {recentGuardians.map((guardian) => {
                  const names = getGuardianSeniorNames(guardian, seniors);

                  return (
                    <div key={guardian.id} className="admin-linked-item">
                      <strong>{guardian.name}</strong>
                      <span>{names.length > 0 ? names.join(", ") : "연결된 보호대상자 없음"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
