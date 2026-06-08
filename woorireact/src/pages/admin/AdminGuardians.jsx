import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { updateGuardianActive } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import AdminPagination from "./AdminPagination";
import { getPageCount, paginateItems, sortRecentFirst } from "./adminListUtils";
import { useAdminData } from "./useAdminData";

const TEXT = {
  title: "\ubcf4\ud638\uc790 \uad00\ub9ac",
  description: "보호자 계정 상태와 연결된 보호대상자를 확인합니다.",
  loading: "\ubcf4\ud638\uc790 \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4.",
  empty: "\ub4f1\ub85d\ub41c \ubcf4\ud638\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  error: "\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  searchPlaceholder: "\uc774\ub984, \uc5f0\ub77d\ucc98, \uc5f0\uacb0 \ubcf4\ud638\ub300\uc0c1\uc790 \uac80\uc0c9",
  name: "\uc774\ub984",
  contact: "\uc5f0\ub77d\ucc98",
  connectedSeniors: "연결 보호대상자",
  status: "\uc0c1\ud0dc",
  manage: "\uacc4\uc815 \uad00\ub9ac",
  active: "\ud65c\uc131",
  inactive: "\ube44\ud65c\uc131",
  activate: "\ud65c\uc131\ud654",
  deactivate: "\ube44\ud65c\uc131\ud654",
  viewList: "\uba85\ub2e8 \ubcf4\uae30",
  countUnit: "\uba85",
  modalTitle: "연결 보호대상자 명단",
  close: "\ub2eb\uae30",
  noConnectedSeniors: "연결된 보호대상자가 없습니다.",
};

function AdminGuardians() {
  const location = useLocation();
  const { seniors, guardians, isLoading, loadError } = useAdminData();
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOverrides, setActiveOverrides] = useState({});
  const [actionMessage, setActionMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [keyword, setKeyword] = useState("");
  const value = keyword.trim().toLowerCase();

  const getConnectedSeniors = (guardian) => {
    if (guardian.seniors?.length) return guardian.seniors;

    const seniorIdSet = new Set((guardian.seniorIds || []).map(String));
    return seniors.filter((senior) => seniorIdSet.has(String(senior.id)));
  };

  const displayGuardians = sortRecentFirst(
    guardians.map((guardian) => ({
      ...guardian,
      active: activeOverrides[guardian.id] ?? guardian.active,
    })).filter((guardian) =>
      !value ||
      [
        guardian.name,
        guardian.phone,
        ...getConnectedSeniors(guardian).map((senior) => senior.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    )
  );
  const pageCount = getPageCount(displayGuardians);
  const pagedGuardians = paginateItems(displayGuardians, page);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const updateKeyword = (nextKeyword) => {
    setKeyword(nextKeyword);
    setPage(1);
  };

  const selectedSeniors = selectedGuardian ? getConnectedSeniors(selectedGuardian) : [];

  const toggleActive = async (guardian) => {
    setUpdatingId(guardian.id);
    setActionMessage(null);

    try {
      const updatedGuardian = await updateGuardianActive(guardian.id, !guardian.active);
      setActiveOverrides((current) => ({ ...current, [guardian.id]: updatedGuardian.active }));
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
      ) : displayGuardians.length === 0 ? (
        <p className="admin-empty">{TEXT.empty}</p>
      ) : (
        <div className="admin-table-box">
          <div className="admin-table-summary">총 {displayGuardians.length}명</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th>{TEXT.contact}</th>
                <th>{TEXT.connectedSeniors}</th>
                <th>{TEXT.status}</th>
                <th>{TEXT.manage}</th>
              </tr>
            </thead>
            <tbody>
              {pagedGuardians.map((guardian) => {
                const connectedSeniors = getConnectedSeniors(guardian);

                return (
                  <tr key={guardian.id} className={guardian.active ? "" : "admin-inactive-row"}>
                    <td className="admin-name-cell">{guardian.name}</td>
                    <td>{guardian.phone || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-count-button"
                        onClick={() => setSelectedGuardian(guardian)}
                        aria-label={`${guardian.name} ${TEXT.viewList}`}
                      >
                        {connectedSeniors.length}
                        {TEXT.countUnit}
                      </button>
                    </td>
                    <td>
                      <span className={`admin-badge ${guardian.active ? "active" : "inactive"}`}>
                        {guardian.active ? TEXT.active : TEXT.inactive}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-button"
                        onClick={() => toggleActive(guardian)}
                        disabled={updatingId === guardian.id}
                      >
                        {guardian.active ? TEXT.deactivate : TEXT.activate}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <AdminPagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}

      {selectedGuardian ? (
        <div className="admin-modal-overlay" role="presentation" onClick={() => setSelectedGuardian(null)}>
          <section
            className="admin-small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-seniors-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="guardian-seniors-title">{TEXT.modalTitle}</h2>
                <p>{`${selectedGuardian.name} / ${selectedGuardian.phone || "-"}`}</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setSelectedGuardian(null)}>
                {TEXT.close}
              </button>
            </div>

            {selectedSeniors.length > 0 ? (
              <ul className="admin-modal-list">
                {selectedSeniors.map((senior) => (
                  <li key={senior.id}>
                    <Link
                      className="admin-modal-list-link"
                      to={`/admin/seniors/${senior.id}`}
                      state={{ from: `${location.pathname}${location.search}` }}
                    >
                      <strong>{senior.name}</strong>
                      <span>
                        {[senior.relation || "\uad00\uacc4 \ubbf8\ub4f1\ub85d", senior.phone || "\uc5f0\ub77d\ucc98 \uc5c6\uc74c"].join(" / ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-modal-empty">{TEXT.noConnectedSeniors}</p>
            )}
          </section>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default AdminGuardians;
