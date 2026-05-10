import { OLLAMA_API_URL, OLLAMA_MODEL } from "./serverConfig";

const CARE_ASSISTANT_SYSTEM_PROMPT = `
너는 어르신을 돕는 한국어 돌봄 챗봇이다.

반드시 지킬 규칙:
- 모든 답변은 자연스러운 한국어로만 쓴다.
- 한자, 일본어, 중국어, 러시아어, 영어 문장을 섞지 않는다.
- 꼭 필요한 서비스명이나 약어를 제외하고 외국어를 쓰지 않는다.
- 사용자가 먼저 반말로 답하라고 요청하지 않는 한 항상 존댓말만 쓴다.
- 반말 어미를 쓰지 않는다. 예: "같아", "좋겠어", "해", "먹어", "야"로 문장을 끝내지 않는다.
- 존댓말 어미를 쓴다. 예: "같아요", "좋겠습니다", "해주세요", "드릴게요", "확인했어요".
- 알 수 없는 내용은 지어내지 말고 짧게 되묻는다.
- 답변은 1~3문장으로 짧고 다정하게 말한다.
- 사용자가 일정, 예약, 약, 병원, 날씨, 위치, 보호자 관련 도움을 요청하면 바로 행동 중심으로 안내한다.
- "나는 텍스트 기반이라 소리를 낼 수 없다"처럼 앱 기능과 어긋나는 변명은 하지 않는다.
- 무섭거나 과장된 표현 없이 따뜻하고 친근하게 말한다.

좋은 말투 예시:
"네, 그렇게 해드릴게요."
"말씀하신 내용을 확인했어요."
"몇 시로 등록하면 좋을까요?"
`.trim();

async function askOllama(message) {
  const response = await fetch(OLLAMA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: CARE_ASSISTANT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = await response.json();
  return normalizeCareResponse(data.message?.content);
}

function normalizeCareResponse(content) {
  const fallback = "말씀하신 내용을 확인했어요. 조금 더 자세히 말씀해 주시면 도와드릴게요.";
  const answer = content?.trim();

  if (!answer) return "답변을 만들지 못했어요. 다시 한번 말씀해 주세요.";
  if (hasMixedForeignText(answer) || hasCasualEnding(answer)) return fallback;

  return answer;
}

function hasMixedForeignText(text) {
  return /[一-龯ぁ-ゟ゠-ヿА-Яа-яЁё]|[A-Za-zÀ-ÿ]{2,}/.test(text);
}

function hasCasualEnding(text) {
  return /(?:같아|좋겠어|먹어|해|야)(?:[.!?…]+|\s*$)/m.test(text);
}

export async function createCareResponse({ text, schedules }) {
  if (schedules.length > 0) {
    const schedule = schedules[0];
    const dateText = schedule.date || "날짜 확인 필요";
    const timeText = schedule.time ? ` ${schedule.time}` : "";

    return `${dateText}${timeText} ${schedule.title} 일정으로 이해했어요. 이 일정으로 등록할까요?`;
  }

  try {
    return await askOllama(text);
  } catch (error) {
    console.error(error);
    return "답변을 가져오지 못했어요. 잠시 후 다시 말씀해 주세요.";
  }
}
