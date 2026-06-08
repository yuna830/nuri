import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getWorkerSeniorCount, updateWelfareWorkerActive } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import AdminPagination from "./AdminPagination";
import { getPageCount, paginateItems, sortRecentFirst } from "./adminListUtils";
import { useAdminData } from "./useAdminData";

const TEXT = {
  title: "\ubcf5\uc9c0\uc0ac \uad00\ub9ac",
  description: "복지사 계정 상태와 각자 담당한 보호대상자 수를 확인합니다.",
  loading: "\ubcf5\uc9c0\uc0ac \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4.",
  empty: "\ub4f1\ub85d\ub41c \ubcf5\uc9c0\uc0ac\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  error: "\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  searchPlaceholder: "\uc774\ub984, \ubcf5\uc9c0\uc0ac \uc544\uc774\ub514, \uc18c\uc18d \uac80\uc0c9",
  name: "\uc774\ub984",
  center: "\uc18c\uc18d",
  workerId: "\ubcf5\uc9c0\uc0ac \uc544\uc774\ub514",
  assignedSeniors: "담당 보호대상자",
  status: "\uc0c1\ud0dc",
  manage: "\uacc4\uc815 \uad00\ub9ac",
  active: "\ud65c\uc131",
  inactive: "\ube44\ud65c\uc131",
  activate: "\ud65c\uc131\ud654",
  deactivate: "\ube44\ud65c\uc131\ud654",
  countUnit: "\uba85",
  viewList: "\uba85\ub2e8 \ubcf4\uae30",
  modalTitle: "담당 보호대상자 명단",
  close: "\ub2eb\uae30",
  noAssignedSeniors: "담당 보호대상자가 없습니다.",
  yearsOld: "\uc138",
};

function AdminWelfare() {
  const { seniors, welfareWorkers, isLoading, loadError } = useAdminData();
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOverrides, setActiveOverrides] = useState({});
  const [actionMessage, setActionMessage] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");

  const value = keyword.trim().toLowerCase();
  const displayWorkers = sortRecentFirst(
    welfareWorkers.map((worker) => ({
      ...worker,
      active: activeOverrides[worker.id] ?? worker.active,
    })).filter((worker) =>
      !value ||
      [worker.name, worker.workerId, worker.center]
        .join(" ")
        .toLowerCase()
        .includes(value)
    )
  );
  const pageCount = getPageCount(displayWorkers);
  const pagedWorkers = paginateItems(displayWorkers, page);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const updateKeyword = (nextKeyword) => {
    setKeyword(nextKeyword);
    setPage(1);
  };

  const toggleActive = async (worker) => {
    setUpdatingId(worker.id);
    setActionMessage(null);

    try {
      const updatedWorker = await updateWelfareWorkerActive(worker.id, !worker.active);
      setActiveOverrides((current) => ({ ...current, [worker.id]: updatedWorker.active }));
      setActionMessage({
        type: "success",
        text: "\uacc4\uc815 \uc0c1\ud0dc\uac00 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
      });
    } catch {
      setActionMessage({
        type: "error",
        text: "\uacc4\uc815 \uc0c1\ud0dc \uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getAssignedSeniors = (workerId) =>
    seniors.filter((senior) => String(senior.welfareId) === String(workerId));

  const selectedSeniors = selectedWorker ? getAssignedSeniors(selectedWorker.id) : [];

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>{TEXT.title}</h1>
        <p>{TEXT.description}</p>
      </header>

      {loadError ? <p className="admin-empty">{TEXT.error}</p> : null}
      {actionMessage ? (
        <p className={`admin-action-message ${actionMessage.type}`}>{actionMessage.text}</p>
      ) : null}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          value={keyword}
          placeholder={TEXT.searchPlaceholder}
          onChange={(event) => updateKeyword(event.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="admin-empty">{TEXT.loading}</p>
      ) : displayWorkers.length === 0 ? (
        <p className="admin-empty">{TEXT.empty}</p>
      ) : (
        <div className="admin-table-box">
          <div className="admin-table-summary">총 {displayWorkers.length}명</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th>{TEXT.workerId}</th>
                <th>{TEXT.center}</th>
                <th>{TEXT.assignedSeniors}</th>
                <th>{TEXT.status}</th>
                <th>{TEXT.manage}</th>
              </tr>
            </thead>
            <tbody>
              {pagedWorkers.map((worker) => (
                <tr key={worker.id} className={worker.active ? "" : "admin-inactive-row"}>
                  <td className="admin-name-cell">{worker.name}</td>
                  <td>{worker.workerId || "-"}</td>
                  <td>{worker.center || "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-count-button"
                      onClick={() => setSelectedWorker(worker)}
                      aria-label={`${worker.name} ${TEXT.viewList}`}
                    >
                      {getWorkerSeniorCount(worker.id, seniors)}
                      {TEXT.countUnit}
                    </button>
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
          <AdminPagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}

      {selectedWorker ? (
        <div className="admin-modal-overlay" role="presentation" onClick={() => setSelectedWorker(null)}>
          <section
            className="admin-small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assigned-seniors-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="assigned-seniors-title">{TEXT.modalTitle}</h2>
                <p>{`${selectedWorker.name} / ${selectedWorker.workerId || "-"}`}</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setSelectedWorker(null)}>
                {TEXT.close}
              </button>
            </div>

            {selectedSeniors.length > 0 ? (
              <ul className="admin-modal-list">
                {selectedSeniors.map((senior) => (
                  <li key={senior.id}>
                    <Link className="admin-modal-list-link" to={`/admin/seniors/${senior.id}`}>
                      <strong>{senior.name}</strong>
                      <span>
                        {[senior.age ? `${senior.age}${TEXT.yearsOld}` : "", senior.address]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-modal-empty">{TEXT.noAssignedSeniors}</p>
            )}
          </section>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default AdminWelfare;
