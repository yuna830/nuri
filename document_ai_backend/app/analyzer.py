import io
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from google.cloud import vision
from google.oauth2 import service_account
from PIL import Image, ImageStat

from app.config import settings


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
    """이미지 품질을 간단히 확인한다."""
    image = Image.open(io.BytesIO(content)).convert("L")
    warnings: list[str] = []

    # 680×668 정도의 사진은 충분히 OCR 가능하므로
    # 가로 크기 하나만으로 저해상도 판정하지 않는다.
    if image.width * image.height < 250_000:
        warnings.append(
            "이미지 해상도가 낮습니다. 제품 라벨을 더 가까이 촬영해 주세요."
        )

    stat = ImageStat.Stat(image)

    if stat.mean[0] < 45:
        warnings.append(
            "사진이 너무 어둡습니다. 밝은 곳에서 다시 촬영해 주세요."
        )

    if stat.mean[0] > 225:
        warnings.append(
            "빛 반사가 강할 수 있습니다. 촬영 각도를 바꿔 주세요."
        )

    if stat.var[0] < 180:
        warnings.append(
            "글자가 흐리거나 대비가 낮습니다. 초점을 맞춰 다시 촬영해 주세요."
        )

    return QualityResult(warnings)


@lru_cache(maxsize=1)
def _vision_client() -> vision.ImageAnnotatorClient:
    """
    GOOGLE_APPLICATION_CREDENTIALS가 가리키는 서비스 계정으로
    Google Cloud Vision 클라이언트를 생성한다.
    """
    credentials_path = settings.google_application_credentials
    if not credentials_path:
        return vision.ImageAnnotatorClient()

    path = Path(credentials_path).expanduser()
    if not path.is_absolute():
        path = (Path(__file__).resolve().parents[1] / path).resolve()
    if not path.is_file():
        raise RuntimeError(
            f"Google Cloud Vision credential file was not found: {path}"
        )

    credentials = service_account.Credentials.from_service_account_file(str(path))
    return vision.ImageAnnotatorClient(credentials=credentials)


def _group_words_into_lines(
    words: list[OcrLine],
) -> list[OcrLine]:
    """Vision의 단어 좌표를 기준으로 한 행씩 결합한다."""
    if not words:
        return []

    words = sorted(
        words,
        key=lambda item: (
            item.center_y,
            item.left,
        ),
    )

    rows: list[list[OcrLine]] = []

    for word in words:
        matched_row: list[OcrLine] | None = None

        for row in rows:
            row_center = (
                sum(item.center_y for item in row)
                / len(row)
            )

            row_height = max(
                sum(item.height for item in row)
                / len(row),
                1,
            )

            tolerance = max(
                row_height * 0.65,
                word.height * 0.65,
                8,
            )

            if abs(word.center_y - row_center) <= tolerance:
                matched_row = row
                break

        if matched_row is None:
            rows.append([word])
        else:
            matched_row.append(word)

    lines: list[OcrLine] = []

    for row in rows:
        row.sort(
            key=lambda item: item.left
        )

        text = " ".join(
            item.text
            for item in row
            if item.text
        ).strip()

        if not text:
            continue

        confidence_values = [
            item.confidence
            for item in row
            if item.confidence > 0
        ]

        confidence = (
            sum(confidence_values)
            / len(confidence_values)
            if confidence_values
            else 0.0
        )

        lines.append(
            OcrLine(
                text=text,
                confidence=confidence,
                left=min(
                    item.left
                    for item in row
                ),
                right=max(
                    item.right
                    for item in row
                ),
                top=min(
                    item.top
                    for item in row
                ),
                bottom=max(
                    item.bottom
                    for item in row
                ),
            )
        )

    lines.sort(
        key=lambda item: (
            item.center_y,
            item.left,
        )
    )

    return lines


