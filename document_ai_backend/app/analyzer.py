import io
import re
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from paddleocr import PaddleOCR
from PIL import Image, ImageStat


FIELD_PATTERNS = {
    "productName": [r"(?:제품명|품명)\s*[:：]?\s*([^\n]{2,40})"],
    "brandName": [r"(?:브랜드명|브랜드|상표명)\s*[:：]?\s*([^\n]{2,40})"],
    "manufacturer": [r"(?:제조사|제조자|제조원|수입자)\s*[:：]?\s*([^\n]{2,50})"],
    "modelNumber": [r"(?:모델명|모델번호|MODEL\s*(?:NO\.?)?)\s*[:：]?\s*([A-Z0-9][A-Z0-9._/-]{3,})"],
    "certificationNumber": [r"(?:안전인증번호|KC)\s*[:：]?\s*([A-Z0-9][A-Z0-9-]{5,})", r"(R-R-[A-Z0-9-]+)"],
    "manufacturingDate": [r"(?:제조년월|제조일|생산일)\s*[:：]?\s*(20\d{2})[.년/-]\s*(0?[1-9]|1[0-2])"],
    "barcode": [r"(?<!\d)(\d{8,14})(?!\d)"],
    "serialNumber": [r"(?:일련번호|SERIAL\s*(?:NO\.?)?|S/N)\s*[:：]?\s*([A-Z0-9][A-Z0-9._/-]{3,})"],
    "lotNumber": [r"(?:LOT\s*(?:NO\.?)?|로트번호)\s*[:：]?\s*([A-Z0-9][A-Z0-9._/-]{2,})"],
}


@dataclass
class QualityResult:
    warnings: list[str]


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


def _extract_text(content: bytes) -> tuple[str, float]:
    image = np.array(Image.open(io.BytesIO(content)).convert("RGB"))
    result = _ocr().ocr(image, cls=True)
    texts = []
    confidences = []
    for page in result or []:
        for line in page or []:
            if not line or len(line) < 2:
                continue
            text, confidence = line[1]
            if text:
                texts.append(str(text).strip())
                confidences.append(float(confidence))
    average = sum(confidences) / len(confidences) if confidences else 0.0
    return "\n".join(texts), average


def _field(value=None, source_text=None, confidence=0.0, warning=None) -> dict:
    return {"value": value, "sourceText": source_text, "confidence": round(float(confidence), 4), "warning": warning}


def _rule_fields(raw_text: str, confidence: float) -> dict:
    fields = {}
    for key, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                value = "-".join(match.groups()) if key == "manufacturingDate" else match.group(1)
                fields[key] = _field(
                    value.strip(), match.group(0).strip(), confidence,
                    "OCR 추출 결과이므로 라벨과 다시 비교해 주세요.",
                )
                break
    for key in FIELD_PATTERNS:
        fields.setdefault(key, _field())
    return fields


def analyze_product_label(content: bytes, mime_type: str) -> tuple[str, dict, list[str]]:
    del mime_type
    quality = inspect_image(content)
    raw_text, confidence = _extract_text(content)
    fields = _rule_fields(raw_text, confidence)
    warnings = list(quality.warnings)
    if not raw_text:
        warnings.append("사진에서 글자를 찾지 못했습니다. 직접 입력하거나 다시 촬영해 주세요.")
    if not fields["modelNumber"]["value"]:
        warnings.append("모델번호를 확인하지 못했습니다. 라벨을 보고 직접 입력해 주세요.")
    warnings.append("분석 결과를 제품 라벨과 비교한 뒤 등록해 주세요.")
    return raw_text, fields, warnings
