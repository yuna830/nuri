import argparse
import math
import os
import time
from collections import defaultdict, deque

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


MATCH_THRESHOLD = 0.62
CANDIDATE_THRESHOLD = 0.55
FACE_ALERT_COOLDOWN_SECONDS = 60
KNOWN_FACE_QUALITY_MIN_SCORE = 0.45
LIVE_FACE_QUALITY_MIN_SCORE = 0.55
MIN_FACE_SIZE = 100
MATCH_HISTORY_SIZE = 10
MATCH_HISTORY_REQUIRED = 6
FACE_ANALYSIS_EVERY_N_FRAMES = 8
YOLO_EVERY_N_FRAMES = 10
LOCATION_SAVE_DISTANCE_METERS = 10
ARCFACE_SIMILARITY_THRESHOLD = MATCH_THRESHOLD
FACE_RECOGNITION_TOLERANCE = 1 - MATCH_THRESHOLD

PERSON_TRACK_IOU_THRESHOLD = 0.35
FULL_BODY_CANDIDATE_DIR = "body_candidates"
FULL_BODY_SAVE_COOLDOWN_SECONDS = 10
BODY_CANDIDATE_CLOTHING_THRESHOLD = 0.5
TARGET_COLORS_RELOAD_SECONDS = 60

TRACK_EXPIRE_SECONDS = 5

COLOR_KEYWORDS = {
    "black": ["black", "검", "까만"],
    "white": ["white", "흰", "하얀"],
    "gray": ["gray", "grey", "회색"],
    "red": ["red", "빨", "붉"],
    "orange": ["orange", "주황"],
    "yellow": ["yellow", "노란"],
    "green": ["green", "초록", "녹색"],
    "blue": ["blue", "navy", "파란", "남색"],
    "purple": ["purple", "보라"],
    "pink": ["pink", "분홍"],
    "brown": ["brown", "beige", "갈색", "베이지"],
}

COLOR_HSV_RANGES = {
    "black": [((0, 0, 0), (179, 255, 55))],
    "white": [((0, 0, 190), (179, 60, 255))],
    "gray": [((0, 0, 56), (179, 55, 189))],
    "red": [((0, 70, 60), (10, 255, 255)), ((170, 70, 60), (179, 255, 255))],
    "orange": [((11, 70, 70), (24, 255, 255))],
    "yellow": [((25, 70, 80), (35, 255, 255))],
    "green": [((36, 45, 50), (85, 255, 255))],
    "blue": [((86, 45, 45), (130, 255, 255))],
    "purple": [((131, 45, 45), (155, 255, 255))],
    "pink": [((156, 45, 80), (169, 255, 255))],
    "brown": [((8, 40, 40), (25, 190, 170))],
}


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


def bbox_area(box):
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)


def calculate_iou(left_box, right_box):
    lx1, ly1, lx2, ly2 = left_box
    rx1, ry1, rx2, ry2 = right_box

    ix1 = max(lx1, rx1)
    iy1 = max(ly1, ry1)
    ix2 = min(lx2, rx2)
    iy2 = min(ly2, ry2)

    intersection = bbox_area((ix1, iy1, ix2, iy2))
    union = bbox_area(left_box) + bbox_area(right_box) - intersection

    if union <= 0:
        return 0.0

    return intersection / union


def assign_person_tracks(person_boxes, tracked_persons, next_track_id):
    assigned_tracks = []
    used_track_ids = set()
    updated_tracks = {}

    for person_box in person_boxes:
        best_track_id = None
        best_iou = 0.0

        for track_id, previous_box in tracked_persons.items():
            if track_id in used_track_ids:
                continue

            iou = calculate_iou(person_box, previous_box)

            if iou > best_iou:
                best_iou = iou
                best_track_id = track_id

        if best_track_id is None or best_iou < PERSON_TRACK_IOU_THRESHOLD:
            best_track_id = next_track_id
            next_track_id += 1

        used_track_ids.add(best_track_id)
        updated_tracks[best_track_id] = person_box
        assigned_tracks.append((best_track_id, person_box))

    return assigned_tracks, updated_tracks, next_track_id


