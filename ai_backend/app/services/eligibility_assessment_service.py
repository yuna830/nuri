from dataclasses import dataclass
from typing import Callable


STATUS_LABELS = {
    "CONDITIONS_CONFIRMED": "조건 충족 확인",
    "REVIEW_POSSIBLE": "검토 가능",
    "INSUFFICIENT_INFORMATION": "정보 부족",
    "LOW_PRIORITY": "현재 정보상 가능성 낮음",
}


@dataclass(frozen=True)
class PolicyDefinition:
    service_id: str
    name: str
    aliases: tuple[str, ...]
    evaluator: str
    application_guide: str


POLICIES = (
    PolicyDefinition(
        "senior_custom_care",
        "노인맞춤돌봄서비스",
        ("노인맞춤돌봄", "맞춤돌봄서비스"),
        "senior_custom_care",
        "주소지 읍·면·동 행정복지센터 또는 수행기관에 확인합니다.",
    ),
    PolicyDefinition(
        "emergency_safety",
        "응급안전안심서비스",
        ("응급안전안심", "응급안전"),
        "emergency_safety",
        "주소지 행정복지센터 또는 지역센터에 확인합니다.",
    ),
    PolicyDefinition(
        "energy_voucher",
        "에너지바우처",
        ("에너지바우처",),
        "energy_voucher",
        "주소지 행정복지센터 또는 복지로에서 확인합니다.",
    ),
    PolicyDefinition(
        "electricity_discount",
        "전기요금 복지할인",
        ("전기요금 복지할인", "전기요금 감면", "전기요금 할인"),
        "utility_discount",
        "한국전력 고객센터 또는 한전ON에서 확인합니다.",
    ),
    PolicyDefinition(
        "gas_discount",
        "도시가스요금 경감",
        ("도시가스요금 경감", "도시가스 경감", "가스요금 경감"),
        "utility_discount",
        "지역 도시가스사 또는 행정복지센터에 확인합니다.",
    ),
)


