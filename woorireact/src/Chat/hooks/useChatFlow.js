import { useState } from "react";
import { createCareResponse, extractScheduleIntent } from "../services/aiCareService";
import { getNearbyPlaceChatAnswer } from "../services/nearbyPlaceChatApi";
import { getWeatherChatAnswer } from "../services/weatherChatApi";
import {
  normalizeScheduleText,
  parseDateFromText,
  parseKoreanSchedules,
  shouldUseScheduleExtraction,
} from "../services/scheduleParser";
import {
  getExtractedScheduleAction,
  getScheduleCommandAction,
  scheduleFromExtractedIntent,
} from "../services/scheduleChatRules";
import { isPastSchedule, scheduleToText, todayValue } from "../utils/scheduleText";

export function useChatFlow({
  messages,
  setMessages,
  savedSchedules,
  onScheduleSave,
  onScheduleUpdate,
  onScheduleDelete,
  speak,
}) {
  const [input, setInput] = useState("");
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [pendingSchedules, setPendingSchedules] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage(customText = null, options = {}) {
    const text = typeof customText === "string" ? customText.trim() : input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const weatherAnswer = await getWeatherChatAnswer(text);
      if (weatherAnswer) {
        answer(weatherAnswer, options);
        return;
      }

      const nearbyPlaceAnswer = await getNearbyPlaceChatAnswer(text);
      if (nearbyPlaceAnswer) {
        answer(nearbyPlaceAnswer, options);
        return;
      }

      if (pendingSchedule?.ambiguousTime) {
        const meridiem = parseMeridiemChoice(text);
        if (meridiem) {
          await savePendingSchedule(applyMeridiemToSchedule(pendingSchedule, meridiem), options);
          return;
        }
      }

      if (pendingSchedules.length > 0 && isAffirmativeReply(text)) {
        await savePendingSchedules(pendingSchedules, options);
        return;
      }

      if (pendingSchedule && isAffirmativeReply(text)) {
        await savePendingSchedule(pendingSchedule, options);
        return;
      }

      const suggestedSchedule = getConfirmedSuggestedSchedule(text, messages);
      if (suggestedSchedule) {
        await savePendingSchedule(suggestedSchedule, options);
        return;
      }

      const commandHandled = await handleScheduleAction(
        getScheduleCommandAction({ text, pendingSchedule, savedSchedules }),
        options
      );
      if (commandHandled) return;

      const parsedSchedules = parseKoreanSchedules(text);
      let firstSchedule = parsedSchedules[0] || null;

      if (parsedSchedules.length > 1) {
        const validSchedules = parsedSchedules.filter((schedule) => !isPastSchedule(schedule));
        if (validSchedules.length !== parsedSchedules.length) {
          answer("지난 날짜나 이미 지난 시간은 일정으로 등록할 수 없어요. 앞으로의 날짜와 시간으로 다시 말해주세요.", options);
          return;
        }
        if (validSchedules.some((schedule) => schedule.ambiguousTime)) {
          answer("여러 일정을 한 번에 등록할 때는 오전 또는 오후를 함께 말해주세요.", options);
          return;
        }
        setPendingSchedules(validSchedules);
        answer(`${validSchedules.length}개의 일정으로 이해했어요. 한 번에 등록할까요?`, options);
        return;
      }

      if (!firstSchedule && shouldUseScheduleExtraction(text)) {
        const extracted = await extractScheduleIntent(text);
        const extractedHandled = await handleScheduleAction(
          getExtractedScheduleAction(extracted, savedSchedules),
          options
        );
        if (extractedHandled) return;
        firstSchedule = scheduleFromExtractedIntent(extracted);
      }

      if (firstSchedule && isPastSchedule(firstSchedule)) {
        answer("지난 날짜나 이미 지난 시간은 일정으로 등록할 수 없어요. 앞으로의 날짜와 시간으로 다시 말해주세요.", options);
        setPendingSchedule(null);
        return;
      }

      if (firstSchedule?.ambiguousTime) {
        answer(`${scheduleToText(firstSchedule)} 일정으로 이해했어요. 오전과 오후 중 언제인가요?`, options);
        setPendingSchedule(firstSchedule);
        return;
      }

      if (firstSchedule) {
        setPendingSchedule(firstSchedule);
        answer(`${scheduleToText(firstSchedule)} 일정으로 이해했어요. 등록할까요?`, options);
        return;
      }

      const response = await createCareResponse({
        text,
        schedules: [],
        history: messages,
        profileContext: getCurrentUserHealthContext(),
      });
      answer(response, options);
    } catch (error) {
      console.error("채팅 응답 오류:", error);
      answer("답변을 가져오지 못했어요. 잠시 후 다시 말씀해 주세요.", options);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScheduleAction(action, options = {}) {
    if (!action) return false;

    if (action.type === "answer") {
      answer(action.answer, options);
      return true;
    }

    if (action.type === "savePending") {
      await savePendingSchedule(action.schedule, options);
      return true;
    }

    if (action.type === "delete") {
      await onScheduleDelete(action.target.id);
      return true;
    }

    if (action.type === "deleteCandidates") {
      setPendingDelete({
        date: action.date,
        schedules: action.schedules,
      });
      answer("삭제할 일정을 선택하거나 전체 삭제를 눌러 주세요.", options);
      return true;
    }

    if (action.type === "update") {
      await onScheduleUpdate(action.schedule);
      return true;
    }

    return false;
  }

  async function savePendingSchedule(schedule, options = {}) {
    await onScheduleSave({
      ...schedule,
      text: scheduleToText(schedule),
    });
    setPendingSchedule(null);

    if (options.speak) {
      speak(`${scheduleToText(schedule)} 일정이 등록됐어요.`);
    }
  }

  async function savePendingSchedules(schedules, options = {}) {
    for (const schedule of schedules) {
      await onScheduleSave({
        ...schedule,
        text: scheduleToText(schedule),
      });
    }
    setPendingSchedules([]);

    if (options.speak) {
      speak(`${schedules.length}개의 일정이 등록됐어요.`);
    }
  }

  function confirmPendingSchedule() {
    if (pendingSchedules.length > 0) {
      savePendingSchedules(pendingSchedules);
      return;
    }
    if (!pendingSchedule) return;
    savePendingSchedule(pendingSchedule);
  }

  function choosePendingScheduleMeridiem(meridiem) {
    if (!pendingSchedule?.ambiguousTime) return;
    savePendingSchedule(applyMeridiemToSchedule(pendingSchedule, meridiem));
  }

  function cancelPendingSchedule() {
    answer("알겠어요. 일정 등록을 취소했어요.");
    setPendingSchedule(null);
    setPendingSchedules([]);
  }

  async function deletePendingSchedule(scheduleId) {
    await onScheduleDelete(scheduleId);
    setPendingDelete((current) => {
      if (!current) return null;
      const schedules = current.schedules.filter((schedule) => schedule.id !== scheduleId);
      return schedules.length > 0 ? { ...current, schedules } : null;
    });
  }

  async function deleteAllPendingSchedules() {
    if (!pendingDelete) return;

    const schedules = pendingDelete.schedules;
    for (const schedule of schedules) {
      await onScheduleDelete(schedule.id);
    }
    setPendingDelete(null);
  }

  function cancelPendingDelete() {
    setPendingDelete(null);
    answer("알겠어요. 일정 삭제를 취소했어요.");
  }

  function answer(content, options = {}) {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
    if (options.speak) speak(content);
  }

  function addAssistantMessage(content) {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  }

  return {
    input,
    setInput,
    pendingSchedule,
    pendingSchedules,
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
  };
}

export function getCurrentUserHealthContext() {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    if (!saved) return null;

    const profile = JSON.parse(saved);
    const healthInfo = profile?.healthInfo || {};
    const senior = profile?.senior || {};

    return {
      age: senior.age,
      birthDate: senior.birthDate,
      allergies: healthInfo.allergies,
      diseases: {
        diabetes: healthInfo.diabetes,
        hypertension: healthInfo.hypertension,
        heartDisease: healthInfo.heartDisease,
        jointDisease: healthInfo.jointDisease,
        stroke: healthInfo.stroke,
        kidneyDisease: healthInfo.kidneyDisease,
        lungDisease: healthInfo.lungDisease,
        liverDisease: healthInfo.liverDisease,
        cancer: healthInfo.cancer,
        otherDisease: healthInfo.otherDisease,
      },
    };
  } catch {
    return null;
  }
}

