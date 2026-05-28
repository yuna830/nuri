import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from job_match_features import REQUIRED_COLUMNS, build_features, load_rows, normalize_label, validate_columns
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a sklearn job suitability model.")
    parser.add_argument("--input", default="data/job_matching_training_sample.csv", help="Labeled CSV or JSON file.")
    parser.add_argument("--output-dir", default="artifacts", help="Directory for model and metrics files.")
    parser.add_argument("--test-size", type=float, default=0.3, help="Holdout test ratio.")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = load_rows(input_path)
    validate_columns(df, REQUIRED_COLUMNS)

    y = df["label"].map(normalize_label)
    x = build_features(df)

    label_counts = y.value_counts()
    can_stratify = len(label_counts) >= 2 and label_counts.min() >= 2 and len(df) >= 10

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y if can_stratify else None,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        random_state=args.random_state,
        class_weight="balanced_subsample",
        min_samples_leaf=1,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    labels = sorted(y.unique())
    metrics = {
        "data_file": str(input_path),
        "rows": int(len(df)),
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "feature_count": int(len(x.columns)),
        "label_distribution": {label: int(count) for label, count in label_counts.items()},
        "accuracy": accuracy_score(y_test, predictions),
        "balanced_accuracy": balanced_accuracy_score(y_test, predictions),
        "macro_precision": precision_score(y_test, predictions, average="macro", zero_division=0),
        "macro_recall": recall_score(y_test, predictions, average="macro", zero_division=0),
        "macro_f1": f1_score(y_test, predictions, average="macro", zero_division=0),
        "classification_report": classification_report(y_test, predictions, labels=labels, zero_division=0, output_dict=True),
        "confusion_matrix": {
            "labels": labels,
            "matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        },
    }

    joblib.dump(model, output_dir / "job_matching_model.joblib")
    (output_dir / "feature_columns.json").write_text(
        json.dumps(list(x.columns), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    feature_importance = pd.DataFrame(
        {
            "feature": x.columns,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)
    feature_importance.to_csv(output_dir / "feature_importance.csv", index=False, encoding="utf-8-sig")

    print(json.dumps({
        "rows": metrics["rows"],
        "feature_count": metrics["feature_count"],
        "label_distribution": metrics["label_distribution"],
        "accuracy": round(metrics["accuracy"], 4),
        "balanced_accuracy": round(metrics["balanced_accuracy"], 4),
        "macro_f1": round(metrics["macro_f1"], 4),
        "model": str(output_dir / "job_matching_model.joblib"),
        "metrics": str(output_dir / "metrics.json"),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