class EligibilityAssessmentService:
    def assess(self, question: str, profile: dict, chunks: list[dict]) -> dict:
        grouped = self._group_documents(chunks)
        candidates = []
        explicitly_requested = [
            policy for policy in POLICIES
            if any(alias.replace(" ", "") in question.replace(" ", "") for alias in policy.aliases)
        ]
        policies = explicitly_requested or POLICIES

        for policy in policies:
            documents = self._matching_documents(policy, grouped)
            if not documents:
                continue
            evaluator: Callable = getattr(self, f"_evaluate_{policy.evaluator}")
            evaluation = evaluator(profile)
            source = self._source_from_document(documents[0])
            candidates.append({
                "serviceId": policy.service_id,
                "serviceName": policy.name,
                "status": evaluation["status"],
                "statusLabel": STATUS_LABELS[evaluation["status"]],
                "matchedConditions": evaluation["matched"],
                "missingConditions": evaluation["missing"],
                "conflictingConditions": evaluation["conflicting"],
                "decisionReason": evaluation["reason"],
                "applicationGuide": policy.application_guide,
                "sourceDocumentIds": [document["document_id"] for document in documents if document["document_id"]],
                "source": source,
            })

        candidates.sort(key=lambda item: self._status_rank(item["status"]))
        confirmed_count = sum(item["status"] == "CONDITIONS_CONFIRMED" for item in candidates)
        summary = (
            f"현재 등록 정보에서 주요 조건이 확인된 제도는 {confirmed_count}건입니다. 최종 신청 자격은 담당 기관 확인이 필요합니다."
            if confirmed_count
            else "현재 등록 정보만으로 신청 가능하다고 확정할 수 있는 제도는 없습니다."
        )

        return {
            "summary": summary,
            "profileFacts": self._profile_facts(profile),
            "candidates": candidates,
        }

    def format_answer(self, assessment: dict) -> str:
        lines = [assessment["summary"], "", "현재 확인된 정보"]
        for fact in assessment["profileFacts"]:
            lines.append(f"- {fact['label']}: {fact['value']}")

        candidates = assessment["candidates"]
        if not candidates:
            lines.extend(["", "현재 검색된 공식 문서에서 대상자 정보와 비교할 수 있는 제도를 찾지 못했습니다."])
        else:
            lines.extend(["", "검토 가능한 후보"])
            for index, candidate in enumerate(candidates, start=1):
                lines.extend(["", f"{index}. {candidate['serviceName']}", f"상태: {candidate['statusLabel']}"])
                if candidate["matchedConditions"]:
                    lines.append("확인된 조건")
                    lines.extend(f"- {condition}" for condition in candidate["matchedConditions"])
                if candidate["missingConditions"]:
                    lines.append("추가 확인이 필요한 조건")
                    lines.extend(f"- {condition}" for condition in candidate["missingConditions"])
                if candidate["conflictingConditions"]:
                    lines.append("현재 정보와 맞지 않는 조건")
                    lines.extend(f"- {condition}" for condition in candidate["conflictingConditions"])
                lines.append(f"현재 판단: {candidate['decisionReason']}")
                lines.append(f"확인 방법: {candidate['applicationGuide']}")

        lines.extend(["", "최종 대상 여부는 주민센터 또는 담당 복지기관의 확인이 필요합니다."])
        return "\n".join(lines)

    def sources(self, assessment: dict) -> list[dict]:
        sources = []
        seen = set()
        for candidate in assessment["candidates"]:
            source = candidate.get("source") or {}
            key = source.get("document_id") or source.get("title")
            if not key or key in seen:
                continue
            seen.add(key)
            sources.append(source)
        return sources

    def _evaluate_senior_custom_care(self, profile: dict) -> dict:
        matched, missing, conflicting = [], [], []
        age = self._age(profile)
        if age is not None and age >= 65:
            matched.append("만 65세 이상")
        elif age is None:
            missing.append("나이")
        else:
            conflicting.append("만 65세 이상 연령 조건")

        missing.extend(["기초생활수급·차상위·기초연금 수급 여부", "실제 돌봄 필요도", "유사 돌봄서비스 이용 여부", "지자체 선정 기준"])
        status = "LOW_PRIORITY" if conflicting else "INSUFFICIENT_INFORMATION"
        reason = "연령 정보만 확인됐고 핵심 선정 조건이 등록되지 않아 신청 가능 여부를 판단할 수 없습니다."
        return self._result(status, matched, missing, conflicting, reason)

    def _evaluate_emergency_safety(self, profile: dict) -> dict:
        matched, missing, conflicting = [], [], []
        if profile.get("livingAlone") is True:
            matched.append("독거 여부 확인")
        elif profile.get("livingAlone") is None:
            missing.append("독거 또는 보호 취약 여부")
        else:
            missing.append("독거 외 다른 대상 유형 해당 여부")

        missing.extend(["상시 보호 필요 여부", "응급 상황 또는 안전 위험 정보", "지자체 선정 기준"])
        reason = "현재 등록 정보에는 응급 상황 위험이나 상시 보호 필요 정보가 없어 우선 대상 여부를 판단할 수 없습니다."
        return self._result("INSUFFICIENT_INFORMATION", matched, missing, conflicting, reason)

    def _evaluate_energy_voucher(self, profile: dict) -> dict:
        matched, missing, conflicting = [], [], []
        benefits = self._known_text(profile.get("basicLivelihoodStatus"))
        if benefits:
            matched.append(f"기초생활보장 급여 정보: {benefits}")
        else:
            missing.append("생계·의료·주거·교육급여 수급 여부")
        if (self._age(profile) or 0) >= 65:
            matched.append("세대원 특성 중 만 65세 이상")
        else:
            missing.append("세대원 특성 기준")
        missing.extend(["세대 전체 수급 자격", "중복지원 및 제외 대상 여부"])
        status = "REVIEW_POSSIBLE" if benefits and len(matched) >= 2 else "INSUFFICIENT_INFORMATION"
        reason = "소득 기준과 세대원 특성 기준을 모두 확인해야 하므로 현재 정보만으로 확정할 수 없습니다."
        return self._result(status, matched, missing, conflicting, reason)

    def _evaluate_utility_discount(self, profile: dict) -> dict:
        matched, missing, conflicting = [], [], []
        benefits = self._known_text(profile.get("basicLivelihoodStatus"))
        disability = self._known_text(profile.get("disabilityStatus"))
        if benefits:
            matched.append(f"수급 정보: {benefits}")
        if disability:
            matched.append(f"장애 정보: {disability}")
        if not matched:
            missing.append("기초생활수급·차상위·장애·유공자 등 할인 자격")
        missing.extend(["계약자 또는 세대원 관계", "현재 할인 신청 여부"])
        status = "REVIEW_POSSIBLE" if matched else "INSUFFICIENT_INFORMATION"
        reason = "할인 자격과 계약 정보를 추가로 확인해야 합니다."
        return self._result(status, matched, missing, conflicting, reason)

    def _group_documents(self, chunks: list[dict]) -> dict[str, dict]:
        grouped = {}
        for chunk in chunks:
            document_id = str(chunk.get("document_id") or "").strip()
            title = self._clean_title(chunk.get("title") or chunk.get("service_name") or chunk.get("filename"))
            if not document_id or self._is_internal_title(title):
                continue
            document = grouped.setdefault(document_id, {"document_id": document_id, "title": title, "chunks": []})
            document["chunks"].append(chunk)
        return grouped

    def _matching_documents(self, policy: PolicyDefinition, grouped: dict) -> list[dict]:
        documents = [
            document for document in grouped.values()
            if any(alias.replace(" ", "") in document["title"].replace(" ", "") for alias in policy.aliases)
        ]
        return sorted(
            documents,
            key=lambda document: 0 if any(word in document["title"] for word in ("대상", "자격", "지원 조건")) else 1,
        )

    def _source_from_document(self, document: dict) -> dict:
        first = document["chunks"][0]
        return {
            "document_id": document["document_id"],
            "title": document["title"],
            "authority": first.get("authority") or first.get("department") or "",
            "effective_year": first.get("effective_year"),
            "source_url": first.get("source_url") or "",
            "content": self._evidence_summary(document["title"]),
        }

    def _profile_facts(self, profile: dict) -> list[dict]:
        age = self._age(profile)
        return [
            {"label": "나이", "value": f"{age}세" if age is not None else "미등록"},
            {"label": "거주 지역", "value": profile.get("region") or profile.get("address") or "미등록"},
            {"label": "독거 여부", "value": "예" if profile.get("livingAlone") is True else "아니요" if profile.get("livingAlone") is False else "미등록"},
            {"label": "소득 정보", "value": self._known_text(profile.get("incomeLevel")) or "미등록"},
            {"label": "수급 정보", "value": self._known_text(profile.get("basicLivelihoodStatus")) or "미등록"},
            {"label": "낙상·응급 위험 정보", "value": "미등록"},
        ]

    def _result(self, status, matched, missing, conflicting, reason):
        return {"status": status, "matched": matched, "missing": missing, "conflicting": conflicting, "reason": reason}

    def _age(self, profile):
        try:
            return int(profile.get("age"))
        except (TypeError, ValueError):
            return None

    def _known_text(self, value):
        text = str(value or "").strip()
        return "" if text.upper() in {"NONE", "UNKNOWN", "NULL"} else text

    def _status_rank(self, status):
        return {"CONDITIONS_CONFIRMED": 0, "REVIEW_POSSIBLE": 1, "INSUFFICIENT_INFORMATION": 2, "LOW_PRIORITY": 3}.get(status, 9)

    def _clean_title(self, value):
        return str(value or "").strip().strip('"\'').removesuffix(".md").replace("_", " ")

    def _is_internal_title(self, title):
        return title.lower().replace(" ", "_") in {"current_upload", "woori-vault", "obsidian", "복지_문서"}

    def _evidence_summary(self, title):
        return f"{title}의 대상 기준 및 신청 안내"
