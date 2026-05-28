import argparse
import math
import os
import time
from collections import deque

import cv2
import numpy as np
import requests
from ultralytics import YOLO

try:
    from insightface.app import FaceAnalysis
except ImportError:
    FaceAnalysis = None

try:
    import face_recognition
except ImportError:
    face_recognition = None


ARCFACE_SIMILARITY_THRESHOLD = 0.65
FACE_RECOGNITION_TOLERANCE = 0.40
LOCATION_SAVE_DISTANCE_METERS = 50
FACE_ALERT_COOLDOWN_SECONDS = 60
MIN_FACE_SIZE = 100
MATCH_HISTORY_SIZE = 10
MATCH_HISTORY_REQUIRED = 6
FACE_ANALYSIS_EVERY_N_FRAMES = 8
YOLO_EVERY_N_FRAMES = 15


def cosine_similarity(left, right):
    return float(np.dot(left, right) / (np.linalg.norm(left) * np.linalg.norm(right)))


def similarity_to_accuracy(similarity):
    accuracy = similarity * 100
    return max(0, min(100, accuracy))


def distance_to_accuracy(distance):
    accuracy = (1 - distance) * 100
    return max(0, min(100, accuracy))


def get_distance_meters(lat1, lon1, lat2, lon2):
    earth_radius = 6371000
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(delta_lon / 2) ** 2
    )

    return earth_radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_mock_location(center_lat, center_lng, tick, simulate_move):
    if not simulate_move:
        return center_lat, center_lng

    latitude = center_lat + math.sin(tick / 6) * 0.003
    longitude = center_lng + math.cos(tick / 6) * 0.003

    return latitude, longitude


def is_face_inside_person_box(face_box, person_box):
    left, top, right, bottom = face_box
    x1, y1, x2, y2 = person_box

    face_center_x = (left + right) / 2
    face_center_y = (top + bottom) / 2

    return x1 <= face_center_x <= x2 and y1 <= face_center_y <= y2

# YOLO 박스 확장 함수 추가 
def expand_person_box(person_box, frame_width, frame_height, ratio=0.15):
    x1, y1, x2, y2 = person_box
    box_width = x2 - x1
    box_height = y2 - y1

    padding_x = int(box_width * ratio)
    padding_y = int(box_height * ratio)

    return (
        max(0, x1 - padding_x),
        max(0, y1 - padding_y),
        min(frame_width, x2 + padding_x),
        min(frame_height, y2 + padding_y),
    )


def post_location(server_url, senior_id, latitude, longitude):
    try:
        response = requests.post(
            f"{server_url}/api/locations",
            json={
                "seniorId": senior_id,
                "latitude": latitude,
                "longitude": longitude,
                "address": "노트북 GPS 모의 위치",
            },
            timeout=10,
        )
        response.raise_for_status()
        print(f"location sent: {latitude}, {longitude}")
    except requests.RequestException as error:
        print(f"location send failed: {error}")


def post_camera_alert(server_url, senior_id, alert_type, message, latitude=None, longitude=None):
    try:
        response = requests.post(
            f"{server_url}/api/alerts/camera",
            json={
                "seniorId": senior_id,
                "type": alert_type,
                "message": message,
                "latitude": latitude,
                "longitude": longitude,
            },
            timeout=10,
        )
        response.raise_for_status()
        print(f"camera alert sent: {alert_type}")
    except requests.RequestException as error:
        print(f"camera alert failed: {error}")


def list_image_files(image_path=None, image_dir=None):
    image_files = []

    if image_path:
        image_files.append(image_path)

    if image_dir:
        for file_name in os.listdir(image_dir):
            if file_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                image_files.append(os.path.join(image_dir, file_name))

    return image_files


def create_scrfd_arcface_app():
    if FaceAnalysis is None:
        return None

    # - SCRFD 계열 모델: 얼굴 감지
    # - ArcFace 계열 모델: 얼굴 임베딩 추출
    # buffalo_l + det_size 480 적용
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(480, 480)) 
    print("InsightFace initialized: SCRFD face detection + ArcFace recognition")
    return app


