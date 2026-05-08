import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { createCareResponse } from "../services/aiCareService";
import { parseKoreanSchedules } from "../services/scheduleParser";
import { STT_API_URL } from "../services/serverConfig";

export default function ChatView({
  messages,
  setMessages,
  savedSchedules,
  onScheduleOpen,
  onScheduleSave,
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

  function speakAnswer(text) {
    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(customText = null, options = {}) {
    const text = typeof customText === "string" ? customText.trim() : input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const parsedSchedules = parseKoreanSchedules(text);
      const answer = await createCareResponse({ text, schedules: parsedSchedules });
      const firstSchedule = parsedSchedules[0] || null;

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

    onScheduleSave({
      ...pendingSchedule,
      text: scheduleToText(pendingSchedule),
    });
    setPendingSchedule(null);
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

function scheduleToText(schedule) {
  const dateText = schedule.date || "날짜 확인 필요";
  const timeText = schedule.time ? ` ${schedule.time}` : "";
  return `${dateText}${timeText} ${schedule.title}`.trim();
}
