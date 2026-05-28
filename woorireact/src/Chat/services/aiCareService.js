const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

const CARE_ASSISTANT_SYSTEM_PROMPT = `
너는 어르신의 일상을 돕는 한국어 돌봄 챗봇이다.

규칙:
- 모든 답변은 자연스러운 한국어 존댓말로 한다.
- 일반 답변은 1~3문장으로 짧고 확실하게 말한다.
- 일정, 날짜, 시간, 날씨는 앱에서 먼저 처리하므로 추측하지 않는다.
- 모르면 지어내지 말고 다시 말해 달라고 한다.
- 이야기, 농담, 설명을 요청하면 바로 내용을 말한다.
- 이야기는 길어도 끝까지 말한다.
- 반말, 과한 농담, 외국어 섞어 쓰기는 하지 않는다.
`.trim();

const SCHEDULE_EXTRACT_SYSTEM_PROMPT = `
너는 어르신의 채팅과 음성 인식 결과를 일정 명령으로 해석하는 JSON 추출기다.

규칙:
- 설명 없이 JSON 객체만 답한다.
- 확실하지 않으면 confidence를 낮춘다.
- 일정과 무관한 일상 대화는 intent를 "none"으로 둔다.
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

export async function extractScheduleIntent(text) {
  try {
    const content = await askGemini([
      { role: "system", content: SCHEDULE_EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: text },
    ], {
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

export async function createCareResponse({ text, schedules, history = [], profileContext = null }) {
  if (schedules.length > 0) {
    const schedule = schedules[0];
    const dateText = schedule.date || "날짜 확인 필요";
    const timeText = schedule.time ? ` ${schedule.time}` : "";

    return `${dateText}${timeText} ${schedule.title} 일정으로 이해했어요. 이 일정으로 등록할까요?`;
  }

  try {
    const content = await askGemini([
      { role: "system", content: CARE_ASSISTANT_SYSTEM_PROMPT },
      ...(profileContext ? [{ role: "system", content: buildProfileContextPrompt(profileContext) }] : []),
      ...toRecentAiMessages(history),
      { role: "user", content: text },
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
    if (error.status === 429) {
      return "Gemini 요청 한도에 걸렸어요. 잠시 후 다시 말씀해 주세요.";
    }
    if (error.status === 403) {
      return "Gemini API 키가 차단됐어요. 새 키로 교체한 뒤 개발 서버를 다시 시작해 주세요.";
    }
    return "답변을 가져오지 못했어요. 잠시 후 다시 말씀해 주세요.";
  }
}

function buildProfileContextPrompt(profileContext) {
  const allergyText = profileContext.allergies?.trim() || "없음";
  const diseaseEntries = Object.entries(profileContext.diseases || {})
    .filter(([, value]) => value && value !== "없음")
    .map(([key, value]) => `${key}: ${value}`);

  return `
사용자 건강 참고 정보:
- 나이: ${profileContext.age || "미확인"}
- 생년월일: ${profileContext.birthDate || "미확인"}
- 알레르기: ${allergyText}
- 질병/건강 정보: ${diseaseEntries.length ? diseaseEntries.join(", ") : "특이사항 없음"}

음식, 복약, 건강 관련 답변에서는 위 알레르기와 질병 정보를 우선 반영한다.
알레르기 성분이 의심되면 먹기 전에 확인하라고 안내한다.
진단이나 처방처럼 의료 전문가 판단이 필요한 내용은 병원/전문가 확인을 권한다.
`.trim();
}

async function askGemini(messages, requestConfig = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing");
  }

  const { json = false, options = {} } = requestConfig;
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
    error.retryable = response.status >= 500;
    throw error;
  }

  return response.json();
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
  return /(이야기|동화|농담|퀴즈|설명|말해줘|들려줘)/.test(text);
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
  const answer = content?.trim();
  if (!answer) return "답변을 만들지 못했어요. 다시 한 번 말씀해 주세요.";
  return answer;
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
