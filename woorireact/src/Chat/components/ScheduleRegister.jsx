import { useMemo, useRef, useState } from "react";
import axios from "axios";
import { UserCommonHeader, UserSubHeader } from "../../components/UserCommonHeader.jsx";
import { STT_API_URL } from "../services/voiceSttApi";
import {
  TIME_EXPRESSION_PATTERN_SOURCE,
  parseDateFromText,
  parseTimeExpression,
} from "../services/scheduleParser";

const categories = [
  {
    id: "hospital",
    label: "병원",
    examples: ["치과 예약", "내과 진료", "건강 검진"],
  },
  {
    id: "medicine",
    label: "약 복용",
    examples: ["혈압약 복용", "당뇨약 복용", "영양제 복용"],
  },
  {
    id: "welfare",
    label: "복지관",
    examples: ["복지관 방문", "복지관 상담", "프로그램 참여"],
  },
  {
    id: "exercise",
    label: "운동",
    examples: ["산책", "물리치료", "스트레칭"],
  },
  {
    id: "meal",
    label: "식사",
    examples: ["아침 식사", "점심 식사", "저녁 식사"],
  },
  {
    id: "custom",
    label: "직접 입력",
    examples: [],
  },
];

const hours = Array.from({ length: 12 }, (_, index) => index + 1);
const minutes = ["00", "30"];

