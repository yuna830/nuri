import unittest

from app.services.groq_service import GroqService
from app.services.rag_service import RagService


class RagSafetyTest(unittest.TestCase):
    def setUp(self):
        self.groq = object.__new__(GroqService)
        self.rag = object.__new__(RagService)

    def test_profile_converts_internal_values(self):
        text = self.groq._build_profile_text({
            "name": "테스트",
            "incomeLevel": "NONE",
            "livingAlone": False,
        })
        self.assertIn("독거 여부: 아니요", text)
        self.assertIn("소득 정보: 미등록", text)
        self.assertNotIn("False", text)
        self.assertNotIn("NONE", text)

    def test_recommendation_removes_false_living_alone_claim(self):
        answer = "- 추천 이유: 만 74세이며 독거 여부가 아니므로 독거노인 지원을 받을 수 있습니다."
        safe = self.groq._sanitize_answer(answer, "recommend", {"livingAlone": False})
        self.assertNotIn("독거노인", safe)
        self.assertNotIn("받을 수 있습니다", safe)
        self.assertIn("추가 확인", safe)

    def test_recommendation_does_not_assert_unknown_fall_risk(self):
        answer = "낙상 위험이 있는 독거노인은 신청 가능성 있습니다."
        safe = self.groq._sanitize_answer(answer, "recommend", {"livingAlone": False})
        self.assertNotIn("낙상 위험이 있는", safe)
        self.assertNotIn("신청 가능성 있습니다", safe)

    def test_retrieval_value_does_not_expose_internal_values(self):
        self.assertEqual("아니요", self.rag._value({"livingAlone": False}, "livingAlone"))
        self.assertEqual("", self.rag._value({"incomeLevel": "NONE"}, "incomeLevel"))


if __name__ == "__main__":
    unittest.main()
