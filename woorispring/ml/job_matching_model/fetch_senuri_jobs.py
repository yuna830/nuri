import argparse
import csv
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path


SERVICE_URL = "http://apis.data.go.kr/B552474/SenuriService/getJobList"

OUTPUT_COLUMNS = [
    "job_id",
    "title",
    "organization",
    "job_type",
    "work_environment",
    "physical_intensity",
    "daily_hours",
    "commute_level",
    "task_tags",
    "closed",
    "work_place",
    "start_date",
    "end_date",
    "employment_type",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Korean senior job postings from the Senuri public API.")
    parser.add_argument("--service-key", default=os.getenv("SENURI_SERVICE_KEY"), help="data.go.kr service key.")
    parser.add_argument("--rows", type=int, default=200, help="Maximum number of postings to collect.")
    parser.add_argument("--page-size", type=int, default=100, help="Rows per API page.")
    parser.add_argument("--output", default="data/senuri_jobs.csv", help="Output normalized CSV file.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.service_key:
        raise SystemExit("SENURI_SERVICE_KEY 환경변수 또는 --service-key 값이 필요합니다.")

    rows = []
    page = 1
    while len(rows) < args.rows:
        xml_text = request_page(args.service_key, page, args.page_size)
        items = parse_items(xml_text)
        if not items:
            break
        for item in items:
            rows.append(normalize_item(item))
            if len(rows) >= args.rows:
                break
        page += 1

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"fetched={len(rows)}")
    print(f"output={output}")


def request_page(service_key: str, page_no: int, page_size: int) -> str:
    params = urllib.parse.urlencode(
        {
            "serviceKey": service_key,
            "pageNo": page_no,
            "numOfRows": page_size,
        },
        quote_via=urllib.parse.quote,
    )
    url = f"{SERVICE_URL}?{params}"
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_items(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    items = []
    for item in root.findall(".//item"):
        parsed = {}
        for child in list(item):
            parsed[child.tag] = child.text or ""
        items.append(parsed)
    return items


def normalize_item(item: dict[str, str]) -> dict[str, object]:
    title = pick(item, "recrtTitle", "title")
    job_type_source = pick(item, "jobclsNm", "jobType")
    workplace = pick(item, "workPlcNm", "workPlace")
    employment_type = pick(item, "emplymShpNm", "emplymShp")
    text = " ".join([title, job_type_source, workplace, employment_type])
    job_type = infer_job_type(job_type_source, title)
    tags = infer_task_tags(text)
    return {
        "job_id": pick(item, "jobId", "id"),
        "title": title,
        "organization": pick(item, "oranNm", "stmNm", "organization"),
        "job_type": job_type,
        "work_environment": infer_work_environment(text),
        "physical_intensity": infer_physical_intensity(text),
        "daily_hours": infer_daily_hours(employment_type, text),
        "commute_level": "대중교통 30분 이내",
        "task_tags": " ".join(tags),
        "closed": str(is_closed(item)).lower(),
        "work_place": workplace,
        "start_date": pick(item, "frDd"),
        "end_date": pick(item, "toDd"),
        "employment_type": employment_type,
    }


def pick(item: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if value:
            return value.strip()
    return ""


def infer_job_type(job_type: str, title: str) -> str:
    text = f"{job_type} {title}"
    if has_any(text, ["사무", "행정", "자료", "문서"]):
        return "사무 보조"
    if has_any(text, ["안내", "민원", "상담"]):
        return "안내"
    if has_any(text, ["급식", "배식", "조리"]):
        return "급식 조리 보조"
    if has_any(text, ["환경", "청소", "공원", "녹지"]):
        return "환경 정비"
    if has_any(text, ["배송", "배달", "물류", "운반"]):
        return "물류 보조"
    if job_type.strip():
        return job_type.strip()
    return "공익활동"


def infer_work_environment(text: str) -> str:
    if has_any(text, ["공원", "녹지", "순찰", "거리", "실외", "야외", "환경"]):
        return "야외"
    if has_any(text, ["사무", "도서관", "복지관", "센터", "실내", "자료", "안내", "급식", "배식"]):
        return "실내"
    return "혼합"


def infer_physical_intensity(text: str) -> str:
    if has_any(text, ["상하차", "무거운", "운반", "배송", "물류", "청소", "순찰"]):
        return "높음"
    if has_any(text, ["환경", "급식", "배식", "조리", "정비", "이동"]):
        return "중간"
    return "낮음"


def infer_daily_hours(employment_type: str, text: str) -> str:
    if has_any(text, ["전일", "정규"]):
        return "8"
    if has_any(employment_type, ["시간제", "일당"]):
        return "4"
    return "4"


def infer_task_tags(text: str) -> list[str]:
    tags = []
    if has_any(text, ["안내", "민원", "상담"]):
        tags.append("고객 응대")
    if has_any(text, ["자료", "문서", "정리", "사무"]):
        tags.append("반복 작업")
    if has_any(text, ["급식", "배식", "조리", "청소"]):
        tags.append("장시간 서있기")
    if has_any(text, ["운반", "배송", "물류", "상하차"]):
        tags.append("무거운 물건 운반")
    if has_any(text, ["순찰", "배달", "이동", "방문"]):
        tags.append("이동 많음")
    if has_any(text, ["계단"]):
        tags.append("계단 이동")
    return tags or ["반복 작업"]


def is_closed(item: dict[str, str]) -> bool:
    deadline = pick(item, "deadline")
    if "마감" in deadline:
        return True
    end_date = parse_yyyymmdd(pick(item, "toDd"))
    return bool(end_date and end_date < date.today())


def parse_yyyymmdd(value: str) -> date | None:
    value = value.strip()
    if not value:
        return None
    for fmt in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


if __name__ == "__main__":
    main()
