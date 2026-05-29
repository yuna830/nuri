//const DEFAULT_CHAT_SERVER_HOST = "172.28.6.243";
const DEFAULT_CHAT_SERVER_HOST = "192.168.219.113";

const CHAT_SERVER_HOST =
  import.meta.env.VITE_CHAT_SERVER_HOST ||
  import.meta.env.VITE_STT_SERVER_HOST ||
  import.meta.env.VITE_AI_SERVER_HOST ||
  DEFAULT_CHAT_SERVER_HOST;

export const STT_API_URL = normalizeServerUrl(
  import.meta.env.VITE_CHAT_STT_API_URL ||
  import.meta.env.VITE_STT_API_URL,
  8000,
  "/stt"
);

function normalizeServerUrl(value, port, path) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return `http://${CHAT_SERVER_HOST}:${port}${path}`;
  }

  if (rawValue.startsWith(":")) {
    return `http://${CHAT_SERVER_HOST}${rawValue}`;
  }

  if (rawValue.startsWith("/")) {
    return `http://${CHAT_SERVER_HOST}:${port}${rawValue}`;
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    return `http://${rawValue}`;
  }

  return rawValue;
}
