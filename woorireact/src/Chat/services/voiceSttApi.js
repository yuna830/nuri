import { AI_API_BASE } from "../../config/api.js";

export const STT_API_URL =
  import.meta.env.VITE_CHAT_STT_API_URL?.trim() ||
  import.meta.env.VITE_STT_API_URL?.trim() ||
  `${AI_API_BASE}/stt`;
