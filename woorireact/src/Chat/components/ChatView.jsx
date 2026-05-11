import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAnswerVoice } from "../hooks/useAnswerVoice";
import { useChatFlow } from "../hooks/useChatFlow";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { formatTodayKorean } from "../utils/scheduleText";
import DeleteScheduleBox from "./DeleteScheduleBox";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import ScheduleConfirmBox from "./ScheduleConfirmBox";
import TodaySchedulePanel from "./TodaySchedulePanel";

export default function ChatView({
  messages,
  setMessages,
  savedSchedules,
  chatSchedules,
  selectedScheduleDate,
  onScheduleDateChange,
  onScheduleOpen,
  onScheduleSave,
  onScheduleUpdate,
  onScheduleEdit,
  onScheduleDelete,
}) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const { speak } = useAnswerVoice();
  const {
    input,
    setInput,
    pendingSchedule,
    pendingDelete,
    isLoading,
    sendMessage,
    confirmPendingSchedule,
    choosePendingScheduleMeridiem,
    cancelPendingSchedule,
    deletePendingSchedule,
    deleteAllPendingSchedules,
    cancelPendingDelete,
    addAssistantMessage,
  } = useChatFlow({
    messages,
    setMessages,
    savedSchedules: chatSchedules,
    onScheduleSave,
    onScheduleUpdate,
    onScheduleDelete,
    speak,
  });
  const { recording, startRecording, stopRecording } = useVoiceInput({
    onRecognized: (recognizedText) => sendMessage(recognizedText, { speak: true }),
    onError: addAssistantMessage,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingSchedule]);

  return (
    <section className="chatbot-page">
      <nav className="chatbot-global-nav">
        <button className="chatbot-nav-logo" type="button" onClick={() => navigate("/user")}>
          우리 woori
        </button>
        <div className="chatbot-nav-right">
          <span className="chatbot-nav-date">{formatTodayKorean()}</span>
        </div>
      </nav>

      <header className="chatbot-header">
        <div className="chatbot-title-wrap">
          <button className="chatbot-back-inline" type="button" onClick={() => navigate("/user")}>
            ← 홈으로
          </button>
          <div>
            <p>AI 챗봇</p>
            <h1>무엇을 도와드릴까요?</h1>
          </div>
        </div>
        <button type="button" onClick={onScheduleOpen}>일정 등록하기</button>
      </header>

      <main className="chatbot-layout">
        <section className="chatbot-panel">
          <MessageList
            ref={messagesEndRef}
            messages={messages}
            isLoading={isLoading}
          />

          <ScheduleConfirmBox
            schedule={pendingSchedule}
            onCancel={cancelPendingSchedule}
            onConfirm={confirmPendingSchedule}
            onChooseMeridiem={choosePendingScheduleMeridiem}
          />

          <DeleteScheduleBox
            pendingDelete={pendingDelete}
            onCancel={cancelPendingDelete}
            onDeleteOne={deletePendingSchedule}
            onDeleteAll={deleteAllPendingSchedules}
          />

          <MessageInput
            input={input}
            isLoading={isLoading}
            recording={recording}
            onInputChange={setInput}
            onSend={() => sendMessage()}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </section>

        <TodaySchedulePanel
          schedules={savedSchedules}
          selectedDate={selectedScheduleDate}
          onDateChange={onScheduleDateChange}
          onScheduleEdit={onScheduleEdit}
          onScheduleDelete={onScheduleDelete}
        />
      </main>
    </section>
  );
}
