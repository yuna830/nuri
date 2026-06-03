import { useRef } from "react";
import { Camera, X } from "lucide-react";

export default function MessageInput({
  input,
  isLoading,
  recording,
  onInputChange,
  onSend,
  onStartRecording,
  onStopRecording,
  pendingImageUrl,
  onImageSelect,
  onImageRemove,
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="chatbot-input-area">
      {pendingImageUrl && (
        <div className="chat-pending-image">
          <img src={pendingImageUrl} alt="첨부할 사진 미리보기" />
          <button type="button" onClick={onImageRemove} aria-label="첨부 사진 삭제" title="첨부 사진 삭제">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="chatbot-input">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="chat-photo-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImageSelect(file);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className="chat-photo-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-label="사진 첨부"
          title="사진 첨부"
        >
          <Camera size={24} strokeWidth={2.4} />
        </button>

        <input
          type="text"
          value={input}
          placeholder={pendingImageUrl ? "사진과 함께 보낼 내용을 입력하세요" : "예: 내일 오후 5시 치과 예약"}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSend();
          }}
        />

        <button
          type="button"
          className="chat-send-button"
          onClick={onSend}
          disabled={isLoading}
        >
          전송
        </button>

        <button
          type="button"
          className={`voice-record-button ${recording ? "recording" : "idle"}`}
          onClick={recording ? onStopRecording : onStartRecording}
          disabled={isLoading}
        >
          {recording ? "녹음 종료" : "음성 입력"}
        </button>
      </div>
    </div>
  );
}
