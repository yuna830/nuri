const trimEnv = (value) => value?.trim() || "";

const sameHostBase = (port) => {
  if (typeof window === "undefined") return "";

  const { protocol, hostname } = window.location;
  const host = hostname || "127.0.0.1";
  return `${protocol}//${host}:${port}`;
};

export const SPRING_API_BASE = trimEnv(import.meta.env.VITE_API_BASE_URL);

export const AI_API_BASE =
  trimEnv(import.meta.env.VITE_AI_API_BASE_URL) || sameHostBase("8002");

export const WELFARE_API_BASE =
  trimEnv(import.meta.env.VITE_WELFARE_API_BASE_URL) || SPRING_API_BASE;

export const POLICE_API_BASE =
  trimEnv(import.meta.env.VITE_POLICE_API_BASE_URL) || SPRING_API_BASE;

export const FALL_API_PORT = trimEnv(import.meta.env.VITE_FALL_API_PORT) || "8000";

export const getDefaultFallApiBase = () => sameHostBase(FALL_API_PORT);

export const RAG_API_BASE =
  trimEnv(import.meta.env.VITE_RAG_API_BASE) || sameHostBase("8001");

export const FACE_API_BASE =
  trimEnv(import.meta.env.VITE_FACE_API_BASE_URL) || sameHostBase("8003");