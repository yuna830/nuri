from langchain_groq import ChatGroq

from app.core.config import settings


class GroqService:
    def __init__(self):
        self.llm = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.1,
            max_tokens=500,
        )

    def answer(self, question: str, context_chunks: list[dict]) -> str:
        limited_chunks = context_chunks[:3]

        context = "\n\n".join(
            [
                f"[Document: {chunk.get('filename')} / chunk {chunk.get('chunk_index')}]\n"
                f"{self._limit_text(chunk.get('content') or '', 1200)}"
                for chunk in limited_chunks
            ]
        )

        prompt = f"""
            You are a Korean welfare policy Q&A assistant for social workers.

            Answer only in Korean.
            Use only the provided documents and the target profile included in the question.

            Question type handling:
            - If [답변 요청] says this is a basic policy question, answer the exact question directly in 2-4 natural Korean sentences.
            - For basic policy questions, do not force "추천 제도" or "추가 확인" sections unless they are truly needed.
            - If the question asks for age, amount, period, application method, definition, eligibility threshold, or basic meaning, answer that first.
            - If [답변 요청] asks for target-based recommendation, then recommend at most 3 policies that match the target profile.

            Strict filtering rules:
            - Do not dump every retrieved policy.
            - If the target profile does not mention North Korean defector status, do not recommend North Korean defector programs.
            - If the target profile does not mention disability, do not recommend disability programs.
            - If the target profile does not mention legal, housing finance, job-seeking, or childcare needs, do not recommend those programs.
            - For a 65+ older adult, prioritize older-adult programs such as basic pension, senior jobs, customized senior care, emergency safety service, long-term care, and basic livelihood only when the documents support them.
            - Do not say the person is eligible with certainty when income, household, disability, or long-term-care grade is missing. Say "확인 필요".

            For target-based recommendation format:
            답변
            - One short summary sentence.

            추천 제도
            - Policy name: why it may fit, and what must be checked.

            추가 확인
            - List missing information needed for final eligibility.

            [Provided documents]
            {context}

            [Question and target profile]
            {question}
        """

        response = self.llm.invoke(prompt)
        return response.content.strip()

    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."
