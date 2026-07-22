import io
import re
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from paddleocr import PaddleOCR
from PIL import Image, ImageStat


@dataclass
class QualityResult:
    warnings: list[str]


@dataclass
class OcrLine:
    text: str
    confidence: float
    left: float
    right: float
    top: float
    bottom: float

    @property
    def center_y(self) -> float:
        return (self.top + self.bottom) / 2

    @property
    def height(self) -> float:
        return max(self.bottom - self.top, 1)


def inspect_image(content: bytes) -> QualityResult:
    image = Image.open(io.BytesIO(content)).convert("L")
    warnings = []
    if image.width < 700 or image.height < 500:
        warnings.append("이미지 해상도가 낮습니다. 제품 라벨을 더 가까이 촬영해 주세요.")
    stat = ImageStat.Stat(image)
    if stat.mean[0] < 45:
        warnings.append("사진이 너무 어둡습니다. 밝은 곳에서 다시 촬영해 주세요.")
    if stat.mean[0] > 225:
        warnings.append("빛 반사가 강할 수 있습니다. 촬영 각도를 바꿔 주세요.")
    if stat.var[0] < 180:
        warnings.append("글자가 흐리거나 대비가 낮습니다. 초점을 맞춰 다시 촬영해 주세요.")
    return QualityResult(warnings)


@lru_cache(maxsize=1)
def _ocr() -> PaddleOCR:
    return PaddleOCR(use_angle_cls=True, lang="korean", show_log=False)


def _extract_text(content: bytes) -> tuple[str, float, list[OcrLine]]:
    image = np.array(Image.open(io.BytesIO(content)).convert("RGB"))
    result = _ocr().ocr(image, cls=True)
    lines = []
    for page in result or []:
        for item in page or []:
            if not item or len(item) < 2:
                continue
            box, recognition = item[0], item[1]
            text, confidence = recognition
            if not text or not box:
                continue
            xs = [float(point[0]) for point in box]
            ys = [float(point[1]) for point in box]
            lines.append(OcrLine(str(text).strip(), float(confidence), min(xs), max(xs), min(ys), max(ys)))
    lines.sort(key=lambda line: (line.center_y, line.left))
    average = sum(line.confidence for line in lines) / len(lines) if lines else 0.0
    return "\n".join(line.text for line in lines), average, lines


def _field(value=None, source_text=None, confidence=0.0, warning=None) -> dict:
    return {
        "value": value,
        "sourceText": source_text,
        "confidence": round(float(confidence), 4),
        "warning": warning,
    }


def _normalize_identifier(value: str) -> str:
    return re.sub(r"\s+", "", value).upper().strip(".,:;")


def _clean_value(value: str) -> str:
    return value.strip().strip(":：|·- ")


def _row_value(lines: list[OcrLine], labels: tuple[str, ...]) -> tuple[str, str, float] | None:
    for label_line in lines:
        compact = re.sub(r"\s+", "", label_line.text)
        matched_label = next((label for label in labels if label.lower() in compact.lower()), None)
        if not matched_label:
            continue

        inline = re.sub(re.escape(matched_label), "", compact, count=1, flags=re.IGNORECASE)
        inline = _clean_value(inline)
        if inline:
            return inline, label_line.text, label_line.confidence

        tolerance = max(label_line.height * 0.8, 8)
        candidates = [
            line for line in lines
            if line.left >= label_line.right - 3
            and abs(line.center_y - label_line.center_y) <= tolerance
            and line is not label_line
        ]
        if candidates:
            value_line = min(candidates, key=lambda line: line.left)
            return _clean_value(value_line.text), f"{label_line.text} {value_line.text}", min(label_line.confidence, value_line.confidence)
    return None