def _extract_text(
    content: bytes,
) -> tuple[str, float, list[OcrLine]]:
    """
    Google Cloud Vision TEXT_DETECTION으로
    전체 텍스트와 단어 위치를 추출한다.
    """
    client = _vision_client()

    response = client.text_detection(
        image=vision.Image(
            content=content
        ),
        image_context=vision.ImageContext(
            language_hints=[
                "ko",
                "en",
            ],
        ),
    )

    if response.error.message:
        raise RuntimeError(
            response.error.message
        )

    raw_text = ""

    if response.full_text_annotation:
        raw_text = (
            response.full_text_annotation.text
            or ""
        ).strip()

    if (
        not raw_text
        and response.text_annotations
    ):
        raw_text = (
            response
            .text_annotations[0]
            .description
            or ""
        ).strip()

    words: list[OcrLine] = []

    for annotation in response.text_annotations[1:]:
        text = (
            annotation.description
            or ""
        ).strip()

        if not text:
            continue

        vertices = list(
            annotation
            .bounding_poly
            .vertices
            or []
        )

        xs = [
            float(vertex.x or 0)
            for vertex in vertices
        ]

        ys = [
            float(vertex.y or 0)
            for vertex in vertices
        ]

        if not xs or not ys:
            continue

        words.append(
            OcrLine(
                text=text,
                # TEXT_DETECTION에서는 단어 신뢰도가
                # 별도로 제공되지 않을 수 있다.
                confidence=0.0,
                left=min(xs),
                right=max(xs),
                top=min(ys),
                bottom=max(ys),
            )
        )

    lines = _group_words_into_lines(
        words
    )

    return raw_text, 0.0, lines


def _field(
    value=None,
    source_text=None,
    confidence: float = 0.0,
    warning=None,
) -> dict:
    return {
        "value": value,
        "sourceText": source_text,
        "confidence": round(
            float(confidence),
            4,
        ),
        "warning": warning,
    }


def _normalize_identifier(
    value: str,
) -> str:
    """모델번호·인증번호의 불필요한 공백을 제거한다."""
    return (
        re.sub(
            r"\s+",
            "",
            value,
        )
        .upper()
        .strip(".,:;")
    )


def _clean_value(
    value: str,
) -> str:
    """일반 텍스트 값의 앞뒤 구분 문자를 제거한다."""
    return value.strip().strip(
        ":：|·- "
    )


def _compact(
    value: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        value,
    ).lower()


def _row_value(
    lines: list[OcrLine],
    labels: tuple[str, ...],
) -> tuple[str, str, float] | None:
    """
    같은 행에 위치한 라벨과 값을 추출한다.

    예:
    모델명 STH-600G
    """
    normalized_labels = tuple(
        _compact(label)
        for label in labels
    )

    for label_line in lines:
        compact_text = _compact(
            label_line.text
        )

        matched_index = next(
            (
                index
                for index, label
                in enumerate(
                    normalized_labels
                )
                if label in compact_text
            ),
            None,
        )

        if matched_index is None:
            continue

        original_label = labels[
            matched_index
        ]

        inline_match = re.search(
            (
                rf"{re.escape(original_label)}"
                r"\s*[:：]?\s*(.+)$"
            ),
            label_line.text,
            flags=re.IGNORECASE,
        )

        if inline_match:
            inline_value = _clean_value(
                inline_match.group(1)
            )

            if inline_value:
                return (
                    inline_value,
                    label_line.text,
                    label_line.confidence,
                )

        tolerance = max(
            label_line.height * 0.9,
            8,
        )

        candidates = [
            line
            for line in lines
            if (
                line is not label_line
                and line.left
                >= label_line.right - 3
                and abs(
                    line.center_y
                    - label_line.center_y
                )
                <= tolerance
            )
        ]

        if candidates:
            candidates.sort(
                key=lambda item: item.left
            )

            value = _clean_value(
                " ".join(
                    item.text
                    for item in candidates
                )
            )

            if value:
                confidence_values = [
                    item.confidence
                    for item
                    in [
                        label_line,
                        *candidates,
                    ]
                    if item.confidence > 0
                ]

                confidence = (
                    min(confidence_values)
                    if confidence_values
                    else 0.0
                )

                return (
                    value,
                    (
                        f"{label_line.text} "
                        f"{value}"
                    ),
                    confidence,
                )

    return None


