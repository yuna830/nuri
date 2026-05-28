export function getCurrentSeniorName() {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    const profile = saved ? JSON.parse(saved) : null;
    return profile?.senior?.name?.trim() || "";
  } catch {
    return "";
  }
}

export function withUserGreeting(content) {
  const name = getCurrentSeniorName();
  if (!name || typeof content !== "string") return content;

  const trimmed = content.trimStart();
  if (trimmed.includes(`${name}님`)) {
    return content;
  }

  return `${name}님, ${content}`;
}
