import { Check, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

function formatConversationTime(value) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return isToday
    ? new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(date);
}

export default function ConversationSidebar({
  open,
  conversations,
  activeConversationId,
  loading,
  onClose,
  onCreate,
  onSelect,
  onDelete,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");

  const startEditing = (conversation) => {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const saveTitle = async (conversationId) => {
    const title = draftTitle.trim();
    if (!title) return;
    await onRename(conversationId, title);
    setEditingId(null);
  };

  if (!open) return null;

  return (
    <>
      <button
        className="conversation-sidebar-backdrop"
        type="button"
        aria-label="대화 목록 닫기"
        onClick={onClose}
      />
      <aside className="conversation-sidebar" aria-label="최근 대화">
        <div className="conversation-sidebar-head">
          <div>
            <h2>최근 대화</h2>
            <p>대화 기록은 마지막 이용 7일 후 삭제됩니다.</p>
          </div>
          <button type="button" className="conversation-icon-button" onClick={onClose} aria-label="닫기">
            <X size={22} />
          </button>
        </div>

        <button type="button" className="conversation-create-button" onClick={onCreate}>
          <Plus size={20} />
          새 대화
        </button>

        <div className="conversation-list">
          {loading ? (
            <p className="conversation-empty">대화 목록을 불러오고 있어요.</p>
          ) : conversations.length === 0 ? (
            <p className="conversation-empty">아직 저장된 대화가 없어요.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                className={`conversation-list-item ${
                  conversation.id === activeConversationId ? "active" : ""
                }`}
                key={conversation.id}
              >
                <div className="conversation-list-main">
                  <MessageSquare size={17} />
                  <span>
                    {editingId === conversation.id ? (
                      <input
                        className="conversation-title-input"
                        value={draftTitle}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveTitle(conversation.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <strong>{conversation.title}</strong>
                    )}
                    <small>{formatConversationTime(conversation.lastMessageAt)}</small>
                  </span>
                  {editingId !== conversation.id && (
                    <button
                      type="button"
                      className="conversation-select-button"
                      onClick={() => onSelect(conversation.id)}
                      aria-label={`${conversation.title} 대화 열기`}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="conversation-edit-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (editingId === conversation.id) {
                      saveTitle(conversation.id);
                    } else {
                      startEditing(conversation);
                    }
                  }}
                  aria-label={`${conversation.title} 제목 수정`}
                >
                  {editingId === conversation.id ? <Check size={16} /> : <Pencil size={16} />}
                </button>
                <button
                  type="button"
                  className="conversation-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(conversation.id);
                  }}
                  aria-label={`${conversation.title} 삭제`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
