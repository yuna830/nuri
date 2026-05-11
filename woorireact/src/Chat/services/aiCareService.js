const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

const CARE_ASSISTANT_SYSTEM_PROMPT = `
너는 어르신을 돕는 한국어 돌봄 챗봇이다.

반드시 지킬 규칙:
- 모든 답변은 자연스러운 한국어 존댓말로만 쓴다.
- 한자, 일본어, 중국어, 러시아어, 영어 문장을 섞지 않는다.
- 꼭 필요한 서비스명이나 약어를 제외하고 외국어를 쓰지 않는다.
- 사용자가 먼저 반말로 답하라고 요청하지 않는 한 항상 존댓말만 쓴다.
- 알 수 없는 내용은 지어내지 말고 짧게 되묻는다.
- 일반 답변은 1~3문장으로 짧고 다정하게 말한다.
- 이야기, 농담, 퀴즈, 설명을 요청하면 시작 안내만 하지 말고 바로 내용을 말한다.
- 이야기는 4~6문장까지 써도 된다.
- "나는 텍스트 기반이라 소리를 낼 수 없다"처럼 앱 기능과 어긋나는 변명은 하지 않는다.
`.trim();

const SCHEDULE_EXTRACT_SYSTEM_PROMPT = `
너는 어르신의 채팅과 음성 인식 결과를 일정 명령으로 해석하는 JSON 추출기다.

입력에는 오타, 띄어쓰기 오류, 사투리, STT 오류, 발음 뭉개짐이 있을 수 있다.
예: "낼 오우 7시에 병언"은 "내일 오후 7시에 병원"으로 보정한다.

규칙:
- 설명 없이 JSON 객체만 답한다.
- 확실하지 않으면 confidence를 낮춘다.
- 사용자가 일정과 무관한 일상 대화를 하면 intent는 "none"으로 둔다.
- date_text, time_text, title은 입력에서 추론 가능한 경우에만 채운다.

JSON 형식:
{
  "intent": "create_schedule" | "lookup_schedule" | "delete_schedule" | "update_schedule" | "none",
  "normalized_text": "보정한 자연스러운 한국어 문장",
  "date_text": "오늘/내일/5월 21일/다음 주 화요일 등",
  "time_text": "오전 9시/오후 7시/저녁 6시 등",
  "old_time_text": "수정 전 시간. 없으면 빈 문자열",
  "title": "일정 이름",
  "confidence": 0.0
}
`.trim();

async function askGemini(messages, requestConfig = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing");
  }

  const {
    json = false,
    options = {},
  } = requestConfig;
  const generationConfig = {
    maxOutputTokens: 128,
    temperature: 0.5,
    ...(json ? { responseMimeType: "application/json" } : {}),
    ...pickOptions(options, ["maxOutputTokens", "temperature", "topP", "topK"]),
  };
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const data = await requestGeminiWithRetry({
    systemText,
    contents,
    generationConfig,
  });
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim() || "";
}

async function requestGeminiWithRetry(payload) {
  const retryDelays = [0, 700, 1500];
  let lastError = null;

  for (const delay of retryDelays) {
    if (delay > 0) await sleep(delay);

    try {
      return await requestGemini(payload);
    } catch (error) {
      lastError = error;
      if (!error.retryable) break;
    }
  }

  throw lastError;
}

async function requestGemini({ systemText, contents, generationConfig }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        ...(systemText
          ? {
              system_instruction: {
                parts: [{ text: systemText }],
              },
            }
          : {}),
        contents,
        generationConfig,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Gemini request failed: ${response.status}${errorText ? ` ${errorText}` : ""}`
    );
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pickOptions(source, allowedKeys) {
  return allowedKeys.reduce((picked, key) => {
    if (source[key] !== undefined) picked[key] = source[key];
    return picked;
  }, {});
}

export async function extractScheduleIntent(text) {
  try {
    const content = await askGemini([
      {
        role: "system",
        content: SCHEDULE_EXTRACT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: text,
      },
    ], {
      format: "json",
      json: true,
      options: {
        maxOutputTokens: 180,
        temperature: 0,
      },
    });

    return normalizeScheduleIntent(parseJsonObject(content));
  } catch (error) {
    console.error("일정 의도 추출 오류:", error);
    return null;
  }
}

export async function createCareResponse({ text, schedules, history = [] }) {
  if (schedules.length > 0) {
    const schedule = schedules[0];
    const dateText = schedule.date || "날짜 확인 필요";
    const timeText = schedule.time ? ` ${schedule.time}` : "";

    return `${dateText}${timeText} ${schedule.title} 일정으로 이해했어요. 이 일정으로 등록할까요?`;
  }

  try {
    const content = await askGemini([
      {
        role: "system",
        content: CARE_ASSISTANT_SYSTEM_PROMPT,
      },
      ...toRecentAiMessages(history),
      {
        role: "user",
        content: text,
      },
    ], {
      options: {
        maxOutputTokens: shouldAllowLongerAnswer(text) ? 320 : 160,
        temperature: 0.5,
      },
    });

    return normalizeCareResponse(content);
  } catch (error) {
    console.error(error);
    if (error.message === "Gemini API key is missing") {
      return "Gemini API 키가 설정되지 않았어요. .env.local 파일에 키를 넣고 개발 서버를 다시 시작해 주세요.";
    }
    return "답변을 가져오지 못했어요. 잠시 후 다시 말씀해 주세요.";
  }
}

function toRecentAiMessages(history) {
  return history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").trim(),
    }))
    .filter((message) => message.content);
}

function shouldAllowLongerAnswer(text) {
  return /(이야기|동화|농담|퀴즈|설명|말해줘|해줄래|들려줘)/.test(text);
}

function parseJsonObject(content) {
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
  return JSON.parse(jsonText);
}

function normalizeScheduleIntent(value) {
  if (!value || typeof value !== "object") return null;

  const allowedIntents = new Set([
    "create_schedule",
    "lookup_schedule",
    "delete_schedule",
    "update_schedule",
    "none",
  ]);
  const intent = allowedIntents.has(value.intent) ? value.intent : "none";
  const confidence = Number(value.confidence || 0);

  return {
    intent,
    normalizedText: String(value.normalized_text || "").trim(),
    dateText: String(value.date_text || "").trim(),
    timeText: String(value.time_text || "").trim(),
    oldTimeText: String(value.old_time_text || "").trim(),
    title: String(value.title || "").trim(),
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

function normalizeCareResponse(content) {
  const fallback =
    "말씀하신 내용을 확인했어요. 조금 더 자세히 말씀해 주시면 도와드릴게요.";
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
