import { useEffect, useState } from "react";
import { Check, Trash2, X } from "lucide-react";

import { deleteAdmin, fetchAdmins, updateAdminStatus } from "../../api/adminAuthApi";
import AdminLayout from "./AdminLayout";
import { sortAdminsByPendingFirst } from "./adminListUtils";

const statusLabel = {
  PENDING: "승인 대기",
  APPROVED: "승인",
  REJECTED: "거절",
};

function AdminAccounts() {
  const currentAdmin = JSON.parse(sessionStorage.getItem("currentAdmin") || "null");
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const orderedAdmins = sortAdminsByPendingFirst(admins);

  useEffect(() => {
    fetchAdmins()
      .then(setAdmins)
      .catch(() => setLoadError("관리자 계정 목록을 불러오지 못했습니다."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleStatusChange = async (adminId, status) => {
    try {
      setSavingId(adminId);
      const updatedAdmin = await updateAdminStatus(adminId, status);
      setAdmins((current) =>
        current.map((admin) => (admin.id === updatedAdmin.id ? updatedAdmin : admin))
      );
    } catch {
      alert("관리자 계정 상태 변경에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (admin) => {
    const confirmed = window.confirm(`${admin.name} 관리자 계정을 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      setSavingId(admin.id);
      await deleteAdmin(admin.id);
      setAdmins((current) => current.filter((item) => item.id !== admin.id));
    } catch (requestError) {
      if (requestError.status === 409) {
        alert("마지막 승인 관리자는 삭제할 수 없습니다.");
      } else {
        alert("관리자 계정 삭제에 실패했습니다.");
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>관리자 승인 관리</h1>
        <p>신규 관리자 가입 신청을 확인하고 승인 또는 거절합니다.</p>
      </header>

      {loadError ? (
        <p className="admin-error-note">{loadError}</p>
      ) : isLoading ? (
        <p className="admin-empty">관리자 계정을 불러오는 중입니다.</p>
      ) : (
        <div className="admin-table-box">
          <div className="admin-table-summary">총 {orderedAdmins.length}명</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>관리자 아이디</th>
                <th>이메일</th>
                <th>전화번호</th>
                <th>상태</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {orderedAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td className="admin-name-cell">{admin.name}</td>
                  <td>{admin.loginId || "-"}</td>
                  <td>{admin.email}</td>
                  <td>{admin.phone}</td>
                  <td>
                    <span className={`admin-badge admin-account-${admin.status.toLowerCase()}`}>
                      {statusLabel[admin.status] || admin.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-account-actions">
                      {admin.status !== "APPROVED" && (
                        <button
                          className="admin-button primary"
                          type="button"
                          disabled={savingId === admin.id}
                          onClick={() => handleStatusChange(admin.id, "APPROVED")}
                        >
                          <Check size={15} />
                          승인
                        </button>
                      )}
                      {admin.status !== "REJECTED" && (
                        <button
                          className="admin-button"
                          type="button"
                          disabled={savingId === admin.id || currentAdmin?.id === admin.id}
                          onClick={() => handleStatusChange(admin.id, "REJECTED")}
                        >
                          <X size={15} />
                          거절
                        </button>
                      )}
                      <button
                        className="admin-button danger"
                        type="button"
                        disabled={savingId === admin.id || currentAdmin?.id === admin.id}
                        onClick={() => handleDelete(admin)}
                      >
                        <Trash2 size={15} />
                        삭제
                      </button>
                    </div>
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

export default AdminAccounts;
