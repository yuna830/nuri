const normalizeBaseUrl = (value, name, fallback = '') => {
  const normalized = String(value || fallback).trim().replace(/\/$/, '');

  if (!normalized) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  }

  return normalized;
};

export const SPRING_API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_SPRING_API_BASE_URL,
  'VITE_SPRING_API_BASE_URL',
  '/api',
);

export const RAG_API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_RAG_API_BASE_URL,
  'VITE_RAG_API_BASE_URL',
);

export const DOCUMENT_AI_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_DOCUMENT_AI_BASE_URL,
  'VITE_DOCUMENT_AI_BASE_URL',
);