def _fallback_labeled_value(
    lines: list[OcrLine],
    labels: tuple[str, ...],
) -> tuple[str, str, float] | None:
    """
    표의 라벨과 값 좌표가 어긋난 경우
    같은 행 또는 다음 OCR 문구를 이용한다.
    """
    normalized_labels = tuple(
        _compact(label)
        for label in labels
    )

    all_known_labels = tuple(
        _compact(label)
        for label in (
            "인증번호",
            "상품명",
            "품명",
            "제품명",
            "모델명",
            "모델번호",
            "배터리",
            "제조연월",
            "제조년월",
            "제조국",
            "수입원",
            "공급원",
            "판매원",
            "고객센터",
            "품질보증기간",
            "제조번호",
            "브랜드",
        )
    )

    for index, label_line in enumerate(
        lines
    ):
        compact_text = _compact(
            label_line.text
        )

        if not any(
            label in compact_text
            for label in normalized_labels
        ):
            continue

        tolerance = max(
            label_line.height * 1.35,
            12,
        )

        same_row = sorted(
            (
                line
                for line in lines
                if (
                    line is not label_line
                    and line.left
                    > label_line.left
                    and abs(
                        line.center_y
                        - label_line.center_y
                    )
                    <= tolerance
                )
            ),
            key=lambda item: item.left,
        )

        if same_row:
            value = _clean_value(
                " ".join(
                    item.text
                    for item in same_row
                )
            )

            if value:
                return (
                    value,
                    (
                        f"{label_line.text} "
                        f"{value}"
                    ),
                    0.0,
                )

        if index + 1 >= len(lines):
            continue

        next_line = lines[index + 1]
        next_compact = _compact(
            next_line.text
        )

        if any(
            label in next_compact
            for label in all_known_labels
        ):
            continue

        value = _clean_value(
            next_line.text
        )

        if value:
            return (
                value,
                (
                    f"{label_line.text} "
                    f"{next_line.text}"
                ),
                0.0,
            )

    return None


def _match_identifier(
    raw_text: str,
    patterns: tuple[str, ...],
) -> tuple[str, str] | None:
    for pattern in patterns:
        match = re.search(
            pattern,
            raw_text,
            flags=(
                re.IGNORECASE
                | re.MULTILINE
            ),
        )

        if match:
            return (
                _normalize_identifier(
                    match.group(1)
                ),
                match.group(0).strip(),
            )

    return None


def _match_general_value(
    raw_text: str,
    patterns: tuple[str, ...],
) -> tuple[str, str] | None:
    for pattern in patterns:
        match = re.search(
            pattern,
            raw_text,
            flags=(
                re.IGNORECASE
                | re.MULTILINE
            ),
        )

        if match:
            return (
                _clean_value(
                    match.group(1)
                ),
                match.group(0).strip(),
            )

    return None


def _extract_certifications(
    raw_text: str,
) -> list[str]:
    """
    OCR 전체 텍스트에서 KC 및 방송통신 기자재 인증번호를 찾는다.

    예:
    XU104036-25001
    HU071234-24001
    R-R-MMC-STH-600G
    """
    # 줄바꿈은 유지하고 인증번호 내부의 불필요한 공백만 허용한다.
    normalized_text = raw_text.upper()

    results: list[str] = []

    patterns = (
        # XU104036-25001
        r"(?<![A-Z0-9])"
        r"((?:XU|HU|JU|CB)\s*\d{6,}\s*-\s*\d{4,6})",

        # R-R-MMC-STH-600G
        r"(?<![A-Z0-9])"
        r"(R\s*-\s*R\s*-\s*[A-Z0-9]+\s*-\s*[A-Z0-9-]+)",
    )

    for pattern in patterns:
        for match in re.finditer(
            pattern,
            normalized_text,
            flags=re.IGNORECASE,
        ):
            results.append(
                _normalize_identifier(
                    match.group(1)
                )
            )

    return list(
        dict.fromkeys(results)
    )

