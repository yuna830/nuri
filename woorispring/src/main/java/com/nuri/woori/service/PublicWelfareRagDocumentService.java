package com.nuri.woori.service;

import com.nuri.woori.entity.RagDocument;
import com.nuri.woori.entity.WelfareServiceInfo;
import com.nuri.woori.repository.RagDocumentRepository;
import com.nuri.woori.repository.WelfareServiceInfoRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Service
public class PublicWelfareRagDocumentService {

    private static final String SOURCE_TYPE = "welfare_service";
    private static final String SOURCE_NAME = "한국사회보장정보원 지자체복지서비스 API";
    private static final String QDRANT_COLLECTION = "public_welfare_services";

    private final WelfareServiceInfoRepository welfareServiceInfoRepository;
    private final RagDocumentRepository ragDocumentRepository;
    private final WelfareServiceFilter welfareServiceFilter;

    public PublicWelfareRagDocumentService(
            WelfareServiceInfoRepository welfareServiceInfoRepository,
            RagDocumentRepository ragDocumentRepository,
            WelfareServiceFilter welfareServiceFilter
    ) {
        this.welfareServiceInfoRepository = welfareServiceInfoRepository;
        this.ragDocumentRepository = ragDocumentRepository;
        this.welfareServiceFilter = welfareServiceFilter;
    }

    public List<RagDocument> syncWelfareServiceRagDocuments(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));

        List<WelfareServiceInfo> services = welfareServiceInfoRepository.findAll();
        List<RagDocument> savedDocuments = new ArrayList<>();

        for (WelfareServiceInfo service : services) {
            if (savedDocuments.size() >= safeLimit) {
                break;
            }

            if (!hasDetailData(service)) {
                continue;
            }

            if (!welfareServiceFilter.shouldIncludeForRag(
                    service.getServiceName(),
                    service.getSummary(),
                    service.getSupportTarget(),
                    service.getSupportContent()
            )) {
                continue;
            }

            String markdown = buildMarkdown(service);
            String rawHash = sha256(markdown);

            RagDocument document = ragDocumentRepository
                    .findBySourceTypeAndSourceId(SOURCE_TYPE, service.getServiceId())
                    .orElseGet(() -> createNewDocument(service));

            if (rawHash.equals(document.getRawHash())) {
                continue;
            }

            document.setTitle(safeTitle(service.getServiceName()));
            document.setFilename(buildFilename(service));
            document.setSource(SOURCE_NAME);
            document.setStatus("PENDING_EMBEDDING");
            document.setQdrantCollection(QDRANT_COLLECTION);
            document.setContent(markdown);
            document.setRawHash(rawHash);
            document.setTextLength(markdown.length());
            document.setChunkCount(estimateChunkCount(markdown));
            document.setUpdatedAt(LocalDateTime.now());

            savedDocuments.add(ragDocumentRepository.save(document));
        }

        return savedDocuments;
    }

    public long countWelfareServiceRagDocuments() {
        return ragDocumentRepository.findAll()
                .stream()
                .filter(document -> SOURCE_TYPE.equals(document.getSourceType()))
                .count();
    }

    private RagDocument createNewDocument(WelfareServiceInfo service) {
        RagDocument document = new RagDocument();

        document.setDocumentId(SOURCE_TYPE + ":" + service.getServiceId());
        document.setSourceType(SOURCE_TYPE);
        document.setSourceId(service.getServiceId());
        document.setCreatedAt(LocalDateTime.now());

        return document;
    }

    private boolean hasDetailData(WelfareServiceInfo service) {
        return hasText(service.getSupportTarget())
                || hasText(service.getSupportContent())
                || hasText(service.getApplicationMethod())
                || hasText(service.getSelectionCriteria());
    }

    private String buildMarkdown(WelfareServiceInfo service) {
        StringBuilder markdown = new StringBuilder();

        appendLine(markdown, "# " + safeTitle(service.getServiceName()));
        appendBlank(markdown);

        appendSection(
                markdown,
                "어떤 도움을 주는 서비스인가",
                firstNonBlank(service.getSupportContent(), service.getSummary())
        );

        appendSection(
                markdown,
                "누가 이용할 수 있는가",
                firstNonBlank(service.getSupportTarget(), service.getSelectionCriteria())
        );

        appendSection(
                markdown,
                "선정 기준",
                service.getSelectionCriteria()
        );

        appendSection(
                markdown,
                "어떻게 신청하는가",
                service.getApplicationMethod()
        );

        appendSection(
                markdown,
                "문의처",
                service.getContact()
        );

        appendRelatedTargets(markdown, service);

        appendSection(
                markdown,
                "담당 기관",
                firstNonBlank(service.getDepartment(), "")
        );

        appendSection(
                markdown,
                "상세 링크",
                service.getDetailLink()
        );

        appendLine(markdown, "## 데이터 출처");
        appendLine(markdown, SOURCE_NAME);
        appendBlank(markdown);

        return markdown.toString().trim();
    }

    private void appendRelatedTargets(StringBuilder markdown, WelfareServiceInfo service) {
        List<String> targets = new ArrayList<>();

        addIfText(targets, service.getLifeCycle());
        addIfText(targets, service.getHouseholdType());
        addIfText(targets, service.getInterestTopic());

        if (targets.isEmpty()) {
            return;
        }

        appendLine(markdown, "## 관련 대상");

        for (String target : targets) {
            appendLine(markdown, target);
        }

        appendBlank(markdown);
    }

    private void appendSection(StringBuilder markdown, String title, String content) {
        if (!hasText(content)) {
            return;
        }

        appendLine(markdown, "## " + title);
        appendLine(markdown, content.trim());
        appendBlank(markdown);
    }

    private void appendLine(StringBuilder markdown, String line) {
        markdown.append(line).append("\n");
    }

    private void appendBlank(StringBuilder markdown) {
        markdown.append("\n");
    }

    private void addIfText(List<String> values, String value) {
        if (!hasText(value)) {
            return;
        }

        String[] parts = value.split("[,|/]");

        for (String part : parts) {
            String trimmed = part.trim();

            if (hasText(trimmed) && !values.contains(trimmed)) {
                values.add(trimmed);
            }
        }
    }

    private String buildFilename(WelfareServiceInfo service) {
        String name = safeTitle(service.getServiceName())
                .replaceAll("[\\\\/:*?\"<>|]", "_")
                .replaceAll("\\s+", "_");

        return name + "_" + service.getServiceId() + ".md";
    }

    private String safeTitle(String value) {
        if (!hasText(value)) {
            return "복지서비스";
        }

        return value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }

        return "";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private int estimateChunkCount(String markdown) {
        int chunkSize = 1200;
        int length = markdown == null ? 0 : markdown.length();

        if (length == 0) {
            return 0;
        }

        return (int) Math.ceil((double) length / chunkSize);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));

            return HexFormat.of().formatHex(hash);
        } catch (Exception error) {
            throw new RuntimeException("raw_hash 생성 실패", error);
        }
    }
}