import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { getSeniorGuardians, getSeniorWelfareWorker } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import AdminPagination from "./AdminPagination";
import { getPageCount, paginateItems, sortRecentFirst } from "./adminListUtils";
import { useAdminData } from "./useAdminData";

const TEXT = {
  title: "보호대상자 관리",
  description: "전체 보호대상자 목록과 담당 복지사, 연결 보호자, 계정 상태를 관리합니다.",
  searchPlaceholder: "\uc774\ub984, \uc8fc\uc18c, \ubcf5\uc9c0\uc0ac \uac80\uc0c9",
  loading: "보호대상자 목록을 불러오는 중입니다.",
  name: "\uc774\ub984",
  age: "\ub098\uc774",
  welfare: "\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac",
  guardians: "\uc5f0\uacb0 \ubcf4\ud638\uc790",
  status: "\uc0c1\ud0dc",
  unassigned: "\ubbf8\ubc30\uc815",
  active: "\ud65c\uc131",
  inactive: "\ube44\ud65c\uc131",
  all: "\uc804\uccb4",
  unlinked: "\uc5f0\uacb0 \ud544\uc694",
  guardianUnlinked: "\ubcf4\ud638\uc790 \ubbf8\uc5f0\uacb0",
  welfareUnassigned: "\ubcf5\uc9c0\uc0ac \ubbf8\ubc30\uc815",
};

function AdminSeniors() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { seniors, welfareById, guardianById, isLoading, loadError } = useAdminData();
  const [keyword, setKeyword] = useState("");
  const filter = searchParams.get("filter") || "all";
  const pageParam = Number(searchParams.get("page") || 1);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const filterOptions = [
    { value: "all", label: TEXT.all },
    { value: "unlinked", label: TEXT.unlinked },
    { value: "guardian", label: TEXT.guardianUnlinked },
    { value: "welfare", label: TEXT.welfareUnassigned },
  ];

  const filteredSeniors = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    const connectionFilteredSeniors = seniors.filter((senior) => {
      const worker = getSeniorWelfareWorker(senior, welfareById);
      const guardians = getSeniorGuardians(senior, guardianById);

      if (filter === "guardian") return guardians.length === 0;
      if (filter === "welfare") return !worker;
      if (filter === "unlinked") return !worker || guardians.length === 0;

      return true;
    });

    if (!value) return sortRecentFirst(connectionFilteredSeniors);

    return sortRecentFirst(
      connectionFilteredSeniors.filter((senior) =>
        [senior.name, senior.age, senior.address, getSeniorWelfareWorker(senior, welfareById)?.name]
          .join(" ")
          .toLowerCase()
          .includes(value)
      )
    );
  }, [filter, guardianById, keyword, seniors, welfareById]);
  const pageCount = getPageCount(filteredSeniors);
  const pagedSeniors = paginateItems(filteredSeniors, page);

  const updatePage = useCallback((nextPage) => {
    const params = new URLSearchParams(searchParams);

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (page > pageCount) updatePage(pageCount);
  }, [page, pageCount, updatePage]);

  const updateKeyword = (nextKeyword) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    setKeyword(nextKeyword);
    setSearchParams(params, { replace: true });
  };

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>{TEXT.title}</h1>
        <p>{TEXT.description}</p>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          value={keyword}
          placeholder={TEXT.searchPlaceholder}
          onChange={(event) => updateKeyword(event.target.value)}
        />
        <div className="admin-filter-tabs" aria-label="보호대상자 필터">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`admin-filter-tab${filter === option.value ? " active" : ""}`}
              onClick={() => {
                if (option.value === "all") {
                  setSearchParams({});
                } else {
                  setSearchParams({ filter: option.value });
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <p className="admin-error-note">{loadError}</p>
      ) : isLoading ? (
        <p className="admin-empty">{TEXT.loading}</p>
      ) : (
        <div className="admin-table-box">
          <div className="admin-table-summary">총 {filteredSeniors.length}명</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{TEXT.name}</th>
                <th>{TEXT.age}</th>
                <th>{TEXT.welfare}</th>
                <th>{TEXT.guardians}</th>
                <th>{TEXT.status}</th>
              </tr>
            </thead>
            <tbody>
              {pagedSeniors.map((senior) => {
                const worker = getSeniorWelfareWorker(senior, welfareById);
                const guardians = getSeniorGuardians(senior, guardianById);

                return (
                  <tr
                    key={senior.id}
                    className={`admin-clickable-row ${senior.active ? "" : "admin-inactive-row"}`}
                    onClick={() =>
                      navigate(`/admin/seniors/${senior.id}`, {
                        state: { from: `${location.pathname}${location.search}` },
                      })
                    }
                  >
                    <td className="admin-name-cell">{senior.name}</td>
                    <td>{senior.age ? `${senior.age}\uc138` : "-"}</td>
                    <td>{worker?.name || <span className="admin-badge warning">{TEXT.unassigned}</span>}</td>
                    <td>{guardians.map((guardian) => guardian.name).join(", ") || "-"}</td>
                    <td>
                      <span className={`admin-badge ${senior.active ? "active" : "inactive"}`}>
                        {senior.active ? TEXT.active : TEXT.inactive}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <AdminPagination page={page} pageCount={pageCount} onPageChange={updatePage} />
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminSeniors;
