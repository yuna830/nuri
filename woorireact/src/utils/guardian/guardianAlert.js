import { getFallCaptureUrl } from "../../api/userPageApi.js";

const FALL_ALERT_TYPES = new Set(["FALL_DETECTED", "FALL_RISK"]);

export const isSameDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const getSeniorName = (alert) => alert.seniorName || alert.name || "보호 대상자";

const normalizeCaptureName = (value) => {
  if (!value) return "";
  return String(value).replace(/^captures[\\/]/, "");
};

export const getFallAlertImageUrl = (alert) => {
  const directUrl = alert.imageAccessUrl || alert.fallDetails?.captureUrl || "";
  if (directUrl) return directUrl;

  const imageUrl = alert.imageUrl || alert.captureImage || alert.capture || alert.fallDetails?.captureName || "";
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/")) return imageUrl;

  return getFallCaptureUrl(normalizeCaptureName(imageUrl));
};

const formatLocation = (alert) =>
  alert.address || alert.locationText || alert.fallDetails?.locationText || "위치 확인 필요";

const isUnknownLocation = (value) => {
  const text = String(value || "").trim();
  return !text || text === "위치 확인 필요" || text === "현재 위치 확인 필요";
};

const replaceUnknownLocationInMessage = (message, locationText) => {
  if (!message || isUnknownLocation(locationText)) return message;

  return message.replace(
    /현재 위치:\s*(?:현재 위치 확인 필요|위치 확인 필요)/g,
    `현재 위치: ${locationText}`
  );
};

const formatCameraScoreNote = (score) => {
  if (score == null) return "카메라와 센서, AI 조건을 함께 확인한 알림입니다.";
  return `카메라 보조점수: ${score}점. 센서나 AI 조건으로도 알림이 발생할 수 있습니다.`;
};

const clarifyFallScoreMessage = (message, score) => {
  if (!message) return message;

  const clarified = message
    .replace(/\s*감지 점수\s*:?\s*[0-9.]+\s*점?\.?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (clarified.includes("센서나 AI 조건") || clarified.includes("카메라와 센서")) {
    return clarified;
  }

  return `${clarified} ${formatCameraScoreNote(score)}`;
};

export const formatAlertMessage = (alert) => {
  const originalMessage = alert.message ?? alert.title ?? "";
  const seniorName = getSeniorName(alert);

  if (alert.type === "INFO_UPDATE_REQUEST") {
    return originalMessage || `${seniorName}님의 미입력 정보 확인이 필요합니다.`;
  }

  if (FALL_ALERT_TYPES.has(alert.type)) {
    const score = alert.score ?? alert.fallDetails?.score;
    if (originalMessage) {
      const messageWithLocation = replaceUnknownLocationInMessage(originalMessage, formatLocation(alert));
      return clarifyFallScoreMessage(messageWithLocation, score);
    }

    return `${seniorName}님 낙상이 감지되었습니다. 현재 위치: ${formatLocation(alert)}. ${formatCameraScoreNote(score)}`;
  }

  const isSosCancel =
    originalMessage.includes("취소")
    || originalMessage.includes("해제")
    || originalMessage.includes("종료");

  if (isSosCancel) {
    return `${seniorName}님 SOS 해제 알림`;
  }

  const isSosRequest =
    alert.type === "SOS"
    || originalMessage.includes("SOS 요청")
    || originalMessage.includes("SOS를 보냄")
    || originalMessage.includes("SOS 보냄");

  if (isSosRequest) {
    return `${seniorName}님 SOS 요청`;
  }

  return originalMessage || "알림 내용이 없습니다.";
};

const isWithinDays = (value, days) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
};

// 알림 유형별 보관 기간
// - 중요 알림 (SOS, 낙상, 안전반경): 7일
// - 정보 입력 요청: 7일
// - 안부 확인·일반 알림: 3일
const ALERT_RETENTION_DAYS = {
  SOS:              7,
  UNANSWERED_SOS:   7,
  FALL_DETECTED:    7,
  FALL_RISK:        7,
  SAFE_ZONE_EXIT:   7,
  SAFE_ZONE:        7,
  INFO_UPDATE_REQUEST: 7,
};
const DEFAULT_RETENTION_DAYS = 3;

const getRetentionDays = (type) =>
  ALERT_RETENTION_DAYS[type] ?? DEFAULT_RETENTION_DAYS;

export const buildDisplayedAlerts = (apiAlerts, reportedAlertIds) => {
  const seenIds = new Set();

  return apiAlerts
    .filter((alert) => {
      if (!alert.id) return true;
      const key = String(alert.id);
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    })
    .filter((alert) => {
      if (alert.type === "CALL_REQUEST") return false;
      // 복지사 전용 알림 — 보호자 패널에서 제외
      if (alert.type === "WELFARE_CONSULT_RESPONSE") return false;

      if (!alert.createdAt) return false;

      const createdAt = new Date(alert.createdAt);

      if (Number.isNaN(createdAt.getTime())) return false;

      return isWithinDays(alert.createdAt, getRetentionDays(alert.type));
    })
    .map((alert) => {
      const isReported = reportedAlertIds.includes(String(alert.id));
      const isCandidateConfirm = alert.type === "AI_CANDIDATE_CONFIRM";
      const isSafeZone = alert.type === "SAFE_ZONE" || alert.type === "SAFE_ZONE_EXIT";
      const isFall = FALL_ALERT_TYPES.has(alert.type);

      return {
        id: alert.id,
        seniorName: alert.seniorName || alert.name,
        seniorId: alert.seniorId,
        type: alert.type,
        latitude: alert.latitude,
        longitude: alert.longitude,
        address: alert.address,
        score: alert.score ?? alert.fallDetails?.score,
        imageUrl: isFall ? getFallAlertImageUrl(alert) : alert.imageUrl || "",
        isCandidateConfirm,
        rawAlert: alert,
        time: alert.createdAt
          ? new Date(alert.createdAt).toLocaleString("ko-KR", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          : "",
        message: formatAlertMessage(alert),
        detailMessage: isFall
          ? "낙상 사진과 위치 정보가 보호자와 복지사에게 함께 공유되었습니다. 연락이 닿지 않거나 대처가 없으면 신고를 진행해주세요."
          : "",
        status: isReported
          ? "신고 완료"
          : alert.isRead
            ? isCandidateConfirm ? "확인 완료" : isSafeZone ? "만남 완료" : "확인됨"
            : isCandidateConfirm ? "확인 필요" : "미확인",
        isSos: alert.type === "SOS",
        isSafeZone,
        isFall,
      };
    });
};
