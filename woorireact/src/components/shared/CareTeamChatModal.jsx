import { useEffect, useRef, useState } from "react";
import { fetchChatMessages, sendChatMessage } from "../../api/chatApi.js";
import "../../css/common/CareTeamChatModal.css";

const ROLE_LABELS = {
  SENIOR: "사용자",
  GUARDIAN: "보호자",
  WELFARE: "복지사",
};

const formatChatTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CareTeamChatModal({
  open,
  senior,
  senderRole,
  senderId,
  senderName,
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  const seniorId = senior?.id || senior?.seniorId;

  const loadMessages = async ({ silent = false } = {}) => {
    if (!seniorId) return;

    if (!silent) setLoading(true);
    try {
      setMessages(await fetchChatMessages(seniorId));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !seniorId) return undefined;

    loadMessages();
    const timerId = window.setInterval(() => loadMessages({ silent: true }), 5000);
    return () => window.clearInterval(timerId);
  }, [open, seniorId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || !seniorId || sending) return;

    try {
      setSending(true);
      const saved = await sendChatMessage({
        seniorId,
        senderRole,
        senderId,
        senderName,
        message,
      });
      setMessages((previous) => [...previous, saved]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ctc-backdrop" onClick={onClose}>
      <section className="ctc-modal" onClick={(event) => event.stopPropagation()}>
        <header className="ctc-header">
          <div>
            <h2>메시지</h2>
            <p>{senior?.name || "대상자"}님과 보호자, 복지사가 함께 보는 대화입니다.</p>
          </div>
          <button type="button" onClick={onClose}>닫기</button>
        </header>

        <div className="ctc-body" ref={bodyRef}>
          {loading ? (
            <div className="ctc-empty">메시지를 불러오는 중입니다.</div>
          ) : messages.length === 0 ? (
            <div className="ctc-empty">아직 주고받은 메시지가 없습니다.</div>
          ) : (
            messages.map((message) => {
              const mine = message.senderRole === senderRole && String(message.senderId || "") === String(senderId || "");
              return (
                <article className={`ctc-message ${mine ? "mine" : ""}`} key={message.id}>
                  <span>{ROLE_LABELS[message.senderRole] || message.senderRole} · {message.senderName || "이름 없음"}</span>
                  <p>{message.message}</p>
                  <time>{formatChatTime(message.createdAt)}</time>
                </article>
              );
            })
          )}
        </div>

        <footer className="ctc-input-row">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" onClick={handleSend} disabled={sending || !draft.trim()}>
            보내기
          </button>
        </footer>
      </section>
    </div>
  );
}
