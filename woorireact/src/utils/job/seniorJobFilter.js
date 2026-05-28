const SENIOR_ELIGIBILITY_KEYWORDS = [
  "\ub178\uc778\uc77c\uc790\ub9ac",
  "\uc2dc\ub2c8\uc5b4",
  "\uc5b4\ub974\uc2e0",
  "\uace0\ub839\uc790",
  "\uace0\ub839",
  "\uc911\uc7a5\ub144",
  "\uc7a5\ub144",
  "\uc900\uace0\ub839",
  "\uc2e4\ubc84",
  "\ub9cc 50",
  "\ub9cc50",
  "\ub9cc 55",
  "\ub9cc55",
  "\ub9cc 60",
  "\ub9cc60",
  "50\uc138 \uc774\uc0c1",
  "55\uc138 \uc774\uc0c1",
  "60\uc138 \uc774\uc0c1",
  "65\uc138 \uc774\uc0c1",
  "50\uc138",
  "55\uc138",
  "60\uc138",
  "65\uc138",
];

const LOW_BARRIER_JOB_KEYWORDS = [
  "\ubbf8\ud654",
  "\uccad\uc18c",
  "\ud658\uacbd\uc815\ube44",
  "\ud658\uacbd \uc815\ube44",
  "\uacbd\ube44",
  "\ubcf4\uc548",
  "\uc8fc\ucc28",
  "\uad00\ub9ac\uc6d0",
  "\uc548\ub0b4",
  "\uc0ac\ubb34\ubcf4\uc870",
  "\uc0ac\ubb34 \ubcf4\uc870",
  "\ud589\uc815\ubcf4\uc870",
  "\ud589\uc815 \ubcf4\uc870",
  "\ubb38\uc11c\uc815\ub9ac",
  "\ubb38\uc11c \uc815\ub9ac",
  "\uc790\ub8cc\uc815\ub9ac",
  "\uc790\ub8cc \uc815\ub9ac",
  "\ub3c4\uc11c\uc815\ub9ac",
  "\ub3c4\uc11c \uc815\ub9ac",
  "\uae09\uc2dd\ubcf4\uc870",
  "\uae09\uc2dd \ubcf4\uc870",
  "\ubc30\uc2dd",
  "\uc8fc\ubc29\ubcf4\uc870",
  "\uc8fc\ubc29 \ubcf4\uc870",
  "\uc870\ub9ac\ubcf4\uc870",
  "\uc870\ub9ac \ubcf4\uc870",
  "\uac80\uc218",
  "\ubd84\ub958",
  "\ub2e8\uc21c",
  "\ubcf4\uc870\uc6d0",
  "\uc0dd\ud65c\uc9c0\uc6d0\uc0ac",
  "\ub3cc\ubd04",
  "\uacf5\uc6d0\uad00\ub9ac",
  "\uacf5\uc6d0 \uad00\ub9ac",
  "\uc2dc\uc124\uad00\ub9ac \ubcf4\uc870",
  "\uc2dc\uc124 \uad00\ub9ac \ubcf4\uc870",
  "\uc544\ud30c\ud2b8",
];

const UNSUITABLE_JOB_KEYWORDS = [
  "java",
  "javascript",
  "react",
  "spring",
  "python",
  "node",
  "node.js",
  "c++",
  "c#",
  "sql",
  "aws",
  "mct",
  "cnc",
  "\uc790\ubc14",
  "\uc790\ubc14\uc2a4\ud06c\ub9bd\ud2b8",
  "\ub9ac\uc561\ud2b8",
  "\uc2a4\ud504\ub9c1",
  "\ud30c\uc774\uc36c",
  "\uac1c\ubc1c\uc790",
  "\ud504\ub85c\uadf8\ub798\uba38",
  "\uc18c\ud504\ud2b8\uc6e8\uc5b4",
  "\uc6f9\uac1c\ubc1c",
  "\uc571\uac1c\ubc1c",
  "\ubc31\uc5d4\ub4dc",
  "\ud504\ub860\ud2b8\uc5d4\ub4dc",
  "\uc11c\ubc84",
  "\ub124\ud2b8\uc6cc\ud06c",
  "\ub370\uc774\ud130\ubca0\uc774\uc2a4",
  "\ub370\uc774\ud130 \uc5d4\uc9c0\ub2c8\uc5b4",
  "\uc778\uacf5\uc9c0\ub2a5",
  "\uba38\uc2e0\ub7ec\ub2dd",
  "\uc5d4\uc9c0\ub2c8\uc5b4",
  "\uc5f0\uad6c\uc6d0",
  "\uc124\uacc4",
  "cad",
  "\uce90\ub4dc",
  "\ud68c\uacc4",
  "\uc138\ubb34",
  "\ubcf4\ud5d8\uc601\uc5c5",
  "\uc601\uc5c5\uc0ac\uc6d0",
  "\ub9c8\ucf00\ud305",
  "\uae30\uc220\uc9c1",
  "\uc0dd\uc0b0\ud300",
  "\uc0dd\uc0b0\uc9c1",
  "\uc0dd\uc0b0",
  "\uc81c\uc870",
  "\uacf5\uc7a5",
  "\ub77c\uc778",
  "\ucda9\uc9c4",
  "\ucda9\uc804",
  "\uc870\ub9bd",
  "\ud654\uc7a5\ud488",
  "\uc804\uae30\uae30\uc0ac",
  "\uc18c\ubc29\uae30\uc0ac",
  "\uc694\uc591\ubcf4\ud638\uc0ac",
  "\uc0ac\ud68c\ubcf5\uc9c0\uc0ac",
  "\ubb3c\ub9ac\uce58\ub8cc\uc0ac",
  "\uc791\uc5c5\uce58\ub8cc\uc0ac",
  "\uac04\ud638\uc0ac",
  "\uac04\ud638\uc870\ubb34\uc0ac",
  "\uc601\uc591\uc0ac",
  "\uc870\ub9ac\uc0ac",
  "\uc6b4\uc804\uae30\uc0ac",
  "\uc6b4\uc804\uc6d0",
  "\ubc84\uc2a4",
  "\ud0dd\uc2dc",
  "\ud654\ubb3c",
  "\uc6a9\uc811",
  "\uc9c0\uac8c\ucc28",
  "\uad74\uc0ad\uae30",
  "\uc804\uae30",
  "\uae30\uacc4",
  "\uc124\ube44",
  "\uc815\ube44",
  "\uae30\uc0ac",
];

const jobText = (job) => [
  job?.source,
  job?.age,
  job?.recrtTitle,
  job?.wantedTitle,
  job?.oranNm,
  job?.plbizNm,
  job?.workPlcNm,
  job?.jobclsNm,
  job?.emplymShpNm,
  job?.acptMthd,
  job?.etcItm,
  job?.detCnts,
].filter(Boolean).join(" ").toLowerCase();

const includesAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

const hasSeniorEligibleAge = (job) => {
  const match = String(job?.age || "").match(/\d+/);
  return match ? Number(match[0]) >= 50 : false;
};

export const isSeniorFriendlyJob = (job) => {
  const text = jobText(job);

  if (!text) {
    return false;
  }

  if (includesAny(text, UNSUITABLE_JOB_KEYWORDS)) {
    return false;
  }

  if (!hasSeniorEligibleAge(job) && !includesAny(text, SENIOR_ELIGIBILITY_KEYWORDS)) {
    return false;
  }

  return includesAny(text, LOW_BARRIER_JOB_KEYWORDS);
};