def _extract_serial_number(
    raw_text: str,
) -> tuple[str, str] | None:
    """
    제품 라벨의 제조번호 또는 일련번호를 찾는다.

    표 OCR 순서가 뒤섞여 라벨과 값이 떨어져 있어도
    숫자 후보 중 제조번호로 적절한 값을 선택한다.
    """
    direct_patterns = (
        r"(?:제조번호|일련번호|시리얼번호|SERIAL\s*NO|S/N)"
        r"\s*[:：]?\s*(\d{8,14})",
    )

    for pattern in direct_patterns:
        match = re.search(
            pattern,
            raw_text,
            flags=re.IGNORECASE,
        )

        if match:
            return (
                match.group(1),
                match.group(0).strip(),
            )

    numeric_candidates = re.findall(
        r"(?<!\d)(\d{8,14})(?!\d)",
        raw_text,
    )

    excluded_numbers = {
        # 전화번호와 같이 제조번호가 아닌 숫자를 제외
        re.sub(r"\D", "", value)
        for value in re.findall(
            r"\d{2,4}[-\s]\d{3,4}[-\s]\d{4}",
            raw_text,
        )
    }

    candidates = [
        value
        for value in numeric_candidates
        if value not in excluded_numbers
    ]

    if not candidates:
        return None

    # 제조번호는 라벨 하단 또는 OCR 결과 끝부분에 있는 경우가 많다.
    selected = candidates[-1]

    return (
        selected,
        selected,
    )


def _infer_product_name_before_model(
    lines: list[OcrLine],
    model_number: str | None,
) -> tuple[str, str, float] | None:
    """
    상품명이 직접 추출되지 않으면
    모델번호 앞의 한글 문구를 후보로 사용한다.
    """
    model_index = next(
        (
            index
            for index, line
            in enumerate(lines)
            if (
                model_number
                and _normalize_identifier(
                    line.text
                )
                == model_number
            )
        ),
        None,
    )

    if model_index is None:
        return None

    excluded = (
        "인증",
        "모델",
        "제조",
        "수입",
        "공급",
        "판매",
        "고객",
        "품질",
        "중국",
        "주식회사",
    )

    candidates: list[
        tuple[float, OcrLine]
    ] = []

    start_index = max(
        0,
        model_index - 7,
    )

    for line in lines[
        start_index:model_index
    ]:
        text = _clean_value(
            line.text
        )

        korean_count = len(
            re.findall(
                r"[가-힣]",
                text,
            )
        )

        if korean_count < 3:
            continue

        if any(
            word in text
            for word in excluded
        ):
            continue

        if re.fullmatch(
            r"[가-힣]{1,3}",
            text,
        ):
            continue

        score = (
            korean_count
            + min(
                len(text),
                20,
            )
            / 20
        )

        candidates.append(
            (
                score,
                line,
            )
        )

    if not candidates:
        return None

    selected = max(
        candidates,
        key=lambda item: item[0],
    )[1]

    return (
        _clean_value(
            selected.text
        ),
        selected.text,
        selected.confidence,
    )


def _as_field(
    result: tuple[str, str, float] | None,
    default_confidence: float,
) -> dict:
    if not result:
        return _field()

    value, source, confidence = result

    return _field(
        value=_normalize_display_value(value),
        source_text=source,
        confidence=confidence or default_confidence,
        warning="제품 라벨과 다시 비교해 주세요.",
    )


