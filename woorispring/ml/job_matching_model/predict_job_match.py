import argparse
import json
from pathlib import Path

import joblib
from job_match_features import PREDICT_REQUIRED_COLUMNS, align_features, build_features, load_rows, validate_columns


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict job suitability with a trained sklearn model.")
    parser.add_argument("--input", required=True, help="CSV or JSON file for prediction rows.")
    parser.add_argument("--model", default="artifacts/job_matching_model.joblib", help="Trained joblib model path.")
    parser.add_argument("--feature-columns", default="artifacts/feature_columns.json", help="Feature column list path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = load_rows(args.input)
    validate_columns(df, PREDICT_REQUIRED_COLUMNS)

    model = joblib.load(args.model)
    feature_columns = json.loads(Path(args.feature_columns).read_text(encoding="utf-8"))

    features = align_features(build_features(df), feature_columns)
    predictions = model.predict(features)
    probabilities = model.predict_proba(features)
    classes = list(model.classes_)

    results = []
    for index, prediction in enumerate(predictions):
        probability_map = {
            label: round(float(probabilities[index][class_index]), 4)
            for class_index, label in enumerate(classes)
        }
        results.append(
            {
                "jobId": value_or_empty(df.iloc[index].get("job_id", df.iloc[index].get("jobId", ""))),
                "title": value_or_empty(df.iloc[index].get("title", "")),
                "prediction": prediction,
                "probabilities": probability_map,
            }
        )

    print(json.dumps({"predictions": results}, ensure_ascii=False, indent=2))


def value_or_empty(value: object) -> str:
    return "" if value is None else str(value)


if __name__ == "__main__":
    main()
