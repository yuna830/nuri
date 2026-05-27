import { ShieldCheck, UserCheck, UserRound, UsersRound } from "lucide-react";

import {
  getGuardianSeniorNames,
  getSeniorGuardians,
  getSeniorWelfareWorker,
  getWorkerSeniorCount,
} from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { useAdminData } from "./useAdminData";

function AdminDashboard() {
  const { seniors, welfareWorkers, guardians, welfareById, guardianById, isLoading, loadError } = useAdminData();

  const unlinkedSeniorCount = seniors.filter(
    (senior) => !senior.welfareId || (senior.guardianIds || []).length === 0
  ).length;

  const summaryCards = [
    { label: "\uc5b4\ub974\uc2e0", value: seniors.length, icon: UserRound },
    { label: "\ubcf5\uc9c0\uc0ac", value: welfareWorkers.length, icon: ShieldCheck },
    { label: "\ubcf4\ud638\uc790", value: guardians.length, icon: UsersRound },
    { label: "\ubbf8\uc5f0\uacb0 \uc5b4\ub974\uc2e0", value: unlinkedSeniorCount, icon: UserCheck },
  ];

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
                <article key={card.label} className="admin-summary-card">
                  <div>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                  <Icon size={28} />
                </article>
              );
            })}
          </section>

          <section className="admin-section">
            <header className="admin-page-header">
              <h1>{"\ucd5c\uadfc \uc5b4\ub974\uc2e0 \uc5f0\uacb0 \ud604\ud669"}</h1>
              <p>{"\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac\uc640 \ubcf4\ud638\uc790 \uc5f0\uacb0\uc774 \ube44\uc5b4 \uc788\ub294\uc9c0 \ube60\ub974\uac8c \ud655\uc778\ud569\ub2c8\ub2e4."}</p>
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
                  {seniors.slice(0, 5).map((senior) => {
                    const worker = getSeniorWelfareWorker(senior, welfareById);
                    const seniorGuardians = getSeniorGuardians(senior, guardianById);

                    return (
                      <tr key={senior.id}>
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
                {welfareWorkers.map((worker) => (
                  <div key={worker.id} className="admin-linked-item">
                    <strong>{worker.name}</strong>
                    <span>{`${worker.center} · \ub2f4\ub2f9 \uc5b4\ub974\uc2e0 ${getWorkerSeniorCount(worker.id, seniors)}\uba85`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-panel">
              <h2>{"\ubcf4\ud638\uc790 \uc5f0\uacb0 \ud604\ud669"}</h2>
              <div className="admin-linked-list">
                {guardians.map((guardian) => {
                  const names = getGuardianSeniorNames(guardian, seniors);

                  return (
                    <div key={guardian.id} className="admin-linked-item">
                      <strong>{guardian.name}</strong>
                      <span>{names.length > 0 ? names.join(", ") : "\uc5f0\uacb0\ub41c \uc5b4\ub974\uc2e0 \uc5c6\uc74c"}</span>
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
