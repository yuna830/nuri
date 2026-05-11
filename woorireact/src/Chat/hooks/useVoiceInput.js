import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { STT_API_URL } from "../services/voiceSttApi";

export function useVoiceInput({ onRecognized, onError }) {
  const [recording, setRecording] = useState(false);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("마이크 녹음 오류:", error);
      onError?.("마이크를 사용할 수 없어요. 브라우저 권한을 확인해주세요.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  }

  async function handleRecordingStop() {
    const recordedMimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: recordedMimeType });
    chunksRef.current = [];

    const formData = new FormData();
    const extension = recordedMimeType.includes("wav") ? "wav" : "webm";
    formData.append("file", blob, `record.${extension}`);

    try {
      const response = await axios.post(STT_API_URL, formData);
      const recognizedText = response.data.text?.trim();
      if (recognizedText) await onRecognized(recognizedText);
    } catch (error) {
      console.error("STT 오류:", error);
      onError?.("음성을 인식하지 못했어요. 다시 한 번 말씀해주세요.");
    }
  }

  return {
    recording,
    startRecording,
    stopRecording,
  };
}

function getSupportedAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/wav",
  ];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}
