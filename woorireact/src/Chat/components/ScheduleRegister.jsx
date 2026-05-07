import { useMemo, useState } from "react";

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

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "날짜 미선택";

  const date = new Date(`${dateValue}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
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

function getInitialCategoryId(schedule) {
  const category = categories.find((item) => item.label === schedule?.category);
  return category?.id || "hospital";
}

export default function ScheduleRegister({ initialSchedule, onBack, onSave }) {
  const initialTime = timeToFields(initialSchedule?.time);
  const isEditing = Boolean(initialSchedule);

  const [date, setDate] = useState(initialSchedule?.date || todayValue());
  const [period, setPeriod] = useState(initialSchedule?.period || initialTime.period);
  const [hour, setHour] = useState(initialSchedule?.hour || initialTime.hour);
  const [minute, setMinute] = useState(initialSchedule?.minute || initialTime.minute);
  const [categoryId, setCategoryId] = useState(getInitialCategoryId(initialSchedule));
  const [detail, setDetail] = useState(
    initialSchedule?.detail || initialSchedule?.title || "치과 예약",
  );

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

  return (
    <section className="schedule-register-page">
      <header className="schedule-register-header">
        <button type="button" onClick={onBack}>
          챗봇으로
        </button>
        <div>
          <p>AI 일정 도우미</p>
          <h1>{isEditing ? "일정을 수정하세요" : "일정을 쉽게 등록하세요"}</h1>
        </div>
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
            <p>Whisper STT 연결 후 말로 일정 등록 기능을 붙일 수 있어요.</p>
            <button type="button" disabled>
              말로 일정 등록하기
            </button>
          </div>
        </aside>
      </main>
    </section>
  );
}