def _rule_fields(
    raw_text: str,
    confidence: float,
    lines: list[OcrLine],
) -> dict:
    fields = {
        "productName": _as_field(
            _row_value(
                lines,
                (
                    "상품명",
                    "품명",
                    "제품명",
                ),
            ),
            confidence,
        ),
        "brandName": _as_field(
            _row_value(
                lines,
                (
                    "브랜드",
                    "상표명",
                    "상표",
                    "BRAND",
                ),
            ),
            confidence,
        ),
        "manufacturer": _as_field(
            _row_value(
                lines,
                (
                    "제조원",
                    "제조자",
                    "제조사",
                ),
            ),
            confidence,
        ),
        "importer": _as_field(
            _row_value(
                lines,
                (
                    "수입원",
                    "수입자",
                ),
            ),
            confidence,
        ),
        "supplier": _as_field(
            _row_value(
                lines,
                (
                    "공급원",
                    "공급자",
                ),
            ),
            confidence,
        ),
        "modelNumber": _as_field(
            _row_value(
                lines,
                (
                    "모델명",
                    "모델번호",
                    "MODEL NO",
                    "MODEL",
                ),
            ),
            confidence,
        ),
        "serialNumber": _as_field(
            _row_value(
                lines,
                (
                    "제조번호",
                    "일련번호",
                    "시리얼번호",
                    "SERIAL NO",
                    "S/N",
                ),
            ),
            confidence,
        ),
        "lotNumber": _as_field(
            _row_value(
                lines,
                (
                    "로트번호",
                    "LOT NO",
                    "LOT",
                ),
            ),
            confidence,
        ),
        "manufacturingDate": _as_field(
            _row_value(
                lines,
                (
                    "제조연월",
                    "제조년월",
                    "제조일자",
                    "생산일",
                ),
            ),
            confidence,
        ),
    }

    # 상품명 좌표 추출 실패 시 보완
    if not fields[
        "productName"
    ]["value"]:
        product_name = (
            _fallback_labeled_value(
                lines,
                (
                    "상품명",
                    "품명",
                    "제품명",
                ),
            )
        )

        if product_name:
            fields[
                "productName"
            ] = _as_field(
                product_name,
                confidence,
            )

    # 모델번호 전체 문자열 검색
    model = _match_identifier(
        raw_text,
        (
            (
                r"(?:모델명|모델번호|"
                r"MODEL(?:\s*NO\.?)?)"
                r"\s*[:：]?\s*"
                r"([A-Z0-9]"
                r"[A-Z0-9._/-]{3,})"
            ),
            (
                r"(?m)^"
                r"((?!R-R-)"
                r"(?=[A-Z0-9._/-]*[A-Z])"
                r"(?=[A-Z0-9._/-]*\d)"
                r"[A-Z]{2,}"
                r"[A-Z0-9._/]*-"
                r"[A-Z0-9._/-]{2,})"
                r"$"
            ),
        ),
    )

    if (
        not fields[
            "modelNumber"
        ]["value"]
        and model
    ):
        fields[
            "modelNumber"
        ] = _field(
            value=model[0],
            source_text=model[1],
            confidence=confidence,
            warning=(
                "제품 라벨과 다시 "
                "비교해 주세요."
            ),
        )

    elif fields[
        "modelNumber"
    ]["value"]:
        fields[
            "modelNumber"
        ]["value"] = (
            _normalize_identifier(
                fields[
                    "modelNumber"
                ]["value"]
            )
        )

    # 상품명이 없으면 모델번호 주변 문구 사용
    if not fields[
        "productName"
    ]["value"]:
        inferred_name = (
            _infer_product_name_before_model(
                lines,
                fields[
                    "modelNumber"
                ]["value"],
            )
        )

        if inferred_name:
            fields[
                "productName"
            ] = _field(
                value=inferred_name[0],
                source_text=inferred_name[1],
                confidence=inferred_name[2],
                warning=(
                    "상품명 항목이 흐려 "
                    "모델번호 주변 문구에서 "
                    "추정했습니다. "
                    "라벨과 비교해 주세요."
                ),
            )

    # 제조연월 전체 문자열 검색
    if not fields["manufacturingDate"]["value"]:
        manufacturing_date = _match_general_value(
            raw_text,
            (
                r"\b(20\d{2}\s*년\s*(?:1[0-2]|[1-9])\s*월)\b",
                r"\b(20\d{2}[./-](?:1[0-2]|0?[1-9]))\b",
            ),
        )

        if manufacturing_date:
            normalized_date = re.sub(
                r"\s+",
                " ",
                manufacturing_date[0],
            )

            fields["manufacturingDate"] = _field(
                value=normalized_date,
                source_text=manufacturing_date[1],
                confidence=confidence,
                warning="제품 라벨과 다시 비교해 주세요.",
            )


    # 제조번호 전체 문자열 검색
    # 제조연월 추출 여부와 관계없이 항상 별도로 실행해야 함
    if not fields["serialNumber"]["value"]:
        serial_number = _extract_serial_number(
            raw_text
        )

        if serial_number:
            fields["serialNumber"] = _field(
                value=serial_number[0],
                source_text=serial_number[1],
                confidence=confidence,
                warning="제품 라벨과 다시 비교해 주세요.",
            )

        if manufacturing_date:
            normalized_date = re.sub(
                r"\s+",
                " ",
                manufacturing_date[0],
            )

            fields[
                "manufacturingDate"
            ] = _field(
                value=normalized_date,
                source_text=(
                    manufacturing_date[1]
                ),
                confidence=confidence,
                warning=(
                    "제품 라벨과 다시 "
                    "비교해 주세요."
                ),
            )

    # 인증번호 전체 문자열 검색
    certifications = (
        _extract_certifications(
            raw_text
        )
    )

    fields[
        "certificationNumbers"
    ] = _field(
        value=(
            certifications
            or None
        ),
        source_text=(
            " / ".join(
                certifications
            )
            or None
        ),
        confidence=confidence,
        warning=(
            "제품 라벨과 다시 "
            "비교해 주세요."
            if certifications
            else None
        ),
    )

    fields[
        "certificationNumber"
    ] = (
        _field(
            value=certifications[0],
            source_text=certifications[0],
            confidence=confidence,
            warning=(
                "제품 라벨과 다시 "
                "비교해 주세요."
            ),
        )
        if certifications
        else _field()
    )

    # 바코드는 바코드 라벨이 있을 때만 사용
    barcode_row = _row_value(
        lines,
        (
            "바코드",
            "BARCODE",
        ),
    )

    barcode_value = (
        _normalize_identifier(
            barcode_row[0]
        )
        if barcode_row
        else ""
    )

    fields["barcode"] = (
        _as_field(
            barcode_row,
            confidence,
        )
        if re.fullmatch(
            r"\d{8,14}",
            barcode_value,
        )
        else _field()
    )

    if fields[
        "barcode"
    ]["value"]:
        fields[
            "barcode"
        ]["value"] = barcode_value

    if fields[
        "serialNumber"
    ]["value"]:
        fields[
            "serialNumber"
        ]["value"] = (
            _normalize_identifier(
                fields[
                    "serialNumber"
                ]["value"]
            )
        )

    return fields


