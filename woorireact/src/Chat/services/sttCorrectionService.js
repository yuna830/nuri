const GEMINI_STT_FIX_API_KEY = import.meta.env.VITE_GEMINI_STT_FIX_API_KEY || "";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

const STT_CORRECTION_PROMPT = `
너는 한국어 음성 인식 결과를 보정하는 도우미다.

규칙:
- 사용자의 실제 발화에서 명백한 STT 오류만 자연스럽게 고친다.
- 일정, 예약, 복약, 병원, 치과, 내과, 진료, 시간 표현을 우선 보정한다.
- 오전, 오후, 아침, 낮, 점심, 저녁, 밤, 새벽 같은 시간대 표현은 유지한다.
- 날짜와 시간은 원문에 근거가 있을 때만 유지하거나 정리한다.
- 없는 장소, 날짜, 시간, 목적을 새로 만들지 않는다.
- 확실하지 않은 단어는 원문을 유지한다.
- 답변은 보정된 문장만 출력한다.
- 설명, 따옴표, 마크다운을 붙이지 않는다.
`.trim();

export async function correctSttText(text) {
  const originalText = String(text || "").trim();
  if (!originalText || !GEMINI_STT_FIX_API_KEY) return originalText;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_STT_FIX_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: STT_CORRECTION_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: originalText }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 80,
            temperature: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`STT correction failed: ${response.status}`);
    }

    const data = await response.json();
    const correctedText = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    return sanitizeCorrectedText(correctedText, originalText);
  } catch (error) {
    console.error("STT 보정 오류:", error);
    return originalText;
  }
}

function sanitizeCorrectedText(correctedText, fallbackText) {
  const text = String(correctedText || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallbackText;
  if (text.length > Math.max(fallbackText.length * 3, 80)) return fallbackText;

  return text;
}
