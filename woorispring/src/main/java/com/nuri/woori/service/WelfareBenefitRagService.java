package com.nuri.woori.service;

import com.nuri.woori.controller.WelfareBenefitAskRequest;
import com.nuri.woori.controller.WelfareBenefitAskResponse;
import com.nuri.woori.entity.WelfareBenefitDocument;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.repository.WelfareBenefitDocumentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WelfareBenefitRagService {
    private final SeniorRepository seniorRepository;
    private final WelfareBenefitDocumentRepository welfareBenefitDocumentRepository;
    private final GeminiEmbeddingService geminiEmbeddingService;
    private final GroqChatService groqChatService;
    private final ObjectMapper objectMapper;

    public WelfareBenefitAskResponse ask(WelfareBenefitAskRequest request) {
        String question = normalizeQuestion(request.question());

        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new IllegalArgumentException("대상자를 찾을 수 없습니다."));

        List<WelfareBenefitDocument> docs = welfareBenefitDocumentRepository.findAll();

        if (docs.isEmpty()) {
            return new WelfareBenefitAskResponse(
                    "아직 동기화된 복지 제도 문서가 없습니다. 먼저 복지 제도 데이터를 동기화해주세요.",
                    List.of()
            );
        }

        List<Double> questionVector = geminiEmbeddingService.embed(
                buildSeniorContext(senior) + "\n질문: " + question
        );

        List<WelfareBenefitDocument> candidateDocs = docs.stream()
                .filter(doc -> isRegionCompatible(senior, doc))
                .filter(doc -> isLifeStageCompatible(senior, doc))
                .filter(doc -> !hasBlockedEligibilityForSenior(senior, doc))
                .filter(doc -> doc.getEmbeddingJson() != null && !doc.getEmbeddingJson().isBlank())
                .toList();

        if (candidateDocs.isEmpty()) {
            return new WelfareBenefitAskResponse(
                    "대상자의 지역과 연령 조건에 맞는 복지 제도를 찾지 못했습니다. 더 넓은 조건으로 다시 검색하거나 대상자 정보를 확인해주세요.",
                    List.of()
            );
        }

        List<ScoredDoc> topDocs = candidateDocs.stream()
                .map(doc -> new ScoredDoc(
                        doc,
                        scoreDoc(senior, question, questionVector, doc)
                ))
                .sorted(Comparator.comparingDouble(ScoredDoc::score).reversed())
                .limit(5)
                .toList();

        String prompt = buildPrompt(senior, question, topDocs);
        String answer = groqChatService.generate(prompt);

        List<WelfareBenefitAskResponse.Source> sources = topDocs.stream()
                .map(item -> new WelfareBenefitAskResponse.Source(
                        item.doc().getTitle(),
                        item.doc().getOrganization(),
                        item.doc().getSourceType(),
                        item.doc().getSourceName(),
                        item.doc().getSourceUrl(),
                        item.doc().getPageNo()
                ))
                .toList();

        return new WelfareBenefitAskResponse(answer, sources);
    }

    private String buildSeniorContext(Senior senior) {
        return """
                대상자 정보:
                이름: %s
                나이: %s
                성별: %s
                주소: %s
                지역: %s
                장애등급: %s
                장애유형: %s
                """.formatted(
                valueOrDash(senior.getName()),
                valueOrDash(senior.getAge()),
                valueOrDash(senior.getGender()),
                valueOrDash(senior.getAddress()),
                valueOrDash(senior.getRegion()),
                valueOrDash(senior.getDisabilityGrade()),
                valueOrDash(senior.getDisabilityType())
        );
    }

    private String normalizeQuestion(String question) {
        if (question == null || question.isBlank()) {
            return "이 대상자가 받을 수 있는 복지 제도를 알려줘";
        }

        return question.trim();
    }

    private String buildPrompt(Senior senior, String question, List<ScoredDoc> docs) {
        StringBuilder context = new StringBuilder();

        for (int i = 0; i < docs.size(); i++) {
            WelfareBenefitDocument doc = docs.get(i).doc();
            context.append("[문서 ").append(i + 1).append("]\n")
                    .append("출처유형: ").append(valueOrDash(doc.getSourceType())).append("\n")
                    .append("출처명: ").append(valueOrDash(doc.getSourceName())).append("\n")
                    .append("페이지: ").append(valueOrDash(doc.getPageNo())).append("\n")
                    .append("제목: ").append(valueOrDash(doc.getTitle())).append("\n")
                    .append("기관: ").append(valueOrDash(doc.getOrganization())).append("\n")
                    .append("내용: ").append(valueOrDash(doc.getContent())).append("\n\n");
        }

        return """
        너는 복지사를 돕는 복지 제도 상담 assistant야.
        반드시 아래 제공된 복지서비스 문서와 대상자 정보만 근거로 답변해.

        답변 형식:
        1. 추천 가능성이 높은 제도
        - 제도명:
        - 추천 이유:
        - 확인해야 할 조건:

        2. 추가 확인이 필요한 제도
        - 제도명:
        - 이유:
        - 확인 질문:

        4. 참고한 복지서비스
        - 제도명:

        답변 규칙:
        - 위 답변 형식을 반드시 유지해.
        - 3번 항목은 만들지 마.
        - 추천할 제도가 여러 개면 1번에는 최대 2개만 써.
        - 2번에는 추가 확인이 필요한 제도를 최대 2개만 써.
        - 해당하는 제도가 없으면 제도명에 "해당 없음"이라고 써.
        - 대상자의 지역과 명백히 맞지 않는 제도는 답변에서 제외해.
        - 신청 가능 여부를 확정하지 말고 "가능성이 있음", "확인 필요"로 표현해.
        - 문서에 없는 소득, 재산, 보훈 여부, 장애 여부는 추측하지 마.
        - 너무 길게 쓰지 말고 복지사가 바로 상담에 쓸 수 있게 써.
        - 대상자의 지역과 명백히 다른 지자체 제도는 추천하지 마.
        - 60세 이상 대상자에게 출산, 임신, 영유아, 청년, 신혼부부 관련 제도는 추천하지 마.
        - 참고 문서에 부적합한 제도가 포함되어 있어도 답변에서 제외해.
        - 추천 이유에는 대상자 정보 중 실제로 확인된 지역, 나이, 성별, 장애 정보만 사용해.

        %s

        복지사 질문:
        %s

        참고 복지서비스 문서:
        %s
        """.formatted(buildSeniorContext(senior), question, context);
    }

    private static final List<String> SEOUL_DISTRICTS = List.of(
            "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구",
            "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구",
            "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구",
            "서초구", "강남구", "송파구", "강동구"
    );

    private static final List<String> LOCAL_REGIONS = List.of(
            "서울", "서울시", "서울특별시",
            "부산", "부산시", "부산광역시",
            "대구", "대구시", "대구광역시",
            "인천", "인천시", "인천광역시",
            "광주", "광주시", "광주광역시",
            "대전", "대전시", "대전광역시",
            "울산", "울산시", "울산광역시",
            "세종", "세종시", "세종특별자치시",
            "경기", "경기도",
            "강원", "강원도", "강원특별자치도",
            "충북", "충청북도",
            "충남", "충청남도",
            "전북", "전라북도", "전북특별자치도",
            "전남", "전라남도",
            "경북", "경상북도",
            "경남", "경상남도",
            "제주", "제주도", "제주특별자치도"
    );

    private static final List<String> OLDER_ADULT_EXCLUDED_KEYWORDS = List.of(
            "출산", "임신", "산모", "난임", "육아", "영유아", "아동", "청년", "신혼", "배우자출산",
            "초등", "중학생", "고등학생", "대학생", "학자금", "보육", "어린이집"
    );

    private boolean isRegionCompatible(Senior senior, WelfareBenefitDocument doc) {
        String seniorRegion = normalizeText(
                valueOrDash(senior.getAddress()) + " " + valueOrDash(senior.getRegion())
        );

        String content = normalizeText(docText(doc));

        if (content.contains("전국") || seniorRegion.equals("-")) {
            return true;
        }

        List<String> mentionedSeoulDistricts = SEOUL_DISTRICTS.stream()
                .filter(content::contains)
                .toList();

        if (!mentionedSeoulDistricts.isEmpty()) {
            return mentionedSeoulDistricts.stream().anyMatch(seniorRegion::contains);
        }

        if (content.contains("장수군") && !seniorRegion.contains("장수군")) {
            return false;
        }

        List<String> mentionedRegions = LOCAL_REGIONS.stream()
                .filter(content::contains)
                .toList();

        if (!mentionedRegions.isEmpty()) {
            return mentionedRegions.stream().anyMatch(seniorRegion::contains)
                    || isSameBroadRegion(seniorRegion, mentionedRegions);
        }

        return true;
    }

    private boolean isSameBroadRegion(String seniorRegion, List<String> mentionedRegions) {
        if (seniorRegion.contains("서울")) {
            return mentionedRegions.stream().anyMatch(region -> region.contains("서울"));
        }

        if (seniorRegion.contains("전북") || seniorRegion.contains("전라북도")) {
            return mentionedRegions.stream().anyMatch(region -> region.contains("전북") || region.contains("전라북도"));
        }

        if (seniorRegion.contains("경기") || seniorRegion.contains("경기도")) {
            return mentionedRegions.stream().anyMatch(region -> region.contains("경기"));
        }

        return false;
    }

    private boolean isLifeStageCompatible(Senior senior, WelfareBenefitDocument doc) {
        int age = parseAge(senior.getAge());
        String content = normalizeText(valueOrDash(doc.getTitle()) + " " + valueOrDash(doc.getContent()));

        if (age >= 60 && OLDER_ADULT_EXCLUDED_KEYWORDS.stream().anyMatch(content::contains)) {
            return false;
        }

        return true;
    }

    private boolean hasBlockedEligibilityForSenior(Senior senior, WelfareBenefitDocument doc) {
        String content = normalizeText(valueOrDash(doc.getTitle()) + " " + valueOrDash(doc.getContent()));
        String gender = normalizeText(valueOrDash(senior.getGender()));

        if (content.contains("여성") && gender.contains("남")) {
            return true;
        }

        return false;
    }

    private int parseAge(Object value) {
        if (value == null) {
            return 0;
        }

        String text = String.valueOf(value).replaceAll("[^0-9]", "");

        if (text.isBlank()) {
            return 0;
        }

        return Integer.parseInt(text);
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }

        return value.replace(" ", "").trim();
    }

    private double scoreDoc(
            Senior senior,
            String question,
            List<Double> questionVector,
            WelfareBenefitDocument doc
    ) {
        double vectorScore = cosine(questionVector, parseEmbedding(doc.getEmbeddingJson()));
        double regionBonus = regionMatchScore(senior, doc);
        double keywordBonus = keywordMatchScore(question, doc);

        return vectorScore + regionBonus + keywordBonus;
    }

    private double regionMatchScore(Senior senior, WelfareBenefitDocument doc) {
        String address = valueOrDash(senior.getAddress());
        String region = valueOrDash(senior.getRegion());
        String content = docText(doc);

        double score = 0;

        if (!region.equals("-") && content.contains(region)) {
            score += 0.18;
        }

        if (!address.equals("-")) {
            String[] parts = address.split(" ");

            for (String part : parts) {
                if (part.length() >= 2 && content.contains(part)) {
                    score += 0.08;
                }
            }
        }

        return Math.min(score, 0.28);
    }

    private double keywordMatchScore(String question, WelfareBenefitDocument doc) {
        String content = docText(doc);
        double score = 0;

        String[] keywords = question.split("\\s+");

        for (String keyword : keywords) {
            if (keyword.length() >= 2 && content.contains(keyword)) {
                score += 0.03;
            }
        }

        return Math.min(score, 0.12);
    }

    private String docText(WelfareBenefitDocument doc) {
        return valueOrDash(doc.getTitle()) + "\n"
                + valueOrDash(doc.getOrganization()) + "\n"
                + valueOrDash(doc.getContent());
    }

    private List<Double> parseEmbedding(String embeddingJson) {
        if (embeddingJson == null || embeddingJson.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(embeddingJson, new TypeReference<>() {
            });
        } catch (Exception exception) {
            return new ArrayList<>();
        }
    }

    private String valueOrDash(Object value) {
        if (value == null) {
            return "-";
        }

        String text = String.valueOf(value);
        return text.isBlank() ? "-" : text;
    }

    private double cosine(List<Double> a, List<Double> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;

        int size = Math.min(a.size(), b.size());
        double dot = 0;
        double normA = 0;
        double normB = 0;

        for (int i = 0; i < size; i++) {
            dot += a.get(i) * b.get(i);
            normA += a.get(i) * a.get(i);
            normB += b.get(i) * b.get(i);
        }

        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private record ScoredDoc(
            WelfareBenefitDocument doc,
            double score
    ) {
    }
}
