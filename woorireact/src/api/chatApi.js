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
  return Array.isArray(data) ? data : [];
};

export const fetchUnreadChatCount = async ({ viewerRole, seniorId } = {}) => {
  if (!viewerRole) return 0;

  const params = new URLSearchParams({ viewerRole });
  if (seniorId) params.set("seniorId", seniorId);

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
      attachmentUrl,
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
  formData.append("file", file);

  const response = await fetch("/api/uploads/chat", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("chat attachment upload failed");
  }

  return response.json();
};

export const fetchChatMessages = fetchSeniorChatMessages;
export const sendChatMessage = sendSeniorChatMessage;
