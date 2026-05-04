import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Common/Login";
import GuardianPage from "../pages/Guardian/GuardianPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Common */}
        <Route path="/" element={<Login />} />

        {/* Guardian */}
        <Route path="/guardian" element={<GuardianPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;