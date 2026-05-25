const SENIOR_JOB_INCLUDE_KEYWORDS = [
  "\ub178\uc778",
  "\uc2dc\ub2c8\uc5b4",
  "\uc5b4\ub974\uc2e0",
  "\uace0\ub839",
  "\uc911\uc7a5\ub144",
  "\uacf5\uc775\ud65c\ub3d9",
  "\uc0ac\ud68c\uc11c\ube44\uc2a4",
  "\uc0ac\ud68c\ubcf5\uc9c0",
  "\ubcf5\uc9c0",
  "\uc7a5\uc560\uc778",
  "\uc13c\ud130",
  "\uc8fc\ubbfc\uc13c\ud130",
  "\ub3c4\uc11c\uad00",
  "\uc548\ub0b4",
  "\ubcf4\uc870",
  "\uc9c0\uc6d0",
  "\ubb38\uc11c",
  "\ud589\uc815",
  "\uc0ac\ubb34",
  "\uc815\ub9ac",
  "\ubbf8\ud654",
  "\uccad\uc18c",
  "\ud658\uacbd",
  "\uacf5\uc6d0",
  "\uacbd\ube44",
  "\ubcf4\uc548",
  "\uc548\uc804",
  "\ub3cc\ubd04",
  "\uc694\uc591",
  "\uac04\ubcd1",
  "\ubcf4\ud638",
  "\uae09\uc2dd",
  "\ubc30\uc2dd",
  "\uc870\ub9ac",
  "\uc8fc\ubc29",
  "\uc544\ud30c\ud2b8",
  "\uc2e4\ubc84",
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
  "\uc804\uae30\uae30\uc0ac",
  "\uc18c\ubc29\uae30\uc0ac",
];

const jobText = (job) => [
  job?.recrtTitle,
  job?.oranNm,
  job?.workPlcNm,
  job?.jobclsNm,
  job?.emplymShpNm,
  job?.acptMthd,
  job?.detCnts,
].filter(Boolean).join(" ").toLowerCase();

const includesAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

export const isSeniorFriendlyJob = (job) => {
  const text = jobText(job);

  if (!text) {
    return false;
  }

  if (includesAny(text, UNSUITABLE_JOB_KEYWORDS)) {
    return false;
  }

  return includesAny(text, SENIOR_JOB_INCLUDE_KEYWORDS);
};
