import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './pages/welfare/Dashboard';
import SeniorList from './pages/welfare/SeniorList';
import SeniorDetail from './pages/welfare/SeniorDetail';
import EnergyVoucher from './pages/welfare/EnergyVoucher';
import RecallList from './pages/welfare/RecallList';
import ActionList from './pages/welfare/ActionList';
import Schedule from './pages/welfare/Schedule';
import Login from './pages/Login';

function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function PrivateLayout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user || !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>WOORI</h1>
          <p>복지사 관리 시스템</p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>대시보드</NavLink>
          <NavLink to="/seniors">대상자 목록</NavLink>
          <NavLink to="/energy-voucher">에너지바우처 미신청</NavLink>
          <NavLink to="/recalled">리콜 보유 대상</NavLink>
          <NavLink to="/actions">조치 관리</NavLink>
          <NavLink to="/schedule">방문 일정</NavLink>
        </nav>
        <div style={{ padding: '0 16px 20px', marginTop: 'auto' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            {user.name} 복지사
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', width: '100%',
            }}
          >
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<PrivateLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