def find_person_track_for_face(face_box, person_tracks):
    matched_track_id = None
    matched_box = None
    smallest_area = None

    for track_id, person_box in person_tracks:
        if not is_face_inside_person_box(face_box, person_box):
            continue

        area = bbox_area(person_box)

        if smallest_area is None or area < smallest_area:
            smallest_area = area
            matched_track_id = track_id
            matched_box = person_box

    return matched_track_id, matched_box


def estimate_face_quality(frame, face, min_face_size=MIN_FACE_SIZE):
    left, top, right, bottom = map(int, face.bbox)
    frame_height, frame_width = frame.shape[:2]

    left = max(0, left)
    top = max(0, top)
    right = min(frame_width, right)
    bottom = min(frame_height, bottom)

    face_width = right - left
    face_height = bottom - top

    if face_width <= 0 or face_height <= 0:
        return 0.0, ["INVALID_BOX"]

    crop = frame[top:bottom, left:right]

    if crop.size == 0:
        return 0.0, ["EMPTY_CROP"]

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blur_value = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = float(np.mean(gray))

    size_score = min(1.0, min(face_width, face_height) / min_face_size)
    blur_score = min(1.0, blur_value / 120.0)
    brightness_score = 1.0 if 45 <= brightness <= 210 else 0.0

    landmark_score = 0.5
    pose_score = 0.5

    kps = getattr(face, "kps", None)

    if kps is not None and len(kps) >= 5:
        kps = np.array(kps)
        inside_count = 0

        for x, y in kps:
            if left <= x <= right and top <= y <= bottom:
                inside_count += 1

        landmark_score = inside_count / len(kps)

        left_eye = kps[0]
        right_eye = kps[1]
        nose = kps[2]
        eye_distance = np.linalg.norm(right_eye - left_eye)

        if eye_distance > 0:
            eye_mid_x = (left_eye[0] + right_eye[0]) / 2
            yaw_ratio = abs(nose[0] - eye_mid_x) / eye_distance
            eye_level_diff = abs(left_eye[1] - right_eye[1]) / eye_distance
            pose_score = 1.0 if yaw_ratio <= 0.45 and eye_level_diff <= 0.35 else 0.0

    quality_score = (
        size_score * 0.30
        + blur_score * 0.25
        + brightness_score * 0.20
        + landmark_score * 0.15
        + pose_score * 0.10
    )

    reasons = []

    if size_score < 1.0:
        reasons.append("SMALL_FACE")
    if blur_score < 0.5:
        reasons.append("BLURRY_FACE")
    if brightness_score == 0.0:
        reasons.append("BAD_BRIGHTNESS")
    if landmark_score < 0.8:
        reasons.append("UNSTABLE_LANDMARKS")
    if pose_score == 0.0:
        reasons.append("SIDE_FACE")

    return quality_score, reasons


def can_send_face_alert(last_alert_time_by_key, alert_key, now):
    last_alert_at = last_alert_time_by_key.get(alert_key, 0)
    return now - last_alert_at >= FACE_ALERT_COOLDOWN_SECONDS


def save_body_candidate(frame, senior_id, track_id, person_box, now, last_saved_at_by_track):
    last_saved_at = last_saved_at_by_track.get(track_id, 0)

    if now - last_saved_at < FULL_BODY_SAVE_COOLDOWN_SECONDS:
        return None

    x1, y1, x2, y2 = person_box
    crop = frame[y1:y2, x1:x2]

    if crop.size == 0:
        return None

    os.makedirs(FULL_BODY_CANDIDATE_DIR, exist_ok=True)
    file_name = f"senior_{senior_id}_track_{track_id}_{int(now)}.jpg"
    path = os.path.join(FULL_BODY_CANDIDATE_DIR, file_name)

    cv2.imwrite(path, crop)
    last_saved_at_by_track[track_id] = now

    return path


