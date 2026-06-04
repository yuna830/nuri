import { useCallback, useEffect, useRef } from "react";
import { AI_API_BASE } from "../../config/api.js";

const TTS_API_URL = import.meta.env.VITE_CHAT_TTS_API_URL || `${AI_API_BASE}/tts`;
const TTS_VOICE = import.meta.env.VITE_CHAT_TTS_VOICE || "F1";

export function useAnswerVoice() {
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const activeTextRef = useRef("");
  const requestIdRef = useRef(0);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
    activeTextRef.current = "";
  }, []);

  const stopSpeaking = useCallback(() => {
    requestIdRef.current += 1;
    releaseAudio();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [releaseAudio]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      stopSpeaking();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [stopSpeaking]);

  async function speak(text) {
    if (!text) return;

    const speechText = normalizeSpeechText(text);
    if (speechText === activeTextRef.current) {
      return;
    }

    stopSpeaking();
    activeTextRef.current = speechText;
    const requestId = ++requestIdRef.current;

    try {
      const response = await fetch(`${TTS_API_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: speechText,
          voice: TTS_VOICE,
          speed: 1,
        }),
      });

      if (!response.ok) throw new Error(`Local TTS failed: ${response.status}`);

      const audioBlob = await response.blob();
      if (requestId !== requestIdRef.current) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      audio.onended = releaseAudio;
      audio.onerror = releaseAudio;
      await audio.play();
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      releaseAudio();
      console.warn("로컬 음성 재생 실패. 브라우저 음성으로 대체합니다.", error);
      speakWithBrowser(speechText);
    }
  }

  function speakWithBrowser(text) {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.voice = getCuteKoreanVoice();
    utterance.pitch = 1;
    utterance.rate = 0.95;
    utterance.volume = 1;
    utterance.onend = () => {
      activeTextRef.current = "";
    };
    utterance.onerror = () => {
      activeTextRef.current = "";
    };
    activeTextRef.current = normalizeSpeechText(text);
    window.speechSynthesis.speak(utterance);
  }

  return { speak };
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCuteKoreanVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const koreanVoices = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith("ko")
  );
  const cuteVoiceNames = ["female", "woman", "girl", "heami", "sunhi", "yuna", "google"];

  return (
    koreanVoices.find((voice) =>
      cuteVoiceNames.some((name) => voice.name.toLowerCase().includes(name))
    ) ||
    koreanVoices[0] ||
    null
  );
}