def _fallback_labeled_value(lines: list[OcrLine], labels: tuple[str, ...]) -> tuple[str, str, float] | None:
    """작은 표에서 라벨과 값의 OCR 박스가 어긋난 경우 읽기 순서로 보완한다."""
    normalized_labels = tuple(re.sub(r"\s+", "", label).lower() for label in labels)
    for index, label_line in enumerate(lines):
        compact = re.sub(r"\s+", "", label_line.text).lower()
        if not any(label in compact for label in normalized_labels):
            continue

        # 같은 행에 잡힌 모든 값 박스를 왼쪽부터 결합한다.
        tolerance = max(label_line.height * 1.35, 12)
        same_row = sorted(
            (
                line for line in lines
                if line is not label_line
                and abs(line.center_y - label_line.center_y) <= tolerance
                and line.left > label_line.left
            ),
            key=lambda line: line.left,
        )
        if same_row:
            value = _clean_value(" ".join(line.text for line in same_row))
            if value:
                source = f"{label_line.text} {value}"
                return value, source, min([label_line.confidence, *[line.confidence for line in same_row]])

        # 좌표가 크게 어긋났다면 OCR 읽기 순서상 바로 다음 박스를 사용한다.
        if index + 1 < len(lines):
            next_line = lines[index + 1]
            next_compact = re.sub(r"\s+", "", next_line.text).lower()
            all_labels = ("상품명", "품명", "제품명", "모델명", "모델번호", "제조번호", "수입원", "브랜드")
            if not any(label in next_compact for label in all_labels):
                value = _clean_value(next_line.text)
                if value:
                    return value, f"{label_line.text} {next_line.text}", min(label_line.confidence, next_line.confidence)
    return None


def _match_identifier(raw_text: str, patterns: tuple[str, ...]) -> tuple[str, str] | None:
    for pattern in patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return _normalize_identifier(match.group(1)), match.group(0).strip()
    return None


def _infer_product_name_before_model(lines: list[OcrLine], model_number: str | None) -> tuple[str, str, float] | None:
    """상품명 라벨이 누락됐을 때 모델번호 앞의 의미 있는 한글 행을 제품명 후보로 사용한다."""
    model_index = next(
        (index for index, line in enumerate(lines) if model_number and _normalize_identifier(line.text) == model_number),
        None,
    )
    if model_index is None:
        return None

    excluded = ("인증", "모델", "제조", "수입", "공급", "고객", "품질", "중국", "주식회사")
    candidates = []
    for line in lines[max(0, model_index - 7):model_index]:
        text = _clean_value(line.text)
        korean_count = len(re.findall(r"[가-힣]", text))
        if korean_count < 3 or any(word in text for word in excluded):
            continue
        if re.fullmatch(r"[가-힣]{1,3}", text):
            continue
        candidates.append((korean_count + min(len(text), 20) / 20, line))
    if not candidates:
        return None
    selected = max(candidates, key=lambda item: item[0])[1]
    return _clean_value(selected.text), selected.text, selected.confidence


def _reconstruct_certifications(lines: list[OcrLine], model_number: str | None) -> list[str]:
    compact_lines = [_normalize_identifier(line.text) for line in lines]
    results = []

    for index, token in enumerate(compact_lines):
        if re.fullmatch(r"(?:XU|HU|JU|CB)\d{6,}", token):
            nearby = compact_lines[max(0, index - 3):index + 4]
            suffix = next((value for value in nearby if re.fullmatch(r"\d{4,5}", value)), None)
            if suffix:
                results.append(f"{token}-{suffix}")

        if re.fullmatch(r"R-R-[A-Z0-9]{2,}", token) and model_number:
            results.append(f"{token}-{model_number.lstrip('-')}")

    return results


def _as_field(result: tuple[str, str, float] | None, default_confidence: float) -> dict:
    if not result:
        return _field()
    value, source, confidence = result
    return _field(value, source, confidence or default_confidence, "제품 라벨과 다시 비교해 주세요.")


