const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

function buildCareAssistantSystemPrompt(profileContext) {
  const name = profileContext?.name?.trim();
  const userLabel = name ? `${name}님` : "사용자님";

  return `
너는 ${userLabel}의 일상을 돕는 한국어 돌봄 챗봇이다.

규칙:
- 모든 답변은 자연스러운 한국어 존댓말로 한다.
- 사용자를 부를 때 "보호대상자"라고 하지 말고 "${userLabel}"이라고 부른다.
- 일반 답변은 1~3문장으로 짧고 확실하게 말한다.
- 일정, 날짜, 시간, 날씨는 앱에서 먼저 처리하므로 추측하지 않는다.
- 모르면 지어내지 말고 다시 말해 달라고 한다.
- 이야기, 농담, 설명을 요청하면 바로 내용을 말한다.
- 이야기는 길어도 끝까지 말한다.
- 반말, 과한 농담, 외국어 섞어 쓰기는 하지 않는다.
`.trim();
}

const SCHEDULE_EXTRACT_SYSTEM_PROMPT = `
너는 보호대상자의 채팅과 음성 인식 결과를 일정 명령으로 해석하는 JSON 추출기다.

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
    if (isGeneralFoodRecommendationQuestion(text)) {
      return await answerGeneralFoodRecommendation(text, profileContext);
    }

    const latestFoodAnalysisMemory = getLatestFoodAnalysisMemory(history);
    const foodSafetyAnswer = answerFoodSafetyQuestion(text, latestFoodAnalysisMemory, profileContext, history);
    if (foodSafetyAnswer) return foodSafetyAnswer;

    const foodIngredientAnswer = answerFoodIngredientQuestion(text, latestFoodAnalysisMemory);
    if (foodIngredientAnswer) return foodIngredientAnswer;

    const content = await askGemini([
      { role: "system", content: buildCareAssistantSystemPrompt(profileContext) },
      ...(profileContext ? [{ role: "system", content: buildProfileContextPrompt(profileContext) }] : []),
      ...(latestFoodAnalysisMemory ? [{ role: "system", content: buildFoodAnalysisContextPrompt(latestFoodAnalysisMemory) }] : []),
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
- 이름: ${profileContext.name || "미확인"}
- 나이: ${profileContext.age || "미확인"}
- 생년월일: ${profileContext.birthDate || "미확인"}
- 알레르기: ${allergyText}
- 질병/건강 정보: ${diseaseEntries.length ? diseaseEntries.join(", ") : "특이사항 없음"}

음식, 복약, 건강 관련 답변에서는 위 알레르기와 질병 정보를 우선 반영한다.
알레르기 성분이 의심되면 먹기 전에 확인하라고 안내한다.
진단이나 처방처럼 의료 전문가 판단이 필요한 내용은 병원/전문가 확인을 권한다.
`.trim();
}

function getLatestFoodAnalysisMemory(history) {
  return [...history]
    .reverse()
    .find((message) => message.hidden && String(message.content || "").includes("[FOOD_ANALYSIS_MEMORY]"))
    ?.content || "";
}

function buildFoodAnalysisContextPrompt(memory) {
  return `
Recent food-label analysis context:
${memory}

Rules for follow-up answers about this food:
- User registered allergies are personal health data, not food ingredients.
- Only say an ingredient is in the food when it appears in OCR text, detected allergens, or Personal allergy conflicts found.
- If Personal allergy conflicts found is "none", do not say the user's allergies are contained in the food.
- If the user asks whether an allergen is included and OCR is uncertain, say it was not clearly found and recommend checking the ingredients label.
- Do not use Markdown bold markers like **text** because this chat view displays them as plain text.
`.trim();
}

