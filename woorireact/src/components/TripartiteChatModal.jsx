import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSeniorChatMessages, sendSeniorChatMessage } from "../api/chatApi";
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
  onClose,
  onReadChange,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [activeRoomKey, setActiveRoomKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const chatRooms = useMemo(() => {
    const sourceRooms = rooms.length > 0
      ? rooms
      : [{ roomType, seniorId, title: `${seniorName}님`, subtitle: "1:1 대화" }];

    return sourceRooms.map((room) => ({
      ...room,
      key: room.key || `${room.seniorId || seniorId}-${room.roomType || roomType}`,
    }));
  }, [rooms, roomType, seniorId, seniorName]);

  const activeRoom = useMemo(
    () => chatRooms.find((room) => room.key === activeRoomKey) || chatRooms[0],
    [activeRoomKey, chatRooms]
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveRoomKey((previousKey) =>
      chatRooms.some((room) => room.key === previousKey)
        ? previousKey
        : chatRooms[0]?.key || ""
    );
  }, [isOpen, chatRooms]);

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
      setMessages((prev) => (appendOlder ? [...nextMessages, ...prev] : nextMessages));
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

    if (!message) {
      window.alert("보낼 메시지를 입력해주세요.");
      return;
    }

    if (!targetSeniorId) {
      window.alert("대화할 대상자가 없습니다.");
      return;
    }

    try {
      setIsSending(true);
      await sendSeniorChatMessage({
        seniorId: targetSeniorId,
        roomType: targetRoomType,
        senderRole,
        senderId,
        senderName,
        message,
      });
      setDraft("");
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
      <section className="tcm-modal" onClick={(event) => event.stopPropagation()}>
        <header className="tcm-header">
          <div>
            <h2>메시지</h2>
            <p>{activeRoom?.title || `${seniorName}님`} 1:1 대화</p>
          </div>
          <button type="button" className="tcm-close" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className="tcm-shell">
          <aside className="tcm-rooms" aria-label="대화방 목록">
            {chatRooms.map((room) => (
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
                    <p>{message.message}</p>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {error && <p className="tcm-error">{error}</p>}

        <footer className="tcm-compose">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요."
          />
          <button type="button" onClick={handleSend} disabled={isSending}>
            {isSending ? "전송 중" : "보내기"}
          </button>
        </footer>
      </section>
    </div>
  );
}
