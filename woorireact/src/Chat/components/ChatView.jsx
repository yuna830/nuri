import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import { useAnswerVoice } from "../hooks/useAnswerVoice";
import { useChatFlow } from "../hooks/useChatFlow";
import { useVoiceInput } from "../hooks/useVoiceInput";
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

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/user");
  };

  const handleImageUpload = async (file) => {
    const imageUrl = URL.createObjectURL(file);
    const answer = "사진 잘 받았어요. 같이 보고 이야기해요. 어떤 사진인지 설명해 주시면 더 잘 맞춰서 대답할게요.";

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: "사진을 보냈어요.",
        imageUrl,
      },
      {
        role: "assistant",
        content: answer,
      },
    ]);

    speak(answer);
  };

  return (
    <section className="chatbot-page">
      <UserCommonHeader />
      <button className="chatbot-back-button" type="button" onClick={goBack} aria-label="뒤로가기">
        &lt;
      </button>

      <header className="chatbot-header">
        <p>AI 챗봇</p>
        <h1>무엇을 도와드릴까요?</h1>
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
            onImageUpload={handleImageUpload}
          />
        </section>

        <TodaySchedulePanel
          schedules={savedSchedules}
          selectedDate={selectedScheduleDate}
          onDateChange={onScheduleDateChange}
          onScheduleOpen={onScheduleOpen}
          onScheduleEdit={onScheduleEdit}
          onScheduleDelete={onScheduleDelete}
        />
      </main>
    </section>
  );
}
