const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const IMAGE_URLS_START = "[WOORI_IMAGE_URLS]";
const IMAGE_URLS_END = "[/WOORI_IMAGE_URLS]";
const HIDDEN_MESSAGE_MARKER = "[WOORI_HIDDEN_MESSAGE]";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`Assistant conversation request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function createAssistantConversation(seniorId) {
  return request(`/api/assistant-conversations/senior/${seniorId}`, {
    method: "POST",
  });
}

export function fetchAssistantConversations(seniorId) {
  return request(`/api/assistant-conversations/senior/${seniorId}`);
}

export function fetchAssistantMessages(seniorId, conversationId) {
  const params = new URLSearchParams({ seniorId });
  return request(`/api/assistant-conversations/${conversationId}/messages?${params}`)
    .then((messages) => messages.map(decodeMessage));
}

export function saveAssistantMessage(seniorId, conversationId, message) {
  const params = new URLSearchParams({ seniorId });
  const content = encodeMessage(message);
  return request(`/api/assistant-conversations/${conversationId}/messages?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: message.role,
      content,
    }),
  });
}

export function updateAssistantConversationTitle(seniorId, conversationId, title) {
  const params = new URLSearchParams({ seniorId });
  return request(`/api/assistant-conversations/${conversationId}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function deleteAssistantConversation(seniorId, conversationId) {
  const params = new URLSearchParams({ seniorId });
  return request(`/api/assistant-conversations/${conversationId}?${params}`, {
    method: "DELETE",
  });
}

function encodeMessage(message) {
  const rawContent = String(message.content || "");
  const content = message.hidden
    ? `${HIDDEN_MESSAGE_MARKER}\n${rawContent}`
    : rawContent;
  const imageUrls = message.imageUrls || (message.imageUrl ? [message.imageUrl] : []);
  if (imageUrls.length === 0) return content;

  return `${content}\n\n${IMAGE_URLS_START}${JSON.stringify(imageUrls)}${IMAGE_URLS_END}`;
}

function decodeMessage(message) {
  const content = String(message.content || "");
  const markerPattern = new RegExp(
    `\\n*${escapeRegExp(IMAGE_URLS_START)}([\\s\\S]*?)${escapeRegExp(IMAGE_URLS_END)}\\s*$`
  );
  const match = content.match(markerPattern);
  let decoded = message;

  if (match) {
    try {
      const imageUrls = JSON.parse(match[1]);
      decoded = {
        ...message,
        content: content.replace(markerPattern, "").trim(),
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      };
    } catch {
      decoded = message;
    }
  }

  const decodedContent = String(decoded.content || "");
  if (!decodedContent.startsWith(HIDDEN_MESSAGE_MARKER)) return decoded;

  return {
    ...decoded,
    content: decodedContent.slice(HIDDEN_MESSAGE_MARKER.length).trimStart(),
    hidden: true,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
