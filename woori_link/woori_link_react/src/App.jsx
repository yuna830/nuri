import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/welfare/Dashboard'
import SeniorList from './pages/welfare/SeniorList'
import SeniorDetail from './pages/welfare/SeniorDetail'
import EnergyVoucher from './pages/welfare/EnergyVoucher'
import RecallList from './pages/welfare/RecallList'
import ActionList from './pages/welfare/ActionList'
import Schedule from './pages/welfare/Schedule'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>WOORI LINK</h1>
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
    </BrowserRouter>
  )
}
