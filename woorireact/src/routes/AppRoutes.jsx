import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Common/Login";
import UserPage from "../pages/User/UserPage";
import WeatherAlert from "../pages/User/WeatherAlert";
import FallHistory from "../pages/User/FallHistory";
import LocationPage from "../pages/User/LocationPage";
import JobPage from "../pages/User/JobPage";
import SignUp from "../pages/Common/SignUp";
import ProfilePage from "../pages/User/ProfilePage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/weather" element={<WeatherAlert />} />
        <Route path="/fall-history" element={<FallHistory />} />
        <Route path="/location" element={<LocationPage />} />
        <Route path="/jobs" element={<JobPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRoutes;