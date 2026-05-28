import { NavLink } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, UserRound, UsersRound } from "lucide-react";

import CommonHeader from "../../components/CommonHeader";
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
};

function AdminLayout({ children }) {
  return (
    <div className="admin-page">
      <CommonHeader logoText="woori admin" homePath="/admin" rightText={text.admin} />

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-profile">
            <strong>{text.console}</strong>
            <span>{text.summary}</span>
          </div>

          <nav className="admin-sidebar-nav" aria-label={text.menu}>
            <NavLink to="/admin" end className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
              <LayoutDashboard size={17} />
              {text.dashboard}
            </NavLink>
            <NavLink to="/admin/seniors" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
              <UserRound size={17} />
              {text.seniors}
            </NavLink>
            <NavLink to="/admin/welfare" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
              <ShieldCheck size={17} />
              {text.welfare}
            </NavLink>
            <NavLink to="/admin/guardians" className={({ isActive }) => `admin-sidebar-item${isActive ? " active" : ""}`}>
              <UsersRound size={17} />
              {text.guardians}
            </NavLink>
          </nav>
        </aside>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
