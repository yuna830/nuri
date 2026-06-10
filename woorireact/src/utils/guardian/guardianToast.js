/**
 * 보호자 페이지 전용 토스트 유틸리티
 * window CustomEvent 기반 — prop drilling 없이 어디서든 호출 가능
 *
 * 사용법:
 *   import { gToast } from "../../utils/guardian/guardianToast";
 *   gToast.success("저장되었습니다.");
 *   gToast.error("저장에 실패했습니다.");
 *   gToast.warn("입력해주세요.");
 */

const EVENT_NAME = "guardian-toast";

const dispatch = (message, type = "success") => {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { message, type } })
  );
};

export const gToast = {
  success: (msg) => dispatch(msg, "success"),
  error:   (msg) => dispatch(msg, "error"),
  warn:    (msg) => dispatch(msg, "warn"),
};

export { EVENT_NAME as GUARDIAN_TOAST_EVENT };
