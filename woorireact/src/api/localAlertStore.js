const getStorageKey = (seniorId) => `woori-local-alerts:${seniorId}`;

const readLocalAlerts = (seniorId) => {
  if (!seniorId) return [];

  try {
    const raw = localStorage.getItem(getStorageKey(seniorId));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalAlerts = (seniorId, alerts) => {
  if (!seniorId) return;

  try {
    localStorage.setItem(getStorageKey(seniorId), JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent("woori-local-alerts-changed", {
      detail: { seniorId: String(seniorId) },
    }));
  } catch {
    return;
  }
};

export const isLocalAlertId = (alertId) => String(alertId || "").startsWith("local-");

export const getLocalSeniorAlerts = (seniorId) => readLocalAlerts(seniorId);

export const saveLocalSeniorAlert = ({
  seniorId,
  type,
  title,
  message,
  createdAt,
  extra = {},
}) => {
  const targetSeniorId = Number(seniorId);
  const alert = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    seniorId: targetSeniorId,
    type,
    title,
    message,
    createdAt: createdAt || new Date().toISOString(),
    isRead: false,
    source: "local",
    ...extra,
  };

  const alerts = readLocalAlerts(targetSeniorId);
  writeLocalAlerts(targetSeniorId, [alert, ...alerts].slice(0, 80));

  return alert;
};

export const markLocalAlertRead = (alertId) => {
  let updatedAlert = null;

  Object.keys(localStorage)
    .filter((key) => key.startsWith("woori-local-alerts:"))
    .forEach((key) => {
      const seniorId = key.replace("woori-local-alerts:", "");
      const alerts = readLocalAlerts(seniorId);
      const nextAlerts = alerts.map((alert) => {
        if (String(alert.id) !== String(alertId)) return alert;
        updatedAlert = { ...alert, isRead: true };
        return updatedAlert;
      });

      if (updatedAlert) {
        writeLocalAlerts(seniorId, nextAlerts);
      }
    });

  if (!updatedAlert) {
    throw new Error("Local alert not found");
  }

  return updatedAlert;
};

export const deleteLocalAlert = (alertId) => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("woori-local-alerts:"))
    .forEach((key) => {
      const seniorId = key.replace("woori-local-alerts:", "");
      const alerts = readLocalAlerts(seniorId);
      writeLocalAlerts(seniorId, alerts.filter((alert) => String(alert.id) !== String(alertId)));
    });
};

export const deleteLocalAlerts = (alertIds) => {
  const idSet = new Set(alertIds.map(String));

  Object.keys(localStorage)
    .filter((key) => key.startsWith("woori-local-alerts:"))
    .forEach((key) => {
      const seniorId = key.replace("woori-local-alerts:", "");
      const alerts = readLocalAlerts(seniorId);
      writeLocalAlerts(seniorId, alerts.filter((alert) => !idSet.has(String(alert.id))));
    });
};

export const deleteOldLocalRequestAlerts = (seniorId, days = 30) => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const alerts = readLocalAlerts(seniorId);
  const nextAlerts = alerts.filter((alert) => {
    const createdAt = new Date(alert.createdAt || alert.time).getTime();
    const isRequest = ["PROFILE_UPDATE_REQUEST", "PROFILE_UPDATE", "JOB_RECOMMEND", "JOB_CONTACT_REQUEST", "WELFARE_REQUEST"].includes(alert.type);
    return !isRequest || Number.isNaN(createdAt) || createdAt >= cutoff;
  });

  writeLocalAlerts(seniorId, nextAlerts);
};