def analyze_product_label(
    content: bytes,
    mime_type: str,
) -> tuple[
    str,
    dict,
    list[str],
]:
    """
    제품 라벨 이미지를 분석한다.

    반환값:
    raw_text
    fields
    warnings
    """
    del mime_type

    quality = inspect_image(
        content
    )

    raw_text, confidence, lines = (
        _extract_text(
            content
        )
    )

    fields = _rule_fields(
        raw_text,
        confidence,
        lines,
    )

    warnings = list(
        quality.warnings
    )

    if not raw_text.strip():
        warnings.append(
            "사진에서 글자를 찾지 못했습니다. "
            "라벨을 가까이 촬영하거나 "
            "직접 입력해 주세요."
        )

    if (
        not fields[
            "modelNumber"
        ]["value"]
        and not fields[
            "certificationNumber"
        ]["value"]
    ):
        warnings.append(
            "모델번호 또는 전체 인증번호를 "
            "확인하지 못했습니다."
        )

    warnings.append(
        "분석 결과를 제품 라벨과 "
        "비교한 뒤 등록해 주세요."
    )

    return (
        raw_text,
        fields,
        warnings,
    )

def _normalize_display_value(
    value: str,
) -> str:
    """
    OCR이 한글과 괄호 사이에 삽입한 불필요한 공백을 정리한다.
    """
    normalized = re.sub(
        r"\s+",
        " ",
        value,
    ).strip()

    normalized = re.sub(
        r"\(\s*주\s*\)",
        "(주)",
        normalized,
    )

    normalized = re.sub(
        r"\s*_\s*",
        "_",
        normalized,
    )

    normalized = re.sub(
        r"\s*\+\s*",
        "+",
        normalized,
    )

    normalized = re.sub(
        r"(?<=[가-힣])\s+(?=[가-힣])",
        "",
        normalized,
    )

    return normalized
