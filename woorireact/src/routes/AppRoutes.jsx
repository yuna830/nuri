import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import WelfareDashboard from "../pages/Welfare/WelfareDashboard";
import WelfareSeniorDetail from "../pages/Welfare/WelfareSeniorDetail";
import WelfareJobPostings from "../pages/Welfare/WelfareJobPostings";
import WelfareJobApplications from "../pages/Welfare/WelfareJobApplications";
import WelfareMyPage from "../pages/Welfare/WelfareMyPage";
import WelfarePolicyChatPage from "../pages/Welfare/WelfarePolicyChatPage";
import WelfareLogin from "../pages/Common/WelfareLogin";
import WelfareSignup from "../pages/Common/WelfareSignup";
import Login from "../pages/Common/Login";
import SignUp from "../pages/Common/SignUp";
import GuardianLogin from "../pages/Common/GuardianLogin";
import GuardianSignUp from "../pages/Common/GuardianSignUp";
import { ChatAssistant } from "../Chat";
import GuardianPage from "../pages/Guardian/GuardianPage";
import UserPage from "../pages/User/UserPage";
import WeatherAlert from "../pages/User/WeatherAlert";
import FallHistory from "../pages/User/FallHistory";
import LocationPage from "../pages/User/LocationPage";
import ProfilePage from "../pages/User/ProfilePage";
import JobPage from "../pages/User/JobPage";
import WeatherGraph from "../pages/User/WeatherGraph";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminSeniors from "../pages/admin/AdminSeniors";
import AdminSeniorDetail from "../pages/admin/AdminSeniorDetail";
import AdminWelfare from "../pages/admin/AdminWelfare";
import AdminGuardians from "../pages/admin/AdminGuardians";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminSignup from "../pages/admin/AdminSignup";
import AdminAccounts from "../pages/admin/AdminAccounts";

function RequireAdmin({ children }) {
  return sessionStorage.getItem("currentAdmin")
    ? children
    : <Navigate to="/admin/login" replace />;
}

function RequireSenior({ children }) {
  useLocation(); // 경로 변경(뒤로가기 포함)마다 재평가
  if (!sessionStorage.getItem("currentSenior")) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Common */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/glogin" element={<GuardianLogin />} />
        <Route path="/gsignup" element={<GuardianSignUp />} />

        {/* Welfare */}
        <Route path="/wlogin" element={<WelfareLogin />} />
        <Route path="/wsignup" element={<WelfareSignup />} />
        <Route path="/welfare" element={<WelfareDashboard />} />
        <Route path="/welfare/seniors/:id" element={<WelfareSeniorDetail />} />
        <Route path="/welfare/jobs" element={<WelfareJobPostings />} />
        <Route path="/welfare/job-applications" element={<WelfareJobApplications />} />
        <Route path="/welfare/mypage" element={<WelfareMyPage />} />
        <Route path="/welfare/policy-chat" element={<WelfarePolicyChatPage />} />
        <Route path="/welfare/seniors/:id/jobs" element={<WelfareJobPostings />} />

        {/* Chat */}
        <Route path="/chat" element={<ChatAssistant />} />

        {/* Guardian */}
        <Route path="/guardian" element={<GuardianPage />} />

        {/* User */}
        <Route path="/user" element={<RequireSenior><UserPage /></RequireSenior>} />
        <Route path="/weather" element={<RequireSenior><WeatherAlert /></RequireSenior>} />
        <Route path="/fall-history" element={<RequireSenior><FallHistory /></RequireSenior>} />
        <Route path="/location" element={<RequireSenior><LocationPage /></RequireSenior>} />
        <Route path="/jobs" element={<RequireSenior><JobPage /></RequireSenior>} />
        <Route path="/profile" element={<RequireSenior><ProfilePage /></RequireSenior>} />
        <Route path="/weather-graph" element={<RequireSenior><WeatherGraph /></RequireSenior>} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/signup" element={<AdminSignup />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/seniors" element={<RequireAdmin><AdminSeniors /></RequireAdmin>} />
        <Route path="/admin/seniors/:id" element={<RequireAdmin><AdminSeniorDetail /></RequireAdmin>} />
        <Route path="/admin/welfare" element={<RequireAdmin><AdminWelfare /></RequireAdmin>} />
        <Route path="/admin/guardians" element={<RequireAdmin><AdminGuardians /></RequireAdmin>} />
        <Route path="/admin/accounts" element={<RequireAdmin><AdminAccounts /></RequireAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
