import logging
import re
import time

from langchain_groq import ChatGroq

from app.core.config import settings

logger = logging.getLogger(__name__)


class GroqService:
    def __init__(self):
        groq_api_key = settings.groq_api_key.strip()

        logger.info(
            "Groq client initialization: prefix=%s, length=%d, model=%s",
            groq_api_key[:4],
            len(groq_api_key),
            settings.groq_model,
        )

        self.llm = ChatGroq(
            model=settings.groq_model,
            groq_api_key=groq_api_key,
            temperature=0.1,
            max_tokens=1000,
            timeout=settings.groq_timeout_seconds,
            max_retries=1,
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
            - 자기소개나 인사말로 답변을 시작하지 않고 바로 본론부터 답한다.
            - "RAG", "상담 도우미", "문서 검색" 같은 시스템 내부 표현을 답변에 쓰지 않는다.
            - [대상자 정보]의 인물은 대화 상대가 아니라 상담 "대상"이다. 대상자에게 인사하거나 2인칭으로 말을 걸지 않고, 항상 "○○님은 ~입니다"처럼 3인칭으로 서술한다.
            - 대상자 정보가 주어진 경우, "관련 복지", "복지 알려줘"처럼 대상이 생략된 질문은 그 대상자에게 해당하는 복지를 묻는 것으로 해석한다.
            - 검색된 문서에 근거가 없는 내용은 만들지 않는다.
            - 문서에서 확인되지 않는 조건, 금액, 중복 수급 가능 여부, 신청 가능 여부는 단정하지 않는다.
            - 근거가 부족하면 "현재 자료만으로는 확인이 어렵습니다. 주민센터, 복지로 또는 담당 기관에서 확인이 필요합니다."라고 답한다.
            - 복지제도 답변에서는 가능 여부를 단정하기보다 근거 수준에 맞게 "가능할 수 있습니다", "제한될 수 있습니다", "확인이 필요합니다"처럼 표현한다.
            - "A를 받고 있는데 B도 받을 수 있나요?", "중복 수급 가능한가요?", "같이 받을 수 있나요?", "감액되나요?" 같은 질문은 제도 추천 목록을 만들지 않는다.
            - 중복 수급 질문은 가능 여부, 감액 또는 소득 반영 가능성, 확인해야 할 기관 순서로 답한다.
            - 예/아니오형 질문은 첫 문장에서 가능한 범위 안에서 바로 답한다.
            - 단, 문서에 근거가 없으면 예/아니오를 추측하지 말고 확인이 필요하다고 답한다.

            절대 위반 금지 규칙:
            - 대상자 정보와 모순되는 사실을 만들지 않는다. 독거 여부가 "아니요"이면 독거노인이라고 표현하지 않는다.
            - 낙상 기록 또는 낙상 위험 정보가 제공되지 않았다면 낙상 위험이 있다고 추론하지 않는다.
            - 소득 정보가 "미등록"이면 저소득, 소득 없음, 기초생활수급자로 해석하지 않는다.
            - 문서의 지원 대상 설명은 일반 조건일 뿐 대상자가 그 조건을 충족한다는 증거가 아니다.
            - 공식 자격 조건을 모두 확인하지 못했다면 "받을 수 있습니다", "대상입니다", "해당됩니다"라고 표현하지 않는다.
            - 추천 제도마다 확인된 조건과 추가 확인 필요 조건을 분리하고, 현재 판정을 "검토 가능" 또는 "정보 부족"으로 표시한다.

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

        started_at = time.perf_counter()
        try:
            if audience == "guardian":
                llm = self.llm.bind(
                    max_tokens=350,
                )
            else:
                llm = self.llm

            response = llm.invoke(prompt)

            answer = self._sanitize_answer(
                response.content.strip(),
                mode,
                profile,
            )

            return self._sanitize_guardian_answer(
                answer=answer,
                audience=audience,
            )
        finally:
            logger.info("RAG Groq generation completed in %.3fs", time.perf_counter() - started_at)

    def _build_rules(self, mode: str, audience: str) -> str:
        audience_rules = {
            "guardian": """
                [보호자용 답변 형식 - 반드시 준수]
                - 질문자는 보호자다. 대상자에게 직접 말하지 않고 보호자에게 설명한다.
                - 쉬운 표현을 사용하고 행정 용어는 풀어서 설명한다.
                - 전체 답변은 공백을 포함해 500자 이내로 작성한다.
                - 답변은 최대 3개 문단으로 작성한다.
                - 첫 문단에서는 질문의 핵심 결론을 바로 설명한다.
                - 두 번째 문단에서는 대상 조건과 필요 서류를 요약한다.
                - 세 번째 문단에서는 신청 기관 또는 다음 행동만 안내한다.
                - 같은 의미를 반복하지 않는다.
                - 검색 문서에 있는 문장을 그대로 길게 옮기지 않는다.
                - 문서 제목, 문서 작성 연도, 출처 목록은 본문에서 반복하지 않는다.
                - 출처는 화면의 근거 문서 영역에서 별도로 표시되므로 본문에 작성하지 않는다.
                - 확정적인 자격 판정은 하지 않는다.
                - 마지막에는 담당 기관에서 확인해야 한다는 안내를 한 문장으로 작성한다.
                - 사용자가 대상, 조건, 필요 서류, 준비물처럼 전체 목록을 요청하면 검색 문서에서 확인된 항목을 빠짐없이 안내한다.
                - 전체 목록을 요청한 경우에는 글머리표를 사용해 한눈에 구분되도록 작성한다.
                - 각 항목의 세부 설명은 길게 풀지 않고 한 줄로 작성한다.
                - 사용자가 일반적인 요약만 요청하면 핵심 항목을 중심으로 짧게 설명한다.
                - 목록을 임의로 3개로 제한하지 않는다.
                - 검색 문서에 없는 서류나 조건은 추측해서 추가하지 않는다.

                [보호자용 답변 예시]
                도시가스요금 경감은 기초생활수급자, 차상위계층,
                장애 정도가 심한 장애인 등에게 적용될 수 있습니다.

                신청할 때는 도시가스 고객번호, 계약자 정보,
                자격을 확인할 수 있는 서류가 필요할 수 있습니다.

                정확한 대상 여부와 제출 서류는 관할 도시가스사에 확인해 주세요.
            """,
            "worker": """
                [대상 사용자]
                - 질문자는 담당 복지사다. 답변은 복지사에게 보고하듯 작성한다.
                - 대상자는 복지사가 관리하는 인물이므로 절대 대상자에게 직접 말하지 않는다. ("안녕하세요 ○○님" 금지)
                - 복지사가 검토하기 쉽게 대상 조건, 확인 필요 정보, 신청 기관을 정리한다.
                - 대상 가능성과 추가 확인이 필요한 정보를 구분한다.
                - 대상자 정보에서 확인된 근거(나이, 질환, 장애, 소득 등)를 제도별 추천 이유에 구체적으로 연결한다.
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
                - 사용자 질문에 특정 질환, 제도, 주제가 명시된 경우(예: "당뇨 관련", "장애 관련"), 그 주제와 직접 관련된 제도만 추천한다. 관련 없는 제도는 나열하지 않는다.

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
                - 대상자 정보가 있으면 그 대상자 기준으로 답한다. 예를 들어 나이·장애 조건이 있는 제도는 대상자가 조건을 충족하는지 함께 짚어준다.
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
            name = chunk.get("title") or chunk.get("service_name") or chunk.get("filename") or "복지 문서"
            source = chunk.get("authority") or chunk.get("department") or "공식 안내 문서"
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

        raw_income_level = profile.get("incomeLevel")
        profile = {
            **profile,
            "incomeLevel": self._display_income(raw_income_level),
            "livingAlone": self._display_boolean(profile.get("livingAlone")),
        }

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

        if not self._display_income(raw_income_level):
            result.append("- 소득 정보: 미등록 (소득 기준 충족 여부를 판단할 수 없음)")
        result.append("- 낙상 위험 정보: 미제공 (위험 여부를 추론하지 말 것)")

        return "\n".join(result) if result else "대상자 정보 없음"

    def _display_boolean(self, value) -> str:
        if value is True:
            return "예"
        if value is False:
            return "아니요"
        return "미등록"

    def _display_income(self, value) -> str:
        if value in (None, "", "NONE", "UNKNOWN"):
            return ""
        labels = {
            "LIVELIHOOD": "생계급여",
            "MEDICAL": "의료급여",
            "HOUSING": "주거급여",
            "EDUCATION": "교육급여",
        }
        return labels.get(str(value), str(value))

    def _sanitize_answer(self, answer: str, mode: str, profile: dict | None) -> str:
        if mode != "recommend" or not profile:
            return answer

        sanitized = answer.replace("NONE", "미등록").replace("False", "아니요").replace("True", "예")

        if profile.get("livingAlone") is False:
            sanitized = sanitized.replace("독거노인", "고령자")
            lines = []
            for line in sanitized.splitlines():
                if line.strip().startswith("- 추천 이유:") and "독거 여부가 아니므로" in line:
                    lines.append("- 추천 이유: 만 65세 이상 연령 정보는 확인됐습니다. 독거 여부는 아니요이며, 그 밖의 자격 조건은 추가 확인이 필요합니다.")
                else:
                    lines.append(line)
            sanitized = "\n".join(lines)

        fall_risk_provided = any(
            profile.get(key) not in (None, "", [], "UNKNOWN")
            for key in ("fallRiskStatus", "fallRisk", "fallHistory")
        )
        if not fall_risk_provided:
            sanitized = sanitized.replace("낙상 위험이 있는", "낙상 위험 여부를 추가 확인해야 하는")
            sanitized = sanitized.replace("낙상 위험군", "낙상 위험 확인 필요 대상")

        replacements = {
            "신청 가능성 있습니다": "검토 가능한 후보입니다",
            "신청 가능합니다": "신청 가능 여부 확인이 필요합니다",
            "참여 가능성이 있습니다": "검토 가능한 후보입니다",
            "받을 수 있습니다": "검토할 수 있으나 추가 확인이 필요합니다",
            "대상입니다": "대상 여부 확인이 필요합니다",
            "해당됩니다": "해당 여부 확인이 필요합니다",
            "현재 판정: 조건 충족": "현재 판정: 검토 가능",
            "검토 구분: 확정 대상": "검토 구분: 조건 확인 후 검토",
        }
        for phrase, replacement in replacements.items():
            sanitized = sanitized.replace(phrase, replacement)

        sanitized = re.sub(r"독거 여부가 아니므로\s*", "독거 여부는 아니요이며 ", sanitized)

        return sanitized

    def _sanitize_guardian_answer(
        self,
        answer: str,
        audience: str,
    ) -> str:
        if audience != "guardian":
            return answer

        sanitized = answer.strip()

        # 과도한 빈 줄 정리
        sanitized = re.sub(
            r"\n{3,}",
            "\n\n",
            sanitized,
        )

        # 모델이 제목용 마크다운을 생성한 경우 제거
        sanitized = re.sub(
            r"^\s*#{1,6}\s*",
            "",
            sanitized,
            flags=re.MULTILINE,
        )

        # 굵은 글씨 기호 제거
        sanitized = sanitized.replace("**", "")

        # 보호자 화면에서 지나치게 긴 답변 방지
        max_chars = 650

        if len(sanitized) > max_chars:
            shortened = sanitized[:max_chars]

            last_sentence_index = max(
                shortened.rfind("."),
                shortened.rfind("다."),
                shortened.rfind("요."),
            )

            if last_sentence_index >= 300:
                shortened = shortened[: last_sentence_index + 1]

            sanitized = shortened.rstrip()

            if not sanitized.endswith((".", "다.", "요.")):
                sanitized += "…"

            sanitized += (
                "\n\n정확한 대상 여부와 제출 서류는 "
                "관할 도시가스사 또는 주민센터에서 확인해 주세요."
            )

        return sanitized

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
