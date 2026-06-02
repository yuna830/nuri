from app.services.embedding_cache_service import EmbeddingCacheService
from app.services.embedding_service import EmbeddingService
from app.services.groq_service import GroqService
from app.services.qdrant_service import QdrantService


class RagService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.cache_service = EmbeddingCacheService()
        self.qdrant_service = QdrantService()
        self.groq_service = GroqService()

    def ask(
        self,
        question: str,
        mode: str = "qa",
        audience: str = "worker",
        profile: dict | None = None,
        history: list[dict] | None = None,
        limit: int = 5,
        search_query: str | None = None,
    ) -> dict:
        retrieval_query = (search_query or self._build_retrieval_query(question, mode, profile)).strip()
        cached_vector = self.cache_service.get(retrieval_query)

        if cached_vector is not None:
            query_vector = cached_vector
        else:
            query_vector = self.embedding_service.embed_text(retrieval_query)
            self.cache_service.set(retrieval_query, query_vector)

        chunks = self.qdrant_service.search_chunks(
            query_vector=query_vector,
            limit=limit,
        )

        if not chunks:
            return {
                "answer": "제공된 자료에서 확인하지 못했습니다.",
                "sources": [],
            }

        answer = self.groq_service.answer(
            question=question,
            mode=mode,
            audience=audience,
            profile=profile,
            history=history or [],
            context_chunks=chunks,
        )

        return {
            "answer": answer,
            "sources": [
                {
                    **chunk,
                    "content": self._limit_text(chunk.get("content") or "", 300),
                }
                for chunk in chunks
            ],
        }

    def _build_retrieval_query(
        self,
        question: str,
        mode: str,
        profile: dict | None,
    ) -> str:
        if mode != "recommend" or not profile:
            return question

        keywords = [
            question,
            self._value(profile, "age"),
            self._value(profile, "gender"),
            self._value(profile, "region"),
            self._value(profile, "address"),
            self._value(profile, "incomeLevel"),
            self._value(profile, "householdType"),
            self._value(profile, "livingAlone"),
            self._value(profile, "medicationInfo"),
            self._value(profile, "basicLivelihoodStatus"),
            self._value(profile, "nearPovertyStatus"),
            self._value(profile, "disabilityStatus"),
            self._value(profile, "longTermCareGrade"),
            self._value(profile, "jobRequestStatus"),
            self._value(profile, "welfareMemo"),
            self._join_list(profile.get("diseases")),
            self._join_list(profile.get("currentBenefits")),
        ]

        for job in profile.get("jobApplications") or []:
            if not isinstance(job, dict):
                continue

            keywords.extend([
                self._value(job, "jobTitle"),
                self._value(job, "organization"),
                self._value(job, "status"),
                self._value(job, "location"),
                self._value(job, "requestedAt"),
                self._value(job, "applicationType"),
            ])

            status = self._value(job, "status")
            if status:
                keywords.append(f"일자리 신청 상태 {status}")

            title = self._value(job, "jobTitle")
            if title:
                keywords.append(f"신청 일자리 {title}")

        age = self._to_int(profile.get("age"))
        profile_text = " ".join(str(value) for value in keywords if value)

        if age >= 65:
            keywords.extend([
                "노인 복지",
                "기초연금",
                "노인맞춤돌봄서비스",
                "노인일자리",
                "장기요양보험",
                "응급안전안심서비스",
                "방문건강관리",
            ])

        if "독거" in profile_text or "혼자" in profile_text or self._value(profile, "livingAlone") in ("예", "true", "True", "1"):
            keywords.extend([
                "독거노인",
                "돌봄",
                "안부 확인",
                "응급안전",
                "방문 지원",
                "노인맞춤돌봄서비스",
            ])

        if "치매" in profile_text:
            keywords.extend([
                "치매안심센터",
                "장기요양",
                "방문건강관리",
                "노인맞춤돌봄서비스",
            ])

        if "당뇨" in profile_text or "관절" in profile_text or "질환" in profile_text:
            keywords.extend([
                "방문건강관리",
                "의료급여",
                "재난적의료비지원",
                "노인 무릎 인공관절 수술 지원",
            ])

        if "없음" in profile_text or "저소득" in profile_text or "기초생활" in profile_text or "수급" in profile_text:
            keywords.extend([
                "기초생활보장",
                "생계급여",
                "의료급여",
                "주거급여",
                "차상위",
                "기초연금",
            ])

        if "장애" in profile_text:
            keywords.extend([
                "장애인연금",
                "장애수당",
                "장애인활동지원",
            ])

        if "일자리" in question or "취업" in question or "근무" in question:
            keywords.extend([
                "노인일자리",
                "공공근로",
                "취업지원",
                "사회활동 지원",
                "일자리 신청",
            ])

        return " ".join(str(value) for value in keywords if value)

    def _value(self, profile: dict, key: str) -> str:
        value = profile.get(key)

        if value is None:
            return ""

        return str(value).strip()

    def _join_list(self, value) -> str:
        if not isinstance(value, list):
            return ""

        return " ".join(str(item).strip() for item in value if str(item).strip())

    def _to_int(self, value) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."
