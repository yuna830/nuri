import { useState } from "react";

import { getGuardianSeniorNames, getGuardianSeniorRelations, updateGuardianActive } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { useAdminData } from "./useAdminData";

const TEXT = {
  title: "\ubcf4\ud638\uc790 \uad00\ub9ac",
  description: "\ubcf4\ud638\uc790 \uacc4\uc815 \uc0c1\ud0dc\uc640 \uc5f0\uacb0\ub41c \uc5b4\ub974\uc2e0\uc744 \ud655\uc778\ud569\ub2c8\ub2e4.",
  loading: "\ubcf4\ud638\uc790 \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4.",
  empty: "\ub4f1\ub85d\ub41c \ubcf4\ud638\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  error: "\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  name: "\uc774\ub984",
  relation: "\uad00\uacc4",
  contact: "\uc5f0\ub77d\ucc98",
  connectedSeniors: "\uc5f0\uacb0 \uc5b4\ub974\uc2e0",
  status: "\uc0c1\ud0dc",
  manage: "\uacc4\uc815 \uad00\ub9ac",
  active: "\ud65c\uc131",
  inactive: "\ube44\ud65c\uc131",
  activate: "\ud65c\uc131\ud654",
  deactivate: "\ube44\ud65c\uc131\ud654",
};

function AdminGuardians() {
  const { seniors, guardians, isLoading, loadError } = useAdminData();
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOverrides, setActiveOverrides] = useState({});
  const [actionMessage, setActionMessage] = useState(null);

  const displayGuardians = guardians.map((guardian) => ({
    ...guardian,
    active: activeOverrides[guardian.id] ?? guardian.active,
  }));

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

      {isLoading ? (
        <p className="admin-empty">{TEXT.loading}</p>
      ) : displayGuardians.length === 0 ? (
        <p className="admin-empty">{TEXT.empty}</p>
      ) : (
        <div className="admin-table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th>{TEXT.relation}</th>
                <th>{TEXT.contact}</th>
                <th>{TEXT.connectedSeniors}</th>
                <th>{TEXT.status}</th>
                <th>{TEXT.manage}</th>
              </tr>
            </thead>
            <tbody>
              {displayGuardians.map((guardian) => {
                const seniorNames = getGuardianSeniorNames(guardian, seniors);
                const seniorRelations = getGuardianSeniorRelations(guardian, seniors);

                return (
                  <tr key={guardian.id} className={guardian.active ? "" : "admin-inactive-row"}>
                    <td className="admin-name-cell">{guardian.name}</td>
                    <td>{seniorRelations.length > 0 ? seniorRelations.join(", ") : "-"}</td>
                    <td>{guardian.phone || "-"}</td>
                    <td>{seniorNames.length > 0 ? seniorNames.join(", ") : "-"}</td>
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
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminGuardians;
