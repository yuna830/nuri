import { useState } from "react";
import "./ChatAssistant.css";
import ChatView from "./components/ChatView";
import ScheduleRegister from "./components/ScheduleRegister";

export default function ChatAssistant() {
  const [mode, setMode] = useState("chat");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "안녕하세요. 무엇을 도와드릴까요? 일정을 직접 선택하거나 채팅으로 말해주시면 등록할 수 있어요.",
    },
  ]);

  function openScheduleCreate() {
    setEditingSchedule(null);
    setMode("schedule");
  }

  function openScheduleEdit(schedule) {
    setEditingSchedule(schedule);
    setMode("schedule");
  }

  function handleScheduleSave(schedule) {
    const isEditing = Boolean(editingSchedule);

    setSavedSchedules((prev) => {
      if (!isEditing) return [schedule, ...prev];

      return prev.map((item) => (item.id === schedule.id ? schedule : item));
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `${schedule.text} 일정을 ${isEditing ? "수정" : "등록"}했어요.`,
      },
    ]);

    setEditingSchedule(null);
    setMode("chat");
  }

  function handleScheduleDelete(scheduleId) {
    const target = savedSchedules.find((schedule) => schedule.id === scheduleId);
    setSavedSchedules((prev) =>
      prev.filter((schedule) => schedule.id !== scheduleId)
    );

    if (target) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${target.text} 일정을 삭제했어요.`,
        },
      ]);
    }
  }

  if (mode === "schedule") {
    return (
      <ScheduleRegister
        initialSchedule={editingSchedule}
        onBack={() => {
          setEditingSchedule(null);
          setMode("chat");
        }}
        onSave={handleScheduleSave}
      />
    );
  }

  return (
    <ChatView
      messages={messages}
      setMessages={setMessages}
      savedSchedules={savedSchedules}
      onScheduleOpen={openScheduleCreate}
      onScheduleSave={handleScheduleSave}
      onScheduleEdit={openScheduleEdit}
      onScheduleDelete={handleScheduleDelete}
    />
  );
}
