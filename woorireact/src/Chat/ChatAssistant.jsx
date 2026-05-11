import { useEffect, useRef, useState } from "react";
import "./ChatAssistant.css";
import ChatView from "./components/ChatView";
import ScheduleRegister from "./components/ScheduleRegister";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedulesByDate,
  fetchSeniorSchedules,
  getCurrentSeniorId,
  updateSchedule,
} from "./services/scheduleApi";
import {
  formatScheduleBrief,
  isPastSchedule,
  pad,
  scheduleToText,
  todayValue,
} from "./utils/scheduleText";

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
  const [chatSchedules, setChatSchedules] = useState([]);
  const didShowBriefingRef = useRef(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "안녕하세요. 무엇을 도와드릴까요? 일정을 직접 선택하거나 채팅으로 말해주시면 등록할 수 있어요.",
    },
  ]);

  function showTodayBriefing(schedules) {
    if (didShowBriefingRef.current) return;

    const todaySchedules = schedules.filter((schedule) => schedule.date === todayValue());
    if (todaySchedules.length === 0) return;

    didShowBriefingRef.current = true;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `오늘 일정은 ${todaySchedules.map(formatScheduleBrief).join(", ")}입니다.`,
      },
    ]);
  }

  async function refreshAllSchedules() {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return [];

    const allSchedules = await fetchSeniorSchedules(seniorId);
    const normalized = allSchedules.map(scheduleFromApi);
    setChatSchedules(normalized);
    return normalized;
  }

  useEffect(() => {
    async function loadSchedules() {
      const seniorId = getResolvedSeniorId();
      if (!seniorId) return;
      try {
        const [dateSchedules, allSchedules] = await Promise.all([
          fetchSchedulesByDate(seniorId, selectedScheduleDate),
          fetchSeniorSchedules(seniorId),
        ]);
        const normalizedDateSchedules = dateSchedules.map(scheduleFromApi);
        const normalizedAllSchedules = allSchedules.map(scheduleFromApi);

        setSavedSchedules(normalizedDateSchedules);
        setChatSchedules(normalizedAllSchedules);
        showTodayBriefing(normalizedAllSchedules);
      } catch (error) {
        console.error("일정 조회 오류:", error);
      }
    }
    loadSchedules();
  }, [selectedScheduleDate]);

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
      addAssistantMessage("지난 날짜나 이미 지난 시간은 일정으로 등록할 수 없어요. 앞으로의 날짜와 시간으로 다시 말해주세요.");
      return;
    }

    if (!seniorId) {
      addAssistantMessage("사용자 정보가 없어 일정을 저장하지 못했어요. 다시 로그인해 주세요.");
      return;
    }

    try {
      const payload = scheduleToApiPayload(schedule, seniorId);
      const saved = isEditing
        ? await updateSchedule(editingSchedule.id, payload)
        : await createSchedule(payload);
      const savedSchedule = scheduleFromApi(saved);

      setSelectedScheduleDate(savedSchedule.date);
      applySavedSchedule(savedSchedule, isEditing);
      await refreshAllSchedules();

      addAssistantMessage(`${savedSchedule.text} 일정이 ${isEditing ? "수정" : "등록"}됐어요.`);
      setEditingSchedule(null);
      setMode("chat");
    } catch (error) {
      console.error("일정 저장 오류:", error);
      addAssistantMessage("일정을 저장하지 못했어요. 서버 연결을 확인해 주세요.");
    }
  }

  async function handleScheduleUpdate(schedule) {
    const seniorId = getResolvedSeniorId();

    if (isPastSchedule(schedule)) {
      addAssistantMessage("지난 날짜나 이미 지난 시간으로는 일정을 수정할 수 없어요. 앞으로의 날짜와 시간으로 다시 말해주세요.");
      return;
    }

    if (!seniorId) {
      addAssistantMessage("사용자 정보가 없어 일정을 수정하지 못했어요. 다시 로그인해 주세요.");
      return;
    }

    try {
      const payload = scheduleToApiPayload(schedule, seniorId);
      const saved = await updateSchedule(schedule.id, payload);
      const savedSchedule = scheduleFromApi(saved);

      setSelectedScheduleDate(savedSchedule.date);
      applySavedSchedule(savedSchedule, true);
      await refreshAllSchedules();
      addAssistantMessage(`${savedSchedule.text} 일정으로 수정됐어요.`);
    } catch (error) {
      console.error("일정 수정 오류:", error);
      addAssistantMessage("일정을 수정하지 못했어요. 서버 연결을 확인해 주세요.");
    }
  }

  async function handleScheduleDelete(scheduleId) {
    const target =
      chatSchedules.find((schedule) => schedule.id === scheduleId) ||
      savedSchedules.find((schedule) => schedule.id === scheduleId);
    try {
      await deleteSchedule(scheduleId);
      setSavedSchedules((prev) =>
        prev.filter((schedule) => schedule.id !== scheduleId)
      );
      setChatSchedules((prev) =>
        prev.filter((schedule) => schedule.id !== scheduleId)
      );
      if (target) {
        addAssistantMessage(`${target.text} 일정이 삭제됐어요.`);
      }
    } catch (error) {
      console.error("일정 삭제 오류:", error);
      addAssistantMessage("일정을 삭제하지 못했어요. 서버 연결을 확인해 주세요.");
    }
  }

  function applySavedSchedule(savedSchedule, isEditing) {
    setChatSchedules((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== savedSchedule.id);
      return [savedSchedule, ...withoutCurrent];
    });

    setSavedSchedules((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== savedSchedule.id);
      if (savedSchedule.date !== selectedScheduleDate) return withoutCurrent;
      return isEditing ? [savedSchedule, ...withoutCurrent] : [savedSchedule, ...prev];
    });
  }

  function addAssistantMessage(content) {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
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
      chatSchedules={chatSchedules}
      selectedScheduleDate={selectedScheduleDate}
      onScheduleDateChange={setSelectedScheduleDate}
      onScheduleOpen={openScheduleCreate}
      onScheduleSave={handleScheduleSave}
      onScheduleUpdate={handleScheduleUpdate}
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
