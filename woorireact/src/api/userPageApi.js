export function resolveUploadUrl(url) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  return `http://localhost:8181${url.startsWith("/") ? url : `/${url}`}`;
}
