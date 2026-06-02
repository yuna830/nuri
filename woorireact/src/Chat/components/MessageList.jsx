import { forwardRef, Fragment, useRef } from "react";

function formatMessageTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

const MessageList = forwardRef(function MessageList(
  { messages, isLoading },
  messagesEndRef
) {
  const displayedAtRef = useRef(new Map());

  return (
    <div className="chatbot-messages" aria-live="polite">
      {messages.filter((message) => !message.hidden).map((message, index) => {
        const messageKey = `${message.role}-${index}`;
        if (!displayedAtRef.current.has(messageKey)) {
          displayedAtRef.current.set(messageKey, message.createdAt || Date.now());
        }
        const formattedTime = formatMessageTime(displayedAtRef.current.get(messageKey));
        const hasVisibleContent = message.content && message.content !== "사진을 보냈어요.";

        return (
          <Fragment key={messageKey}>
            {message.imageUrl && (
              <div className={`chat-message-row image ${message.role}`}>
                <img
                  className="chat-message-image"
                  src={message.imageUrl}
                  alt="첨부한 사진"
                />
                {!hasVisibleContent && <time className="chat-message-time">{formattedTime}</time>}
              </div>
            )}
            {hasVisibleContent && (
              <div className={`chat-message-row ${message.role}`}>
                <div className={`chat-message ${message.role}`}>{message.content}</div>
                <time className="chat-message-time">{formattedTime}</time>
              </div>
            )}
          </Fragment>
        );
      })}

      {isLoading && (
        <div className="chat-message-row assistant">
          <div className="chat-message assistant chat-typing-indicator" role="status">
            <span className="chat-typing-label">답변을 확인하고 있어요.</span>
            <span className="chat-typing-dot" aria-hidden="true" />
            <span className="chat-typing-dot" aria-hidden="true" />
            <span className="chat-typing-dot" aria-hidden="true" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});

export default MessageList;
