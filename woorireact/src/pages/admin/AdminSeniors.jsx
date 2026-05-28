import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSeniorGuardians, getSeniorWelfareWorker } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { useAdminData } from "./useAdminData";

function AdminSeniors() {
  const navigate = useNavigate();
  const { seniors, welfareById, guardianById, isLoading, loadError } = useAdminData();
  const [keyword, setKeyword] = useState("");

  const filteredSeniors = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) return seniors;

    return seniors.filter((senior) =>
      [senior.name, senior.age, senior.address, getSeniorWelfareWorker(senior, welfareById)?.name]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [keyword, seniors, welfareById]);

  return (
    <AdminLayout>
      <header className="admin-page-header">
      <h1>어르신 관리</h1>
      <p>전체 어르신 목록과 담당 복지사, 연결 보호자, 계정 상태를 관리합니다.</p>
    </header>

    <div className="admin-toolbar">
      <input
        className="admin-search"
        type="search"
        value={keyword}
        placeholder="이름, 주소, 복지사 검색"
        onChange={(event) => setKeyword(event.target.value)}
      />
    </div>

    {loadError ? (
      <p className="admin-error-note">{loadError}</p>
    ) : isLoading ? (
      <p className="admin-empty">어르신 목록을 불러오는 중입니다.</p>
    ) : (
      <div className="admin-table-box">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>나이</th>
              <th>담당 복지사</th>
              <th>연결 보호자</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {filteredSeniors.map((senior) => {
              const worker = getSeniorWelfareWorker(senior, welfareById);
              const guardians = getSeniorGuardians(senior, guardianById);

              return (
                <tr
                  key={senior.id}
                  className="admin-clickable-row"
                  onClick={() => navigate(`/admin/seniors/${senior.id}`)}
                >
                  <td className="admin-name-cell">{senior.name}</td>
                  <td>{senior.age ? `${senior.age}세` : "-"}</td>
                  <td>
                    {worker?.name || (
                      <span className="admin-badge warning">미배정</span>
                    )}
                  </td>
                  <td>
                    {guardians.map((guardian) => guardian.name).join(", ") || "-"}
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        senior.active ? "active" : "inactive"
                      }`}
                    >
                      {senior.active ? "활성" : "비활성"}
                    </span>
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

export default AdminSeniors;
