import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';

import {
  getUser,
} from './utils/auth.js';


/* =========================================================
 * 보호자 페이지
 * ========================================================= */

import GuardianHome from './pages/guardian/Home.jsx';
import SeniorStatus from './pages/guardian/SeniorStatus.jsx';
import GuardianSafety from './pages/guardian/Safety.jsx';
import GuardianWelfareAssistant from './pages/guardian/WelfareAssistant.jsx';
import GuardianLogin from './pages/guardian/Login.jsx';
import GuardianRegister from './pages/guardian/Register.jsx';
import GuardianMyPage from './pages/guardian/MyPage.jsx';


/* =========================================================
 * 복지사 페이지
 * ========================================================= */

import WelfareLogin from './pages/welfare/Login.jsx';
import WelfareRegister from './pages/welfare/Register.jsx';
import Dashboard from './pages/welfare/Dashboard.jsx';
import EnergyVoucher from './pages/welfare/EnergyVoucher.jsx';
import RecallList from './pages/welfare/RecallList.jsx';
import SeniorDetail from './pages/welfare/SeniorDetail.jsx';
import SeniorList from './pages/welfare/SeniorList.jsx';
import WelfareSidebar from './pages/welfare/WelfareSidebar.jsx';
import WelfareMyPage from './pages/welfare/MyPage.jsx';


/* =========================================================
 * 복지사 인증 및 공통 레이아웃
 * ========================================================= */

function WelfareProtectedLayout() {
  const user =
    getUser('WELFARE_WORKER')
    || getUser();

  if (!user) {
    return (
      <Navigate
        to="/welfare/login"
        replace
      />
    );
  }

  if (
    user.role
    !== 'WELFARE_WORKER'
  ) {
    return (
      <Navigate
        to="/welfare/login"
        replace
      />
    );
  }

  return (
    <div className="app-layout">
      <WelfareSidebar />

      <main className="main-content">
        <div className="welfare-content-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


/* =========================================================
 * 보호자 인증
 * ========================================================= */

function GuardianProtectedRoute() {
  const user =
    getUser('GUARDIAN')
    || getUser();

  if (!user) {
    return (
      <Navigate
        to="/guardian/login"
        replace
      />
    );
  }

  if (
    user.role
    !== 'GUARDIAN'
  ) {
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
 * 전체 라우터
 * ========================================================= */

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
         * 복지사 공개 경로
         * ========================================================= */}

        <Route
          path="/welfare/login"
          element={<WelfareLogin />}
        />

        <Route
          path="/welfare/register"
          element={<WelfareRegister />}
        />


        {/* =================================================
         * 복지사 인증 필요 경로
         * ========================================================= */}

        <Route
          element={
            <WelfareProtectedLayout />
          }
        >
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
            path="/welfare/mypage"
            element={<WelfareMyPage />}
          />
        </Route>


        {/* =================================================
         * 보호자 공개 경로
         * ========================================================= */}

        <Route
          path="/guardian/login"
          element={<GuardianLogin />}
        />

        <Route
          path="/guardian/register"
          element={<GuardianRegister />}
        />


        {/* =================================================
         * 보호자 인증 필요 경로
         * ========================================================= */}

        <Route
          element={
            <GuardianProtectedRoute />
          }
        >
          <Route
            path="/guardian"
            element={<GuardianHome />}
          />

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
            element={
              <GuardianWelfareAssistant />
            }
          />

          <Route
            path="/guardian/mypage"
            element={<GuardianMyPage />}
          />
        </Route>


        {/* 존재하지 않는 주소 */}
        <Route
          path="*"
          element={(
            <Navigate
              to="/"
              replace
            />
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
