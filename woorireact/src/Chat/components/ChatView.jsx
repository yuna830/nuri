import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { createCareResponse, extractScheduleIntent } from "../services/aiCareService";
import {
  normalizeScheduleText,
  parseDateFromText,
  parseKoreanSchedules,
  parseTimeFromText,
} from "../services/scheduleParser";
import { STT_API_URL } from "../services/serverConfig";

export default function ChatView({
  messages,
  setMessages,
  savedSchedules,
  onScheduleOpen,
  onScheduleSave,
  onScheduleUpdate,
  onScheduleEdit,
  onScheduleDelete,
}) {
  const [input, setInput] = useState("");
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingSchedule]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;

    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  function speakAnswer(text) {
    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.voice = getCuteKoreanVoice();
    utterance.pitch = 1.25;
    utterance.rate = 1.06;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(customText = null, options = {}) {
    const text = typeof customText === "string" ? customText.trim() : input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const commandAnswer = await handleScheduleCommand(text, options);
      if (commandAnswer) return;

      const parsedSchedules = parseKoreanSchedules(text);
      let firstSchedule = parsedSchedules[0] || null;

      if (!firstSchedule) {
        const extracted = await extractScheduleIntent(text);
        const handled = await handleExtractedScheduleIntent(extracted, options);
        if (handled) return;
        firstSchedule = scheduleFromExtractedIntent(extracted);
      }

      if (firstSchedule && isPastSchedule(firstSchedule)) {
        const pastMessage =
          "지난 날짜나 이미 지난 시간은 일정으로 등록할 수 없어요. 앞으로의 날짜와 시간으로 다시 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: pastMessage }]);
        setPendingSchedule(null);
        if (options.speak) speakAnswer(pastMessage);
        return;
      }

      if (firstSchedule && !firstSchedule.time) {
        const answer = `${scheduleToText(firstSchedule)} 일정으로 이해했어요. 몇 시로 등록할까요? 시간 없이 등록하시려면 "시간 없이 등록"이라고 말씀해 주세요.`;
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        setPendingSchedule(firstSchedule);
        if (options.speak) speakAnswer(answer);
        return;
      }

      const answer = await createCareResponse({ text, schedules: parsedSchedules });

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      setPendingSchedule(firstSchedule);

      if (options.speak) speakAnswer(answer);
    } catch (error) {
      console.error("채팅 응답 오류:", error);

      const errorMessage = "답변을 가져오지 못했어요. Ollama가 실행 중인지 확인해 주세요.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMessage }]);

      if (options.speak) speakAnswer(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExtractedScheduleIntent(extracted, options = {}) {
    if (!extracted || extracted.confidence < 0.65) return false;

    if (extracted.intent === "lookup_schedule") {
      const date =
        parseDateFromText(extracted.dateText) ||
        parseDateFromText(extracted.normalizedText) ||
        todayValue();
      const matches = savedSchedules.filter((schedule) => schedule.date === date);
      const answer =
        matches.length > 0
          ? `${formatDateKorean(date)} 일정은 ${matches.map(formatScheduleBrief).join(", ")}입니다.`
          : `${formatDateKorean(date)}에는 등록된 일정이 없어요.`;

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      if (options.speak) speakAnswer(answer);
      return true;
    }

    if (extracted.intent === "delete_schedule") {
      const target = findScheduleByText(
        savedSchedules,
        `${extracted.title} ${extracted.normalizedText}`
      );
      if (!target) {
        const answer = "삭제할 일정을 찾지 못했어요. 일정 이름을 조금 더 정확히 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }

      await onScheduleDelete(target.id);
      return true;
    }

    if (extracted.intent === "update_schedule") {
      const target = findScheduleByText(
        savedSchedules,
        `${extracted.title} ${extracted.normalizedText}`
      );
      const time =
        parseTimeFromText(extracted.timeText) ||
        parseLooseTime(extracted.timeText, target?.time);

      if (!target) {
        const answer = "수정할 일정을 찾지 못했어요. 어떤 일정을 바꿀지 다시 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }
      if (!time) {
        const answer = "몇 시로 바꿀지 다시 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }

      await onScheduleUpdate({
        ...target,
        time,
        text: scheduleToText({ ...target, time }),
      });
      return true;
    }

    return false;
  }

  async function handleScheduleCommand(text, options = {}) {
    const normalizedText = normalizeScheduleText(text);

    if (pendingSchedule && isTimeSkipRequest(text)) {
      await savePendingSchedule(pendingSchedule, options);
      return true;
    }

    if (pendingSchedule) {
      const requestedTime = parseTimeFromText(text);
      if (requestedTime) {
        await savePendingSchedule(
          {
            ...pendingSchedule,
            time: requestedTime,
          },
          options
        );
        return true;
      }
    }

    if (isScheduleLookupRequest(normalizedText)) {
      const date = parseDateFromText(normalizedText) || todayValue();
      const matches = savedSchedules.filter((schedule) => schedule.date === date);
      const answer =
        matches.length > 0
          ? `${formatDateKorean(date)} 일정은 ${matches.map(formatScheduleBrief).join(", ")}입니다.`
          : `${formatDateKorean(date)}에는 등록된 일정이 없어요.`;

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      if (options.speak) speakAnswer(answer);
      return true;
    }

    if (isScheduleDeleteRequest(normalizedText)) {
      const target = findScheduleByText(savedSchedules, normalizedText);
      if (!target) {
        const answer = "삭제할 일정을 찾지 못했어요. 일정 이름을 조금 더 정확히 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }

      await onScheduleDelete(target.id);
      return true;
    }

    if (isScheduleUpdateRequest(normalizedText)) {
      const update = parseScheduleTimeUpdate(normalizedText, savedSchedules);
      if (!update.target) {
        const answer = "수정할 일정을 찾지 못했어요. 어떤 일정을 바꿀지 다시 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }
      if (!update.time) {
        const answer = "몇 시로 바꿀지 다시 말씀해 주세요.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        if (options.speak) speakAnswer(answer);
        return true;
      }

      await onScheduleUpdate({
        ...update.target,
        time: update.time,
        text: scheduleToText({ ...update.target, time: update.time }),
      });
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
      speakAnswer(`${scheduleToText(schedule)} 일정을 등록했어요.`);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const recordedMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        chunksRef.current = [];

        const formData = new FormData();
        const extension = recordedMimeType.includes("wav") ? "wav" : "webm";
        formData.append("file", blob, `record.${extension}`);

        try {
          const response = await axios.post(STT_API_URL, formData);
          const recognizedText = response.data.text?.trim();
          await sendMessage(recognizedText, { speak: true });
        } catch (error) {
          console.error("STT 오류:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "음성을 인식하지 못했어요. STT 서버 상태를 확인해 주세요.",
            },
          ]);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("마이크 녹음 오류:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "마이크를 사용할 수 없어요. 브라우저 권한을 확인해 주세요.",
        },
      ]);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  }

  function confirmPendingSchedule() {
    if (!pendingSchedule) return;

    savePendingSchedule(pendingSchedule);
  }

  function cancelPendingSchedule() {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "알겠어요. 일정 등록을 취소했어요.",
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

            <button
              type="button"
              className={`voice-record-button ${recording ? "recording" : "idle"}`}
              onClick={recording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {recording ? "녹음 종료" : "음성 입력"}
            </button>

            <button type="button" onClick={() => sendMessage()} disabled={isLoading}>
              전송
            </button>
          </div>
        </section>

        <aside className="schedule-list-panel">
          <h2>등록된 일정</h2>

          {savedSchedules.length === 0 ? (
            <p>아직 등록된 일정이 없어요.</p>
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

function getSupportedAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/wav",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function getCuteKoreanVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const koreanVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("ko"));
  const cuteVoiceNames = ["female", "woman", "girl", "heami", "sunhi", "yuna", "google"];

  return (
    koreanVoices.find((voice) =>
      cuteVoiceNames.some((name) => voice.name.toLowerCase().includes(name))
    ) ||
    koreanVoices[0] ||
    null
  );
}

function scheduleToText(schedule) {
  const dateText = schedule.date || "날짜 확인 필요";
  const timeText = schedule.time ? ` ${schedule.time}` : "";
  return `${dateText}${timeText} ${schedule.title}`.trim();
}

function scheduleFromExtractedIntent(extracted) {
  if (
    !extracted ||
    extracted.intent !== "create_schedule" ||
    extracted.confidence < 0.65 ||
    !extracted.title
  ) {
    return null;
  }

  const date =
    parseDateFromText(extracted.dateText) ||
    parseDateFromText(extracted.normalizedText);
  const time =
    parseTimeFromText(extracted.timeText) ||
    parseTimeFromText(extracted.normalizedText);

  if (!date && !time) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: extracted.title,
    date,
    time,
    sourceText: extracted.normalizedText,
    createdAt: new Date().toISOString(),
  };
}

function isTimeSkipRequest(text) {
  return /시간\s*없이|시간은\s*없|그냥\s*등록|바로\s*등록/.test(text);
}

function isScheduleLookupRequest(text) {
  return /일정/.test(text) && (
    /(뭐|뭐야|있어|알려|확인|보여|브리핑|언제|어떻게)/.test(text) ||
    Boolean(parseDateFromText(text))
  );
}

function isScheduleDeleteRequest(text) {
  return /(취소|삭제|지워|빼줘|없애)/.test(text);
}

function isScheduleUpdateRequest(text) {
  return /(수정|변경|바꿔|말고|앞당겨|미뤄)/.test(text);
}

function findScheduleByText(schedules, text) {
  const keywords = extractScheduleKeywords(text);
  if (keywords.length === 0) return null;

  return (
    schedules.find((schedule) =>
      keywords.every((keyword) => scheduleToSearchText(schedule).includes(keyword))
    ) ||
    schedules.find((schedule) =>
      keywords.some((keyword) => scheduleToSearchText(schedule).includes(keyword))
    ) ||
    null
  );
}

function parseScheduleTimeUpdate(text, schedules) {
  const timeMatches = [...text.matchAll(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?/g)];
  const oldTimeText = timeMatches[0]?.[0] || "";
  const newTimeText = timeMatches[1]?.[0] || oldTimeText;
  const rawOldTime = oldTimeText ? parseTimeFromText(oldTimeText) : "";
  const keywords = extractScheduleKeywords(text);

  const target =
    schedules.find((schedule) => {
      const searchText = scheduleToSearchText(schedule);
      const keywordMatched =
        keywords.length === 0 || keywords.some((keyword) => searchText.includes(keyword));
      const timeMatched = rawOldTime ? isSameLooseTime(schedule.time, rawOldTime) : true;
      return keywordMatched && timeMatched;
    }) ||
    findScheduleByText(schedules, text);

  const time = parseLooseTime(newTimeText, target?.time);
  return { target, time };
}

function extractScheduleKeywords(text) {
  return text
    .replace(/(오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분?)?/g, " ")
    .replace(/일정|예약|취소|삭제|지워|빼줘|없애|수정|변경|바꿔|말고|으로|로|해줘|해주세요|줘/g, " ")
    .replace(/[,.!?]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function scheduleToSearchText(schedule) {
  return `${schedule.title || ""} ${schedule.detail || ""} ${schedule.text || ""}`;
}

function parseLooseTime(text, referenceTime = "") {
  const match = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?/);
  if (!match) return "";

  const [, meridiem, rawHour, rawMinute] = match;
  let hour = Number(rawHour);
  const minute = Number(rawMinute || 0);
  const referenceHour = Number(referenceTime.slice(0, 2));

  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;
  if (!meridiem && referenceHour >= 12 && hour < 12) hour += 12;

  return `${pad(hour)}:${pad(minute)}`;
}

function isSameLooseTime(scheduleTime, requestedTime) {
  if (!scheduleTime || !requestedTime) return false;
  if (scheduleTime === requestedTime) return true;

  const scheduleHour = Number(scheduleTime.slice(0, 2));
  const requestedHour = Number(requestedTime.slice(0, 2));
  return scheduleHour % 12 === requestedHour % 12;
}

function formatScheduleBrief(schedule) {
  return `${schedule.time ? `${schedule.time} ` : ""}${schedule.title || schedule.detail || "일정"}`;
}

function formatDateKorean(dateValue) {
  const [, month, day] = dateValue.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
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
