import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelfareDashboard from "../pages/Welfare/WelfareDashboard";
import WelfareSeniorDetail from "../pages/Welfare/WelfareSeniorDetail";
import WelfareJobPostings from "../pages/Welfare/WelfareJobPostings";
import WelfareJobApplications from "../pages/Welfare/WelfareJobApplications";
import WelfareMyPage from "../pages/Welfare/WelfareMyPage";
import WelfareLogin from "../pages/Common/WelfareLogin";
import WelfareSignup from "../pages/Common/WelfareSignup";
import Login from "../pages/Common/Login";
import SignUp from "../pages/Common/SignUp";
import GuardianLogin from "../pages/Common/GuardianLogin";
import GuardianSignUp from "../pages/Common/GuardianSignUp";
import { ChatAssistant, FoodCamera } from "../Chat";
import GuardianPage from "../pages/Guardian/GuardianPage";
import UserPage from "../pages/User/UserPage";
import WeatherAlert from "../pages/User/WeatherAlert";
import FallHistory from "../pages/User/FallHistory";
import LocationPage from "../pages/User/LocationPage";
import ProfilePage from "../pages/User/ProfilePage";
import JobPage from "../pages/User/JobPage";
import WeatherGraph from "../pages/User/WeatherGraph";

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
        <Route path="/welfare-login" element={<WelfareLogin />} />
        <Route path="/wsignup" element={<WelfareSignup />} />
        <Route path="/welfare-signup" element={<WelfareSignup />} />
        <Route path="/welfare" element={<WelfareDashboard />} />
        <Route path="/welfare/seniors/:id" element={<WelfareSeniorDetail />} />
        <Route path="/welfare/jobs" element={<WelfareJobPostings />} />
        <Route path="/welfare/job-applications" element={<WelfareJobApplications />} />
        <Route path="/welfare/mypage" element={<WelfareMyPage />} />
        <Route path="/welfare/seniors/:id/jobs" element={<WelfareJobPostings />} />

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
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
