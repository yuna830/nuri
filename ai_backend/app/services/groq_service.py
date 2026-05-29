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

        if mode == "recommend":
            mode_rules = """
[답변 규칙]
- 대상자 정보와 질문에 맞는 복지 제도를 최대 3개만 추천한다.
- 각 제도는 이름, 왜 맞는지, 신청 전 확인할 정보를 짧게 설명한다.
- 대상 가능성을 단정하지 말고, 소득, 재산, 등급, 가구 상황 확인이 필요하면 분명히 말한다.
- 질문과 관련 없는 제도는 나열하지 않는다.
- 같은 제도를 반복해서 설명하지 않는다.
- 답변은 5~8문장 또는 짧은 bullet 형식으로 작성한다.
"""
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
        if not profile:
            return "대상자 정보 없음"

        lines = [
            ("이름", profile.get("name")),
            ("나이", profile.get("age")),
            ("성별", profile.get("gender")),
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

    def _join_list(self, value) -> str:
        if not isinstance(value, list):
            return ""

        return ", ".join(str(item).strip() for item in value if str(item).strip())

    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."
