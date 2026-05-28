export const isSameDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

export const isCallRequestAlert = (alert) => alert?.type === "CALL_REQUEST";

export const isSosAlert = (alert) => {
  const text = `${alert?.type || ""} ${alert?.title || ""} ${alert?.message || ""}`;
  return alert?.type === "SOS" || /SOS/.test(text);
};

export const isSosCancelAlert = (alert) => {
  const text = `${alert?.type || ""} ${alert?.title || ""} ${alert?.message || ""}`;
  return alert?.type === "SOS_CANCEL" || /취소|해제|잘못/.test(text);
};

export const isSafeZoneAlert = (alert) => (
  alert?.type === "SAFE_ZONE" || alert?.type === "SAFE_ZONE_EXIT"
);

export const formatAlertMessage = (alert) => {
  const originalMessage = alert.message ?? alert.title ?? "";

  if (!originalMessage) {
    return "알림 내용이 없습니다.";
  }

  const seniorName = alert.seniorName || alert.name || "보호 대상자";

  if (isSosCancelAlert(alert)) {
    return `${seniorName}님 SOS 잘못 누름 알림`;
  }

  if (isSosAlert(alert)) {
    return `${seniorName}님 SOS 요청`;
  }

  return originalMessage;
};

export const buildDisplayedAlerts = (apiAlerts, reportedAlertIds) => {
  const today = new Date();
  const todayAlerts = apiAlerts.filter((alert) => {
    if (!alert.createdAt) return false;
    if (isCallRequestAlert(alert)) return false;

    const createdAt = new Date(alert.createdAt);

    if (Number.isNaN(createdAt.getTime())) return false;

    return isSameDate(createdAt, today);
  });

  const sosCancelAlerts = todayAlerts.filter(isSosCancelAlert);

  return todayAlerts
    .filter((alert) => {
      if (!isSosAlert(alert) || isSosCancelAlert(alert)) return true;

      const alertTime = new Date(alert.createdAt).getTime();
      return !sosCancelAlerts.some((cancelAlert) => {
        const isSameSenior = String(cancelAlert.seniorId || "") === String(alert.seniorId || "");
        const cancelTime = new Date(cancelAlert.createdAt).getTime();
        return isSameSenior && cancelTime >= alertTime;
      });
    })
    .map((alert) => {
      const safeZone = isSafeZoneAlert(alert);

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
        status: reportedAlertIds.includes(String(alert.id))
          ? "신고 완료"
          : alert.isRead
            ? safeZone
              ? "만남 완료"
              : isSosCancelAlert(alert)
                ? "확인함"
                : "조치완료"
            : "미확인",
        isSos: isSosAlert(alert) && !isSosCancelAlert(alert),
        isSosCancel: isSosCancelAlert(alert),
        isSafeZone: safeZone,
      };
    });
};
