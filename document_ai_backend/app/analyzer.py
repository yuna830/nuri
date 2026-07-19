import io
import re
from dataclasses import dataclass

from google.api_core.client_options import ClientOptions
from google.cloud import documentai
from PIL import Image, ImageStat

from app.config import settings


FIELD_PATTERNS = {
    "productName": [r"(?:제품명|품명)\s*[:：]?\s*([^\n]{2,40})"],
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


def _text_anchor(document, entity) -> str:
    anchor = entity.text_anchor
    parts = []
    for segment in anchor.text_segments:
        start = int(segment.start_index or 0)
        end = int(segment.end_index)
        parts.append(document.text[start:end])
    return "".join(parts).strip()


def _field(value=None, source_text=None, confidence=0.0, warning=None) -> dict:
    return {"value": value, "sourceText": source_text, "confidence": round(float(confidence), 4), "warning": warning}


def _entity_fields(document) -> dict:
    aliases = {
        "product_name": "productName", "productName": "productName",
        "manufacturer": "manufacturer", "brand": "manufacturer",
        "model_number": "modelNumber", "modelNumber": "modelNumber",
        "barcode": "barcode", "certification_number": "certificationNumber",
        "manufacturing_date": "manufacturingDate", "serial_number": "serialNumber", "lot_number": "lotNumber",
    }
    fields = {}
    for entity in document.entities:
        key = aliases.get(entity.type_)
        if key and key not in fields:
            source = _text_anchor(document, entity) or entity.mention_text
            fields[key] = _field(entity.normalized_value.text or entity.mention_text, source, entity.confidence)
    return fields


def _rule_fields(raw_text: str, fields: dict) -> dict:
    for key, patterns in FIELD_PATTERNS.items():
        if key in fields:
            continue
        for pattern in patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                value = "-".join(match.groups()) if key == "manufacturingDate" else match.group(1)
                fields[key] = _field(value.strip(), match.group(0).strip(), 0.72,
                                     "규칙 기반 추출 결과이므로 라벨과 다시 비교해 주세요.")
                break
    for key in ("productName", "manufacturer", "modelNumber", "barcode", "certificationNumber", "manufacturingDate", "serialNumber", "lotNumber"):
        fields.setdefault(key, _field())
    return fields


def analyze_product_label(content: bytes, mime_type: str) -> tuple[str, dict, list[str]]:
    quality = inspect_image(content)
    endpoint = f"{settings.google_cloud_location}-documentai.googleapis.com"
    client = documentai.DocumentProcessorServiceClient(
        client_options=ClientOptions(api_endpoint=endpoint)
    )
    processor_name = client.processor_path(
        settings.google_cloud_project,
        settings.google_cloud_location,
        settings.google_document_ai_processor_id,
    )
    result = client.process_document(request=documentai.ProcessRequest(
        name=processor_name,
        raw_document=documentai.RawDocument(content=content, mime_type=mime_type),
    ))
    raw_text = result.document.text or ""
    fields = _rule_fields(raw_text, _entity_fields(result.document))
    warnings = list(quality.warnings)
    if not fields["modelNumber"]["value"]:
        warnings.append("모델번호를 확인하지 못했습니다. 라벨을 보고 직접 입력해 주세요.")
    warnings.append("분석 결과를 제품 라벨과 비교한 뒤 등록해 주세요.")
    return raw_text, fields, warnings
