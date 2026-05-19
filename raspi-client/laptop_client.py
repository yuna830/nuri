import argparse
import math
import time

import cv2
import requests
from ultralytics import YOLO

try:
    import face_recognition
except ImportError:
    face_recognition = None


def post_location(server_url, senior_id, latitude, longitude):
    response = requests.post(
        f"{server_url}/api/locations",
        json={
            "seniorId": senior_id,
            "latitude": latitude,
            "longitude": longitude,
            "address": "노트북 GPS 모의 위치",
        },
        timeout=5,
    )
    response.raise_for_status()
    print(f"location sent: {latitude}, {longitude}")


def post_camera_alert(server_url, senior_id, alert_type, message, latitude=None, longitude=None):
    response = requests.post(
        f"{server_url}/api/alerts/camera",
        json={
            "seniorId": senior_id,
            "type": alert_type,
            "message": message,
            "latitude": latitude,
            "longitude": longitude,
        },
        timeout=5,
    )
    response.raise_for_status()
    print(f"camera alert sent: {alert_type}")


def load_known_face(image_path):
    if not face_recognition or not image_path:
        return None

    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if not encodings:
        raise RuntimeError("등록 사진에서 얼굴을 찾지 못했습니다.")

    return encodings[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default="http://localhost:8080")
    parser.add_argument("--senior-id", type=int, required=True)
    parser.add_argument("--center-lat", type=float, required=True)
    parser.add_argument("--center-lng", type=float, required=True)
    parser.add_argument("--interval", type=int, default=10)
    parser.add_argument("--known-face")
    parser.add_argument("--yolo-model", default="yolo11n.pt")
    args = parser.parse_args()

    yolo = YOLO(args.yolo_model)
    known_encoding = load_known_face(args.known_face)

    camera = cv2.VideoCapture(0)
    last_location_sent_at = 0
    last_face_alert_at = 0
    tick = 0

    current_latitude = args.center_lat
    current_longitude = args.center_lng

    while True:
        now = time.time()

        if now - last_location_sent_at >= args.interval:
            current_latitude = args.center_lat + math.sin(tick / 6) * 0.003
            current_longitude = args.center_lng + math.cos(tick / 6) * 0.003

            post_location(args.server, args.senior_id, current_latitude, current_longitude)

            last_location_sent_at = now
            tick += 1

        ok, frame = camera.read()

        if not ok:
            continue

        results = yolo.predict(frame, imgsz=416, conf=0.45, verbose=False)
        person_detected = False

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                class_name = yolo.names[class_id]
                confidence = float(box.conf[0])

                if class_name != "person":
                    continue

                person_detected = True
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 180, 0), 2)
                cv2.putText(
                    frame,
                    f"person {confidence:.2f}",
                    (x1, max(y1 - 8, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 180, 0),
                    2,
                )

        if person_detected and known_encoding is not None and face_recognition is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

            for encoding in face_encodings:
                matches = face_recognition.compare_faces([known_encoding], encoding, tolerance=0.5)

                if matches[0] and now - last_face_alert_at >= 30:
                    post_camera_alert(
                        args.server,
                        args.senior_id,
                        "FACE_MATCH",
                        "등록된 실종자 얼굴과 일치하는 인물이 카메라에 감지되었습니다.",
                        current_latitude,
                        current_longitude,
                    )
                    last_face_alert_at = now

        cv2.imshow("Nuri YOLO Camera Prototype", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
