import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import { createCareResponse } from "../services/aiCareService";
import { useAnswerVoice } from "../hooks/useAnswerVoice";
import { getCurrentUserHealthContext, useChatFlow } from "../hooks/useChatFlow";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { correctSttText } from "../services/sttCorrectionService";
import DeleteScheduleBox from "./DeleteScheduleBox";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import ScheduleConfirmBox from "./ScheduleConfirmBox";
import TodaySchedulePanel from "./TodaySchedulePanel";

const FOOD_API_URL = import.meta.env.VITE_CHAT_FOOD_API_URL || `${AI_API_BASE}/food`;

export default function ChatView({
  messages,
  setMessages,
  savedSchedules,
  chatSchedules,
  selectedScheduleDate,
  onScheduleDateChange,
  onScheduleOpen,
  onScheduleSave,
  onScheduleUpdate,
  onScheduleEdit,
  onScheduleDelete,
}) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageUrl, setPendingImageUrl] = useState("");
  const [isImageLoading, setIsImageLoading] = useState(false);
  const foodAnalysisSpeechRef = useRef("");
  const foodWarningSpeechRef = useRef("");
  const isWaitingForFoodAnalysisReadRef = useRef(false);
  const { speak } = useAnswerVoice();
  const {
    input,
    setInput,
    pendingSchedule,
    pendingSchedules,
    pendingDelete,
    isLoading,
    sendMessage,
    confirmPendingSchedule,
    choosePendingScheduleMeridiem,
    cancelPendingSchedule,
    deletePendingSchedule,
    deleteAllPendingSchedules,
    cancelPendingDelete,
    addAssistantMessage,
  } = useChatFlow({
    messages,
    setMessages,
    savedSchedules: chatSchedules,
    onScheduleSave,
    onScheduleUpdate,
    onScheduleDelete,
    speak,
  });
  const isChatLoading = isLoading || isImageLoading;
  const { recording, startRecording, stopRecording } = useVoiceInput({
    onRecognized: async (recognizedText) => {
      const correctedText = await correctSttText(recognizedText);
      console.log("STT 보정:", { recognizedText, correctedText });
      handleSendMessage(correctedText, { speak: true });
    },
    onError: (message) => {
      addAssistantMessage(message);
      speak(message);
    },
  });

  const handleSendMessage = (customText = null, options = {}) => {
    const text = typeof customText === "string" ? customText.trim() : input.trim();
    const isConfirmedRead =
      isWaitingForFoodAnalysisReadRef.current && /^(응|네|예|그래|좋아|읽어\s*줘)[.!?\s]*$/i.test(text);
    const isExplicitRead =
      /(성분표|영양\s*성분).*(읽어|말해|알려)|(읽어|말해|알려).*(성분표|영양\s*성분)/i.test(text);
    const isWarningRead =
      /(주의\s*사항|주의할\s*점|경고).*(읽어|말해|알려)|(읽어|말해|알려).*(주의\s*사항|주의할\s*점|경고)/i.test(text);

    if (foodWarningSpeechRef.current && isWarningRead) {
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "주의사항을 읽어드릴게요." },
      ]);
      speak(foodWarningSpeechRef.current);
      return;
    }

    if (foodAnalysisSpeechRef.current && (isConfirmedRead || isExplicitRead)) {
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "영양성분을 읽어드릴게요." },
      ]);
      isWaitingForFoodAnalysisReadRef.current = false;
      speak(foodAnalysisSpeechRef.current);
      return;
    }

    if (pendingImage) {
      const image = pendingImage;
      setPendingImage(null);
      setPendingImageUrl("");
      setInput("");
      handleImageUpload(image, text);
      return;
    }

    sendMessage(customText, options);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, pendingSchedule, pendingSchedules]);

  useEffect(() => () => {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
  }, [pendingImageUrl]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/user");
  };

  const splitAllergyText = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => splitAllergyText(item));
    }

    return String(value || "")
      .split(/[,/·\n]|그리고|및/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getCurrentUserAllergies = () => {
    try {
      const saved = sessionStorage.getItem("currentSenior");
      const profile = saved ? JSON.parse(saved) : null;
      const healthInfo = profile?.healthInfo || profile?.health_info || {};
      return splitAllergyText(healthInfo.allergies);
    } catch {
      return [];
    }
  };

  const getRelatedAllergyKeywords = (allergy) => {
    const normalized = allergy.replace(/\s/g, "");
    const groups = {
      견과류: ["견과", "호두", "아몬드", "아몬드", "브라질너트", "캐슈", "캐슈너트", "피칸", "피스타치오", "마카다미아", "땅콩", "잣", "밤"],
      땅콩: ["땅콩", "견과", "호두", "아몬드", "캐슈", "피칸", "피스타치오", "마카다미아"],
      우유: ["우유", "유제품", "버터", "치즈", "크림", "분유", "유청", "카제인"],
      유제품: ["우유", "유제품", "버터", "치즈", "크림", "분유", "유청", "카제인"],
      밀: ["밀", "소맥", "글루텐", "빵", "과자"],
      대두: ["대두", "콩", "두유", "간장"],
      계란: ["계란", "달걀", "난류", "알류"],
      알류: ["계란", "달걀", "난류", "알류"],
      새우: ["새우", "갑각류"],
      게: ["게", "갑각류"],
      갑각류: ["새우", "게", "갑각류"],
      복숭아: ["복숭아"],
      토마토: ["토마토"],
      메밀: ["메밀"],
      고등어: ["고등어"],
      돼지고기: ["돼지고기", "돈육"],
      쇠고기: ["쇠고기", "소고기", "우육"],
      닭고기: ["닭고기", "계육"],
      오징어: ["오징어"],
      조개류: ["조개", "조개류", "홍합", "전복", "굴"],
    };

    const matchedGroup = Object.entries(groups).find(([key]) => normalized.includes(key));
    return [...new Set([normalized, ...(matchedGroup ? matchedGroup[1] : [])])];
  };

  const normalizeAllergyTargetText = (text) => {
    const replacements = {
      아모드: "아몬드",
      구운아모드: "구운아몬드",
      마가다미아: "마카다미아",
      키슈너트: "캐슈너트",
      피간: "피칸",
      피스치오: "피스타치오",
    };

    return Object.entries(replacements).reduce(
      (nextText, [source, target]) => nextText.replaceAll(source, target),
      String(text || "")
    );
  };

  const findAllergyConflicts = (result) => {
    const userAllergies = getCurrentUserAllergies();
    if (!userAllergies.length) return [];

    const detectedText = normalizeAllergyTargetText([
      result?.product_name,
      result?.ocr_text,
    ].join(" "));

    return userAllergies
      .map((allergy) => {
        const keywords = getRelatedAllergyKeywords(allergy);
        const matched = keywords.filter((keyword) => keyword && detectedText.includes(keyword));

        return matched.length
          ? {
              allergy,
              matched: [...new Set(matched)],
            }
          : null;
      })
      .filter(Boolean);
  };

  const hasIngredientEvidence = (result) => {
    const text = normalizeAllergyTargetText([
      result?.ocr_text,
      result?.product_name,
    ].join(" "));

    return /원재료|원재료명|함유|알레르기|유발|대두|밀|우유|땅콩|호두|메밀|난류|알류|새우|게|고등어|복숭아|토마토|아황산|닭고기|쇠고기|돼지고기|오징어|조개류|잣|아몬드|캐슈|피칸|피스타치오|마카다미아/.test(text);
  };

  const formatFoodAnalysisMessage = (result) => {
    const nutrients = result?.nutrients || {};
    const warnings = result?.warnings || [];
    const allergyConflicts = findAllergyConflicts(result);
    const userAllergies = getCurrentUserAllergies();
    const shouldShowIngredientNotice = userAllergies.length > 0 && !allergyConflicts.length && !hasIngredientEvidence(result);
    const rows = [
      ["열량", nutrients.calories_kcal, "kcal"],
      ["나트륨", nutrients.sodium_mg, "mg"],
      ["탄수화물", nutrients.carbohydrate_g, "g"],
      ["당류", nutrients.sugar_g, "g"],
      ["지방", nutrients.fat_g, "g"],
      ["포화지방", nutrients.saturated_fat_g, "g"],
      ["트랜스지방", nutrients.trans_fat_g, "g"],
      ["콜레스테롤", nutrients.cholesterol_mg, "mg"],
      ["단백질", nutrients.protein_g, "g"],
    ];

    const nutrientText = rows
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([label, value, unit]) => `- ${label}: ${value}${unit}`)
      .join("\n");

    const visibleWarnings = warnings.filter(
      (warning) => !String(warning.reason || "").includes("알레르기 유발 가능 성분")
    );
    const warningText = visibleWarnings.length
      ? visibleWarnings.map((warning) => `- [${warning.level}] ${warning.reason}`).join("\n")
      : allergyConflicts.length
        ? "- 개인 알레르기와 관련된 성분이 확인되어 섭취하지 않는 것이 안전해요."
        : "- 특별한 주의 항목은 발견되지 않았어요.";
    const personalAllergyText = allergyConflicts.length
      ? [
          "개인 알레르기 경고",
          ...allergyConflicts.map(
            (item) => `- 등록된 알레르기(${item.allergy})와 관련된 성분이 보여요: ${item.matched.join(", ")}. 섭취하지 않는 것이 안전해요.`
          ),
          "",
        ].join("\n")
      : "";
    const ingredientNoticeText = shouldShowIngredientNotice
      ? [
          "알레르기 확인 안내",
          "- 원재료명이 보이지 않아 알레르기 판단은 제한적입니다.",
          "- 알레르기 확인이 필요하면 원재료명 부분을 추가로 찍어주세요.",
          "",
        ].join("\n")
      : "";

    return [
      "성분표 분석이 끝났어요.",
      "",
      personalAllergyText,
      ingredientNoticeText,
      `제품명: ${result?.product_name || "확인 필요"}`,
      "",
      "영양성분",
      nutrientText || "- 인식된 영양성분이 부족해요.",
      "",
      "주의사항",
      warningText,
    ].join("\n");
  };

  const hasRecognizedNutrients = (result) =>
    Object.values(result?.nutrients || {}).some((value) => value !== null && value !== undefined);

  const hasRecognizedLabelText = (result) =>
    Boolean(result?.product_name || String(result?.ocr_text || "").trim());

  const formatFoodClassificationMessage = (result) => {
    if (!result?.accepted) {
      return result?.rejection_reason === "text_heavy_image"
        ? "글자가 많은 사진이에요. 성분표를 확인하려면 영양성분 부분을 가까이 찍어주세요."
        : "음식 종류를 정확히 식별하지 못했어요. 음식 전체가 보이도록 다시 찍어주세요.";
    }

    return `${result.category}로 보여요.`;
  };

  const classifyFoodImage = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${FOOD_API_URL}/classify-image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Food classification request failed");
    }

    return response.json();
  };

  const buildFoodAnalysisMemory = (result, answer) => {
    const nutrients = result?.nutrients || {};
    const allergyConflicts = findAllergyConflicts(result);
    const userAllergies = getCurrentUserAllergies();

    return [
      "[FOOD_ANALYSIS_MEMORY]",
      "The user uploaded a food label image. Use this as recent conversation context for follow-up questions such as whether the user can eat it, what is high, or what the ingredients mean.",
      `Product name: ${result?.product_name || "unknown"}`,
      `User registered allergies: ${userAllergies.length ? userAllergies.join(", ") : "none"}`,
      `Personal allergy conflicts found: ${
        allergyConflicts.length
          ? allergyConflicts.map((item) => `${item.allergy} -> ${item.matched.join(", ")}`).join("; ")
          : "none"
      }`,
      `Nutrients JSON: ${JSON.stringify(nutrients)}`,
      `Detected allergens JSON: ${JSON.stringify(result?.allergens || [])}`,
      `Warnings JSON: ${JSON.stringify(result?.warnings || [])}`,
      `Assistant visible summary:\n${answer}`,
      `OCR text:\n${result?.ocr_text || ""}`,
      "[/FOOD_ANALYSIS_MEMORY]",
    ].join("\n");
  };

  const buildFoodClassificationMemory = (result) => [
    "[FOOD_ANALYSIS_MEMORY]",
    "The user uploaded a general food photo. Use the image classification as recent conversation context.",
    "Answer the user's message naturally. Do not reply with only the classified food name unless the user asks what food it is.",
    "Exact nutrients are unknown. Do not invent calories or nutrient amounts. Give only cautious general guidance when relevant.",
    `Product name: ${result?.category || "unknown"}`,
    `Image classification accepted: ${Boolean(result?.accepted)}`,
    `Image classification confidence: ${result?.confidence ?? "unknown"}`,
    "Nutrients JSON: unknown",
    "Detected allergens JSON: unknown",
    "Warnings JSON: unknown",
    "OCR text:",
    "[/FOOD_ANALYSIS_MEMORY]",
  ].join("\n");

  const answerImagePrompt = async (prompt, memory) => createCareResponse({
    text: prompt,
    schedules: [],
    history: [
      ...messages,
      { role: "assistant", content: memory, hidden: true },
    ],
    profileContext: getCurrentUserHealthContext(),
  });

  const buildFoodNutritionSpeech = (answer) => {
    const nutrientText = String(answer || "")
      .match(/영양성분\s*\n([\s\S]*?)(?:\n\s*\n주의사항|$)/)?.[1]
      ?.replace(/^- /gm, "")
      .replace(/\n+/g, ", ");

    return nutrientText
      ? `영양성분을 읽어드릴게요. ${nutrientText}`
      : "인식된 영양성분이 부족해요.";
  };

  const buildFoodWarningSpeech = (answer) => {
    const warningText = String(answer || "")
      .match(/주의사항\s*\n([\s\S]*?)$/)?.[1]
      ?.replace(/^- /gm, "")
      .replace(/\n+/g, ", ");

    return warningText
      ? `주의사항을 읽어드릴게요. ${warningText}`
      : "별도의 주의사항은 없어요.";
  };

  const selectImage = (file) => {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImage(file);
    setPendingImageUrl(URL.createObjectURL(file));
  };

  const removePendingImage = () => {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImage(null);
    setPendingImageUrl("");
  };

  const handleImageUpload = async (file, prompt = "") => {
    const imageUrl = URL.createObjectURL(file);
    const userMessage = {
      role: "user",
      content: prompt || "사진을 보냈어요.",
      imageUrl,
    };
    foodAnalysisSpeechRef.current = "";
    foodWarningSpeechRef.current = "";
    isWaitingForFoodAnalysisReadRef.current = false;

    setMessages((prev) => [...prev, userMessage]);
    setIsImageLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${FOOD_API_URL}/analyze-image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Food analysis request failed");
      }

      const result = await response.json();

      if (!hasRecognizedNutrients(result) && !hasRecognizedLabelText(result)) {
        const classification = await classifyFoodImage(file);
        const memory = buildFoodClassificationMemory(classification);
        const answer =
          prompt && classification.accepted
            ? await answerImagePrompt(prompt, memory)
            : formatFoodClassificationMessage(classification);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: answer },
          { role: "assistant", content: memory, hidden: true },
        ]);
        speak(answer);
        return;
      }

      const answer = formatFoodAnalysisMessage(result);
      const memory = buildFoodAnalysisMemory(result, answer);
      const visibleAnswer = prompt ? await answerImagePrompt(prompt, memory) : answer;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: visibleAnswer,
        },
        {
          role: "assistant",
          content: memory,
          hidden: true,
        },
      ]);
      foodAnalysisSpeechRef.current = buildFoodNutritionSpeech(answer);
      foodWarningSpeechRef.current = buildFoodWarningSpeech(answer);
      isWaitingForFoodAnalysisReadRef.current = true;
      speak(prompt ? visibleAnswer : "성분표 분석이 끝났어요. 영양성분을 읽어드릴까요?");
    } catch (error) {
      console.error("Food OCR analysis failed:", error);
      const answer = "성분표 분석 중 문제가 생겼어요. chat_server가 켜져 있는지 확인해 주세요.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } finally {
      setIsImageLoading(false);
    }
  };

  return (
    <section className="chatbot-page">
      <UserCommonHeader />
      <button className="chatbot-back-button" type="button" onClick={goBack} aria-label="뒤로가기">
        &lt;
      </button>

      <main className="chatbot-layout">
        <section className="chatbot-panel">
          <MessageList
            ref={messagesEndRef}
            messages={messages}
            isLoading={isChatLoading}
          />

          <ScheduleConfirmBox
            schedule={pendingSchedules.length > 0 ? pendingSchedules : pendingSchedule}
            onCancel={cancelPendingSchedule}
            onConfirm={confirmPendingSchedule}
            onChooseMeridiem={choosePendingScheduleMeridiem}
          />

          <DeleteScheduleBox
            pendingDelete={pendingDelete}
            onCancel={cancelPendingDelete}
            onDeleteOne={deletePendingSchedule}
            onDeleteAll={deleteAllPendingSchedules}
          />

          <MessageInput
            input={input}
            isLoading={isChatLoading}
            recording={recording}
            onInputChange={setInput}
            onSend={() => handleSendMessage()}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            pendingImageUrl={pendingImageUrl}
            onImageSelect={selectImage}
            onImageRemove={removePendingImage}
          />
        </section>

        <TodaySchedulePanel
          schedules={savedSchedules}
          selectedDate={selectedScheduleDate}
          onDateChange={onScheduleDateChange}
          onScheduleOpen={onScheduleOpen}
          onScheduleEdit={onScheduleEdit}
          onScheduleDelete={onScheduleDelete}
        />
      </main>
    </section>
  );
}
