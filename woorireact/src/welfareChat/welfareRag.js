import { WELFARE_PROGRAMS } from "./welfarePrograms.js";

const QUESTION_INTENT_KEYWORDS = ["받을", "가능", "대상", "추천", "알려", "신청", "제도", "복지"];

export function findWelfarePrograms({ question, person, limit = 3 }) {
  const normalizedQuestion = normalizeText(question);
  const normalizedPerson = normalizePerson(person);

  const rankedPrograms = WELFARE_PROGRAMS.map((program) => ({
    program,
    score: scoreProgram(program, normalizedQuestion, normalizedPerson),
    reasons: getMatchReasons(program, normalizedPerson),
  }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score);

  if (rankedPrograms.length > 0) {
    return rankedPrograms.slice(0, limit);
  }

  return WELFARE_PROGRAMS.filter((program) => isAgeMatched(program, normalizedPerson))
    .slice(0, limit)
    .map((program) => ({
      program,
      score: 1,
      reasons: getMatchReasons(program, normalizedPerson),
    }));
}

export function normalizePerson(person = {}) {
  const age = toNumber(person.age);
  const healthText = [
    person.healthStatus,
    person.condition,
    person.healthInfo,
    person.diseases,
    person.medicineCount,
  ]
    .map(stringifyValue)
    .join(" ");

  const address = [
    person.address,
    person.region,
    person.currentAddress,
    person.safeZoneAddress,
  ]
    .filter(Boolean)
    .join(" ");
  const benefitsText = stringifyValue(person.currentBenefits || person.welfareBenefits || person.benefits || person.welfareMemo || "");
  const incomeText = stringifyValue(person.incomeLevel || person.income || person.welfareDecision || "");
  const householdText = stringifyValue(person.household || person.householdType || person.relation || "");
  const profileText = [healthText, benefitsText, incomeText, householdText, address].join(" ");

  return {
    ...person,
    age,
    name: person.name || person.seniorName || person.elderName || "대상자",
    gender: person.gender || "",
    address,
    healthText,
    benefitsText,
    incomeText,
    householdText,
    profileText,
    isLivingAlone: /독거|혼자|1인|단독/.test(`${person.household || ""} ${person.relation || ""} ${healthText}`),
  };
}

function scoreProgram(program, normalizedQuestion, person) {
  let score = 0;

  for (const keyword of program.keywords) {
    if (normalizedQuestion.includes(normalizeText(keyword))) score += 4;
  }

  for (const keyword of QUESTION_INTENT_KEYWORDS) {
    if (normalizedQuestion.includes(keyword)) score += 1;
  }

  if (isAgeMatched(program, person)) score += 2;
  if (program.healthKeywords?.some((keyword) => person.healthText.includes(keyword))) score += 3;
  if (program.keywords?.some((keyword) => person.profileText?.includes(keyword))) score += 3;
  if (person.benefitsText && person.benefitsText.includes(program.name)) score -= 5;
  if (/기초|차상위|저소득|의료급여|생계급여/.test(person.incomeText || "") && /basic-pension|basic-livelihood/.test(program.id)) score += 3;
  if (/장애|거동|치매|보행|인지|돌봄|요양/.test(person.profileText || "") && /long-term-care|custom-care/.test(program.id)) score += 3;
  if (person.isLivingAlone && /custom-care|emergency-safety/.test(program.id)) score += 2;

  return score;
}

function getMatchReasons(program, person) {
  const reasons = [];

  if (person.age && program.minAge && person.age >= program.minAge) {
    reasons.push(`만 ${person.age}세로 ${program.name}의 연령 기준을 우선 확인할 수 있습니다.`);
  }

  if (program.healthKeywords?.some((keyword) => person.healthText.includes(keyword))) {
    reasons.push("건강 상태와 돌봄 필요도 확인이 필요한 항목이 있습니다.");
  }

  if (person.isLivingAlone && /custom-care|emergency-safety/.test(program.id)) {
    reasons.push("독거 또는 돌봄 공백 여부를 기준으로 신청 가능성을 확인할 수 있습니다.");
  }

  if (reasons.length === 0) {
    reasons.push(program.evidence[0]);
  }

  return reasons;
}

function isAgeMatched(program, person) {
  if (!program.minAge || !person.age) return true;
  return person.age >= program.minAge;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function toNumber(value) {
  const number = Number(String(value ?? "").match(/\d+/)?.[0] || 0);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function stringifyValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyValue).join(" ");
  if (typeof value === "object") return Object.values(value).map(stringifyValue).join(" ");
  return String(value);
}
