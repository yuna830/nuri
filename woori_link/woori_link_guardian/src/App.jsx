import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/guardian/Home.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrap">
        <header className="header">
          <div className="header-inner">
            <div className="header-logo">
              WOORI LINK <span>보호자</span>
            </div>
            <nav className="header-nav">
              <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                어르신 현황
              </NavLink>
            </nav>
          </div>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
