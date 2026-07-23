import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import {
  clearUser,
  getUser,
} from './utils/auth.js';

/* =========================================================
   보호자 페이지
   ========================================================= */

import GuardianHome from './pages/guardian/Home.jsx';
import SeniorStatus from './pages/guardian/SeniorStatus.jsx';
import GuardianSafety from './pages/guardian/Safety.jsx';
import GuardianWelfareAssistant from './pages/guardian/WelfareAssistant.jsx';
import GuardianLogin from './pages/guardian/Login.jsx';
import GuardianRegister from './pages/guardian/Register.jsx';
import GuardianMyPage from './pages/guardian/MyPage.jsx';

/* =========================================================
   복지사 페이지
   ========================================================= */

import WelfareLogin from './pages/welfare/Login.jsx';
import WelfareRegister from './pages/welfare/Register.jsx';
import Dashboard from './pages/welfare/Dashboard.jsx';
import EnergyVoucher from './pages/welfare/EnergyVoucher.jsx';
import RecallList from './pages/welfare/RecallList.jsx';
import Schedule from './pages/welfare/Schedule.jsx';
import SeniorDetail from './pages/welfare/SeniorDetail.jsx';
import SeniorList from './pages/welfare/SeniorList.jsx';


/* =========================================================
   복지사 인증 및 공통 레이아웃
   ========================================================= */

function WelfareProtectedLayout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user) {
    return (
      <Navigate
        to="/welfare/login"
        replace
      />
    );
  }

  if (user.role !== 'WELFARE_WORKER') {
    return (
      <Navigate
        to="/welfare/login"
        replace
      />
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(
        '복지사 로그아웃 요청 실패:',
        error,
      );
    } finally {
      clearUser();

      navigate(
        '/welfare/login',
        {
          replace: true,
        },
      );
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>WOORI</h1>
          <p>복지사 관리 시스템</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/welfare"
            end
          >
            대시보드
          </NavLink>

          <NavLink to="/welfare/seniors">
            대상자 목록
          </NavLink>

          <NavLink to="/welfare/energy-voucher">
            에너지복지 신청 지원
          </NavLink>

          <NavLink to="/welfare/recalled">
            리콜 제품 확인 대상
          </NavLink>

          <NavLink to="/welfare/schedule">
            방문 일정
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user.name || '담당자'} 복지사
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-logout"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}


/* =========================================================
   보호자 인증
   ========================================================= */

/*
 * 보호자 페이지의 화면 레이아웃과 사이드바는
 * Home.jsx와 SeniorStatus.jsx 내부의 GuardianLayout이 담당한다.
 *
 * 따라서 App.jsx에서는 인증만 처리하고 Outlet만 반환한다.
 */
function GuardianProtectedRoute() {
  const user = getUser();

  if (!user) {
    return (
      <Navigate
        to="/guardian/login"
        replace
      />
    );
  }

  if (user.role !== 'GUARDIAN') {
    return (
      <Navigate
        to="/guardian/login"
        replace
      />
    );
  }

  return <Outlet />;
}


/* =========================================================
   전체 라우터
   ========================================================= */

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* 최초 접속 */}
        <Route
          path="/"
          element={(
            <Navigate
              to="/welfare"
              replace
            />
          )}
        />

        {/* 기존 공통 로그인 경로 호환 */}
        <Route
          path="/login"
          element={(
            <Navigate
              to="/welfare/login"
              replace
            />
          )}
        />

        <Route
          path="/register"
          element={(
            <Navigate
              to="/welfare/register"
              replace
            />
          )}
        />

        {/* =================================================
            복지사 공개 경로
            ================================================= */}

        <Route
          path="/welfare/login"
          element={<WelfareLogin />}
        />

        <Route
          path="/welfare/register"
          element={<WelfareRegister />}
        />

        {/* =================================================
            복지사 인증 필요 경로
            ================================================= */}

        <Route element={<WelfareProtectedLayout />}>
          <Route
            path="/welfare"
            element={<Dashboard />}
          />

          <Route
            path="/welfare/seniors"
            element={<SeniorList />}
          />

          <Route
            path="/welfare/seniors/:id"
            element={<SeniorDetail />}
          />

          <Route
            path="/welfare/energy-voucher"
            element={<EnergyVoucher />}
          />

          <Route
            path="/welfare/recalled"
            element={<RecallList />}
          />

          <Route
            path="/welfare/schedule"
            element={<Schedule />}
          />
        </Route>

        {/* =================================================
            보호자 공개 경로
            ================================================= */}

        <Route
          path="/guardian/login"
          element={<GuardianLogin />}
        />

        <Route
          path="/guardian/register"
          element={<GuardianRegister />}
        />

        {/* =================================================
            보호자 인증 필요 경로
            ================================================= */}

        <Route element={<GuardianProtectedRoute />}>
          {/* 담당 님 전체 요약 홈 */}
          <Route
            path="/guardian"
            element={<GuardianHome />}
          />

          {/* 선택한 님 상세 현황 */}
          <Route
            path="/guardian/seniors"
            element={<SeniorStatus />}
          />
          <Route
            path="/guardian/safety"
            element={<GuardianSafety />}
          />
          <Route
            path="/guardian/welfare"
            element={<GuardianWelfareAssistant />}
          />
          <Route
            path="/guardian/mypage"
            element={<GuardianMyPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
