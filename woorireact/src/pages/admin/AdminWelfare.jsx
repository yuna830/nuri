import { useState } from "react";

import { getWorkerSeniorCount, updateWelfareWorkerActive } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { useAdminData } from "./useAdminData";

const TEXT = {
  title: "\ubcf5\uc9c0\uc0ac \uad00\ub9ac",
  description: "\ubcf5\uc9c0\uc0ac \uacc4\uc815 \uc0c1\ud0dc\uc640 \uac01\uc790 \ub2f4\ub2f9\ud55c \uc5b4\ub974\uc2e0 \uc218\ub97c \ud655\uc778\ud569\ub2c8\ub2e4.",
  loading: "\ubcf5\uc9c0\uc0ac \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4.",
  empty: "\ub4f1\ub85d\ub41c \ubcf5\uc9c0\uc0ac\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  error: "\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  name: "\uc774\ub984",
  center: "\uc18c\uc18d",
  contact: "\uc5f0\ub77d\ucc98",
  assignedSeniors: "\ub2f4\ub2f9 \uc5b4\ub974\uc2e0",
  status: "\uc0c1\ud0dc",
  manage: "\uacc4\uc815 \uad00\ub9ac",
  active: "\ud65c\uc131",
  inactive: "\ube44\ud65c\uc131",
  activate: "\ud65c\uc131\ud654",
  deactivate: "\ube44\ud65c\uc131\ud654",
  countUnit: "\uba85",
};

function AdminWelfare() {
  const { seniors, welfareWorkers, isLoading, loadError, reload } = useAdminData();
  const [updatingId, setUpdatingId] = useState(null);

  const toggleActive = async (worker) => {
    setUpdatingId(worker.id);

    try {
      await updateWelfareWorkerActive(worker.id, !worker.active);
      await reload();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>{TEXT.title}</h1>
        <p>{TEXT.description}</p>
      </header>

      {loadError ? <p className="admin-empty">{TEXT.error}</p> : null}

      {isLoading ? (
        <p className="admin-empty">{TEXT.loading}</p>
      ) : welfareWorkers.length === 0 ? (
        <p className="admin-empty">{TEXT.empty}</p>
      ) : (
        <div className="admin-table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th>{TEXT.center}</th>
                <th>{TEXT.contact}</th>
                <th>{TEXT.assignedSeniors}</th>
                <th>{TEXT.status}</th>
                <th>{TEXT.manage}</th>
              </tr>
            </thead>
            <tbody>
              {welfareWorkers.map((worker) => (
                <tr key={worker.id}>
                  <td className="admin-name-cell">{worker.name}</td>
                  <td>{worker.center || "-"}</td>
                  <td>{worker.phone || "-"}</td>
                  <td>
                    {getWorkerSeniorCount(worker.id, seniors)}
                    {TEXT.countUnit}
                  </td>
                  <td>
                    <span className={`admin-badge ${worker.active ? "active" : "inactive"}`}>
                      {worker.active ? TEXT.active : TEXT.inactive}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-button"
                      onClick={() => toggleActive(worker)}
                      disabled={updatingId === worker.id}
                    >
                      {worker.active ? TEXT.deactivate : TEXT.activate}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminWelfare;
