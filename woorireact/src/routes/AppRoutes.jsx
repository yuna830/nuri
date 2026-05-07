import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Common/Login";
import { ChatAssistant } from "../Chat";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatAssistant />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