def load_arcface_embeddings(app, image_files, show_known_face=False):
    embeddings = []

    for image_file in image_files:
        image = cv2.imread(image_file)

        if image is None:
            print(f"known face skipped, cannot read image: {image_file}")
            continue

        faces = app.get(image)

        if not faces:
            print(f"known face skipped, SCRFD found no face: {image_file}")
            continue

        largest_face = max(
            faces,
            key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
        )

        left, top, right, bottom = map(int, largest_face.bbox)
        height, width = image.shape[:2]

        padding = 30
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(width, right + padding)
        bottom = min(height, bottom + padding)

        face_crop = image[top:bottom, left:right]

        os.makedirs("debug_faces", exist_ok=True)
        crop_path = os.path.join(
            "debug_faces",
            f"known_{os.path.splitext(os.path.basename(image_file))[0]}.jpg"
        )
        cv2.imwrite(crop_path, face_crop)

        print(f"known face crop saved: {crop_path}")
        print(f"known face bbox: left={left}, top={top}, right={right}, bottom={bottom}")

        if show_known_face:
            cv2.imshow("Known Face Crop", face_crop)
            cv2.waitKey(1000)

        embeddings.append(largest_face.embedding)

    if embeddings:
        print(f"ArcFace known embeddings loaded: {len(embeddings)}")

    return embeddings


