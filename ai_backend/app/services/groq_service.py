from langchain_groq import ChatGroq

from app.core.config import settings


class GroqService:
    def __init__(self):
        self.llm = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.1,
            max_tokens=1000,
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
            문서에 없는 내용은 추측하지 않는다.
            답변은 반드시 한국어로 작성한다.

            공통 답변 원칙:
            - 검색된 문서에 근거가 없는 내용은 만들지 않는다.
            - 문서에서 확인되지 않는 조건, 금액, 중복 수급 가능 여부, 신청 가능 여부는 단정하지 않는다.
            - 근거가 부족하면 "현재 자료만으로는 확인이 어렵습니다. 주민센터, 복지로 또는 담당 기관에서 확인이 필요합니다."라고 답한다.
            - 복지제도 답변에서는 가능 여부를 단정하기보다 근거 수준에 맞게 "가능할 수 있습니다", "제한될 수 있습니다", "확인이 필요합니다"처럼 표현한다.
            - "A를 받고 있는데 B도 받을 수 있나요?", "중복 수급 가능한가요?", "같이 받을 수 있나요?", "감액되나요?" 같은 질문은 제도 추천 목록을 만들지 않는다.
            - 중복 수급 질문은 가능 여부, 감액 또는 소득 반영 가능성, 확인해야 할 기관 순서로 답한다.
            - 예/아니오형 질문은 첫 문장에서 가능한 범위 안에서 바로 답한다.
            - 단, 문서에 근거가 없으면 예/아니오를 추측하지 말고 확인이 필요하다고 답한다.

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
                [대상 사용자]
                - 보호자가 이해하기 쉽게 쉬운 말로 설명한다.
                - 행정 용어는 풀어서 설명한다.
                - 핵심 내용만 3~5문장 이내로 짧게 요약한다.
                - 세부 지원 항목은 2~3개만 대표로 언급하고 나열하지 않는다.
                - 다음 행동을 짧게 안내한다.
                - 확정적으로 대상이라고 말하지 말고, 주민센터, 복지로 또는 담당 기관 확인이 필요하다고 안내한다.
                """,
                        "worker": """
                [대상 사용자]
                - 복지사가 검토하기 쉽게 대상 조건, 확인 필요 정보, 신청 기관을 정리한다.
                - 대상 가능성과 추가 확인이 필요한 정보를 구분한다.
                - 상담 기록에 남기기 쉬운 표현으로 간결하게 작성한다.
            """,    
        }.get(audience, "")

        if mode == "recommend":
            mode_rules = """
                [추천 모드 답변 규칙]
                - 대상자 정보와 검색된 복지 문서를 함께 보고, 신청 가능성이 있어 보이는 복지 제도를 최대 4개만 제시한다.
                - "받을 수 있다", "대상이다", "해당된다"처럼 확정적으로 말하지 않는다.
                - 반드시 "신청 가능성이 있습니다", "우선 검토할 수 있습니다", "확인이 필요합니다"처럼 표현한다.
                - 추천 이유에는 대상자 정보에서 실제로 확인된 정보만 사용한다.
                - 대상자 정보에서 확인되지 않은 건강 상태, 독거 여부, 장애 여부, 장기요양 등급, 기초생활수급 여부, 차상위 여부, 소득 수준은 절대 추정하지 않는다.
                - 기초연금 수급 여부만으로 기초생활보장제도, 의료급여, 주거급여 대상이라고 판단하지 않는다.
                - 기초생활보장제도, 의료급여, 주거급여는 소득인정액, 재산, 가구 구성, 기존 수급 여부 확인이 필요한 제도로 분류한다.
                - 노인맞춤돌봄서비스, 응급안전안심서비스처럼 나이·독거 여부·돌봄 필요도·안전 확인 필요 여부가 중요한 제도는 확인된 정보와 확인 필요 정보를 구분한다.
                - 관련성이 낮은 제도는 나열하지 않는다.
                - 같은 제도를 반복해서 설명하지 않는다.
                - 검색 문서에 없는 제도는 추천하지 않는다.
                - 검색 문서에 근거가 부족하면 "현재 자료만으로는 확인이 어렵습니다. 주민센터, 복지로 또는 담당 기관에서 확인이 필요합니다."라고 답한다.
                - 답변은 반드시 아래 형식을 따른다.
                - 굵게 표시를 위한 **, ***, # 기호는 사용하지 않는다.
                - 항목 구분은 번호와 하이픈만 사용한다.

                {대상자명}님 기준으로 우선 검토할 수 있는 복지제도는 다음과 같습니다.

                1. {제도명}
                - 검토 구분: 우선 추천 또는 조건 확인 후 검토
                - 추천 이유: {대상자 정보에서 실제 확인된 정보만 근거로 설명한다. 확인되지 않은 정보는 쓰지 않는다.}
                - 지원 내용: {검색 문서에 있는 핵심 지원 내용을 1~2문장으로 요약한다.}
                - 신청 방법: {검색 문서에 있는 주민센터, 복지로, 수행기관 등 신청 경로를 설명한다.}
                - 확인 필요: {선정 전에 확인해야 하는 소득·재산, 가구 형태, 건강 상태, 돌봄 필요도, 기존 수급 여부 등을 적는다.}
                - 근거: {실제 복지 제도 이름과 출처 기관명. '문서 1', '문서 2' 같은 번호 표현은 쓰지 않는다.}

                마지막에는 다음 문장을 붙인다.
                위 내용은 현재 등록된 대상자 정보와 검색된 복지 문서를 기준으로 한 검토 결과이므로, 실제 신청 가능 여부는 주민센터, 복지로 또는 담당 기관 확인이 필요합니다.
            """
        else:
            mode_rules = """
                [Q&A 모드 답변 규칙]
                - 질문에 바로 답한다.
                - 간단한 Q&A는 2~4문장으로 짧게 답한다.
                - 나이, 금액, 신청 방법, 대상 조건을 묻는 질문은 해당 내용을 먼저 말한다.
                - 대상자 정보는 필요할 때만 참고한다.
                - 추천 목록을 임의로 만들지 않는다.
                - 같은 내용을 반복하지 않는다.
                - "A를 받고 있는데 B도 받을 수 있나요?", "중복 수급 가능한가요?", "같이 받을 수 있나요?", "감액되나요?" 같은 질문은 추천 목록 대신 가능 여부를 먼저 답한다.
                - 중복 수급 질문은 첫 문장에 "가능합니다", "가능할 수 있습니다", "제한될 수 있습니다", "현재 자료만으로는 확인이 어렵습니다" 중 하나로 답한다.
                - 그 다음 문장에서 감액 가능성, 소득 반영 여부, 중복 제한 가능성을 설명한다.
                - 마지막 문장에는 확인 기관을 안내한다.
                - 기초연금 수급 여부만으로 기초생활보장제도, 의료급여, 주거급여 대상이라고 단정하지 않는다.
                - 문서 근거가 부족하면 추측하지 말고 "현재 자료만으로는 확인이 어렵습니다. 주민센터, 복지로 또는 담당 기관에서 확인이 필요합니다."라고 답한다.
            """

        return f"{audience_rules}\n{mode_rules}"

    def _build_context(self, chunks: list[dict]) -> str:
        limited_chunks = chunks[:4]

        seen_names = set()
        result = []

        for chunk in limited_chunks:
            name = chunk.get("service_name") or chunk.get("filename") or "복지 문서"
            source = chunk.get("source") or chunk.get("department") or "관련 기관"
            content = self._limit_text(chunk.get("content") or "", 1200)

            result.append(
                f"[{name}]\n"
                f"출처: {source}\n"
                f"{content}"
            )

            seen_names.add(name)

        return "\n\n".join(result)

    def _build_profile_text(self, profile: dict | None) -> str:
        if not profile:
            return "대상자 정보 없음"

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
            ("일자리 신청 이력", "\n".join(job_application_lines)),
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