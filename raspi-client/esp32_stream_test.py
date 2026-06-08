import cv2

stream_url = "http://172.28.6.12:81/stream"
cap = cv2.VideoCapture(stream_url)

while True:
    ok, frame = cap.read()

    if not ok:
        print("stream read failed")
        break

    cv2.imshow("ESP32-CAM", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()