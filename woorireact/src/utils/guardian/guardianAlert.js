export const isSameDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

export const formatAlertMessage = (alert) => {
  const originalMessage = alert.message ?? alert.title ?? "";

  if (!originalMessage) {
    return "알림 내용이 없습니다.";
  }

  const seniorName = alert.seniorName || alert.name || "보호 대상자";

  const isSosCancel =
    originalMessage.includes("취소")
    || originalMessage.includes("해제")
    || originalMessage.includes("잘못");

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

  return originalMessage;
};

export const buildDisplayedAlerts = (apiAlerts, reportedAlertIds) => {
  const today = new Date();

  return apiAlerts
    .filter((alert) => {
      if (!alert.createdAt) return false;

      const createdAt = new Date(alert.createdAt);

      if (Number.isNaN(createdAt.getTime())) return false;

      return isSameDate(createdAt, today);
    })
    .map((alert) => {
      const isReported = reportedAlertIds.includes(String(alert.id));
      const isSafeZone = alert.type === "SAFE_ZONE" || alert.type === "SAFE_ZONE_EXIT";

      return {
        id: alert.id,
        seniorId: alert.seniorId,
        type: alert.type,
        latitude: alert.latitude,
        longitude: alert.longitude,
        time: alert.createdAt
          ? new Date(alert.createdAt).toLocaleString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        message: formatAlertMessage(alert),
        status: isReported
          ? "신고 완료"
          : alert.isRead
            ? isSafeZone ? "만남 완료" : "확인됨"
            : "미확인",
        isSos: alert.type === "SOS",
        isSafeZone,
      };
    });
};
