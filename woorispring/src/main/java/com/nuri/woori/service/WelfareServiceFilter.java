package com.nuri.woori.service;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WelfareServiceFilter {

    private static final List<String> EXCLUDE_KEYWORDS = List.of(
            "청년",
            "신혼",
            "아동",
            "청소년",
            "대학생",
            "학생",
            "영유아",
            "출산",
            "임산부",
            "난임",
            "보육",
            "어린이집",
            "학자금"
    );

    private static final List<String> INCLUDE_KEYWORDS = List.of(
            "노인",
            "어르신",
            "고령",
            "65세",
            "70세",
            "75세",
            "독거",
            "돌봄",
            "치매",
            "장기요양",
            "방문건강",
            "기초생활",
            "수급자",
            "차상위",
            "저소득",
            "장애",
            "의료급여",
            "주거급여",
            "생계급여",
            "보훈",
            "참전",
            "복지관",
            "요양",
            "안부",
            "응급안전"
    );

    public boolean shouldExclude(String serviceName, String summary, String supportTarget, String supportContent) {
        String text = combineText(serviceName, summary, supportTarget, supportContent);

        if (text.isBlank()) {
            return true;
        }

        boolean hasExcludeKeyword = containsAny(text, EXCLUDE_KEYWORDS);
        boolean hasIncludeKeyword = containsAny(text, INCLUDE_KEYWORDS);

        if (hasIncludeKeyword) {
            return false;
        }

        return hasExcludeKeyword;
    }

    public boolean shouldIncludeForRag(String serviceName, String summary, String supportTarget, String supportContent) {
        return !shouldExclude(serviceName, summary, supportTarget, supportContent);
    }

    private String combineText(String serviceName, String summary, String supportTarget, String supportContent) {
        return safe(serviceName)
                + " "
                + safe(summary)
                + " "
                + safe(supportTarget)
                + " "
                + safe(supportContent);
    }

    private boolean containsAny(String text, List<String> keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }

        return false;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}