def cleanup_expired_tracks(
    active_track_ids,
    tracked_persons,
    match_history_by_track,
    last_body_candidate_saved_at,
    track_last_seen_at,
    now,
):
    expired_track_ids = []

    for track_id, last_seen_at in track_last_seen_at.items():
        if track_id in active_track_ids:
            continue

        if now - last_seen_at >= TRACK_EXPIRE_SECONDS:
            expired_track_ids.append(track_id)

    for track_id in expired_track_ids:
        tracked_persons.pop(track_id, None)
        match_history_by_track.pop(track_id, None)
        last_body_candidate_saved_at.pop(track_id, None)
        track_last_seen_at.pop(track_id, None)


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


def post_camera_alert(
    server_url,
    senior_id,
    alert_type,
    message,
    latitude=None,
    longitude=None,
    image_url=None,
    similarity_score=None,
    candidate_kind=None,
):
    if alert_type == "AI_CANDIDATE_CONFIRM" and "?" in message:
        message = "유사한 사람이 감지되었습니다. 보호자 확인이 필요합니다."

    try:
        payload = {
            "seniorId": senior_id,
            "type": alert_type,
            "message": message,
            "latitude": latitude,
            "longitude": longitude,
            "imageUrl": image_url,
            "similarityScore": similarity_score,
            "candidateKind": candidate_kind,
        }
        response = requests.post(
            f"{server_url}/api/alerts/camera",
            json={key: value for key, value in payload.items() if value is not None},
            timeout=10,
        )
        response.raise_for_status()
        print(f"camera alert sent: {alert_type}")
    except requests.RequestException as error:
        print(f"camera alert failed: {error}")


def upload_candidate_image(server_url, image_path):
    try:
        with open(image_path, "rb") as image_file:
            response = requests.post(
                f"{server_url}/api/uploads/candidates",
                files={"image": (os.path.basename(image_path), image_file, "image/jpeg")},
                timeout=15,
            )
        response.raise_for_status()
        return response.json().get("imageUrl")
    except (OSError, requests.RequestException, ValueError) as error:
        print(f"candidate image upload failed: {error}")
        return None


def load_target_clothing_colors(server_url, senior_id):
    try:
        response = requests.get(f"{server_url}/api/missing-reports/face-targets", timeout=10)
        response.raise_for_status()
        reports = response.json()
    except requests.RequestException as error:
        print(f"missing target load failed: {error}")
        return set()

    text = " ".join(
        report.get("description") or ""
        for report in reports
        if report.get("seniorId") == senior_id
    ).lower()

    colors = set()
    for color, keywords in COLOR_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            colors.add(color)

    print(f"target clothing colors: {sorted(colors)}")
    return colors


def detect_crop_colors(crop):
    if crop.size == 0:
        return set()

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    pixel_count = hsv.shape[0] * hsv.shape[1]
    detected = set()

    if pixel_count <= 0:
        return detected

    for color, ranges in COLOR_HSV_RANGES.items():
        mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
        for lower, upper in ranges:
            mask = cv2.bitwise_or(
                mask,
                cv2.inRange(hsv, np.array(lower, dtype=np.uint8), np.array(upper, dtype=np.uint8)),
            )

        if cv2.countNonZero(mask) / pixel_count >= 0.08:
            detected.add(color)

    return detected


