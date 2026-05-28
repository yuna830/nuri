import argparse
import csv
from pathlib import Path

import pandas as pd


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
    parser = argparse.ArgumentParser(description="Normalize the Hugging Face LinkedIn job postings dataset.")
    parser.add_argument("--input", default="data/hf_linkedin_job_postings.csv", help="Downloaded LinkedIn jobs CSV.")
    parser.add_argument("--output", default="data/hf_linkedin_jobs_normalized.csv", help="Normalized output CSV.")
    parser.add_argument("--limit", type=int, default=2000, help="Maximum rows to keep after normalization.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = pd.read_csv(args.input).fillna("")
    rows = []
    seen_categories = {}

    for _, row in source.iterrows():
        normalized = normalize_row(row)
        category = normalized["job_type"]
        if not category:
            continue
        seen_categories[category] = seen_categories.get(category, 0) + 1
        rows.append(normalized)
        if len(rows) >= args.limit:
            break

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"source_rows={len(source)}")
    print(f"normalized_rows={len(rows)}")
    print(f"job_type_distribution={seen_categories}")
    print(f"output={output}")


def normalize_row(row: pd.Series) -> dict[str, object]:
    title = str(row.get("title", ""))
    description = str(row.get("description", ""))
    text = f"{title} {description}".lower()
    job_type = infer_job_type(text)
    tags = infer_task_tags(text)
    return {
        "job_id": row.get("job_id", ""),
        "title": title,
        "organization": row.get("company_id", ""),
        "job_type": job_type,
        "work_environment": infer_work_environment(text, row.get("remote_allowed", "")),
        "physical_intensity": infer_physical_intensity(text),
        "daily_hours": infer_daily_hours(str(row.get("formatted_work_type", ""))),
        "commute_level": "대중교통 30분 이내",
        "task_tags": " ".join(tags),
        "closed": str(bool(row.get("closed_time", ""))).lower(),
        "work_place": row.get("location", ""),
        "start_date": row.get("listed_time", ""),
        "end_date": row.get("expiry", ""),
        "employment_type": row.get("formatted_work_type", ""),
    }


def infer_job_type(text: str) -> str:
    if has_any(text, ["administrative", "assistant", "clerk", "data entry", "office", "coordinator"]):
        return "사무 보조"
    if has_any(text, ["customer service", "reception", "front desk", "attendant", "concierge", "care provider"]):
        return "안내"
    if has_any(text, ["cook", "kitchen", "food", "dietary", "restaurant", "meal"]):
        return "급식 조리 보조"
    if has_any(text, ["cleaner", "janitor", "housekeeping", "maintenance", "landscaping", "groundskeeper"]):
        return "환경 정비"
    if has_any(text, ["warehouse", "shipping", "receiving", "delivery", "driver", "stock", "inventory"]):
        return "물류 보조"
    return "공익활동"


def infer_work_environment(text: str, remote_allowed: object) -> str:
    if str(remote_allowed).strip() in {"1", "1.0", "true", "True"}:
        return "실내"
    if has_any(text, ["outdoor", "field", "delivery", "driver", "landscaping", "groundskeeper"]):
        return "야외"
    if has_any(text, ["warehouse", "maintenance", "cleaner", "housekeeping"]):
        return "혼합"
    return "실내"


def infer_physical_intensity(text: str) -> str:
    if has_any(text, ["lift", "lifting", "warehouse", "shipping", "receiving", "driver", "delivery", "maintenance"]):
        return "높음"
    if has_any(text, ["standing", "walk", "walking", "clean", "housekeeping", "cook", "kitchen", "food"]):
        return "중간"
    return "낮음"


def infer_daily_hours(work_type: str) -> str:
    work_type = work_type.lower()
    if "part" in work_type or "contract" in work_type or "temporary" in work_type:
        return "4"
    return "6"


def infer_task_tags(text: str) -> list[str]:
    tags = []
    if has_any(text, ["customer", "client", "patient", "reception", "front desk"]):
        tags.append("고객 응대")
    if has_any(text, ["data entry", "document", "administrative", "office", "coordinator"]):
        tags.append("반복 작업")
    if has_any(text, ["standing", "cook", "kitchen", "housekeeping", "clean"]):
        tags.append("장시간 서있기")
    if has_any(text, ["lift", "lifting", "warehouse", "shipping", "receiving", "stock"]):
        tags.append("무거운 물건 운반")
    if has_any(text, ["driver", "delivery", "field", "walking", "travel"]):
        tags.append("이동 많음")
    if has_any(text, ["stairs", "ladder"]):
        tags.append("계단 이동")
    return tags or ["반복 작업"]


def has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


if __name__ == "__main__":
    main()
