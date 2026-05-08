export const getCurrentGuardian = () => {
  const savedGuardian = sessionStorage.getItem("currentGuardian");

  if (!savedGuardian) {
    return null;
  }

  return JSON.parse(savedGuardian);
};

export const getCurrentGuardianId = () => {
  const currentGuardian = getCurrentGuardian();
  return currentGuardian?.id ?? null;
};
