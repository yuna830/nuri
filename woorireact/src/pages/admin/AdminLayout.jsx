import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, ShieldCheck, UserCog, UserRound, UsersRound } from "lucide-react";

import "../../css/admin/Admin.css";

const text = {
  admin: "\uad00\ub9ac\uc790",
  console: "\uad00\ub9ac\uc790 \ucf58\uc194",
  summary: "\ud68c\uc6d0 \uc5f0\uacb0\uacfc \uacc4\uc815 \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.",
  menu: "\uad00\ub9ac\uc790 \uba54\ub274",
  dashboard: "\ub300\uc2dc\ubcf4\ub4dc",
  seniors: "\uc5b4\ub974\uc2e0 \uad00\ub9ac",
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
