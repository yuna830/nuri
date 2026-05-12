from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from PIL import Image
from transformers import pipeline

import requests
import shutil
import os

app = FastAPI()

classifier = pipeline(
    "image-classification",
    model="Kaludi/food-category-classification-v2.0"
)

SERVICE_KEY = "3c6dbc7415560aacf7394273e01091c2886cd6793945dabc5cb12819f796c74e"


def get_food_info(food_name):

    url = "http://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02"

    params = {
        "serviceKey": SERVICE_KEY,
        "FOOD_NM_KR": food_name,
        "pageNo": 1,
        "numOfRows": 5,
        "type": "json"
    }

    response = requests.get(url, params=params)

    print("API 응답:")
    print(response.text)

    return response.json()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"

if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


@app.post("/food")
async def upload_food(file: UploadFile = File(...)):

    label_map = {
        "Dessert": "과자",
        "Ice cream": "아이스크림",
        "Pizza": "피자",
        "Ramen": "라면",
        "Hamburger": "햄버거",
        "Chocolate": "초콜릿",
    }

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image = Image.open(file_path)

    result = classifier(image)

    top_result = result[0]

    label = top_result["label"]

    search_name = label_map.get(label, "과자")

    try:

        food_info = get_food_info(search_name)

        items = food_info["body"]["items"]

        item = items[0]

        sugar = item.get("AMT_NUM7", "0")

        sodium = item.get("AMT_NUM14", "0")

        try:

            sugar_value = float(sugar)

        except:

            sugar_value = 0

        if sugar_value >= 20:

            diabetes_result = "위험"

        elif sugar_value >= 10:

            diabetes_result = "주의"

        else:

            diabetes_result = "안전"

    except Exception as e:

        print("API 오류:", e)

        food_info = {}

    return {
        "message": "분석 성공",
        "label": label,
        "search_name": search_name,
        "score": float(top_result["score"]),
        "sugar": sugar,
        "sodium": sodium,   
        "diabetes_result": diabetes_result,
        "food_info": food_info,
    }