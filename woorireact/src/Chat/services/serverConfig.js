/* const DEFAULT_AI_SERVER_HOST = "172.28.6.243"; */
const DEFAULT_AI_SERVER_HOST = "172.28.224.1";

const AI_SERVER_HOST =
  import.meta.env.VITE_AI_SERVER_HOST || DEFAULT_AI_SERVER_HOST;

function normalizeServerUrl(value, port, path) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return `http://${AI_SERVER_HOST}:${port}${path}`;
  }

  if (rawValue.startsWith(":")) {
    return `http://${AI_SERVER_HOST}${rawValue}`;
  }

  if (rawValue.startsWith("/")) {
    return `http://${AI_SERVER_HOST}:${port}${rawValue}`;
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    return `http://${rawValue}`;
  }

  return rawValue;
}

export const STT_API_URL = normalizeServerUrl(
  import.meta.env.VITE_STT_API_URL,
  8000,
  "/stt"
);

export const OLLAMA_API_URL = normalizeServerUrl(
  import.meta.env.VITE_OLLAMA_API_URL,
  11434,
  "/api/chat"
);

export const OLLAMA_MODEL =
  import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:3b";
