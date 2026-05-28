import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import { useAnswerVoice } from "../hooks/useAnswerVoice";
import { useChatFlow } from "../hooks/useChatFlow";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { correctSttText } from "../services/sttCorrectionService";
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
    onRecognized: async (recognizedText) => {
      const correctedText = await correctSttText(recognizedText);
      console.log("STT 보정:", { recognizedText, correctedText });
      sendMessage(correctedText, { speak: true });
    },
    onError: (message) => {
      addAssistantMessage(message);
      speak(message);
    },
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

  const formatFoodAnalysisMessage = (result) => {
    const nutrients = result?.nutrients || {};
    const warnings = result?.warnings || [];
    const rows = [
      ["열량", nutrients.calories_kcal, "kcal"],
      ["나트륨", nutrients.sodium_mg, "mg"],
      ["탄수화물", nutrients.carbohydrate_g, "g"],
      ["당류", nutrients.sugar_g, "g"],
      ["지방", nutrients.fat_g, "g"],
      ["포화지방", nutrients.saturated_fat_g, "g"],
      ["트랜스지방", nutrients.trans_fat_g, "g"],
      ["콜레스테롤", nutrients.cholesterol_mg, "mg"],
      ["단백질", nutrients.protein_g, "g"],
    ];

    const nutrientText = rows
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([label, value, unit]) => `- ${label}: ${value}${unit}`)
      .join("\n");

    const warningText = warnings.length
      ? warnings.map((warning) => `- [${warning.level}] ${warning.reason}`).join("\n")
      : "- 특별한 주의 항목은 발견되지 않았어요.";

    return [
      "성분표 분석이 끝났어요.",
      "",
      `제품명: ${result?.product_name || "확인 필요"}`,
      "",
      "영양성분",
      nutrientText || "- 인식된 영양성분이 부족해요.",
      "",
      "주의사항",
      warningText,
    ].join("\n");
  };

  const handleImageUpload = async (file) => {
    const imageUrl = URL.createObjectURL(file);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: "성분표 사진을 보냈어요.",
        imageUrl,
      },
      {
        role: "assistant",
        content: "성분표를 읽고 있어요. 잠시만 기다려 주세요.",
      },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://127.0.0.1:8000/food/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Food analysis request failed");
      }

      const result = await response.json();
      const answer = formatFoodAnalysisMessage(result);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
      speak(answer);
    } catch (error) {
      console.error("Food OCR analysis failed:", error);
      const answer = "성분표 분석 중 문제가 생겼어요. chat_server가 켜져 있는지 확인해 주세요.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
      speak(answer);
    }
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
