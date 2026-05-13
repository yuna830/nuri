import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WelfareDashboard from "../pages/Common/WelfareDashboard";
import WelfareSeniorDetail from "../pages/Common/WelfareSeniorDetail";
import WelfareJobPostings from "../pages/Common/WelfareJobPostings";
import WelfareLogin from "../pages/Common/WelfareLogin";
import WelfareMyPage from "../pages/Common/WelfareMyPage";
import WelfareSignup from "../pages/Common/WelfareSignup";
import Login from "../pages/Common/Login";
import SignUp from "../pages/Common/SignUp";
import G_Login from "../pages/Common/G_Login";
import G_SignUp from "../pages/Common/G_SignUp";
import { ChatAssistant, FoodCamera } from "../Chat";
import GuardianPage from "../pages/Guardian/GuardianPage";
import UserPage from "../pages/User/UserPage";
import WeatherAlert from "../pages/User/WeatherAlert";
import FallHistory from "../pages/User/FallHistory";
import LocationPage from "../pages/User/LocationPage";
import ProfilePage from "../pages/User/ProfilePage";
import JobPage from "../pages/User/JobPage";
import WeatherGraph from "../pages/User/WeatherGraph";
import SocialWorkerManager from "../pages/SocialWorker/Manager";

function RequireWelfareLogin({ children }) {
  const currentWorker = sessionStorage.getItem("currentWelfareWorker");

  if (!currentWorker) {
    return <Navigate to="/welfare-login" replace />;
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
        <Route path="/glogin" element={<G_Login />} />
        <Route path="/gsignup" element={<G_SignUp />} />

        {/* Welfare */}
        <Route path="/welfare-login" element={<WelfareLogin />} />
        <Route path="/welfare-signup" element={<WelfareSignup />} />
        <Route
          path="/welfare"
          element={
            <RequireWelfareLogin>
              <WelfareDashboard />
            </RequireWelfareLogin>
          }
        />
        <Route
          path="/welfare/seniors/:id"
          element={
            <RequireWelfareLogin>
              <WelfareSeniorDetail />
            </RequireWelfareLogin>
          }
        />
        <Route
          path="/welfare/jobs"
          element={
            <RequireWelfareLogin>
              <WelfareJobPostings />
            </RequireWelfareLogin>
          }
        />
        <Route
          path="/welfare/mypage"
          element={
            <RequireWelfareLogin>
              <WelfareMyPage />
            </RequireWelfareLogin>
          }
        />
        <Route
          path="/welfare/seniors/:id/jobs"
          element={
            <RequireWelfareLogin>
              <WelfareJobPostings />
            </RequireWelfareLogin>
          }
        />

        {/* Chat */}
        <Route path="/chat" element={<ChatAssistant />} />
        <Route path="/food-camera" element={<FoodCamera />} />

        {/* Guardian */}
        <Route path="/guardian" element={<GuardianPage />} />

        {/* User */}
        <Route path="/user" element={<UserPage />} />
        <Route path="/weather" element={<WeatherAlert />} />
        <Route path="/fall-history" element={<FallHistory />} />
        <Route path="/location" element={<LocationPage />} />
        <Route path="/jobs" element={<JobPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/weather-graph" element={<WeatherGraph />} />

        {/* Social Worker */}
        <Route
          path="/social-worker"
          element={
            <RequireWelfareLogin>
              <SocialWorkerManager />
            </RequireWelfareLogin>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
