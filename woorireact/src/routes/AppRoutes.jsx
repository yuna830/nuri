import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelfareDashboard from "../pages/Common/WelfareDashboard";
import WelfareSeniorDetail from "../pages/Common/WelfareSeniorDetail";
import Login from "../pages/Common/Login";
import SignUp from "../pages/Common/SignUp";
import G_Login from "../pages/Common/G_Login";
import G_SignUp from "../pages/Common/G_SignUp";
import { ChatAssistant } from "../Chat";
import STTServer from "../Chat/STTServer";
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
        <Route path="/" element={<WelfareDashboard />} />
        <Route path="/welfare" element={<WelfareDashboard />} />
        <Route path="/welfare/seniors/:id" element={<WelfareSeniorDetail />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/glogin" element={<G_Login />} />
        <Route path="/gsignup" element={<G_SignUp />} />

        <Route path="/chat" element={<ChatAssistant />} />
        <Route path="/stt" element={<STTServer />} />

        <Route path="/guardian" element={<GuardianPage />} />

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
