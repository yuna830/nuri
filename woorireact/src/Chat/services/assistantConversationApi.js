const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
  return request(`/api/assistant-conversations/${conversationId}/messages?${params}`);
}

export function saveAssistantMessage(seniorId, conversationId, message) {
  const params = new URLSearchParams({ seniorId });
  return request(`/api/assistant-conversations/${conversationId}/messages?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: message.role,
      content: message.content,
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
