import unittest

from app.services.eligibility_assessment_service import EligibilityAssessmentService


class EligibilityAssessmentTest(unittest.TestCase):
    def setUp(self):
        self.service = EligibilityAssessmentService()
        self.profile = {
            "name": "최숙희",
            "age": 74,
            "region": "서울특별시 광진구",
            "livingAlone": False,
            "basicLivelihoodStatus": None,
        }
        self.chunks = [
            {
                "document_id": "senior_custom_care_target",
                "title": "노인맞춤돌봄서비스 지원 대상",
                "authority": "보건복지부",
                "effective_year": 2026,
                "content": "대상자 선정 기준",
            },
            {
                "document_id": "emergency_safety_target",
                "title": "응급안전안심서비스 지원 대상",
                "authority": "보건복지부",
                "effective_year": 2026,
                "content": "대상자 선정 기준",
            },
            {
                "document_id": "internal_upload",
                "title": "current upload",
                "content": "내부 문서",
            },
        ]

    def test_unknown_requirements_are_not_confirmed(self):
        result = self.service.assess("받을 수 있는 복지제도 알려줘", self.profile, self.chunks)

        self.assertEqual(2, len(result["candidates"]))
        self.assertTrue(all(item["status"] == "INSUFFICIENT_INFORMATION" for item in result["candidates"]))
        self.assertIn("확정할 수 있는 제도는 없습니다", result["summary"])

    def test_false_living_alone_is_rendered_as_no(self):
        result = self.service.assess("받을 수 있는 복지제도 알려줘", self.profile, self.chunks)
        facts = {fact["label"]: fact["value"] for fact in result["profileFacts"]}

        self.assertEqual("아니요", facts["독거 여부"])
        self.assertNotIn("독거노인", self.service.format_answer(result))

    def test_internal_source_is_not_exposed(self):
        result = self.service.assess("받을 수 있는 복지제도 알려줘", self.profile, self.chunks)
        sources = self.service.sources(result)

        self.assertTrue(sources)
        self.assertTrue(all(source["title"] != "current upload" for source in sources))
        self.assertEqual(len(sources), len({source["document_id"] for source in sources}))

    def test_each_candidate_uses_its_own_document(self):
        result = self.service.assess("받을 수 있는 복지제도 알려줘", self.profile, self.chunks)
        candidates = {item["serviceId"]: item for item in result["candidates"]}

        self.assertEqual(["senior_custom_care_target"], candidates["senior_custom_care"]["sourceDocumentIds"])
        self.assertEqual(["emergency_safety_target"], candidates["emergency_safety"]["sourceDocumentIds"])


if __name__ == "__main__":
    unittest.main()
