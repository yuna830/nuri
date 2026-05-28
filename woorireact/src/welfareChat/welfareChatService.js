import { findWelfarePrograms, normalizePerson } from "./welfareRag.js";

const VITE_ENV = import.meta.env || {};
const GEMINI_API_KEY = VITE_ENV.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = VITE_ENV.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

export async function createWelfareChatAnswer({
  question,
  person,
  viewerType = "welfare",
  limit = 3,
}) {
  const target = normalizePerson(person);
  const matches = findWelfarePrograms({ question, person: target, limit });
  const fallbackAnswer = buildAnswer({
    question,
    target,
    matches,
    viewerType,
  });
  const answer = await createGeminiAnswer({
    question,
    target,
    matches,
    viewerType,
    fallbackAnswer,
  });

  return {
    answer,
    question: question.trim(),
    target,
    matches: matches.map(({ program, reasons }) => ({
      id: program.id,
      name: program.name,
      summary: program.summary,
      evidence: program.evidence,
      nextSteps: program.nextSteps,
      reasons,
    })),
  };
}

export function createWelfareChatAnswerSync({
  question,
  person,
  viewerType = "welfare",
  limit = 3,
}) {
  const target = normalizePerson(person);
  const matches = findWelfarePrograms({ question, person: target, limit });

  return buildAnswer({
    question,
    target,
    matches,
    viewerType,
  });
}

function buildAnswer({ question, target, matches, viewerType }) {
  const displayName = getDisplayName(target, viewerType);

  if (!question?.trim()) {
    return "질문을 입력해 주세요. 예: 이 대상자가 받을 수 있는 복지 제도를 알려줘";
  }

  if (matches.length === 0) {
    return [
      "답변",
      `${displayName}의 현재 정보만으로 바로 추천할 제도를 찾기 어렵습니다.`,
      "나이, 거주지, 소득, 건강 상태, 독거 여부를 추가로 확인해 주세요.",
      "",
      "근거",
      "- 복지 제도는 연령, 소득인정액, 건강 상태, 가구 형태에 따라 신청 가능 여부가 달라집니다.",
    ].join("\n");
  }

  const programNames = matches.map(({ program }) => program.name).join(", ");
  const evidenceLines = matches.flatMap(({ program, reasons }) =>
    [...new Set([...reasons, ...program.evidence])].slice(0, 2).map((text) => `- ${program.name}: ${text}`)
  );
  const nextStepLines = matches
    .flatMap(({ program }) => program.nextSteps || [])
    .slice(0, 2)
    .map((text) => `- ${text}`);

  return [
    "답변",
    `${displayName}의 대상자 정보를 기준으로 확인했습니다.`,
    `우선 검토할 수 있는 제도는 ${programNames}입니다.`,
    "",
    "근거",
    ...evidenceLines,
    "",
    "다음 확인",
    ...(nextStepLines.length > 0
      ? nextStepLines
      : ["- 실제 신청 가능 여부는 주민센터 또는 담당 기관 확인이 필요합니다."]),
  ].join("\n");
}

async function createGeminiAnswer({ question, target, matches, viewerType, fallbackAnswer }) {
  if (!GEMINI_API_KEY || matches.length === 0) {
    return fallbackAnswer;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: buildSystemPrompt(viewerType) }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildUserPrompt({ question, target, matches }),
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 650,
            temperature: 0.25,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    return answer || fallbackAnswer;
  } catch (error) {
    console.error("복지 Q&A Gemini 답변 생성 실패:", error);
    return fallbackAnswer;
  }
}

function buildSystemPrompt(viewerType) {
  const viewerLabel = viewerType === "guardian" ? "보호자" : "복지사";

  return `
너는 ${viewerLabel}가 어르신 복지 제도를 빠르게 확인하도록 돕는 복지 Q&A 도우미다.

규칙:
- 반드시 제공된 대상자 정보와 복지 제도 근거 안에서만 답한다.
- 확정 표현 대신 "검토할 수 있습니다", "확인이 필요합니다"처럼 안내한다.
- 모르는 내용은 추측하지 말고 주민센터, 복지로, 담당 기관 확인이 필요하다고 말한다.
- 답변은 "답변", "근거", "다음 확인" 섹션으로 나눈다.
- 근거는 bullet 형태로 2~5개만 쓴다.
- 의료 진단, 법적 확정, 수급 가능 확정처럼 단정적인 판단은 하지 않는다.
`.trim();
}

function buildUserPrompt({ question, target, matches }) {
  return `
질문:
${question}

대상자 정보:
- 이름: ${target.name || "미확인"}
- 나이: ${target.age ? `만 ${target.age}세` : "미확인"}
- 성별: ${target.gender || "미확인"}
- 주소/거주지: ${target.address || "미확인"}
- 건강/돌봄 정보: ${target.healthText || "미확인"}
- 독거 여부 추정: ${target.isLivingAlone ? "예" : "미확인"}

검색된 복지 제도 근거:
${matches.map(({ program, reasons }) => `
[${program.name}]
요약: ${program.summary}
대상 기준/근거:
${[...new Set([...reasons, ...program.evidence])].map((text) => `- ${text}`).join("\n")}
다음 확인:
${(program.nextSteps || []).map((text) => `- ${text}`).join("\n") || "- 담당 기관 확인 필요"}
`).join("\n")}
`.trim();
}

function getDisplayName(target, viewerType) {
  const name = target.name || "대상자";

  if (viewerType === "guardian") {
    return `${name}님`;
  }

  return `${name}님`;
}