function answerFoodIngredientQuestion(text, memory) {
  if (!memory) return "";

  const match = text.match(/([가-힣A-Za-z0-9\s]+?)\s*(?:들어\s*있|들었|있어|포함|함유)/);
  const ingredient = match?.[1]?.trim().replace(/[?!.]/g, "");
  if (!ingredient || ingredient.length > 20) return "";

  const ocrText = extractFoodMemorySection(memory, "OCR text:");
  const detectedAllergens = extractFoodMemorySection(memory, "Detected allergens JSON:");
  const conflicts = extractFoodMemorySection(memory, "Personal allergy conflicts found:");
  const haystack = normalizeIngredientText([ocrText, detectedAllergens, conflicts].join(" "));
  const needle = normalizeIngredientText(ingredient);

  if (!needle) return "";

  if (haystack.includes(needle)) {
    return `네, OCR 원재료명에서 ${ingredient}가 보여요. 다만 사진 인식 결과라서 실제 섭취 전에는 원재료명 부분을 한 번 더 확인해 주세요.`;
  }

  return `OCR 원문에서는 ${ingredient}가 명확히 확인되지 않았어요. 알레르기나 제한 식품이면 원재료명 부분을 직접 확인하는 것이 안전해요.`;
}

async function answerGeneralFoodRecommendation(text, profileContext) {
  const fallbackAnswer = buildRuleBasedFoodRecommendation(profileContext);
  if (!GEMINI_API_KEY) return fallbackAnswer;

  try {
    const content = await askGemini([
      { role: "system", content: buildCareAssistantSystemPrompt(profileContext) },
      ...(profileContext ? [{ role: "system", content: buildProfileContextPrompt(profileContext) }] : []),
      {
        role: "system",
        content: [
          "사용자는 특정 사진 속 음식이 아니라, 본인 건강상태 기준으로 먹어도 되는 음식 예시를 묻고 있다.",
          "먹지 말아야 할 음식 목록보다 먹어도 되는 음식과 먹는 방법을 먼저 알려준다.",
          "답변은 한국어로 짧게, 4~7개 음식 예시를 bullet 없이 줄바꿈으로 제시한다.",
          "의료 진단처럼 말하지 말고 일반적인 식사 참고 안내로 말한다.",
        ].join("\n"),
      },
      { role: "user", content: text },
    ], {
      options: {
        maxOutputTokens: 260,
        temperature: 0.3,
      },
    });

    return normalizeCareResponse(content);
  } catch (error) {
    console.warn("음식 추천 Gemini 응답 실패. 규칙 기반 답변으로 대체합니다.", error);
    return fallbackAnswer;
  }
}

function buildRuleBasedFoodRecommendation(profileContext) {
  const diseases = profileContext?.diseases || {};
  const allergies = String(profileContext?.allergies || "").trim();
  const hasDiabetes = hasHealthCondition(diseases.diabetes);
  const hasSaltSensitive =
    hasHealthCondition(diseases.hypertension) ||
    hasHealthCondition(diseases.heartDisease) ||
    hasHealthCondition(diseases.kidneyDisease);
  const hasLiverDisease = hasHealthCondition(diseases.liverDisease);

  const foods = [
    "삶은 달걀이나 두부처럼 담백한 단백질 음식",
    "나물, 데친 채소, 샐러드처럼 양념이 적은 채소 음식",
    "흰밥보다 양을 줄인 잡곡밥이나 현미밥",
    "맑은 국보다 건더기 위주로 먹는 국이나 찌개",
    "구운 생선이나 찐 생선처럼 기름이 적은 음식",
  ];

  const notes = [];
  if (hasDiabetes) notes.push("당뇨가 있으니 밥, 떡, 빵, 과일은 양을 줄여 드세요.");
  if (hasSaltSensitive) notes.push("혈압이나 신장, 심장 때문에 국물과 짠 반찬은 적게 드세요.");
  if (hasLiverDisease) notes.push("간질환이 있으니 튀김이나 기름진 음식은 적게 드세요.");
  if (allergies && allergies !== "없음") notes.push(`알레르기(${allergies})가 있는 음식은 피하고 원재료명을 확인하세요.`);

  return [
    "드셔도 비교적 무난한 음식은 이런 쪽이에요.",
    "",
    ...foods.map((food) => `- ${food}`),
    "",
    "드실 때",
    ...notes.map((note) => `- ${note}`),
    "- 한 번에 많이 드시기보다 조금씩 나누어 드세요.",
  ].join("\n");
}

