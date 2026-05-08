import { useRef, useState } from "react";
import axios from "axios";
import { STT_API_URL } from "./services/serverConfig";

function STTServer() {

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const [recording, setRecording] = useState(false);
    const [text, setText] = useState("");

    const startRecording = async () => {

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
            chunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {

            const blob = new Blob(chunksRef.current, {
                type: "audio/wav"
            });

            chunksRef.current = [];

            const formData = new FormData();

            formData.append("file", blob, "record.wav");

            try {

                const response = await axios.post(
                    STT_API_URL,
                    formData,
                    {
                        headers: {
                            "Content-Type": "multipart/form-data",
                        },
                    }
                );

                setText(response.data.text);

            } catch (error) {
                console.error(error);
            }
        };

        mediaRecorder.start();

        setRecording(true);
    };

    const stopRecording = () => {

        mediaRecorderRef.current.stop();

        setRecording(false);
    };

    return (
        <div>
            <h2>STT 테스트</h2>

            {
                !recording
                ?
                <button onClick={startRecording}>
                    녹음 시작
                </button>
                :
                <button onClick={stopRecording}>
                    녹음 종료
                </button>
            }

            <h3>변환 결과</h3>

            <p>{text}</p>
        </div>
    );
}

export default STTServer;