def _rule_fields(raw_text: str, confidence: float, lines: list[OcrLine]) -> dict:
    fields = {
        "productName": _as_field(_row_value(lines, ("상품명", "품명", "제품명")), confidence),
        "brandName": _as_field(_row_value(lines, ("브랜드", "상표명", "상표", "BRAND")), confidence),
        "manufacturer": _as_field(_row_value(lines, ("제조원", "제조자", "제조사")), confidence),
        "importer": _as_field(_row_value(lines, ("수입원", "수입자")), confidence),
        "supplier": _as_field(_row_value(lines, ("공급원", "공급자")), confidence),
        "modelNumber": _as_field(_row_value(lines, ("모델명", "모델번호", "MODEL NO", "MODEL")), confidence),
        "serialNumber": _as_field(_row_value(lines, ("제조번호", "일련번호", "시리얼번호", "SERIAL NO", "S/N")), confidence),
        "lotNumber": _as_field(_row_value(lines, ("로트번호", "LOT NO", "LOT")), confidence),
        "manufacturingDate": _as_field(_row_value(lines, ("제조년월", "제조일자", "생산일")), confidence),
    }

    # 상품명은 등록 화면의 핵심 표시값이므로 표 좌표가 어긋난 경우 한 번 더 추출한다.
    if not fields["productName"]["value"]:
        product_name = _fallback_labeled_value(lines, ("\uc0c1\ud488\uba85", "\ud488\uba85", "\uc81c\ud488\uba85"))
        if product_name:
            fields["productName"] = _as_field(product_name, confidence)

    model = _match_identifier(raw_text, (
        r"(?:모델명|모델번호|MODEL(?:\s*NO\.?)?)\s*[:：]?\s*([A-Z0-9][A-Z0-9._/-]{3,})",
        r"(?m)^((?!R-R-)(?=[A-Z0-9._/-]*[A-Z])(?=[A-Z0-9._/-]*\d)[A-Z]{2,}[A-Z0-9._/]*-[A-Z0-9._/-]{2,})$",
    ))
    if not fields["modelNumber"]["value"] and model:
        fields["modelNumber"] = _field(model[0], model[1], confidence, "제품 라벨과 다시 비교해 주세요.")
    elif fields["modelNumber"]["value"]:
        fields["modelNumber"]["value"] = _normalize_identifier(fields["modelNumber"]["value"])

    if not fields["productName"]["value"]:
        inferred_name = _infer_product_name_before_model(lines, fields["modelNumber"]["value"])
        if inferred_name:
            fields["productName"] = _field(
                inferred_name[0], inferred_name[1], inferred_name[2],
                "상품명 항목이 흐려 모델번호 주변 문구에서 추정했습니다. 라벨과 비교해 주세요.",
            )

    certifications = []
    compact_raw_text = re.sub(r"\s+", "", raw_text)
    for pattern in (
        r"\b((?:XU|HU|JU|CB)\d{6,}-\d{4,})\b",
        r"\b(R-R-[A-Z0-9]{2,}-[A-Z0-9-]{2,})\b",
    ):
        certifications.extend(_normalize_identifier(match.group(1)) for match in re.finditer(pattern, compact_raw_text, re.IGNORECASE))
    certifications = list(dict.fromkeys(certifications))
    certifications.extend(_reconstruct_certifications(lines, fields["modelNumber"]["value"]))
    certifications = list(dict.fromkeys(certifications))
    fields["certificationNumbers"] = _field(certifications or None, " / ".join(certifications) or None, confidence)
    fields["certificationNumber"] = _field(certifications[0], certifications[0], confidence, "제품 라벨과 다시 비교해 주세요.") if certifications else _field()

    # 숫자 문자열은 제조번호일 수 있으므로 바코드라는 행이 명시된 경우에만 사용한다.
    barcode_row = _row_value(lines, ("바코드", "BARCODE"))
    barcode_value = _normalize_identifier(barcode_row[0]) if barcode_row else ""
    fields["barcode"] = _as_field(barcode_row, confidence) if re.fullmatch(r"\d{8,14}", barcode_value) else _field()
    if fields["barcode"]["value"]:
        fields["barcode"]["value"] = barcode_value

    if fields["serialNumber"]["value"]:
        fields["serialNumber"]["value"] = _normalize_identifier(fields["serialNumber"]["value"])
    return fields


def analyze_product_label(content: bytes, mime_type: str) -> tuple[str, dict, list[str]]:
    del mime_type
    quality = inspect_image(content)
    raw_text, confidence, lines = _extract_text(content)
    fields = _rule_fields(raw_text, confidence, lines)
    warnings = list(quality.warnings)
    if not raw_text:
        warnings.append("사진에서 글자를 찾지 못했습니다. 라벨을 가까이 촬영하거나 직접 입력해 주세요.")
    if not fields["modelNumber"]["value"] and not fields["certificationNumber"]["value"]:
        warnings.append("모델번호 또는 전체 인증번호를 확인하지 못했습니다.")
    warnings.append("분석 결과를 제품 라벨과 비교한 뒤 등록해 주세요.")
    return raw_text, fields, warnings
