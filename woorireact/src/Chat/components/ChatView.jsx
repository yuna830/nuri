import { useEffect, useRef, useState } from "react";
import { createCareResponse } from "../services/aiCareService";
import { parseKoreanSchedules } from "../services/scheduleParser";

export default function ChatView({
  messages,
  setMessages,
  savedSchedules,
  onScheduleOpen,
  onScheduleSave,
  onScheduleEdit,
  onScheduleDelete,
}) {
  const [input, setInput] = useState("");
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingSchedule]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    try {
      const parsedSchedules = parseKoreanSchedules(text);
      const answer = await createCareResponse({ text, schedules: parsedSchedules });
      const firstSchedule = parsedSchedules[0] || null;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: answer },
      ]);

      setPendingSchedule(firstSchedule);
    } finally {
      setIsLoading(false);
    }
  }

  function confirmPendingSchedule() {
    if (!pendingSchedule) return;

    onScheduleSave({
      ...pendingSchedule,
      text: scheduleToText(pendingSchedule),
    });
    setPendingSchedule(null);
  }

  function cancelPendingSchedule() {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "알겠어요. 일정 등록을 취소했습니다.",
      },
    ]);
    setPendingSchedule(null);
  }

  return (
    <section className="chatbot-page">
      <header className="chatbot-header">
        <div>
          <p>AI 챗봇</p>
          <h1>무엇을 도와드릴까요?</h1>
        </div>

        <button type="button" onClick={onScheduleOpen}>
          일정 등록하기
        </button>
      </header>

      <main className="chatbot-layout">
        <section className="chatbot-panel">
          <div className="chatbot-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chat-message ${message.role}`}
              >
                {message.content}
              </div>
            ))}

            {isLoading && (
              <div className="chat-message assistant">내용을 확인하는 중이에요...</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {pendingSchedule && (
            <div className="chat-schedule-confirm">
              <p>이 일정으로 등록할까요?</p>
              <strong>{scheduleToText(pendingSchedule)}</strong>
              <div>
                <button type="button" onClick={cancelPendingSchedule}>
                  취소
                </button>
                <button type="button" onClick={confirmPendingSchedule}>
                  등록
                </button>
              </div>
            </div>
          )}

          <div className="chatbot-input">
            <input
              type="text"
              value={input}
              placeholder="예: 내일 오후 5시 치과 예약"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
            />

            <button type="button" onClick={sendMessage} disabled={isLoading}>
              전송
            </button>
          </div>
        </section>

        <aside className="schedule-list-panel">
          <h2>등록된 일정</h2>

          {savedSchedules.length === 0 ? (
            <p>아직 등록된 일정이 없습니다.</p>
          ) : (
            savedSchedules.map((schedule) => (
              <article key={schedule.id} className="saved-schedule-card">
                <p>{schedule.text}</p>
                <div className="saved-schedule-actions">
                  <button type="button" onClick={() => onScheduleEdit(schedule)}>
                    수정
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => onScheduleDelete(schedule.id)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </aside>
      </main>
    </section>
  );
}

function scheduleToText(schedule) {
  const dateText = schedule.date || "날짜 확인 필요";
  const timeText = schedule.time ? ` ${schedule.time}` : "";
  return `${dateText}${timeText} ${schedule.title}`.trim();
}
