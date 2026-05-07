import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Common/Login";
import { ChatAssistant } from "../Chat";
import STTServer from "../Chat/STTServer";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatAssistant />} />
        <Route path ="/stt" element={<STTServer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
