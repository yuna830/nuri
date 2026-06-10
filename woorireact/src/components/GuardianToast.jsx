import { useEffect, useState } from "react";
import { GUARDIAN_TOAST_EVENT } from "../utils/guardian/guardianToast";
import "../css/guardian/GuardianToast.css";

let _nextId = 1;
const DURATION = 3200; // ms

export default function GuardianToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const id = _nextId++;
      const { message, type } = e.detail;

      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);

      // 퇴장 애니메이션 시작
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
        );
      }, DURATION - 350);

      // DOM 제거
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DURATION);
    };

    window.addEventListener(GUARDIAN_TOAST_EVENT, handler);
    return () => window.removeEventListener(GUARDIAN_TOAST_EVENT, handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="g-toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`g-toast g-toast-${t.type}${t.leaving ? " g-toast-leaving" : ""}`}
        >
          <span className="g-toast-icon">
            {t.type === "success" && "✓"}
            {t.type === "error"   && "✕"}
            {t.type === "warn"    && "!"}
          </span>
          <span className="g-toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
