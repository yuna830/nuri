import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelfareDashboard from "../pages/Common/WelfareDashboard";
import WelfareSeniorDetail from "../pages/Common/WelfareSeniorDetail";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelfareDashboard />} />
        <Route path="/welfare/seniors/:id" element={<WelfareSeniorDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
