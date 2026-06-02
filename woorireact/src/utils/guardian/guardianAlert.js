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

export const formatAlertMessage = (alert) => {
  const originalMessage = alert.message ?? alert.title ?? "";
  const seniorName = getSeniorName(alert);

  if (alert.type === "INFO_UPDATE_REQUEST") {
    return originalMessage || `${seniorName}님의 미입력 정보 확인이 필요합니다.`;
  }

  if (FALL_ALERT_TYPES.has(alert.type)) {
    const score = alert.score ?? alert.fallDetails?.score;
    const scoreText = score != null ? ` 감지 점수 ${score}점.` : "";
    return `${seniorName}님 낙상이 감지되었습니다. 현재 위치: ${formatLocation(alert)}.${scoreText}`;
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

export const buildDisplayedAlerts = (apiAlerts, reportedAlertIds) => {
  const today = new Date();
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
      if (!alert.createdAt) return false;

      const createdAt = new Date(alert.createdAt);

      if (Number.isNaN(createdAt.getTime())) return false;

      if (alert.type === "INFO_UPDATE_REQUEST") {
        return isWithinDays(alert.createdAt, 30);
      }

      return isSameDate(createdAt, today);
    })
    .map((alert) => {
      const isReported = reportedAlertIds.includes(String(alert.id));
      const isSafeZone = alert.type === "SAFE_ZONE" || alert.type === "SAFE_ZONE_EXIT";
      const isFall = FALL_ALERT_TYPES.has(alert.type);

      return {
        id: alert.id,
        seniorId: alert.seniorId,
        type: alert.type,
        latitude: alert.latitude,
        longitude: alert.longitude,
        address: alert.address,
        score: alert.score ?? alert.fallDetails?.score,
        imageUrl: isFall ? getFallAlertImageUrl(alert) : "",
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
            ? isSafeZone ? "만남 완료" : "확인됨"
            : "미확인",
        isSos: alert.type === "SOS",
        isSafeZone,
        isFall,
      };
    });
};
