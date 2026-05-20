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
                f"[문서: {chunk.get('filename')} / chunk {chunk.get('chunk_index')}]\n"
                f"{self._limit_text(chunk.get('content') or '', 1200)}"
                for chunk in limited_chunks
            ]
        )

        prompt = f"""
            당신은 복지 Q&A 상담 보조 AI입니다.

            반드시 아래 제공된 문서 내용만 기반으로 답변하세요.
            문서에 없는 내용은 추측하지 말고 "제공된 자료에서 확인되지 않습니다"라고 답변하세요.
            신청 가능 여부를 단정하지 말고, 조건과 확인 필요 사항을 구분해서 설명하세요.
            복지 제도명, 지원대상, 소득기준, 신청방법, 문의처를 우선적으로 정리하세요.
            답변은 한국어로 5문장 이내로 작성하세요.
            마크다운 코드블록은 사용하지 마세요.

            [제공 문서]
            {context}

            [질문]
            {question}
        """

        response = self.llm.invoke(prompt)
        return response.content.strip()

    def _limit_text(self, text: str, max_chars: int) -> str:
        normalized_text = " ".join(text.split())

        if len(normalized_text) <= max_chars:
            return normalized_text

        return normalized_text[:max_chars] + "..."