import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { logout } from './api/authApi.js';
import { guardianLogout } from './api/guardianAuthApi.js';
import GuardianHome from './pages/guardian/Home.jsx';
import GuardianLogin from './pages/guardian/Login.jsx';
import GuardianRegister from './pages/guardian/Register.jsx';
import Login from './pages/welfare/Login';
import Register from './pages/welfare/Register';
import ActionList from './pages/welfare/ActionList';
import Dashboard from './pages/welfare/Dashboard';
import EnergyVoucher from './pages/welfare/EnergyVoucher';
import RecallList from './pages/welfare/RecallList';
import Schedule from './pages/welfare/Schedule';
import SeniorDetail from './pages/welfare/SeniorDetail';
import SeniorList from './pages/welfare/SeniorList';
import { clearUser, getUser } from './utils/auth.js';

function WelfareLayout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user) return <Navigate to="/welfare/login" replace />;
  if (user.role !== 'WELFARE_WORKER') return <Navigate to="/welfare/login" replace />;

  const handleLogout = async () => {
    await logout();
    clearUser();
    navigate('/welfare/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>WOORI</h1>
          <p>복지사 관리 시스템</p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/welfare" end>대시보드</NavLink>
          <NavLink to="/welfare/seniors">대상자 목록</NavLink>
          <NavLink to="/welfare/energy-voucher">에너지바우처 미신청</NavLink>
          <NavLink to="/welfare/recalled">리콜 보유 대상</NavLink>
          <NavLink to="/welfare/actions">조치 관리</NavLink>
          <NavLink to="/welfare/schedule">방문 일정</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">{user.name} 복지사</div>
          <button onClick={handleLogout} className="sidebar-logout">
            로그아웃
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/seniors" element={<SeniorList />} />
          <Route path="/seniors/:id" element={<SeniorDetail />} />
          <Route path="/energy-voucher" element={<EnergyVoucher />} />
          <Route path="/recalled" element={<RecallList />} />
          <Route path="/actions" element={<ActionList />} />
          <Route path="/schedule" element={<Schedule />} />
        </Routes>
      </main>
    </div>
  );
}

function GuardianLayout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user) return <Navigate to="/guardian/login" replace />;
  if (user.role !== 'GUARDIAN') return <Navigate to="/guardian/login" replace />;

  const handleLogout = async () => {
    await guardianLogout();
    clearUser();
    navigate('/guardian/login');
  };

  return (
    <div className="guardian-app-wrap">
      <header className="guardian-header">
        <div className="guardian-header-inner">
          <div className="guardian-header-logo">
            WOORI <span>보호자</span>
          </div>
          <nav className="guardian-header-nav">
            <NavLink to="/guardian" end className={({ isActive }) => isActive ? 'active' : ''}>
              어르신 현황
            </NavLink>
          </nav>
          <div className="guardian-header-user">
            <span>{user.name} 님</span>
            <button onClick={handleLogout} className="guardian-logout-button">
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className="guardian-page-content">
        <Routes>
          <Route path="/" element={<GuardianHome />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/welfare" replace />} />

        <Route path="/login" element={<Navigate to="/welfare/login" replace />} />
        <Route path="/register" element={<Navigate to="/welfare/register" replace />} />

        <Route path="/welfare/login" element={<Login />} />
        <Route path="/welfare/register" element={<Register />} />
        <Route path="/welfare/*" element={<WelfareLayout />} />

        <Route path="/guardian/login" element={<GuardianLogin />} />
        <Route path="/guardian/register" element={<GuardianRegister />} />
        <Route path="/guardian/*" element={<GuardianLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
