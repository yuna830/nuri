from app.services.embedding_cache_service import EmbeddingCacheService
from app.services.embedding_service import EmbeddingService
from app.services.eligibility_assessment_service import EligibilityAssessmentService
from app.services.groq_service import GroqService
from app.services.qdrant_service import QdrantService


class RagService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.cache_service = EmbeddingCacheService()
        self.qdrant_service = QdrantService()
        self.groq_service = GroqService()
        self.eligibility_assessment_service = EligibilityAssessmentService()

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

        if mode == "recommend" and profile:
            chunks = self.qdrant_service.get_chunks_by_document_ids([
                "obsidian_복지정책_노인맞춤돌봄서비스",
                "obsidian_복지정책_응급안전안심서비스",
                "obsidian_노인맞춤돌봄서비스",
                "obsidian_응급안전안심서비스",
                "welfare_energy_voucher_eligibility",
                "utility_electricity_discount_eligibility",
                "utility_gas_discount_eligibility",
            ])
            return self._build_assessment_response(question, profile, chunks)

        cached_vector = self.cache_service.get(retrieval_query)

        if cached_vector is not None:
            query_vector = cached_vector
        else:
            query_vector = self.embedding_service.embed_text(retrieval_query)
            self.cache_service.set(retrieval_query, query_vector)

        search_limit = max(limit, 12) if mode == "recommend" and profile else limit
        chunks = self.qdrant_service.hybrid_search_chunks(
            query_text=retrieval_query,
            query_vector=query_vector,
            limit=search_limit,
            vector_limit=max(search_limit * 3, 12),
            keyword_limit=max(search_limit * 3, 12),
        )

        if not chunks:
            return {
                "answer": "현재 자료만으로는 확인이 어렵습니다. 주민센터, 복지로 또는 담당 기관에서 확인이 필요합니다.",
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

        seen = set()
        unique_sources = []
        for chunk in chunks:
            key = chunk.get("document_id") or chunk.get("title") or chunk.get("service_name") or chunk.get("filename") or ""
            if key and key not in seen:
                seen.add(key)
                unique_sources.append({
                    **chunk,
                    "content": self._limit_text(chunk.get("content") or "", 300),
                })

        return {
            "answer": answer,
            "sources": unique_sources,
        }

    def _build_assessment_response(self, question: str, profile: dict, chunks: list[dict]) -> dict:
        assessment = self.eligibility_assessment_service.assess(
            question=question,
            profile=profile,
            chunks=chunks,
        )
        return {
            "answer": self.eligibility_assessment_service.format_answer(assessment),
            "sources": self.eligibility_assessment_service.sources(assessment),
            "assessment": assessment,
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
            self._join_list(profile.get("currentBenefits")),
            # diseases는 focus 없을 때만 추가 (아래 else 블록에서 처리)
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
        focus = self._detect_question_focus(question)

        if focus == "health":
            if "당뇨" in question:
                keywords.extend([
                    "방문건강관리",
                    "의료급여",
                    "재난적의료비지원",
                ])
            if "관절" in question:
                keywords.extend([
                    "노인 무릎 인공관절 수술 지원",
                    "방문건강관리",
                ])
            if "치매" in question:
                keywords.extend([
                    "치매안심센터",
                    "장기요양",
                    "방문건강관리",
                ])
            if "고혈압" in question:
                keywords.extend([
                    "방문건강관리",
                    "의료급여",
                ])

        elif focus == "income":
            keywords.extend([
                "기초생활보장",
                "생계급여",
                "의료급여",
                "주거급여",
                "차상위",
                "기초연금",
            ])

        elif focus == "care":
            keywords.extend([
                "노인맞춤돌봄서비스",
                "독거노인",
                "돌봄",
                "안부 확인",
                "응급안전안심서비스",
                "방문 지원",
                "장기요양보험",
            ])

        elif focus == "job":
            keywords.extend([
                "노인일자리",
                "공공근로",
                "취업지원",
                "사회활동 지원",
                "일자리 신청",
            ])

        elif focus == "disability":
            keywords.extend([
                "장애인연금",
                "장애수당",
                "장애인활동지원",
            ])

        else:
            # 초점 없을 때만 diseases 전체 포함
            keywords.append(self._join_list(profile.get("diseases")))

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

            if profile.get("livingAlone") is True or "독거" in profile_text or "혼자" in profile_text:
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
    
    

    _FOCUS_MAP = {
        "health": ["당뇨", "고혈압", "암", "관절", "뇌졸중", "신장", "간", "폐", "심장", "치매", "건강", "질환", "의료", "치료", "병원"],
        "income": ["소득", "생계", "기초생활", "수급", "기초연금", "연금", "급여", "저소득", "차상위"],
        "care":   ["돌봄", "독거", "요양", "장기요양", "방문", "안전", "안심"],
        "job":    ["일자리", "취업", "근무", "공공근로"],
        "disability": ["장애"],
    }

    def _detect_question_focus(self, question: str) -> str | None:
        normalized = question.replace(" ", "")
        for focus, keywords in self._FOCUS_MAP.items():
            if any(kw in normalized for kw in keywords):
                return focus
        return None

    def _value(self, profile: dict, key: str) -> str:
        value = profile.get(key)

        if value is None:
            return ""

        if value is True:
            return "예"

        if value is False:
            return "아니요"

        if str(value).upper() in ("NONE", "UNKNOWN"):
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
