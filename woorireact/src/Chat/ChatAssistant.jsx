import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./ChatAssistant.css";
import ChatView from "./components/ChatView";
import ScheduleRegister from "./components/ScheduleRegister";
import { createSchedule, deleteSchedule, fetchSchedulesByDate, fetchSeniorSchedules, getCurrentSeniorId, updateSchedule, } from "./services/scheduleApi";
import { formatScheduleBrief, isPastSchedule, isRemainingTodaySchedule, pad, scheduleToText, todayValue, } from "./utils/scheduleText";
import { withUserGreeting } from "./utils/userGreeting";
import { createAssistantConversation, deleteAssistantConversation, fetchAssistantConversations, fetchAssistantMessages, saveAssistantMessage, updateAssistantConversationTitle, } from "./services/assistantConversationApi";

//=======================상수 함수===========================
//챗봇 시작말 
const createWelcomeMessages = () => [
  {
    role: "assistant",
    content: withUserGreeting("안녕하세요. 무엇을 도와드릴까요? 일정을 직접 선택하거나 채팅으로 말해주시면 등록할 수 있어요."),
    createdAt: new Date().toISOString(),
  },
];

//사용자 불러오기 
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
    //ignore
  }
  return null;
};

//=======================상태===========================
export default function ChatAssistant() {
  const [searchParams] = useSearchParams();

  // 화면 상태
  const [mode, setMode] = useState("chat");
  const [editingSchedule, setEditingSchedule] = useState(null);

  // 일정 상태
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [chatSchedules, setChatSchedules] = useState([]);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());

  // 채팅 상태
  const [messages, setMessages] = useState(createWelcomeMessages);

  // 대화방 상태
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isConversationPanelOpen, setIsConversationPanelOpen] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(true);

  // 이미 DB에 저장된 메시지 개수
  const persistedMessageCountRef = useRef(0);
  // 메시지 저장 순서 보장용 큐
  const saveQueueRef = useRef(Promise.resolve());
  // 오늘 일정 안내 중복 방지
  const didShowBriefingRef = useRef(false);
  // 새로 만든 대화방에만 오늘 일정 브리핑
  const briefingConversationIdRef = useRef(null);
  // 늦게 도착한 일정 조회가 최신 목록을 덮어쓰지 않도록 요청 순서를 보관
  const scheduleLoadRequestRef = useRef(0);

  //=======================대화방 함수===========================
  // 대화방 목록 조회 
  async function refreshConversations(seniorId = getResolvedSeniorId()) {
    if (!seniorId) return [];
    const recentConversations = await fetchAssistantConversations(seniorId);
    setConversations(recentConversations);
    return recentConversations;
  }

  //================================================
  // 선택한 대화방 열기 
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
      briefingConversationIdRef.current = null;
      setActiveConversationId(conversationId);
      setMessages(nextMessages);
      if (closePanel) setIsConversationPanelOpen(false);
    } catch (error) {
      console.error("대화 불러오기 오류:", error);
    } finally {
      setIsConversationLoading(false);
    }
  }

  // 새 대화방 생성 
  async function createConversation({ closePanel = true } = {}) {
    const seniorId = getResolvedSeniorId();
    if (!seniorId) return;

    setIsConversationLoading(true);
    try {
      const conversation = await createAssistantConversation(seniorId);
      persistedMessageCountRef.current = 0;
      didShowBriefingRef.current = false;
      briefingConversationIdRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      const nextMessages = createWelcomeMessages();
      const remainingTodaySchedules = chatSchedules.filter(isRemainingTodaySchedule);
      if (remainingTodaySchedules.length > 0) {
        nextMessages.push({
          role: "assistant",
          content: `남은 오늘 일정은 ${remainingTodaySchedules.map(formatScheduleBrief).join(", ")}입니다.`,
          createdAt: new Date().toISOString(),
        });
        didShowBriefingRef.current = true;
      }
      setMessages(nextMessages);
      setConversations((prev) => [conversation, ...prev]);
      if (closePanel) setIsConversationPanelOpen(false);
    } catch (error) {
      console.error("새 대화 생성 오류:", error);
    } finally {
      setIsConversationLoading(false);
    }
  }

  // 대화방 삭제 
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

  // 대화방 제목 수정 
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

  //=======================일정 함수===========================
  // 일정 등록 화면 열기 
  function openScheduleCreate() {
    setEditingSchedule(null);
    setMode("schedule");
  }

  //일정 수정 화면 열기 
  function openScheduleEdit(schedule) {
    setEditingSchedule(schedule);
    setMode("schedule");
  }

  //================================================
  //일정 저장
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
      scheduleLoadRequestRef.current += 1;
      const [dateSchedules, allSchedules] = await Promise.all([
        fetchSchedulesByDate(seniorId, savedSchedule.date),
        fetchSeniorSchedules(seniorId),
      ]);
      setSavedSchedules(dateSchedules.map(scheduleFromApi));
      setChatSchedules(allSchedules.map(scheduleFromApi));

      addAssistantMessage(`${savedSchedule.text} 일정이 ${isEditing ? "수정" : "등록"}됐어요.`);
      setEditingSchedule(null);
      setMode("chat");
    } catch (error) {
      console.error("일정 저장 오류:", error);
      addAssistantMessage("일정을 저장하지 못했어요. 서버 연결을 확인해 주세요.");
    }
  }

  //일정 수정
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
      scheduleLoadRequestRef.current += 1;
      const [dateSchedules, allSchedules] = await Promise.all([
        fetchSchedulesByDate(seniorId, savedSchedule.date),
        fetchSeniorSchedules(seniorId),
      ]);
      setSavedSchedules(dateSchedules.map(scheduleFromApi));
      setChatSchedules(allSchedules.map(scheduleFromApi));
      addAssistantMessage(`${savedSchedule.text} 일정으로 수정됐어요.`);
    } catch (error) {
      console.error("일정 수정 오류:", error);
      addAssistantMessage("일정을 수정하지 못했어요. 서버 연결을 확인해 주세요.");
    }
  }

  //일정 삭제 
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

  //챗봇 메시지 추가 
  function addAssistantMessage(content) {
    setMessages((prev) => [...prev, { role: "assistant", content, createdAt: new Date().toISOString() }]);
  }

  //오늘 일정 자동 안내 
  function showTodayBriefing(schedules) {
    if (didShowBriefingRef.current) return;

    const todaySchedules = schedules.filter(isRemainingTodaySchedule);
    if (todaySchedules.length === 0) return;
    didShowBriefingRef.current = true;

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `남은 오늘 일정은 ${todaySchedules.map(formatScheduleBrief).join(", ")}입니다.`,
        createdAt: new Date().toISOString(),
      },
    ]);
  }


  //=======================useEffect===========================
  // 최초 진입 시 최근 대화 불러오기 
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

  // 메시지 변경 시 자동 저장
  useEffect(() => {
    const seniorId = getResolvedSeniorId();
    if (!seniorId || !activeConversationId) return;

    const newMessages = messages.slice(persistedMessageCountRef.current);
    persistedMessageCountRef.current = messages.length;
    const persistableMessages = newMessages.filter((message) => message.content);

    if (persistableMessages.length === 0) return;

    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        for (const message of persistableMessages) {
          await saveAssistantMessage(seniorId, activeConversationId, message);
        }
        await refreshConversations(seniorId);
      })
      .catch((error) => {
        console.error("대화 메시지 저장 오류:", error);
      });
  }, [activeConversationId, messages]);

  // URL 파라미터에 따른 화면 전환
  useEffect(() => {
    if (searchParams.get("mode") === "schedule") {
      setEditingSchedule(null);
      setMode("schedule");
    }
  }, [searchParams]);

  // 선택한 날짜의 일정 조회
  useEffect(() => {
    async function loadSchedules() {
      const seniorId = getResolvedSeniorId();
      if (!seniorId) return;
      const requestId = ++scheduleLoadRequestRef.current;
      try {
        const [dateSchedules, allSchedules] = await Promise.all([
          fetchSchedulesByDate(seniorId, selectedScheduleDate),
          fetchSeniorSchedules(seniorId),
        ]);
        if (requestId !== scheduleLoadRequestRef.current) return;

        const normalizedDateSchedules = dateSchedules.map(scheduleFromApi);
        const normalizedAllSchedules = allSchedules.map(scheduleFromApi);

        setSavedSchedules(normalizedDateSchedules);
        setChatSchedules(normalizedAllSchedules);
      } catch (error) {
        console.error("일정 조회 오류:", error);
      }
    }
    loadSchedules();
  }, [selectedScheduleDate]);

  useEffect(() => {
    if (
      !activeConversationId ||
      briefingConversationIdRef.current !== activeConversationId ||
      didShowBriefingRef.current
    ) {
      return;
    }

    showTodayBriefing(chatSchedules);
  }, [activeConversationId, chatSchedules]);

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

//=======================변환용 유틸 함수===========================
// API 요청용 일정 데이터 변환
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

// API 응답 데이터를 화면용 일정 객체로 변환
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

// 오전/오후 시각을 24시간 형식으로 변환
function fieldsToTime(schedule) {
  const hour = Number(schedule.hour || 9);
  const minute = schedule.minute || "00";
  let hour24 = hour;
  if (schedule.period === "오후" && hour < 12) hour24 += 12;
  if (schedule.period === "오전" && hour === 12) hour24 = 0;
  return `${pad(hour24)}:${minute}`;
}

// 24시간 형식을 오전/오후 시각으로 변환
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
