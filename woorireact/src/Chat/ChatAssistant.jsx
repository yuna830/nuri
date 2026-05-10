import { useEffect, useState } from "react";
import "./ChatAssistant.css";
import ChatView from "./components/ChatView";
import ScheduleRegister from "./components/ScheduleRegister";
import {
  createSchedule,
  deleteSchedule,
  fetchSeniorSchedules,
  getCurrentSeniorId,
  updateSchedule,
} from "./services/scheduleApi";

const getResolvedSeniorId = () => {
  const fromStorage = getCurrentSeniorId();
  if (fromStorage) return fromStorage;
  try {
    const saved = sessionStorage.getItem("currentSenior");
    if (saved) {
      const profile = JSON.parse(saved);
      const id = String(profile?.senior?.id || "");
      if (id) localStorage.setItem("current_senior_id", id);
      return id;
    }
  } catch {}
  return null;
};

export default function ChatAssistant() {
  const [mode, setMode] = useState("chat");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "안녕하세요. 무엇을 도와드릴까요? 일정을 직접 선택하거나 채팅으로 말해주시면 등록할 수 있어요.",
    },
  ]);

  useEffect(() => {
    async function loadSchedules() {
      const seniorId = getResolvedSeniorId();
      if (!seniorId) return;
      try {
        const schedules = await fetchSeniorSchedules(seniorId);
        setSavedSchedules(schedules.map(scheduleFromApi));
      } catch (error) {
        console.error("일정 조회 오류:", error);
      }
    }
    loadSchedules();
  }, []);

  function openScheduleCreate() {
    setEditingSchedule(null);
    setMode("schedule");
  }

  function openScheduleEdit(schedule) {
    setEditingSchedule(schedule);
    setMode("schedule");
  }

  async function handleScheduleSave(schedule) {
    const seniorId = getResolvedSeniorId();
    const isEditing = Boolean(editingSchedule);

    if (isPastSchedule(schedule)) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "지난 날짜나 이미 지난 시간은 일정으로 등록할 수 없어요. 앞으로의 날짜와 시간으로 다시 말씀해 주세요.",
        },
      ]);
      return;
    }

    if (!seniorId) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "사용자 정보가 없어 일정을 저장하지 못했어요. 다시 로그인해 주세요.",
        },
      ]);
      return;
    }

    try {
      const payload = scheduleToApiPayload(schedule, seniorId);
      const saved = isEditing
        ? await updateSchedule(editingSchedule.id, payload)
        : await createSchedule(payload);
      const savedSchedule = scheduleFromApi(saved);

      setSavedSchedules((prev) => {
        if (!isEditing) return [savedSchedule, ...prev];
        return prev.map((item) =>
          item.id === editingSchedule.id ? savedSchedule : item
        );
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${savedSchedule.text} 일정을 ${isEditing ? "수정" : "등록"}했어요.`,
        },
      ]);

      setEditingSchedule(null);
      setMode("chat");
    } catch (error) {
      console.error("일정 저장 오류:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "일정을 저장하지 못했어요. 서버 연결을 확인해 주세요.",
        },
      ]);
    }
  }

  async function handleScheduleDelete(scheduleId) {
    const target = savedSchedules.find((schedule) => schedule.id === scheduleId);
    try {
      await deleteSchedule(scheduleId);
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
    } catch (error) {
      console.error("일정 삭제 오류:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "일정을 삭제하지 못했어요. 서버 연결을 확인해 주세요.",
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

function scheduleToApiPayload(schedule, seniorId) {
  const title = schedule.detail || schedule.title || "일정";
  const scheduleTime = Object.prototype.hasOwnProperty.call(schedule, "time")
    ? schedule.time || null
    : fieldsToTime(schedule);

  return {
    seniorId: Number(seniorId),
    guardianId: null,
    title,
    content: title,
    scheduleDate: schedule.date || todayValue(),
    scheduleTime,
    isRepeat: false,
    isAlarm: true,
  };
}

function scheduleFromApi(schedule) {
  const time = schedule.scheduleTime?.slice(0, 5) || "";
  const timeFields = timeToFields(time);
  const title = schedule.content || schedule.title;
  const text = scheduleToText({ date: schedule.scheduleDate, time, title });
  return {
    id: schedule.id,
    date: schedule.scheduleDate,
    time,
    period: timeFields.period,
    hour: timeFields.hour,
    minute: timeFields.minute,
    category: "일정",
    detail: title,
    title,
    text,
    createdAt: schedule.createdAt,
  };
}

function fieldsToTime(schedule) {
  const hour = Number(schedule.hour || 9);
  const minute = schedule.minute || "00";
  let hour24 = hour;
  if (schedule.period === "오후" && hour < 12) hour24 += 12;
  if (schedule.period === "오전" && hour === 12) hour24 = 0;
  return `${pad(hour24)}:${minute}`;
}

function timeToFields(time) {
  if (!time) return { period: "오전", hour: 9, minute: "00" };
  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour24 = Number(rawHour);
  return {
    period: hour24 >= 12 ? "오후" : "오전",
    hour: hour24 % 12 || 12,
    minute: rawMinute === "30" ? "30" : "00",
  };
}

function scheduleToText(schedule) {
  const dateText = schedule.date || "날짜 확인 필요";
  const timeText = schedule.time ? ` ${schedule.time}` : "";
  return `${dateText}${timeText} ${schedule.title}`.trim();
}

function isPastSchedule(schedule) {
  const date = schedule.date || todayValue();
  const today = todayValue();

  if (date < today) return true;
  if (date > today || !schedule.time) return false;

  return schedule.time <= currentTimeValue();
}

function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function currentTimeValue() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