function answerFoodSafetyQuestion(text, memory, profileContext, history = []) {
  if (!memory || !isFoodSafetyQuestion(text)) return "";

  const intro = getFoodNameIntro(memory, history);
  const productName = getVisibleFoodName(memory);
  const conflicts = extractFoodMemorySection(memory, "Personal allergy conflicts found:");
  const ocrText = extractFoodMemorySection(memory, "OCR text:");
  const hasConflicts = conflicts && conflicts !== "none";
  const diseaseCaution = getFoodDiseaseCaution(profileContext);
  const foodSpecificCaution = getFoodSpecificCaution(productName);
  const eatingTips = getFoodEatingTips(productName);

  if (hasConflicts) {
    return compactFoodAnswer([
      intro,
      intro && "",
      "드시지 마세요.",
      "",
      "이유",
      `- 등록된 알레르기와 관련된 성분이 보여요: ${formatAllergyConflicts(conflicts)}`,
      "",
      "확인해 주세요",
      "- 드시기 전에 원재료명을 다시 확인해 주세요.",
    ]);
  }

  if (diseaseCaution.length > 0) {
    return compactFoodAnswer([
      intro,
      intro && "",
      "조금만 드세요.",
      "",
      "주의할 점",
      ...foodSpecificCaution,
      ...diseaseCaution,
      "",
      "드실 때",
      ...eatingTips,
      "- 가능하면 성분표도 확인해 주세요.",
    ]);
  }

  if (!ocrText) {
    return compactFoodAnswer([
      intro,
      intro && "",
      "사진만으로는 드셔도 되는지 판단하기 어려워요.",
      "",
      "확인해 주세요",
      "- 알레르기나 제한 식품이 있다면 원재료명을 확인해 주세요.",
    ]);
  }

  return compactFoodAnswer([
    intro,
    intro && "",
    "사진에서 피해야 할 성분은 명확히 보이지 않아요.",
    "",
    "확인해 주세요",
    "- 드시기 전에 원재료명을 한 번 더 확인해 주세요.",
  ]);
}

function getFoodNameIntro(memory, history) {
  const productName = getVisibleFoodName(memory);
  if (!productName) return "";

  const alreadyMentioned = [...history]
    .reverse()
    .slice(0, 4)
    .some((message) =>
      message.role === "assistant" &&
      !message.hidden &&
      String(message.content || "").includes(productName)
    );

  return alreadyMentioned ? "" : `${productName}로 보여요.`;
}

function getVisibleFoodName(memory) {
  const name = extractFoodMemorySection(memory, "Product name:")
    .split("\n")[0]
    .trim();

  return name && name !== "unknown" ? name : "";
}

function compactFoodAnswer(lines) {
  return lines.filter((line) => line !== false && line !== null && line !== undefined).join("\n");
}

function getFoodSpecificCaution(productName) {
  const name = normalizeFoodName(productName);

  if (/치킨|닭튀김|후라이드|프라이드|양념치킨/.test(name)) {
    return [
      "- 치킨: 튀긴 음식이라 지방과 열량이 높을 수 있어요.",
      "- 치킨 껍질: 포화지방이 많을 수 있어 가능하면 줄이세요.",
    ];
  }

  if (/떡볶이|떡복이|떡볶/.test(name)) {
    return [
      "- 떡볶이: 떡 때문에 탄수화물이 많을 수 있어요.",
      "- 떡볶이 양념: 맵고 짜며 당이 들어갈 수 있어요.",
    ];
  }

  if (/라면|국수|우동|칼국수/.test(name)) {
    return [
      "- 면 음식: 탄수화물과 나트륨이 많을 수 있어요.",
      "- 국물: 나트륨이 많으니 적게 드세요.",
    ];
  }

  if (/피자|햄버거|버거/.test(name)) {
    return [
      "- 패스트푸드: 지방과 나트륨이 많을 수 있어요.",
      "- 소스: 당과 나트륨이 들어갈 수 있어 적게 드세요.",
    ];
  }

  return [];
}

