from langchain_groq import ChatGroq

from app.core.config import settings


class GroqService:
    def __init__(self):
        self.llm = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.1,
            max_tokens=700,
        )

    def answer(
        self,
        question: str,
        context_chunks: list[dict],
        mode: str = "qa",
        audience: str = "worker",
        profile: dict | None = None,
        history: list[dict] | None = None,
    ) -> str:
        context = self._build_context(context_chunks)
        profile_text = self._build_profile_text(profile)
        history_text = self._build_history_text(history or [])
        rules = self._build_rules(mode, audience)

        prompt = f"""
            너는 한국 복지 제도를 설명하는 RAG 상담 도우미다.
            반드시 제공된 문서 근거 안에서만 답한다.
            문서에 없는 내용은 추측하지 말고 "제공된 자료에서 확인하지 못했습니다."라고 말한다.
            답변은 반드시 한국어로 작성한다.

            {rules}

            [대상자 정보]
            {profile_text}

            [최근 대화]
            {history_text}

            [검색된 복지 문서]
            {context}

            [사용자 질문]
            {question}
            """

        response = self.llm.invoke(prompt)
        return response.content.strip()

    def _build_rules(self, mode: str, audience: str) -> str:
        audience_rules = {
            "guardian": """
            [대상 독자]
            - 보호자가 이해하기 쉽게 쉬운 말로 설명한다.
            - 행정 용어는 풀어서 설명한다.
            - 다음 행동을 짧게 안내한다.
            - 확정적으로 대상이라고 말하지 말고, 주민센터나 복지로에서 확인이 필요하다고 말한다.
            """,
                        "worker": """
            [대상 독자]
            - 복지사가 검토하기 쉽게 대상 조건, 확인 필요 정보, 신청 기관을 정리한다.
            - 대상 가능성과 추가 확인이 필요한 정보를 구분한다.
            - 상담 기록에 옮기기 쉬운 표현으로 간결하게 작성한다.
            """,
        }.get(audience, "")

        # 추천 목록 구조화
        if mode == "recommend":
            mode_rules = """
                [답변 규칙]
                - 대상자 정보와 질문에 맞는 복지 제도를 우선순위 높은 순서로 최대 4개만 추천한다.
                - 답변은 반드시 아래 형식을 따른다.

                {대상자명}님 기준으로 확인 가능한 복지제도는 다음과 같습니다.

                1. {제도명}
                - 추천 이유: {대상자의 나이, 건강 상태, 일자리 신청 상태, 소득/가구 정보 등 개인 정보를 근거로 설명한다.}
                - 지원 내용: {핵심 지원 내용을 1~2문장으로 요약한다.}
                - 신청 방법: {주민센터, 복지로, 수행기관 등 신청 경로를 설명한다.}
                - 확인 필요: {소득·재산 조사, 건강 상태, 지역별 모집 여부 등 실제 판정 전에 확인해야 할 내용을 적는다.}
                - 근거: {참고한 문서명 또는 제도명을 적는다.}

                - 관련성이 낮은 제도는 나열하지 않는다.
                - 대상 가능성을 단정하지 말고, 확인이 필요한 조건은 "확인 필요"에 적는다.
                - 같은 제도를 반복해서 설명하지 않는다.
                - 답변은 5~8문장 또는 제도별 짧은 항목 중심으로 작성한다.
                - 답변에는 마크다운 문법을 사용하지 않는다.
                - 굵게 표시를 위한 **, ***, # 기호는 사용하지 않는다.
                - 항목 구분용 번호와 하이픈은 사용할 수 있다.
                - 제도명은 기호 없이 일반 문장으로 작성한다.
                - 대상자의 정보에서 직접 확인되지 않는 건강 상태, 돌봄 필요, 국민연금 가입 상태, 장애 여부는 추정하지 말고 "확인 필요"에만 적는다.
                """
        # 일반 질문용
        else:
            mode_rules = """
                [답변 규칙]
                - 질문에 바로 답한다.
                - 간단한 Q&A는 2~4문장으로 짧게 답한다.
                - 나이, 금액, 신청 방법, 대상 조건을 묻는 질문은 해당 내용을 먼저 말한다.
                - 대상자 정보는 필요할 때만 참고한다.
                - 추천 목록을 억지로 만들지 않는다.
                - 같은 내용을 반복하지 않는다.
                """

        return f"{audience_rules}\n{mode_rules}"

    def _build_context(self, chunks: list[dict]) -> str:
        limited_chunks = chunks[:4]

        return "\n\n".join(
            [
                f"[문서 {index + 1}] "
                f"{chunk.get('service_name') or chunk.get('filename') or '복지 문서'}\n"
                f"출처: {chunk.get('source') or chunk.get('department') or '제공 문서'}\n"
                f"{self._limit_text(chunk.get('content') or '', 1200)}"
                for index, chunk in enumerate(limited_chunks)
            ]
        )

    def _build_profile_text(self, profile: dict | None) -> str:
        job_applications = profile.get("jobApplications") or []

        job_application_lines = []
        for index, job in enumerate(job_applications[:5], start=1):
            parts = [
                job.get("jobTitle"),
                job.get("organization"),
                job.get("status"),
                job.get("location"),
                job.get("requestedAt"),
            ]
            text = " / ".join(str(value).strip() for value in parts if value)
            if text:
                job_application_lines.append(f"{index}. {text}")
        
        if not profile:
            return "대상자 정보 없음"

        lines = [
            ("이름", profile.get("name")),
            ("나이", profile.get("age")),
            ("성별", profile.get("gender")),
            ("키", profile.get("height")),
            ("몸무게", profile.get("weight")),
            ("흡연", profile.get("smoking")),
            ("음주", profile.get("drinking")),
            ("알레르기", profile.get("allergies")),
            ("복용 약 개수", profile.get("medicineCount")),
            ("복약 상세", self._format_medications(profile.get("medications"))),
            ("거동/감각/인지 정보", self._join_list(profile.get("mobilityInfo"))),
            ("근무 제약 정보", self._join_list(profile.get("workLimitations"))),
            ("희망 일자리 조건", self._format_job_preference(profile.get("jobPreference"))),
            ("지역", profile.get("region") or profile.get("address")),
            ("소득 수준", profile.get("incomeLevel")),
            ("가구 형태", profile.get("householdType")),
            ("독거 여부", profile.get("livingAlone")),
            ("질환", self._join_list(profile.get("diseases"))),
            ("복약 정보", profile.get("medicationInfo")),
            ("기초생활수급 여부", profile.get("basicLivelihoodStatus")),
            ("차상위 여부", profile.get("nearPovertyStatus")),
            ("장애 여부", profile.get("disabilityStatus")),
            ("장기요양 등급", profile.get("longTermCareGrade")),
            ("일자리 신청 내역", "\n".join(job_application_lines)),
            ("일자리 신청 상태", profile.get("jobRequestStatus")),
            ("현재 이용 중인 복지", self._join_list(profile.get("currentBenefits"))),
            ("복지 메모", profile.get("welfareMemo")),
        ]

        result = [
            f"- {label}: {value}"
            for label, value in lines
            if value not in (None, "", [])
        ]

        return "\n".join(result) if result else "대상자 정보 없음"

    def _build_history_text(self, history: list[dict]) -> str:
        if not history:
            return "최근 대화 없음"

        recent_messages = history[-6:]

        return "\n".join(
            f"{'사용자' if message.get('role') == 'user' else 'AI'}: {message.get('text', '')}"
            for message in recent_messages
            if message.get("text")
        )

    def _format_medications(self, value) -> str:
        if not isinstance(value, list):
            return ""

        rows = []
        for item in value:
            if isinstance(item, dict):
                parts = [
                    item.get("name") or item.get("medicineName") or item.get("drugName"),
                    item.get("startDate"),
                    item.get("endDate"),
                    item.get("interval") or item.get("intervalHours"),
                    item.get("dailyCount") or item.get("timesPerDay"),
                ]
                text = " / ".join(str(part).strip() for part in parts if part)
                if text:
                    rows.append(text)
            elif item:
                rows.append(str(item).strip())

        return "; ".join(rows)

    def _format_job_preference(self, value) -> str:
        if not isinstance(value, dict):
            return ""

        parts = [
            value.get("payType"),
            value.get("hopeDays"),
            value.get("hopeJobType"),
            value.get("hopeCondition"),
            value.get("memo"),
        ]

        return " / ".join(str(part).strip() for part in parts if part)

    def _join_list(self, value) -> str:
        if not isinstance(value, list):
            return ""

        return ", ".join(str(item).strip() for item in value if str(item).strip())

    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."