export default function ScheduleRegister({ initialSchedule, onBack, onSave }) {
  const initialTime = timeToFields(initialSchedule?.time);
  const isEditing = Boolean(initialSchedule);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [date, setDate] = useState(initialSchedule?.date || todayValue());
  const [period, setPeriod] = useState(initialSchedule?.period || initialTime.period);
  const [hour, setHour] = useState(initialSchedule?.hour || initialTime.hour);
  const [minute, setMinute] = useState(initialSchedule?.minute || initialTime.minute);
  const [categoryId, setCategoryId] = useState(getInitialCategoryId(initialSchedule));
  const [detail, setDetail] = useState(
    initialSchedule?.detail || initialSchedule?.title || "치과 예약"
  );
  const [recording, setRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const selectedCategory = useMemo(() => {
    return categories.find((category) => category.id === categoryId);
  }, [categoryId]);

  const previewText = useMemo(() => {
    const minuteText = minute === "00" ? "" : ` ${minute}분`;
    const eventText = detail || selectedCategory?.label || "일정";

    return `${formatDateLabel(date)} ${period} ${hour}시${minuteText} ${eventText}`;
  }, [date, period, hour, minute, detail, selectedCategory]);

  function handleCategorySelect(category) {
    setCategoryId(category.id);
    setDetail(category.examples[0] || "");
  }

  function applyVoiceSchedule(text) {
    const parsed = parseVoiceSchedule(text);

    if (parsed.date) setDate(parsed.date);
    if (parsed.period) setPeriod(parsed.period);
    if (parsed.hour) setHour(parsed.hour);
    if (parsed.minute) setMinute(parsed.minute);
    if (parsed.categoryId) setCategoryId(parsed.categoryId);
    if (parsed.detail) setDetail(parsed.detail);
  }

  async function startRecording() {
    setVoiceError("");

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

          if (!recognizedText) {
            setVoiceError("음성을 인식하지 못했어요. 다시 말해 주세요.");
            return;
          }

          setVoiceText(recognizedText);
          applyVoiceSchedule(recognizedText);
        } catch (error) {
          console.error("일정 STT 오류:", error);
          setVoiceError("음성을 인식하지 못했어요. STT 서버 상태를 확인해 주세요.");
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("마이크 녹음 오류:", error);
      setVoiceError("마이크를 사용할 수 없어요. 브라우저 권한을 확인해 주세요.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  }

  function handleSave() {
    onSave({
      id: initialSchedule?.id || Date.now(),
      date,
      period,
      hour,
      minute,
      category: selectedCategory?.label || "일정",
      detail: detail || selectedCategory?.label || "일정",
      title: detail || selectedCategory?.label || "일정",
      text: previewText,
      createdAt: initialSchedule?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="schedule-register-page">
      <UserCommonHeader />
      <UserSubHeader
        title=""
        onBack={onBack}
        backLabel="← 채팅으로"
      />

      <header className="schedule-register-header">
        <p>AI 일정 도우미</p>
        <h1>{isEditing ? "일정을 수정하세요" : "일정을 쉽게 등록하세요"}</h1>
      </header>

      <main className="schedule-register-layout">
        <section className="schedule-register-form">
          <div className="register-step">
            <h2>1. 날짜 선택</h2>
            <input
              className="date-picker"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="register-step">
            <h2>2. 시간 선택</h2>

            <div className="segmented-buttons">
              {["오전", "오후"].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={period === item ? "selected" : ""}
                  onClick={() => setPeriod(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="hour-grid">
              {hours.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={hour === item ? "selected" : ""}
                  onClick={() => setHour(item)}
                >
                  {item}시
                </button>
              ))}
            </div>

            <div className="segmented-buttons small">
              {minutes.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={minute === item ? "selected" : ""}
                  onClick={() => setMinute(item)}
                >
                  {item === "00" ? "정각" : "30분"}
                </button>
              ))}
            </div>
          </div>

          <div className="register-step">
            <h2>3. 일정 종류</h2>

            <div className="category-grid">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={categoryId === category.id ? "selected" : ""}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="register-step">
            <h2>4. 상세 내용</h2>

            {selectedCategory?.examples.length > 0 && (
              <div className="example-buttons">
                {selectedCategory.examples.map((example) => (
                  <button
                    type="button"
                    key={example}
                    className={detail === example ? "selected" : ""}
                    onClick={() => setDetail(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            <input
              className="detail-input"
              type="text"
              value={detail}
              placeholder="예: 치과 예약"
              onChange={(event) => setDetail(event.target.value)}
            />
          </div>
        </section>

        <aside className="schedule-confirm">
          <h2>{isEditing ? "수정 전 확인" : "등록 전 확인"}</h2>

          <div className="preview-box">
            <p>이 일정으로 {isEditing ? "수정할까요?" : "등록할까요?"}</p>
            <strong>{previewText}</strong>
          </div>

          <button type="button" className="save-button" onClick={handleSave}>
            {isEditing ? "일정 수정하기" : "일정 등록하기"}
          </button>

          <div className="voice-box">
            <h3>음성 입력</h3>
            <p>예: 내일 오후 5시 치과 예약</p>
            <button
              type="button"
              className={`voice-record-button ${recording ? "recording" : "idle"}`}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? "녹음 종료" : "말로 일정 채우기"}
            </button>
            {voiceText && <p className="voice-result">인식한 말: {voiceText}</p>}
            {voiceError && <p className="voice-error">{voiceError}</p>}
          </div>
        </aside>
      </main>

      <button type="button" className="scroll-top-button" onClick={scrollToTop}>
        ↑ 맨 위
      </button>
    </section>
  );
}

function getInitialCategoryId(schedule) {
  const category = categories.find((item) => item.label === schedule?.category);
  return category?.id || "hospital";
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

function parseVoiceSchedule(text) {
  return {
    date: parseDateFromText(text),
    ...parseTimeFromVoice(text),
    categoryId: inferCategoryId(text),
    detail: cleanDetail(text),
  };
}

function parseTimeFromVoice(text) {
  const parsed = parseTimeExpression(text);
  if (!parsed) return {};

  const hour24 = Number(parsed.value.slice(0, 2));
  return {
    period: hour24 >= 12 ? "오후" : "오전",
    hour: hour24 % 12 || 12,
    minute: parsed.minute >= 15 && parsed.minute < 45 ? "30" : "00",
  };
}

function inferCategoryId(text) {
  if (/병원|치과|내과|검진|진료|약국/.test(text)) return "hospital";
  if (/약|복용|영양제/.test(text)) return "medicine";
  if (/복지관|상담|프로그램/.test(text)) return "welfare";
  if (/운동|산책|물리치료|스트레칭/.test(text)) return "exercise";
  if (/식사|아침|점심|저녁/.test(text)) return "meal";
  return "custom";
}

function cleanDetail(text) {
  return text
    .replace(/오늘|내일|낼|모레|다음\s*주|이번\s*주|[일월화수목금토]요일/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, "")
    .replace(new RegExp(TIME_EXPRESSION_PATTERN_SOURCE, "g"), "")
    .replace(/일정|등록|해줘|해주세요|예약해줘|알려줘/g, "")
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timeToFields(time) {
  if (!time) return { period: "오전", hour: 9, minute: "00" };

  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour24 = Number(rawHour);
  const period = hour24 >= 12 ? "오후" : "오전";
  const hour12 = hour24 % 12 || 12;

  return {
    period,
    hour: hour12,
    minute: rawMinute === "30" ? "30" : "00",
  };
}

function todayValue() {
  return formatDate(new Date());
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "날짜 미선택";

  const date = new Date(`${dateValue}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
