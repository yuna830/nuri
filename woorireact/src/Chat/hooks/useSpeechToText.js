import { useMemo, useRef, useState } from "react";

export function useSpeechToText({ language = "ko-KR" } = {}) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const SpeechRecognition = useMemo(() => {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  function start(onResult) {
    setError("");

    if (!SpeechRecognition) {
      setError("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      onResult(transcript);
    };

    recognition.onerror = () => {
      setError("음성을 인식하지 못했어요. 다시 시도해 주세요.");
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  return {
    isListening,
    error,
    isSupported: Boolean(SpeechRecognition),
    start,
    stop,
  };
}
