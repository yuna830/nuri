const OLLAMA_API_URL =
  import.meta.env.VITE_OLLAMA_API_URL || "http://localhost:11434/api/chat";

const OLLAMA_MODEL =
  import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:1.5b";

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
          content:
            "너는 어르신을 돕는 친절한 한국어 챗봇이다. 항상 한국어로 쉽고 자연스럽게 대답해라. 모르는 일정은 지어내지 마라.",
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
  return data.message?.content || "답변을 만들지 못했어요.";
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
    return "AI 연결에 문제가 있어요. Ollama가 실행 중인지 확인해 주세요.";
  }
}
