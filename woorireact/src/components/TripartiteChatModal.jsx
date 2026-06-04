import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSeniorChatMessages, sendSeniorChatMessage, uploadChatAttachment } from "../api/chatApi";
import "../css/common/TripartiteChatModal.css";

const ROLE_LABELS = {
  SENIOR: "사용자",
  GUARDIAN: "보호자",
  WELFARE: "복지사",
};

const formatChatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TripartiteChatModal({
  isOpen,
  seniorId,
  seniorName = "사용자",
  rooms = [],
  roomType = "SENIOR_GUARDIAN",
  senderRole,
  senderId,
  senderName,
  initialRoomType,
  onClose,
  onReadChange,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [roomGroup, setRoomGroup] = useState("ALL");
  const [activeRoomKey, setActiveRoomKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const attachmentPreviewUrls = useMemo(() =>
    attachments.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
    ), [attachments]);

  useEffect(() => {
    return () => {
      attachmentPreviewUrls.forEach((url) => { if (url) URL.revokeObjectURL(url); });
    };
  }, [attachmentPreviewUrls]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    setAttachments((prev) => {
      const merged = [...prev, ...files];
      return merged.slice(0, 3);
    });
    event.target.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const chatRooms = useMemo(() => {
    const sourceRooms = rooms.length > 0
      ? rooms
      : [{ roomType, seniorId, title: `${seniorName}님`, subtitle: "1:1 대화" }];

    return sourceRooms.map((room) => ({
      ...room,
      key: room.key || `${room.seniorId || seniorId}-${room.roomType || roomType}`,
    }));
  }, [rooms, roomType, seniorId, seniorName]);

  const noTabSelected = senderRole === "WELFARE" && roomGroup === "ALL";

  const activeRoom = useMemo(() => {
    if (noTabSelected) return null;
    return chatRooms.find((room) => room.key === activeRoomKey) || chatRooms[0];
  }, [activeRoomKey, chatRooms, noTabSelected]);

  const visibleRooms = useMemo(() => {
    if (senderRole !== "WELFARE" || roomGroup === "ALL") return chatRooms;
    return chatRooms.filter((room) => room.roomType === roomGroup);
  }, [chatRooms, roomGroup, senderRole]);

  useEffect(() => {
    if (!isOpen || noTabSelected) return;
    const preferredRoom = initialRoomType
      ? visibleRooms.find((room) => room.roomType === initialRoomType)
      : null;
     
    setActiveRoomKey((previousKey) => {
      if (preferredRoom?.key) return preferredRoom.key;
      return visibleRooms.some((room) => room.key === previousKey)
        ? previousKey
        : visibleRooms[0]?.key || "";
    });
  }, [initialRoomType, isOpen, visibleRooms, noTabSelected]);

  const loadMessages = async ({ silent = false, page = 0, appendOlder = false } = {}) => {
    const targetSeniorId = activeRoom?.seniorId || seniorId;
    const targetRoomType = activeRoom?.roomType || roomType;
    if (!targetSeniorId) return;

    try {
      if (!silent) setIsLoading(true);
      const nextMessages = await fetchSeniorChatMessages(targetSeniorId, targetRoomType, {
        keyword: keyword.trim(),
        viewerRole: senderRole,
        page,
        size: 100,
      });

      // 복지사 채팅방은 본인 + 대상자/보호자 메시지만 표시 (다른 복지사 메시지 제외)
      const filtered = (senderRole === "WELFARE" && senderId)
        ? nextMessages.filter((msg) =>
            msg.senderRole !== "WELFARE" || String(msg.senderId) === String(senderId)
          )
        : nextMessages;

      setMessages((prev) => (appendOlder ? [...filtered, ...prev] : filtered));
      setHistoryPage(page);
      onReadChange?.();
      setError("");
    } catch (loadError) {
      console.error("채팅 내역 조회 실패:", loadError);
      setError("대화 내역을 불러오지 못했습니다.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !(activeRoom?.seniorId || seniorId)) return undefined;

     
    loadMessages();
    const timerId = window.setInterval(() => {
      if (historyPage === 0) {
        loadMessages({ silent: true });
      }
    }, 5000);

    return () => window.clearInterval(timerId);
  }, [isOpen, seniorId, activeRoom?.seniorId, activeRoom?.roomType, keyword, historyPage]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, isOpen]);

  const handleSend = async () => {
    const message = draft.trim();
    const targetSeniorId = activeRoom?.seniorId || seniorId;
    const targetRoomType = activeRoom?.roomType || roomType;

    if (!message && attachments.length === 0) {
      window.alert("보낼 메시지를 입력해주세요.");
      return;
    }

    if (!targetSeniorId) {
      window.alert("대화할 대상자가 없습니다.");
      return;
    }

    try {
      setIsSending(true);

      // 첫 번째 메시지: 텍스트 + 첫 번째 첨부
      const firstFile = attachments[0] || null;
      const uploaded0 = firstFile ? await uploadChatAttachment(firstFile) : null;
      await sendSeniorChatMessage({
        seniorId: targetSeniorId,
        roomType: targetRoomType,
        senderRole,
        senderId,
        senderName,
        message,
        attachmentUrl: uploaded0?.fileUrl || uploaded0?.imageUrl || "",
        attachmentType: firstFile?.type || "",
        attachmentName: uploaded0?.fileName || firstFile?.name || "",
      });

      // 2~3번째 첨부는 추가 메시지로 전송
      for (let i = 1; i < attachments.length; i++) {
        const file = attachments[i];
        const uploaded = await uploadChatAttachment(file);
        await sendSeniorChatMessage({
          seniorId: targetSeniorId,
          roomType: targetRoomType,
          senderRole,
          senderId,
          senderName,
          message: "",
          attachmentUrl: uploaded?.fileUrl || uploaded?.imageUrl || "",
          attachmentType: file.type || "",
          attachmentName: uploaded?.fileName || file.name || "",
        });
      }

      setDraft("");
      setAttachments([]);
      await loadMessages({ silent: true });
    } catch (sendError) {
      console.error("채팅 전송 실패:", sendError);
      window.alert("메시지 전송에 실패했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tcm-backdrop" onClick={onClose}>
      <section className={`tcm-modal ${senderRole === "WELFARE" ? "tcm-modal-welfare" : ""}`} onClick={(event) => event.stopPropagation()}>
        <header className="tcm-header">
          <div>
            <h2>메시지</h2>
            <p>{activeRoom?.title || `${seniorName}님`} 1:1 대화</p>
          </div>
          <button type="button" className="tcm-close" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className={`tcm-shell${senderRole === "WELFARE" ? " tcm-shell-welfare" : ""}${noTabSelected ? " tcm-no-selection" : ""}`}>
          {senderRole === "WELFARE" && (
            <div className="tcm-room-groups">
              <button
                type="button"
                className={roomGroup === "SENIOR_WELFARE" ? "active" : ""}
                onClick={() => {
                  setRoomGroup("SENIOR_WELFARE");
                  setActiveRoomKey("");
                  setMessages([]);
                  setKeyword("");
                  setHistoryPage(0);
                }}
              >
                대상자
              </button>
              <button
                type="button"
                className={roomGroup === "GUARDIAN_WELFARE" ? "active" : ""}
                onClick={() => {
                  setRoomGroup("GUARDIAN_WELFARE");
                  setActiveRoomKey("");
                  setMessages([]);
                  setKeyword("");
                  setHistoryPage(0);
                }}
              >
                보호자
              </button>
            </div>
          )}

          {noTabSelected ? (
            <div className="tcm-select-tab-placeholder">
              대상자 또는 보호자를 선택해 주세요
            </div>
          ) : (
            <>
              <aside className="tcm-rooms" aria-label="대화방 목록">
                {visibleRooms.map((room) => (
                  <button
                    type="button"
                    key={room.key}
                    className={room.key === activeRoom?.key ? "active" : ""}
                    onClick={() => {
                      setActiveRoomKey(room.key);
                      setMessages([]);
                      setKeyword("");
                      setHistoryPage(0);
                    }}
                  >
                    <strong>{room.title}</strong>
                    {room.subtitle && <span>{room.subtitle}</span>}
                  </button>
                ))}
              </aside>

              <div className="tcm-search">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="대화 내용 검색"
                />
              </div>

              <div className="tcm-list" ref={listRef}>
                {!keyword.trim() && messages.length > 0 && (
                  <button
                    className="tcm-load-more"
                    type="button"
                    onClick={() => loadMessages({
                      silent: true,
                      page: historyPage + 1,
                      appendOlder: true,
                    })}
                  >
                    이전 대화 더 보기
                  </button>
                )}
                {isLoading ? (
                  <div className="tcm-empty">대화 내역을 불러오는 중입니다.</div>
                ) : messages.length === 0 ? (
                  <div className="tcm-empty">아직 주고받은 메시지가 없습니다.</div>
                ) : (
                  messages.map((message) => {
                    const isMine = String(message.senderRole) === String(senderRole)
                      && String(message.senderId) === String(senderId);

                    return (
                      <article
                        key={message.id}
                        className={`tcm-message ${isMine ? "mine" : ""}`}
                      >
                        <div className="tcm-message-meta">
                          <strong>{message.senderName || ROLE_LABELS[message.senderRole] || "참여자"}</strong>
                          <span>{ROLE_LABELS[message.senderRole] || message.senderRole}</span>
                          <time>{formatChatTime(message.createdAt)}</time>
                        </div>
                        {message.message && <p>{message.message}</p>}
                        {message.attachmentUrl && (
                          message.attachmentType?.startsWith("image/") ? (
                            <img className="tcm-attachment-image" src={message.attachmentUrl} alt="첨부 이미지" />
                          ) : (
                            <a className="tcm-attachment-link" href={message.attachmentUrl} target="_blank" rel="noreferrer">
                              {message.attachmentName || "첨부 파일 열기"}
                            </a>
                          )
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {error && <p className="tcm-error">{error}</p>}

        {!noTabSelected && (
          <div className="tcm-compose-wrap">
            {attachments.length > 0 && (
              <div className="tcm-compose-attachment">
                {attachments.map((file, i) => (
                  <div key={i} className="tcm-compose-attachment-item">
                    {attachmentPreviewUrls[i] && (
                      <img src={attachmentPreviewUrls[i]} alt={`첨부 미리보기 ${i + 1}`} />
                    )}
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeAttachment(i)} aria-label="첨부 제거">×</button>
                  </div>
                ))}
              </div>
            )}
            <footer className="tcm-compose">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="메시지를 입력하세요."
              />
              <label className={`tcm-file-button${attachments.length >= 3 ? " tcm-file-button-disabled" : ""}`}>
                첨부 {attachments.length > 0 ? `${attachments.length}/3` : ""}
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  disabled={attachments.length >= 3}
                  onChange={handleFileChange}
                />
              </label>
              <button type="button" onClick={handleSend} disabled={isSending}>
                {isSending ? "전송 중" : "보내기"}
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
