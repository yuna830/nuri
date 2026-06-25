import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/guardian/Home.jsx';
import Login from './pages/Login.jsx';
import { getUser, clearUser } from './utils/auth.js';
import { logout } from './api/authApi.js';

function PrivateLayout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
    clearUser();
    navigate('/login');
  };

  return (
    <div className="app-wrap">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            WOORI <span>보호자</span>
          </div>
          <nav className="header-nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              어르신 현황
            </NavLink>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.name} 님</span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
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