def score_clothing_similarity(frame, person_box, target_colors):
    # 신고서에 옷차림 색 정보가 없으면 후보로 올리지 않음
    if not target_colors:
        return 0.0

    x1, y1, x2, y2 = person_box
    crop = frame[y1:y2, x1:x2]

    if crop.size == 0:
        return 0.0

    height = crop.shape[0]
    upper = crop[: max(1, int(height * 0.55)), :]
    lower = crop[int(height * 0.45):, :]
    detected_colors = detect_crop_colors(upper) | detect_crop_colors(lower)

    if not detected_colors:
        return 0.0

    score = len(target_colors & detected_colors) / len(target_colors)
    print(f"clothing score={score:.2f}, target={sorted(target_colors)}, detected={sorted(detected_colors)}")
    return score


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

        quality_score, quality_reasons = estimate_face_quality(image, largest_face)

        if quality_score < KNOWN_FACE_QUALITY_MIN_SCORE:
            print(
                f"known face skipped, low quality: {image_file}, "
                f"quality={quality_score:.2f}, reasons={quality_reasons}"
            )
            continue

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
            f"known_{os.path.splitext(os.path.basename(image_file))[0]}.jpg",
        )
        cv2.imwrite(crop_path, face_crop)

        print(f"known face crop saved: {crop_path}")
        print(f"known face quality={quality_score:.2f}, bbox={left},{top},{right},{bottom}")

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

    target_clothing_colors = load_target_clothing_colors(args.server, args.senior_id)
    last_colors_loaded_at = time.time()

    yolo = YOLO(args.yolo_model)

    scrfd_arcface_app = create_scrfd_arcface_app()
    arcface_embeddings = (
        load_arcface_embeddings(scrfd_arcface_app, image_files, args.show_known_face)
        if scrfd_arcface_app is not None
        else []
    )

    # 평균 임베딩을 대표값으로 추가 — 사진별 노이즈가 상쇄돼 유사도가 안정적으로 올라감
    if len(arcface_embeddings) >= 2:
        mean_embedding = np.mean(arcface_embeddings, axis=0)
        mean_embedding = mean_embedding / np.linalg.norm(mean_embedding)
        arcface_embeddings.append(mean_embedding)
        print("mean embedding added to known embeddings")

    fallback_encodings = [] if arcface_embeddings else load_face_recognition_encodings(image_files)

    if not arcface_embeddings and not fallback_encodings:
        raise RuntimeError("등록 사진에서 사용할 수 있는 얼굴을 찾지 못했습니다.")

    camera = cv2.VideoCapture(args.camera_index, cv2.CAP_DSHOW)

    if not camera.isOpened():
        raise RuntimeError(f"카메라를 열 수 없습니다. camera-index={args.camera_index}")

    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    camera.set(cv2.CAP_PROP_FPS, 30)

    last_location_checked_at = 0
    last_saved_location = None

    tracked_persons = {}
    next_track_id = 1
    match_history_by_track = defaultdict(lambda: deque(maxlen=MATCH_HISTORY_SIZE))
    last_alert_time_by_key = {}
    last_body_candidate_saved_at = {}
    track_last_seen_at = {}

    tick = 0
    frame_index = 0
    last_person_tracks = []
    last_arcface_faces = []
    last_fallback_face_locations = []
    last_fallback_face_encodings = []

    current_latitude = None
    current_longitude = None

    while True:
        now = time.time()
        tick += 1

        current_latitude, current_longitude = get_mock_location(
            args.center_lat,
            args.center_lng,
            tick,
            args.simulate_move,
        )

        # 실행 중 신고서가 갱신되면 옷차림 색을 다시 반영
        if now - last_colors_loaded_at >= TARGET_COLORS_RELOAD_SECONDS:
            target_clothing_colors = load_target_clothing_colors(args.server, args.senior_id)
            last_colors_loaded_at = now

        if now - last_location_checked_at >= args.interval:
            should_send_location = False

            if last_saved_location is None:
                should_send_location = True
            else:
                previous_latitude, previous_longitude = last_saved_location
                distance = get_distance_meters(
                    previous_latitude,
                    previous_longitude,
                    current_latitude,
                    current_longitude,
                )
                should_send_location = distance >= LOCATION_SAVE_DISTANCE_METERS

            if should_send_location:
                post_location(
                    args.server,
                    args.senior_id,
                    current_latitude,
                    current_longitude,
                )
                last_saved_location = (current_latitude, current_longitude)

            last_location_checked_at = now

        for _ in range(2):
            camera.grab()

        ok, frame = camera.read()

        if not ok:
            continue

        frame_index += 1
        should_run_yolo = frame_index % YOLO_EVERY_N_FRAMES == 0
        should_run_face_analysis = frame_index % FACE_ANALYSIS_EVERY_N_FRAMES == 0

        frame_height, frame_width = frame.shape[:2]

        if should_run_yolo:
            results = yolo.predict(frame, imgsz=416, conf=0.45, verbose=False)
            person_boxes = []

            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    class_name = yolo.names[class_id]

                    if class_name != "person":
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    expanded_box = expand_person_box(
                        (x1, y1, x2, y2),
                        frame_width,
                        frame_height,
                    )
                    person_boxes.append(expanded_box)

            person_tracks, tracked_persons, next_track_id = assign_person_tracks(
                person_boxes,
                tracked_persons,
                next_track_id,
            )
            last_person_tracks = person_tracks

            active_track_ids = {track_id for track_id, _ in person_tracks}

            for track_id in active_track_ids:
                track_last_seen_at[track_id] = now

            cleanup_expired_tracks(
                active_track_ids,
                tracked_persons,
                match_history_by_track,
                last_body_candidate_saved_at,
                track_last_seen_at,
                now,
            )
        else:
            person_tracks = last_person_tracks

        current_track_matches = {track_id: False for track_id, _ in person_tracks}
        current_track_has_face = {track_id: False for track_id, _ in person_tracks}
        current_track_candidate = {track_id: False for track_id, _ in person_tracks}

        for track_id, (x1, y1, x2, y2) in person_tracks:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 180, 0), 2)
            cv2.putText(
                frame,
                f"YOLO person #{track_id}",
                (x1, max(y1 - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 180, 0),
                2,
            )

        if scrfd_arcface_app is not None and arcface_embeddings:
            if should_run_face_analysis:
                last_arcface_faces = scrfd_arcface_app.get(frame)

            faces = last_arcface_faces

            for face in faces:
                left, top, right, bottom = map(int, face.bbox)
                face_box = (left, top, right, bottom)

                track_id, person_box = find_person_track_for_face(face_box, person_tracks)
                is_inside_person = track_id is not None

                if is_inside_person:
                    current_track_has_face[track_id] = True

                quality_score, quality_reasons = estimate_face_quality(frame, face)

                if quality_score < LIVE_FACE_QUALITY_MIN_SCORE:
                    if is_inside_person:
                        current_track_candidate[track_id] = True

                    cv2.rectangle(frame, (left, top), (right, bottom), (0, 165, 255), 2)
                    cv2.putText(
                        frame,
                        f"LOW QUALITY {quality_score:.2f}",
                        (left, max(top - 8, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 165, 255),
                        2,
                    )

                    if should_run_face_analysis:
                        print(
                            f"low quality face: track={track_id}, "
                            f"quality={quality_score:.2f}, reasons={quality_reasons}"
                        )

                    continue

                similarities = [
                    cosine_similarity(known_embedding, face.embedding)
                    for known_embedding in arcface_embeddings
                ]
                best_similarity = max(similarities)
                accuracy = similarity_to_accuracy(best_similarity)

                is_match = best_similarity >= ARCFACE_SIMILARITY_THRESHOLD and is_inside_person

                if should_run_face_analysis:
                    print(
                        f"track={track_id}, ArcFace similarity={best_similarity:.3f}, "
                        f"display_score={accuracy:.1f}%, quality={quality_score:.2f}, "
                        f"match={is_match}"
                    )

                # 화질이 좋은데 비매치 = 명확히 다른 사람 -> 옷차림 후보에서 제외
                if is_match:
                    current_track_matches[track_id] = True

                color = (0, 0, 255) if is_match else (80, 80, 80)
                person_hint = f"TRACK {track_id}" if is_inside_person else "FACE ONLY"

                label = (
                    f"ArcFace MATCH {accuracy:.0f}% Q{quality_score:.2f} {person_hint}"
                    if is_match
                    else f"ArcFace NO MATCH {accuracy:.0f}% Q{quality_score:.2f} {person_hint}"
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
                face_box = (left, top, right, bottom)
                face_width = right - left
                face_height = bottom - top

                track_id, person_box = find_person_track_for_face(face_box, person_tracks)
                is_inside_person = track_id is not None

                if is_inside_person:
                    current_track_has_face[track_id] = True

                if face_width < MIN_FACE_SIZE or face_height < MIN_FACE_SIZE:
                    if is_inside_person:
                        current_track_candidate[track_id] = True
                    continue

                distances = face_recognition.face_distance(fallback_encodings, encoding)
                best_distance = min(distances)
                accuracy = distance_to_accuracy(best_distance)
                is_match = best_distance <= FACE_RECOGNITION_TOLERANCE and is_inside_person

                # 화질이 좋은데 비매치 = 명확히 다른 사람 -> 옷차림 후보에서 제외
                if is_match:
                    current_track_matches[track_id] = True

                print(
                    f"track={track_id}, face_recognition distance={best_distance:.3f}, "
                    f"display_score={accuracy:.1f}%, match={is_match}"
                )

                color = (0, 0, 255) if is_match else (80, 80, 80)
                person_hint = f"TRACK {track_id}" if is_inside_person else "FACE ONLY"

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

        if should_run_face_analysis:
            for track_id, person_box in person_tracks:
                track_matched = current_track_matches.get(track_id, False)
                track_has_face = current_track_has_face.get(track_id, False)
                track_candidate = current_track_candidate.get(track_id, False)

                match_history_by_track[track_id].append(track_matched)
                stable_match = sum(match_history_by_track[track_id]) >= MATCH_HISTORY_REQUIRED

                if stable_match and can_send_face_alert(
                    last_alert_time_by_key,
                    (args.senior_id, "FACE_MATCH"),
                    now,
                ):
                    post_camera_alert(
                        args.server,
                        args.senior_id,
                        "AI_CANDIDATE_CONFIRM",
                        "등록된 실종자 얼굴과 일치하는 사람이 카메라에 감지되었습니다.",
                        current_latitude,
                        current_longitude,
                        similarity_score=1.0,
                        candidate_kind="FACE_MATCH",
                    )
                    last_alert_time_by_key[(args.senior_id, "FACE_MATCH")] = now
                    match_history_by_track[track_id].clear()

                # 얼굴이 아예 안 잡혔거나 저화질이라 판단 불가한 트랙만 옷차림 분석
                should_save_body_candidate = not track_has_face or track_candidate

                if should_save_body_candidate and not track_matched:
                    clothing_score = score_clothing_similarity(frame, person_box, target_clothing_colors)

                    if clothing_score < BODY_CANDIDATE_CLOTHING_THRESHOLD:
                        continue

                    candidate_path = save_body_candidate(
                        frame,
                        args.senior_id,
                        track_id,
                        person_box,
                        now,
                        last_body_candidate_saved_at,
                    )

                    if candidate_path:
                        print(f"body candidate saved: {candidate_path}")
                        candidate_image_url = upload_candidate_image(args.server, candidate_path)
                        if can_send_face_alert(
                            last_alert_time_by_key,
                            (args.senior_id, "BODY_CANDIDATE"),
                            now,
                        ):
                            post_camera_alert(
                                args.server,
                                args.senior_id,
                                "AI_CANDIDATE_CONFIRM",
                                "얼굴이 명확하지 않아 전신 후보를 저장했습니다. 보호자 확인이 필요합니다.",
                                current_latitude,
                                current_longitude,
                                image_url=candidate_image_url,
                                similarity_score=clothing_score,
                                candidate_kind="BODY_CANDIDATE",
                            )
                            last_alert_time_by_key[(args.senior_id, "BODY_CANDIDATE")] = now

        cv2.imshow("Nuri YOLO Camera Prototype", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