function getFoodEatingTips(productName) {
  const name = normalizeFoodName(productName);

  if (/치킨|닭튀김|후라이드|프라이드|양념치킨/.test(name)) {
    return [
      "- 한두 조각만 덜어 드세요.",
      "- 껍질과 튀김옷은 조금 줄이세요.",
      "- 양념치킨이면 소스가 많은 부분은 피하세요.",
    ];
  }

  if (/떡볶이|떡복이|떡볶/.test(name)) {
    return [
      "- 떡은 조금만 덜어 드세요.",
      "- 국물이나 양념은 적게 드세요.",
      "- 가능하면 채소나 단백질 음식과 함께 드세요.",
    ];
  }

  return [
    "- 작은 양만 덜어 드세요.",
    "- 자극적인 양념은 적게 드세요.",
  ];
}

function normalizeFoodName(productName) {
  return String(productName || "").replace(/\s/g, "").toLowerCase();
}

function isFoodSafetyQuestion(text) {
  const normalized = String(text || "")
    .replace(/\s/g, "")
    .replace(/머거/g, "먹어")
    .replace(/먹거/g, "먹어")
    .replace(/먹어두/g, "먹어도")
    .replace(/드셔두/g, "드셔도")
    .replace(/섭취해두/g, "섭취해도");

  return /(먹어도|먹어봐도|드셔도|섭취해도|먹으면|먹을수있)/.test(normalized);
}

function isGeneralFoodRecommendationQuestion(text) {
  const normalized = String(text || "").replace(/\s/g, "");

  return (
    /(먹어도되는|먹을수있는|먹어도괜찮은|먹어도좋은|먹어야하는|추천)/.test(normalized) &&
    /(음식|식단|반찬|밥|메뉴|먹을거|먹거리|뭐|무엇)/.test(normalized)
  );
}

function getFoodDiseaseCaution(profileContext) {
  const diseases = profileContext?.diseases || {};
  const cautions = [];

  if (hasHealthCondition(diseases.diabetes)) {
    cautions.push("- 당뇨: 단 음식과 탄수화물은 적게 드세요.");
  }

  const saltSensitiveConditions = [
    [diseases.hypertension, "고혈압"],
    [diseases.heartDisease, "심장질환"],
    [diseases.kidneyDisease, "신장질환"],
  ]
    .filter(([value]) => hasHealthCondition(value))
    .map(([, label]) => label);

  if (saltSensitiveConditions.length > 0) {
    cautions.push(`- ${saltSensitiveConditions.join("·")}: 짠 음식과 국물은 적게 드세요.`);
  }
  if (hasHealthCondition(diseases.liverDisease)) {
    cautions.push("- 간질환: 자극적이거나 기름진 음식은 적게 드세요.");
  }

  return cautions;
}

function formatAllergyConflicts(conflicts) {
  return conflicts.replace(/\s*->\s*/g, ": ");
}

function hasHealthCondition(value) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  return normalized && !["없음", "아니오", "false", "no", "0", "정상"].includes(normalized);
}

function extractFoodMemorySection(memory, label) {
  const startIndex = memory.indexOf(label);
  if (startIndex < 0) return "";

  const start = startIndex + label.length;
  const rest = memory.slice(start);
  const nextLabel = rest.search(/\n(?:Product name|User registered allergies|Personal allergy conflicts found|Image classification accepted|Image classification confidence|Nutrients JSON|Detected allergens JSON|Warnings JSON|Assistant visible summary|OCR text|\[\/FOOD_ANALYSIS_MEMORY\])/);
  return (nextLabel >= 0 ? rest.slice(0, nextLabel) : rest).trim();
}

function normalizeIngredientText(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/아모드/g, "아몬드")
    .replace(/마가다미아/g, "마카다미아")
    .replace(/키슈너트/g, "캐슈너트")
    .replace(/피스치오/g, "피스타치오")
    .replace(/피간/g, "피칸");
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
    .filter((message) => !message.hidden)
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
  const answer = content?.trim().replace(/\*\*/g, "");
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
