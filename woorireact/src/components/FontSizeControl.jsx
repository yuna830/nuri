import { useEffect, useState } from "react";
import "../css/common/FontSizeControl.css";

const LEVELS = [
  { label: "가", value: 16, title: "기본 크기" },
  { label: "가", value: 19, title: "크게" },
  { label: "가", value: 22, title: "매우 크게" },
];

const STORAGE_KEY = "woori_font_size";

export function applyFontSize(px) {
  document.documentElement.style.fontSize = `${px}px`;
}

export function initFontSize() {
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  const valid = LEVELS.find((level) => level.value === saved);
  if (valid) applyFontSize(valid.value);
}

export default function FontSizeControl() {
  const [current, setCurrent] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return LEVELS.find((level) => level.value === saved)?.value ?? LEVELS[0].value;
  });

  const handleSelect = (px) => {
    setCurrent(px);
    applyFontSize(px);
    localStorage.setItem(STORAGE_KEY, String(px));
  };

  return (
    <div className="fsc-wrap" aria-label="글씨 크기 조절">
      <span className="fsc-label">글씨</span>
      {LEVELS.map((level, index) => (
        <button
          key={level.value}
          type="button"
          className={`fsc-btn fsc-btn-${index} ${current === level.value ? "active" : ""}`}
          title={level.title}
          onClick={() => handleSelect(level.value)}
          aria-pressed={current === level.value}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
