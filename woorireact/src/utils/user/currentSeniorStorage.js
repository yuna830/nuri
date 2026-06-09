const CURRENT_SENIOR_KEY = "currentSenior";

const PRESERVED_SESSION_KEYS = new Set([
  CURRENT_SENIOR_KEY,
  "currentGuardian",
  "currentWelfareWorker",
  "currentAdmin",
]);

const isQuotaExceeded = (error) =>
  error?.name === "QuotaExceededError" ||
  error?.code === 22 ||
  String(error?.message || "").includes("exceeded the quota");

const clearVolatileSessionStorage = () => {
  const keys = [];

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key && !PRESERVED_SESSION_KEYS.has(key)) keys.push(key);
  }

  keys.forEach((key) => sessionStorage.removeItem(key));
};

const compactCurrentSenior = (profile) => ({
  senior: {
    id: profile?.senior?.id,
    name: profile?.senior?.name,
    phone: profile?.senior?.phone,
    profileImageUrl: profile?.senior?.profileImageUrl,
    region: profile?.senior?.region,
    address: profile?.senior?.address,
  },
});

export const getCurrentSeniorProfile = () => {
  const saved = sessionStorage.getItem(CURRENT_SENIOR_KEY);
  return saved ? JSON.parse(saved) : null;
};

export const saveCurrentSeniorProfile = (profile) => {
  try {
    sessionStorage.setItem(CURRENT_SENIOR_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  clearVolatileSessionStorage();

  try {
    sessionStorage.setItem(CURRENT_SENIOR_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  sessionStorage.setItem(CURRENT_SENIOR_KEY, JSON.stringify(compactCurrentSenior(profile)));
  return false;
};