def load_face_recognition_encodings(image_files):
    if face_recognition is None:
        return []

    encodings = []

    for image_file in image_files:
        image = face_recognition.load_image_file(image_file)
        face_encodings = face_recognition.face_encodings(image)

        if not face_encodings:
            print(f"fallback face skipped, no face found: {image_file}")
            continue

        encodings.append(face_encodings[0])

    if encodings:
        print(f"face_recognition fallback faces loaded: {len(encodings)}")

    return encodings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default="http://localhost:8080")
    parser.add_argument("--senior-id", type=int, required=True)
    parser.add_argument("--center-lat", type=float, required=True)
    parser.add_argument("--center-lng", type=float, required=True)
    parser.add_argument("--interval", type=int, default=10)
    parser.add_argument("--known-face")
    parser.add_argument("--known-face-dir")
    parser.add_argument("--yolo-model", default="yolo11n.pt")
    parser.add_argument("--simulate-move", action="store_true")
    parser.add_argument("--show-known-face", action="store_true")
    parser.add_argument("--camera-index", type=int, default=0)
    args = parser.parse_args()

    image_files = list_image_files(args.known_face, args.known_face_dir)

    if not image_files:
        raise RuntimeError("등록 얼굴 사진 경로가 필요합니다. --known-face 또는 --known-face-dir를 입력하세요.")

    yolo = YOLO(args.yolo_model)

    scrfd_arcface_app = create_scrfd_arcface_app()
    arcface_embeddings = (
        load_arcface_embeddings(scrfd_arcface_app, image_files, args.show_known_face)
        if scrfd_arcface_app is not None
        else []
    )

    fallback_encodings = [] if arcface_embeddings else load_face_recognition_encodings(image_files)

    if not arcface_embeddings and not fallback_encodings:
        raise RuntimeError("등록 사진에서 얼굴을 찾지 못했습니다.")

    # 웹캠 해상도 설정
    camera = cv2.VideoCapture(args.camera_index, cv2.CAP_DSHOW)

    if not camera.isOpened():
        raise RuntimeError(f"카메라를 열 수 없습니다. camera-index={args.camera_index}")

    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    camera.set(cv2.CAP_PROP_FPS, 30)

    face_alert_sent = False

    last_location_checked_at = 0
    last_face_alert_at = 0
    last_saved_location = None

    # 프레임 스킵용 변수 추가
    match_history = deque(maxlen=MATCH_HISTORY_SIZE)
    tick = 0
    frame_index = 0
    last_person_boxes = []
    last_arcface_faces = []
    last_fallback_face_locations = []
    last_fallback_face_encodings = []

    current_latitude = None
    current_longitude = None

    while True:
        now = time.time()

        # 매 루프마다 오래된 프레임 버리기 
        for _ in range(2):
            camera.grab()

        # while 루프에서 프레임 카운트 추가
        ok, frame = camera.read()

        if not ok:
            continue

        frame_index += 1
        should_run_yolo = frame_index % YOLO_EVERY_N_FRAMES == 0
        should_run_face_analysis = frame_index % FACE_ANALYSIS_EVERY_N_FRAMES == 0

        frame_height, frame_width = frame.shape[:2]

        # YOLO를 5프레임마다만 실행
        if should_run_yolo:
            results = yolo.predict(frame, imgsz=416, conf=0.45, verbose=False)
            person_boxes = []

            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    class_name = yolo.names[class_id]
                    confidence = float(box.conf[0])

                    if class_name != "person":
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    expanded_box = expand_person_box((x1, y1, x2, y2), frame_width, frame_height)

                    person_boxes.append(expanded_box)

            last_person_boxes = person_boxes
        else:
            person_boxes = last_person_boxes

        # 박스 그리기는 if should_run_yolo 밖에서 항상 하게끔
        for x1, y1, x2, y2 in person_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 180, 0), 2)
            cv2.putText(
                frame,
                "YOLO person",
                (x1, max(y1 - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 180, 0),
                2,
            )

        frame_has_match = False
        
        # InsightFace를 YOLO 조건 밖으로 빼고 3프레임마다
        if scrfd_arcface_app is not None and arcface_embeddings:
            if should_run_face_analysis:
                last_arcface_faces = scrfd_arcface_app.get(frame)

            faces = last_arcface_faces

            for face in faces:
                left, top, right, bottom = map(int, face.bbox)
                face_width = right - left
                face_height = bottom - top

                if face_width < MIN_FACE_SIZE or face_height < MIN_FACE_SIZE:
                    continue
                
                # 박스 안 얼굴 조건 제거 후 참고값으로만 사용 
                is_inside_person = any(
                    is_face_inside_person_box((left, top, right, bottom), box)
                    for box in person_boxes
                )

                similarities = [
                    cosine_similarity(known_embedding, face.embedding)
                    for known_embedding in arcface_embeddings
                ]
                best_similarity = max(similarities)
                accuracy = similarity_to_accuracy(best_similarity)
                is_match = best_similarity >= ARCFACE_SIMILARITY_THRESHOLD

                if should_run_face_analysis:
                    print(
                        f"ArcFace similarity={best_similarity:.3f}, "
                        f"display_score={accuracy:.1f}%, "
                        f"threshold={ARCFACE_SIMILARITY_THRESHOLD}, "
                        f"match={is_match}"
                    )

                if is_match:
                    frame_has_match = True

                color = (0, 0, 255) if is_match else (80, 80, 80)
                person_hint = "PERSON" if is_inside_person else "FACE ONLY"

                label = (
                    f"ArcFace MATCH {accuracy:.0f}% {person_hint}"
                    if is_match
                    else f"ArcFace NO MATCH {accuracy:.0f}% {person_hint}"
                )

                cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (left, max(top - 8, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                )

        elif fallback_encodings and face_recognition is not None:
            if should_run_face_analysis:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                last_fallback_face_locations = face_recognition.face_locations(rgb_frame)
                last_fallback_face_encodings = face_recognition.face_encodings(
                    rgb_frame,
                    last_fallback_face_locations,
                )

            face_locations = last_fallback_face_locations
            face_encodings = last_fallback_face_encodings

            for face_location, encoding in zip(face_locations, face_encodings):
                top, right, bottom, left = face_location
                face_width = right - left
                face_height = bottom - top

                if face_width < MIN_FACE_SIZE or face_height < MIN_FACE_SIZE:
                    continue

                is_inside_person = any(
                    is_face_inside_person_box((left, top, right, bottom), box)
                    for box in person_boxes
                )

                distances = face_recognition.face_distance(fallback_encodings, encoding)
                best_distance = min(distances)
                accuracy = distance_to_accuracy(best_distance)
                is_match = best_distance <= FACE_RECOGNITION_TOLERANCE

                print(
                    f"face_recognition distance={best_distance:.3f}, "
                    f"display_score={accuracy:.1f}%, "
                    f"threshold={FACE_RECOGNITION_TOLERANCE}, "
                    f"match={is_match}"
                )

                if is_match:
                    frame_has_match = True

                color = (0, 0, 255) if is_match else (80, 80, 80)
                person_hint = "PERSON" if is_inside_person else "FACE ONLY"

                label = (
                    f"fallback MATCH {accuracy:.0f}% {person_hint}"
                    if is_match
                    else f"fallback NO MATCH {accuracy:.0f}% {person_hint}"
                )

                cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (left, max(top - 8, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                )

        match_history.append(frame_has_match)
        stable_match = sum(match_history) >= MATCH_HISTORY_REQUIRED

        if stable_match and not face_alert_sent:
            post_camera_alert(
                args.server,
                args.senior_id,
                "FACE_MATCH",
                "등록된 실종자 얼굴과 일치하는 인물이 카메라에 감지되었습니다.",
                None,
                None,
            )
            face_alert_sent = True
            match_history.clear()

        cv2.imshow("Nuri YOLO Camera Prototype", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break  

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
