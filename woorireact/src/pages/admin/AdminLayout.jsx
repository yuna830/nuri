import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, ShieldCheck, UserCog, UserRound, UsersRound } from "lucide-react";

import { deleteCurrentAdmin } from "../../api/adminAuthApi";
import "../../css/admin/Admin.css";

const text = {
  admin: "\uad00\ub9ac\uc790",
  console: "\uad00\ub9ac\uc790 \ucf58\uc194",
  summary: "\ud68c\uc6d0 \uc5f0\uacb0\uacfc \uacc4\uc815 \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.",
  menu: "\uad00\ub9ac\uc790 \uba54\ub274",
  dashboard: "\ub300\uc2dc\ubcf4\ub4dc",
  seniors: "보호대상자 관리",
  welfare: "\ubcf5\uc9c0\uc0ac \uad00\ub9ac",
  guardians: "\ubcf4\ud638\uc790 \uad00\ub9ac",
  accounts: "\uad00\ub9ac\uc790 \uc2b9\uc778 \uad00\ub9ac",
  logout: "\ub85c\uadf8\uc544\uc6c3",
};

function AdminLayout({ children }) {
  const navigate = useNavigate();
  const currentAdmin = JSON.parse(sessionStorage.getItem("currentAdmin") || "null");

  const handleLogout = () => {
    sessionStorage.removeItem("currentAdmin");
    navigate("/admin/login");
  };

  const handleWithdraw = async () => {
    const confirmed = window.confirm("\uad00\ub9ac\uc790 \uacc4\uc815\uc744 \ud0c8\ud1f4\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c? \uc0ad\uc81c\ud55c \uacc4\uc815\uc740 \ubcf5\uad6c\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");
    if (!confirmed) return;

    try {
      await deleteCurrentAdmin();
      sessionStorage.removeItem("currentAdmin");
      alert("\uad00\ub9ac\uc790 \uacc4\uc815\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
      navigate("/admin/login");
    } catch (requestError) {
      if (requestError.status === 409) {
        alert("\ub9c8\uc9c0\ub9c9 \uc2b9\uc778 \uad00\ub9ac\uc790\ub294 \ud0c8\ud1f4\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\ub978 \uad00\ub9ac\uc790\ub97c \uba3c\uc800 \uc2b9\uc778\ud574\uc8fc\uc138\uc694.");
      } else {
        alert("\uad00\ub9ac\uc790 \ud0c8\ud1f4\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.");
      }
    }
  };

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <button className="admin-sidebar-logo" type="button" onClick={() => navigate("/admin")}>
          <span>woori</span> admin
        </button>

        <nav className="admin-sidebar-nav" aria-label={text.menu}>
          <NavLink to="/admin" end className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
            <LayoutDashboard size={18} />
            {text.dashboard}
          </NavLink>
          <NavLink to="/admin/seniors" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
            <UserRound size={18} />
            {text.seniors}
          </NavLink>
          <NavLink to="/admin/welfare" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
            <ShieldCheck size={18} />
            {text.welfare}
          </NavLink>
          <NavLink to="/admin/guardians" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
            <UsersRound size={18} />
            {text.guardians}
          </NavLink>
          <NavLink to="/admin/accounts" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
            <UserCog size={18} />
            {text.accounts}
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <strong>{currentAdmin?.name || text.admin}</strong>
          <span>{currentAdmin?.email || text.console}</span>
          <button type="button" onClick={handleLogout}>
            <LogOut size={16} />
            {text.logout}
          </button>
          <button className="admin-withdraw-button" type="button" onClick={handleWithdraw}>
            관리자 탈퇴
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <strong>{text.console}</strong>
          <div className="admin-topbar-actions">
            <span>{currentAdmin?.name || text.admin}</span>
            <button type="button" onClick={handleLogout}>
              <LogOut size={15} />
              {text.logout}
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </section>
    </div>
  );
}

export default AdminLayout;
