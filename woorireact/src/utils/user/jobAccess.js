import { calculateAge } from "./profileForm.js";

export const MIN_JOB_ACCESS_AGE = 18;

const toNumber = (value) => {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
};

export const getJobAccessAge = (profile) => {
  if (!profile) return null;

  const senior = profile.senior ?? {};
  const birthDate = profile.birthDate ?? senior.birthDate;
  const age = profile.age ?? senior.age;

  return calculateAge(birthDate) ?? toNumber(age);
};

export const canAccessJobs = (profile) => {
  const age = getJobAccessAge(profile);
  return age === null || age >= MIN_JOB_ACCESS_AGE;
};
