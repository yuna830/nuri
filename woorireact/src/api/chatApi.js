const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const resolveChatAttachmentUrl = (url) => {
  if (!url) return "";

  const value = String(url).trim();
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  if (value.startsWith("uploads/")) {
    return `/${value}`;
  }

  try {
    const parsed = new URL(value, window.location.origin);

    if (parsed.pathname.startsWith("/uploads/") && LOCAL_HOSTS.has(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return parsed.href;
    }
  } catch {
    // Keep the original value when it is not a URL-like string.
  }

  return value;
};

const normalizeChatMessage = (message) => ({
  ...message,
  attachmentUrl: resolveChatAttachmentUrl(message?.attachmentUrl),
});

export const fetchSeniorChatMessages = async (
  seniorId,
  roomType = "SENIOR_GUARDIAN",
  options = {},
) => {
  if (!seniorId) return [];

  const params = new URLSearchParams({
    roomType,
  });

  if (options.keyword) params.set("keyword", options.keyword);
  if (options.viewerRole) params.set("viewerRole", options.viewerRole);
  if (options.page !== undefined) params.set("page", options.page);
  if (options.size !== undefined) params.set("size", options.size);

  const response = await fetch(`/api/chat/senior/${seniorId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("chat messages fetch failed");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeChatMessage) : [];
};

export const fetchUnreadChatCount = async ({ viewerRole, seniorId, welfareWorkerId } = {}) => {
  if (!viewerRole) return 0;

  const params = new URLSearchParams({ viewerRole });
  if (seniorId) params.set("seniorId", seniorId);
  if (welfareWorkerId) params.set("welfareWorkerId", welfareWorkerId);

  const response = await fetch(`/api/chat/unread?${params.toString()}`);
  if (!response.ok) return 0;

  const data = await response.json();
  return Number(data?.count || 0);
};

export const sendSeniorChatMessage = async ({
  seniorId,
  roomType = "SENIOR_GUARDIAN",
  senderRole,
  senderId,
  senderName,
  message,
  attachmentUrl,
  attachmentType,
  attachmentName,
}) => {
  const response = await fetch(`/api/chat/senior/${seniorId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderRole,
      roomType,
      senderId,
      senderName,
      message,
      attachmentUrl: resolveChatAttachmentUrl(attachmentUrl),
      attachmentType,
      attachmentName,
    }),
  });

  if (!response.ok) {
    throw new Error("chat message send failed");
  }

  return response.json();
};

export const uploadChatAttachment = async (file) => {
  const formData = new FormData();
  formData.append(file.type.startsWith("image/") ? "image" : "file", file);

  const response = await fetch("/api/uploads/chat", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("파일 업로드 실패");
  }

  return response.json();
};

export const fetchChatMessages = fetchSeniorChatMessages;
export const sendChatMessage = sendSeniorChatMessage;

export const deleteChatMessage = async ({ messageId, senderRole, senderId }) => {
  const params = new URLSearchParams({ senderRole, senderId });
  const response = await fetch(`/api/chat/messages/${messageId}?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("메시지 삭제에 실패했습니다.");
};