function parseMeridiemChoice(text) {
  const normalized = normalizeScheduleText(text);
  if (/오전|아침|새벽/.test(normalized)) return "오전";
  if (/오후|저녁|밤|낮|점심/.test(normalized)) return "오후";
  return "";
}

function getConfirmedSuggestedSchedule(text, messages) {
  if (!isAffirmativeReply(text)) return null;

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content);
  const content = String(lastAssistantMessage?.content || "");

  if (!/(일정에\s*추가|일정으로\s*등록|일정을\s*잘\s*기억|일정으로\s*이해|추가해\s*드릴까요|등록해\s*드릴까요|등록할까요)/.test(content)) {
    return null;
  }

  const title = extractSuggestedScheduleTitle(content);
  if (!title) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    date: parseDateFromText(content) || todayValue(),
    time: "",
    sourceText: content,
    createdAt: new Date().toISOString(),
  };
}

function isAffirmativeReply(text) {
  return /^(응|네|예|어|좋아|좋습니다|그래|그래요|ㅇㅇ|오케이|ok|okay|등록해줘|추가해줘|웅)[.!?\s]*$/i.test(
    normalizeScheduleText(text).trim()
  );
}

function extractSuggestedScheduleTitle(content) {
  const normalized = normalizeScheduleText(content).replace(/\s+/g, " ").trim();
  const sentence =
    normalized
      .split(/[.!?]/)
      .map((item) => item.trim())
      .find((item) => /일정(?:에|으로)\s*(?:추가|등록)|일정을\s*잘\s*기억|일정으로\s*이해|등록할까요/.test(item)) || normalized;
  const match =
    sentence.match(
    /(?:오늘|내일|모레)?\s*(.+?)(?:을|를)?\s*일정(?:에|으로)\s*(?:추가|등록)/
    ) ||
    sentence.match(/(?:오늘|내일|모레|글피|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)?\s*(.+?)(?:을|를)?\s*일정을\s*잘\s*기억/) ||
    sentence.match(/(?:오늘|내일|모레|글피|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)?\s*(.+?)\s*일정으로\s*이해/) ||
    sentence.match(/(?:오늘|내일|모레|글피|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)?\s*(.+?)\s*등록할까요/);
  if (!match) return "";

  return match[1]
    .replace(/\*\*/g, "")
    .replace(/^(네|예|좋습니다|좋아요|알겠습니다|그럼|그렇다면|그러면)[,.\s]*/g, "")
    .replace(/^(오늘|내일|모레|글피|\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\s*[일월화수목금토]요일)?(?:이네요)?)[,.\s]*/g, "")
    .replace(/\s*(은|는|이|가|을|를)$/g, "")
    .trim();
}

function applyMeridiemToSchedule(schedule, meridiem) {
  const hour = schedule.ambiguousTime.hour;
  const minute = schedule.ambiguousTime.minute;
  let hour24 = hour;

  if (meridiem === "오후" && hour24 < 12) hour24 += 12;
  if (meridiem === "오전" && hour24 === 12) hour24 = 0;

  return {
    ...schedule,
    time: `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    ambiguousTime: null,
  };
}
