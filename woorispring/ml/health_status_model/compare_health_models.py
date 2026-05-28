import argparse
import json
from pathlib import Path

import joblib

from health_features import PREDICT_REQUIRED_COLUMNS, align_features, build_features, load_rows, normalize_label, validate_columns


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare current health model artifacts with v2 artifacts.")
    parser.add_argument("--input", default="data/predict_sample.json", help="CSV or JSON prediction rows.")
    parser.add_argument("--current-model", default="artifacts/health_status_model.joblib")
    parser.add_argument("--current-features", default="artifacts/feature_columns.json")
    parser.add_argument("--v2-model", default="artifacts_v2/health_status_model.joblib")
    parser.add_argument("--v2-features", default="artifacts_v2/feature_columns.json")
    parser.add_argument("--expected-column", default="expected_label", help="Optional expected label column.")
    parser.add_argument("--case-column", default="case_id", help="Optional case description/id column.")
    parser.add_argument("--output", help="Optional JSON output path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = load_rows(args.input)
    validate_columns(df, PREDICT_REQUIRED_COLUMNS)

    current = predict(df, args.current_model, args.current_features)
    v2 = predict(df, args.v2_model, args.v2_features)
    has_expected = args.expected_column in df.columns
    rows = []

    for index in range(len(df)):
        expected = normalize_label(df.iloc[index].get(args.expected_column, "")) if has_expected else ""
        result = {
            "row": index + 1,
            "case": str(df.iloc[index].get(args.case_column, "")),
            "age": str(df.iloc[index].get("age", "")),
            "expected": expected,
            "current": current[index],
            "v2": v2[index],
            "changed": current[index]["prediction"] != v2[index]["prediction"],
        }
        if has_expected:
            result["current_matches_expected"] = current[index]["prediction"] == expected
            result["v2_matches_expected"] = v2[index]["prediction"] == expected
        rows.append(result)

    payload = {
        "summary": build_summary(rows, has_expected),
        "rows": rows,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    print(text)


def build_summary(rows: list[dict], has_expected: bool) -> dict:
    summary = {
        "rows": len(rows),
        "changed": sum(1 for row in rows if row["changed"]),
    }
    if has_expected:
        current_matches = sum(1 for row in rows if row["current_matches_expected"])
        v2_matches = sum(1 for row in rows if row["v2_matches_expected"])
        summary.update(
            {
                "current_matches_expected": current_matches,
                "v2_matches_expected": v2_matches,
                "current_accuracy": round(current_matches / len(rows), 4) if rows else 0,
                "v2_accuracy": round(v2_matches / len(rows), 4) if rows else 0,
            }
        )
    return summary


def predict(df, model_path: str, features_path: str) -> list[dict]:
    model = joblib.load(model_path)
    feature_columns = json.loads(Path(features_path).read_text(encoding="utf-8"))
    features = align_features(build_features(df), feature_columns)
    predictions = model.predict(features)
    probabilities = model.predict_proba(features)
    classes = list(model.classes_)

    return [
        {
            "prediction": str(prediction),
            "probabilities": {
                label: round(float(probabilities[index][class_index]), 4)
                for class_index, label in enumerate(classes)
            },
        }
        for index, prediction in enumerate(predictions)
    ]


if __name__ == "__main__":
    main()
