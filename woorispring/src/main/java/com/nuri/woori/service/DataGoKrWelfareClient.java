package com.nuri.woori.service;

import com.nuri.woori.entity.Senior;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DataGoKrWelfareClient {
    private final RestClient restClient = RestClient.create();

    @Value("${data.api.service-key}")
    private String serviceKey;

    @Value("${public-data.welfare-base-url}")
    private String baseUrl;

    public List<WelfareBenefitDoc> searchBenefits(Senior senior, String question) {
        return fetchBenefitDocs(1, 50);
    }

    public List<WelfareBenefitDoc> fetchBenefitDocs(int pageNo, int numOfRows) {
        String url = buildListUrl(pageNo, numOfRows);

        String xml = restClient
                .get()
                .uri(URI.create(url))
                .retrieve()
                .body(String.class);

        return parseBenefitDocs(xml);
    }

    private String buildListUrl(int pageNo, int numOfRows) {
        return baseUrl + "/LcgvWelfarelist"
                + "?serviceKey=" + encodeServiceKey()
                + "&pageNo=" + pageNo
                + "&numOfRows=" + numOfRows;
    }

    private String encodeServiceKey() {
        String key = serviceKey == null ? "" : serviceKey.trim();

        if (key.contains("%")) {
            return key;
        }

        return URLEncoder.encode(key, StandardCharsets.UTF_8);
    }

    private List<WelfareBenefitDoc> parseBenefitDocs(String xml) {
        List<WelfareBenefitDoc> docs = new ArrayList<>();

        try {
            Document document = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder()
                    .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

            NodeList items = document.getElementsByTagName("servList");

            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                Map<String, String> fields = new LinkedHashMap<>();

                NodeList children = item.getChildNodes();
                for (int j = 0; j < children.getLength(); j++) {
                    if (children.item(j) instanceof Element child) {
                        fields.put(child.getTagName(), child.getTextContent());
                    }
                }

                String title = first(fields, "servNm", "wlfareInfoNm", "serviceNm", "title");
                String org = first(fields, "jurMnofNm", "servDgst", "inqueryNm", "organization");
                String content = String.join("\n", fields.values());
                String externalId = first(fields, "servId", "wlfareInfoId", "serviceId");

                if (externalId.equals("-")) {
                    externalId = "PUBLIC_API:" + Integer.toHexString((title + ":" + org + ":" + content).hashCode());
                }

                docs.add(new WelfareBenefitDoc(externalId, title, org, content));
            }
        } catch (Exception exception) {
            return docs;
        }

        return docs;
    }

    private String first(Map<String, String> fields, String... keys) {
        for (String key : keys) {
            String value = fields.get(key);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }

        return "-";
    }

    public record WelfareBenefitDoc(
            String externalId,
            String title,
            String organization,
            String content
    ) {
    }
}
