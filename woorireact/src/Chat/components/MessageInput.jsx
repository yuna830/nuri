export default function MessageInput({
  input,
  isLoading,
  recording,
  onInputChange,
  onSend,
  onStartRecording,
  onStopRecording,
}) {
  return (
    <div className="chatbot-input">
      <input
        type="text"
        value={input}
        placeholder="예: 내일 오후 5시 치과 예약"
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSend();
        }}
      />

      <button
        type="button"
        className={`voice-record-button ${recording ? "recording" : "idle"}`}
        onClick={recording ? onStopRecording : onStartRecording}
        disabled={isLoading}
      >
        {recording ? "녹음 종료" : "음성 입력"}
      </button>

      <button type="button" onClick={onSend} disabled={isLoading}>
        전송
      </button>
    </div>
  );
}
