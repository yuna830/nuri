const trimEnv = (value) => value?.trim() || "";

export const SPRING_API_BASE = trimEnv(import.meta.env.VITE_API_BASE_URL);

export const AI_API_BASE = trimEnv(import.meta.env.VITE_AI_API_BASE_URL);

export const WELFARE_API_BASE =
  trimEnv(import.meta.env.VITE_WELFARE_API_BASE_URL) || SPRING_API_BASE;

export const POLICE_API_BASE =
  trimEnv(import.meta.env.VITE_POLICE_API_BASE_URL) || SPRING_API_BASE;

export const getDefaultFallApiBase = () =>
  trimEnv(import.meta.env.VITE_FALL_API_BASE);

export const RAG_API_BASE = trimEnv(import.meta.env.VITE_RAG_API_BASE);

export const FACE_API_BASE = trimEnv(import.meta.env.VITE_FACE_API_BASE_URL);
