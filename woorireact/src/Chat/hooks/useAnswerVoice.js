import { useEffect } from "react";

export function useAnswerVoice() {
  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;

    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.voice = getCuteKoreanVoice();
    utterance.pitch = 1.25;
    utterance.rate = 1.06;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  return { speak };
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
