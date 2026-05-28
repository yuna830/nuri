import { forwardRef } from "react";

const MessageList = forwardRef(function MessageList(
  { messages, isLoading },
  messagesEndRef
) {
  return (
    <div className="chatbot-messages" aria-live="polite">
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
          {message.imageUrl && (
            <img
              className="chat-message-image"
              src={message.imageUrl}
              alt="첨부한 사진"
            />
          )}
          {message.content}
        </div>
      ))}

      {isLoading && (
        <div className="chat-message assistant">확인하는 중이에요...</div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});

export default MessageList;
