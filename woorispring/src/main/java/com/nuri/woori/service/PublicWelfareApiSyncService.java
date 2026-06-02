package com.nuri.woori.service;

import com.nuri.woori.entity.WelfareServiceInfo;
import com.nuri.woori.repository.WelfareServiceInfoRepository;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class PublicWelfareApiSyncService {

    private static final String LIST_URL =
            "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist";

    private static final String DETAIL_URL =
            "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed";

    private final WelfareServiceInfoRepository repository;
    private final Environment environment;
    private final WelfareServiceFilter welfareServiceFilter;
    private final RestClient restClient = RestClient.create();

    public PublicWelfareApiSyncService(
            WelfareServiceInfoRepository repository,
            Environment environment,
            WelfareServiceFilter welfareServiceFilter
    ) {
        this.repository = repository;
        this.environment = environment;
        this.welfareServiceFilter = welfareServiceFilter;
    }

    public List<WelfareServiceInfo> syncWelfareServices() {
        String serviceKey = getServiceKey();

        int numOfRows = 100;
        int pageNo = 1;
        int totalCount = 0;
        int maxPages = 5;

        List<WelfareServiceInfo> savedItems = new ArrayList<>();

        do {
            String requestUrl = LIST_URL
                    + "?serviceKey=" + serviceKey
                    + "&pageNo=" + pageNo
                    + "&numOfRows=" + numOfRows;

            String xml = restClient.get()
                    .uri(URI.create(requestUrl))
                    .retrieve()
                    .body(String.class);

            WelfareApiPage parsedPage = parseListXml(xml);

            totalCount = parsedPage.totalCount();

            System.out.println(
                    "복지서비스 목록 동기화 page=" + pageNo
                            + ", items=" + parsedPage.items().size()
                            + ", totalCount=" + totalCount
            );

            for (WelfareServiceInfo parsed : parsedPage.items()) {
                WelfareServiceInfo entity = repository
                        .findByServiceId(parsed.getServiceId())
                        .orElse(parsed);

                copyListFields(parsed, entity);

                if (welfareServiceFilter.shouldExclude(
                        entity.getServiceName(),
                        entity.getSummary(),
                        entity.getSupportTarget(),
                        entity.getSupportContent()
                )) {
                    System.out.println(
                            "복지서비스 목록 저장 제외 serviceId="
                                    + entity.getServiceId()
                                    + ", serviceName="
                                    + entity.getServiceName()
                    );
                    continue;
                }

                savedItems.add(repository.save(entity));
            }

            pageNo++;
        } while ((pageNo - 1) * numOfRows < totalCount && pageNo <= maxPages);

        return savedItems;
    }

    public WelfareServiceInfo syncWelfareServiceDetail(String serviceId) {
        String serviceKey = getServiceKey();

        if (serviceId == null || serviceId.isBlank()) {
            throw new IllegalArgumentException("serviceId가 비어 있습니다.");
        }

        WelfareServiceInfo entity = repository.findByServiceId(serviceId)
                .orElseThrow(() -> new RuntimeException("목록 데이터가 먼저 저장되어 있어야 합니다. serviceId=" + serviceId));

        String requestUrl = DETAIL_URL
                + "?serviceKey=" + serviceKey
                + "&servId=" + serviceId;

        String xml = restClient.get()
                .uri(URI.create(requestUrl))
                .retrieve()
                .body(String.class);

        WelfareServiceInfo detail = parseDetailXml(xml, serviceId);

        copyDetailFields(detail, entity);

        if (welfareServiceFilter.shouldExclude(
                entity.getServiceName(),
                entity.getSummary(),
                entity.getSupportTarget(),
                entity.getSupportContent()
        )) {
            repository.delete(entity);

            throw new RuntimeException(
                    "필터 제외 대상 복지서비스라서 welfare_services에서 삭제했습니다. serviceId="
                            + serviceId
                            + ", serviceName="
                            + entity.getServiceName()
            );
        }

        entity.setDetailSyncedAt(LocalDateTime.now());
        entity.setSyncedAt(LocalDateTime.now());
        entity.setSourceName("한국사회보장정보원 지자체복지서비스 API");

        return repository.save(entity);
    }

    public List<WelfareServiceInfo> syncWelfareServiceDetails(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));

        List<WelfareServiceInfo> targets = repository.findAll()
                .stream()
                .filter(item -> item.getServiceId() != null && !item.getServiceId().isBlank())
                .filter(item -> item.getDetailSyncedAt() == null)
                .limit(safeLimit)
                .toList();

        List<WelfareServiceInfo> savedItems = new ArrayList<>();

        for (WelfareServiceInfo target : targets) {
            try {
                WelfareServiceInfo saved = syncWelfareServiceDetail(target.getServiceId());
                savedItems.add(saved);

                System.out.println(
                        "복지서비스 상세 동기화 성공 serviceId="
                                + target.getServiceId()
                                + ", serviceName="
                                + target.getServiceName()
                );
            } catch (Exception error) {
                System.out.println(
                        "복지서비스 상세 동기화 실패 serviceId="
                                + target.getServiceId()
                                + ", message="
                                + error.getMessage()
                );
            }
        }

        return savedItems;
    }

    private String getServiceKey() {
        String serviceKey = environment.getProperty("public-data.service-key", "");

        if (serviceKey == null || serviceKey.isBlank()) {
            throw new RuntimeException("공공데이터 serviceKey가 없습니다.");
        }

        return serviceKey.trim();
    }

    private void copyListFields(WelfareServiceInfo source, WelfareServiceInfo target) {
        target.setServiceId(source.getServiceId());
        target.setServiceName(source.getServiceName());
        target.setSummary(source.getSummary());
        target.setDepartment(source.getDepartment());
        target.setContact(source.getContact());
        target.setDetailLink(source.getDetailLink());
        target.setLifeCycle(source.getLifeCycle());
        target.setHouseholdType(source.getHouseholdType());
        target.setInterestTopic(source.getInterestTopic());
        target.setSourceName("한국사회보장정보원 지자체복지서비스 API");
        target.setSyncedAt(LocalDateTime.now());
    }

    private void copyDetailFields(WelfareServiceInfo source, WelfareServiceInfo target) {
        if (hasText(source.getSupportTarget())) {
            target.setSupportTarget(source.getSupportTarget());
        }

        if (hasText(source.getSelectionCriteria())) {
            target.setSelectionCriteria(source.getSelectionCriteria());
        }

        if (hasText(source.getSupportContent())) {
            target.setSupportContent(source.getSupportContent());
        }

        if (hasText(source.getApplicationMethod())) {
            target.setApplicationMethod(source.getApplicationMethod());
        }

        if (hasText(source.getRequiredDocuments())) {
            target.setRequiredDocuments(source.getRequiredDocuments());
        }

        if (hasText(source.getContact())) {
            target.setContact(source.getContact());
        }

        if (hasText(source.getDepartment())) {
            target.setDepartment(source.getDepartment());
        }

        if (hasText(source.getDetailLink())) {
            target.setDetailLink(source.getDetailLink());
        }

        if (hasText(source.getSummary())) {
            target.setSummary(source.getSummary());
        }
    }

    private WelfareServiceInfo parseDetailXml(String xml, String serviceId) {
        try {
            Document document = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder()
                    .parse(new InputSource(new StringReader(xml)));

            document.getDocumentElement().normalize();

            String resultCode = firstNonBlank(
                    firstText(document, "resultCode"),
                    firstText(document, "result")
            );

            String resultMessage = firstNonBlank(
                    firstText(document, "resultMessage"),
                    firstText(document, "msg")
            );

            if (hasText(resultCode) && !isSuccessResult(resultCode)) {
                throw new RuntimeException("상세 API 응답 오류 resultCode=" + resultCode + ", message=" + resultMessage);
            }

            WelfareServiceInfo detail = new WelfareServiceInfo();

            detail.setServiceId(firstNonBlank(
                    firstText(document, "servId"),
                    serviceId
            ));

            detail.setServiceName(firstText(document, "servNm"));

            detail.setSummary(firstNonBlank(
                    firstText(document, "servDgst"),
                    firstText(document, "servDgstCn"),
                    firstText(document, "summary")
            ));

            detail.setSupportTarget(firstNonBlank(
                    firstText(document, "sprtTrgtCn"),
                    firstText(document, "tgtrDtlCn"),
                    firstText(document, "trgterIndvdlCn"),
                    firstText(document, "supportTarget"),
                    firstText(document, "servTrgtCn")
            ));

            detail.setSelectionCriteria(firstNonBlank(
                    firstText(document, "slctCritCn"),
                    firstText(document, "slctCrtCn"),
                    firstText(document, "selectionCriteria"),
                    firstText(document, "seltCritCn")
            ));

            detail.setSupportContent(firstNonBlank(
                    firstText(document, "alwServCn"),
                    firstText(document, "servCn"),
                    firstText(document, "supportContent"),
                    firstText(document, "sprtCn"),
                    firstText(document, "servSeDetailCn")
            ));

            detail.setApplicationMethod(firstNonBlank(
                    firstText(document, "aplyMtdCn"),
                    firstText(document, "reqstMthdCn"),
                    firstText(document, "applicationMethod"),
                    firstText(document, "applMtdCn")
            ));

            detail.setRequiredDocuments(firstNonBlank(
                    firstText(document, "reqstDcmtCn"),
                    firstText(document, "sbmsnDocCn"),
                    firstText(document, "requiredDocuments"),
                    firstText(document, "prvddcmtCn")
            ));

            detail.setContact(firstNonBlank(
                    firstText(document, "inqNum"),
                    firstText(document, "rprsCtadr"),
                    firstText(document, "inqplCtadr"),
                    firstText(document, "contact")
            ));

            detail.setDepartment(firstNonBlank(
                    firstText(document, "jurOrgNm"),
                    firstText(document, "jurMnofNm"),
                    firstText(document, "department")
            ));

            detail.setDetailLink(firstNonBlank(
                    firstText(document, "servDtlLink"),
                    firstText(document, "detailLink")
            ));

            return detail;
        } catch (Exception error) {
            throw new RuntimeException("복지서비스 상세 API XML 파싱 실패 serviceId=" + serviceId, error);
        }
    }

    private boolean isSuccessResult(String resultCode) {
        return "00".equals(resultCode)
                || "0".equals(resultCode)
                || "INFO-000".equalsIgnoreCase(resultCode)
                || "NORMAL_CODE".equalsIgnoreCase(resultCode);
    }

    private WelfareApiPage parseListXml(String xml) {
        try {
            Document document = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder()
                    .parse(new InputSource(new StringReader(xml)));

            document.getDocumentElement().normalize();

            int totalCount = parseInt(firstText(document, "totalCount"));

            NodeList items = document.getElementsByTagName("servList");
            List<WelfareServiceInfo> result = new ArrayList<>();

            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);

                WelfareServiceInfo service = new WelfareServiceInfo();
                service.setServiceId(text(item, "servId"));
                service.setServiceName(text(item, "servNm"));
                service.setSummary(text(item, "servDgst"));
                service.setDepartment(text(item, "jurMnofNm"));
                service.setContact(text(item, "inqNum"));
                service.setDetailLink(text(item, "servDtlLink"));
                service.setLifeCycle(text(item, "lifeNmArray"));
                service.setHouseholdType(text(item, "trgterIndvdlNmArray"));
                service.setInterestTopic(text(item, "intrsThemaNmArray"));

                if (service.getServiceId() != null && !service.getServiceId().isBlank()) {
                    result.add(service);
                }
            }

            return new WelfareApiPage(result, totalCount);
        } catch (Exception error) {
            throw new RuntimeException("복지서비스 API XML 파싱 실패", error);
        }
    }

    private int parseInt(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }

        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException error) {
            return 0;
        }
    }

    private String firstText(Document document, String tagName) {
        NodeList nodes = document.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        String value = nodes.item(0).getTextContent();

        return value == null ? "" : value.trim();
    }

    private String text(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        String value = nodes.item(0).getTextContent();

        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record WelfareApiPage(
            List<WelfareServiceInfo> items,
            int totalCount
    ) {
    }
}