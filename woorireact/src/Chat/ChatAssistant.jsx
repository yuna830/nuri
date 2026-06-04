import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { withUserGreeting } from "./utils/userGreeting";
import {
  createAssistantConversation,
  deleteAssistantConversation,
  fetchAssistantConversations,
  fetchAssistantMessages,
  saveAssistantMessage,
  updateAssistantConversationTitle,
} from "./services/assistantConversationApi";

const createWelcomeMessages = () => [
  {
    role: "assistant",
    content: withUserGreeting("안녕하세요. 무엇을 도와드릴까요? 일정을 직접 선택하거나 채팅으로 말해주시면 등록할 수 있어요."),
  },
];

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
  } catch {
    // ignore

    // Fall back to the stored senior id lookup result.
  }
  return null;
};

export default function ChatAssistant() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("chat");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [chatSchedules, setChatSchedules] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isConversationPanelOpen, setIsConversationPanelOpen] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(true);
  const persistedMessageCountRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const didShowBriefingRef = useRef(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [messages, setMessages] = useState(createWelcomeMessages);

  async function refreshConversations(seniorId = getResolvedSeniorId()) {
    if (!seniorId) return [];
    const recentConversations = await fetchAssistantConversations(seniorId);
    setConversations(recentConversations);
    return recentConversations;
  }

  async function openConversation(conversationId, { closePanel = true } = {}) {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return;

    setIsConversationLoading(true);
    try {
      const savedMessages = await fetchAssistantMessages(seniorId, conversationId);
      const nextMessages = savedMessages.length > 0
        ? savedMessages.map((message) => ({
            ...message,
            role: message.role.toLowerCase(),
          }))
        : createWelcomeMessages();

      persistedMessageCountRef.current = savedMessages.length;
      setActiveConversationId(conversationId);
      setMessages(nextMessages);
      if (closePanel) setIsConversationPanelOpen(false);
    } catch (error) {
      console.error("대화 불러오기 오류:", error);
    } finally {
      setIsConversationLoading(false);
    }
  }

  async function createConversation({ closePanel = true } = {}) {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return;

    setIsConversationLoading(true);
    try {
      const conversation = await createAssistantConversation(seniorId);
      persistedMessageCountRef.current = 0;
      setActiveConversationId(conversation.id);
      setMessages(createWelcomeMessages());
      setConversations((prev) => [conversation, ...prev]);
      if (closePanel) setIsConversationPanelOpen(false);
    } catch (error) {
      console.error("새 대화 생성 오류:", error);
    } finally {
      setIsConversationLoading(false);
    }
  }

  async function removeConversation(conversationId) {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return;

    try {
      await deleteAssistantConversation(seniorId, conversationId);
      const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
      setConversations(remaining);

      if (conversationId !== activeConversationId) return;
      if (remaining.length > 0) {
        await openConversation(remaining[0].id, { closePanel: false });
      } else {
        await createConversation({ closePanel: false });
      }
    } catch (error) {
      console.error("대화 삭제 오류:", error);
    }
  }

  async function renameConversation(conversationId, title) {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return;

    try {
      const updated = await updateAssistantConversationTitle(seniorId, conversationId, title);
      setConversations((prev) =>
        prev.map((conversation) => conversation.id === conversationId ? updated : conversation)
      );
    } catch (error) {
      console.error("대화 제목 수정 오류:", error);
    }
  }

  useEffect(() => {
    async function initializeConversations() {
      const seniorId = getResolvedSeniorId();
      if (!seniorId) {
        setIsConversationLoading(false);
        return;
      }

      try {
        const recentConversations = await refreshConversations(seniorId);
        if (recentConversations.length > 0) {
          await openConversation(recentConversations[0].id);
        } else {
          await createConversation();
        }
      } catch (error) {
        console.error("최근 대화 초기화 오류:", error);
        setIsConversationLoading(false);
      }
    }

    initializeConversations();
  }, []);

  useEffect(() => {
    const seniorId = getResolvedSeniorId();
    if (!seniorId || !activeConversationId) return;

    const newMessages = messages.slice(persistedMessageCountRef.current);
    persistedMessageCountRef.current = messages.length;
    const visibleMessages = newMessages.filter((message) => !message.hidden && message.content);

    if (visibleMessages.length === 0) return;

    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        for (const message of visibleMessages) {
          await saveAssistantMessage(seniorId, activeConversationId, message);
        }
        await refreshConversations(seniorId);
      })
      .catch((error) => {
        console.error("대화 메시지 저장 오류:", error);
      });
  }, [activeConversationId, messages]);

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
    if (searchParams.get("mode") === "schedule") {
      setEditingSchedule(null);
      setMode("schedule");
    }
  }, [searchParams]);

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
      onScheduleSave={(schedule) =>{
        setEditingSchedule(null);
        return handleScheduleSave(schedule);
      }}
      onScheduleUpdate={handleScheduleUpdate}
      onScheduleEdit={openScheduleEdit}
      onScheduleDelete={handleScheduleDelete}
      conversations={conversations}
      activeConversationId={activeConversationId}
      isConversationPanelOpen={isConversationPanelOpen}
      isConversationLoading={isConversationLoading}
      onConversationPanelToggle={() => setIsConversationPanelOpen((open) => !open)}
      onConversationPanelClose={() => setIsConversationPanelOpen(false)}
      onConversationCreate={createConversation}
      onConversationSelect={openConversation}
      onConversationDelete={removeConversation}
      onConversationRename={renameConversation}
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
