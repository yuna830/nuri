# 일단 --camera-index 0

cd C:\github\nuri\raspi-client

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face .\test_woon.jpg --camera-index 0


# 만약 웹 캠이 먼저 잡히면 --camera-index 1, --camera-index 2

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face .\test_woon.jpg --camera-index 1

# 사진을 known_faces\kimnari 에 넣고 실험 

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face-dir .\known_faces\kimnari --camera-index 0