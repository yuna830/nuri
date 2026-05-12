import { useEffect, useRef, useState } from "react";
import axios from "axios";

function FoodCamera() {

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [photo, setPhoto] = useState(null);

    useEffect(() => {
        startCamera();
    }, []);

    const startCamera = async () => {

        try {

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

        } catch (error) {
            console.error("카메라 실행 실패", error);
        }
    };

    const capturePhoto = () => {

        const video = videoRef.current;
        const canvas = canvasRef.current;

        const context = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        context.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {

            const imageData = URL.createObjectURL(blob);

            setPhoto(imageData);

            await uploadPhoto(blob);

        }, "image/png");
    };

    const uploadPhoto = async (imageBlob) => {

        const formData = new FormData();

        formData.append("file", imageBlob, "food.png");

        try {

            const response = await axios.post(
                "http://127.0.0.1:8000/food",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            console.log(response.data);

        } catch (error) {
            console.error("업로드 실패", error);
        }
    };

    return (
        <div style={{ padding: "20px" }}>

            <h2>음식 카메라 테스트</h2>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                    width: "400px",
                    border: "2px solid black",
                    borderRadius: "10px",
                }}
            />

            <br /><br />

            <button onClick={capturePhoto}>
                사진 찍기
            </button>

            <canvas
                ref={canvasRef}
                style={{ display: "none" }}
            />

            <br /><br />

            {
                photo && (
                    <img
                        src={photo}
                        alt="captured"
                        style={{
                            width: "400px",
                            borderRadius: "10px",
                        }}
                    />
                )
            }

        </div>
    );
}



export default FoodCamera;