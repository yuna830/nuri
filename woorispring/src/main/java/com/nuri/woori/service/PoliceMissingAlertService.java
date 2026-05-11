package com.nuri.woori.service;

import com.nuri.woori.entity.PoliceMissingAlert;
import com.nuri.woori.repository.PoliceMissingAlertRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class PoliceMissingAlertService {

    private static final String API_URL = "https://www.safe182.go.kr/api/lcm/amberList.do";

    private final PoliceMissingAlertRepository policeMissingAlertRepository;
    private final RestClient restClient = RestClient.create();

    @Value("${police.safe182.esntl-id:}")
    private String esntlId;

    @Value("${police.safe182.auth-key:}")
    private String authKey;

    public PoliceMissingAlertService(PoliceMissingAlertRepository policeMissingAlertRepository) {
        this.policeMissingAlertRepository = policeMissingAlertRepository;
    }

    public List<PoliceMissingAlert> getLatestAlerts() {
        return policeMissingAlertRepository.findTop100ByOrderBySyncedAtDesc();
    }

    public List<PoliceMissingAlert> syncTodayAlerts() {
        return syncAlerts(LocalDate.now());
    }

    public List<PoliceMissingAlert> syncAlerts(LocalDate occurredDate) {
        if (esntlId == null || esntlId.isBlank() || authKey == null || authKey.isBlank()) {
            throw new RuntimeException("Safe182 API key is missing");
        }

        String dateValue = occurredDate.format(DateTimeFormatter.BASIC_ISO_DATE);

        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("esntlId", esntlId);
        form.add("authKey", authKey);
        form.add("rowSize", "100");
        form.add("page", "1");
        form.add("occrde", dateValue);
        form.add("xmlUseYN", "Y");

        String response = restClient.post()
                .uri(API_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(String.class);

        List<PoliceMissingAlert> parsedAlerts = parseXml(response);
        List<PoliceMissingAlert> savedAlerts = new ArrayList<>();

        for (PoliceMissingAlert parsedAlert : parsedAlerts) {
            PoliceMissingAlert alert = policeMissingAlertRepository
                    .findByExternalKey(parsedAlert.getExternalKey())
                    .orElse(parsedAlert);

            copyAlert(parsedAlert, alert);
            savedAlerts.add(policeMissingAlertRepository.save(alert));
        }

        return savedAlerts;
    }

    private List<PoliceMissingAlert> parseXml(String xml) {
        try {
            Document document = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder()
                    .parse(new InputSource(new StringReader(xml)));

            NodeList items = document.getElementsByTagName("list");
            List<PoliceMissingAlert> result = new ArrayList<>();

            for (int index = 0; index < items.getLength(); index++) {
                Element item = (Element) items.item(index);

                String name = text(item, "nm");
                String occurredDate = text(item, "occrde");
                String occurredAddress = text(item, "occrAdres");
                String gender = text(item, "sexdstnDscd");

                PoliceMissingAlert alert = new PoliceMissingAlert();
                alert.setName(name);
                alert.setGender(gender);
                alert.setTargetType(text(item, "writngTrgetDscd"));
                alert.setOccurredDate(occurredDate);
                alert.setOccurredAddress(occurredAddress);
                alert.setAge(text(item, "age"));
                alert.setAgeNow(text(item, "ageNow"));
                alert.setHeight(text(item, "height"));
                alert.setWeight(text(item, "bdwgh"));
                alert.setBodyType(text(item, "frmDscd"));
                alert.setFaceShape(text(item, "faceshpeDscd"));
                alert.setHairShape(text(item, "hairshpeDscd"));
                alert.setHairColor(text(item, "haircolrDscd"));
                alert.setClothing(text(item, "alldressingDscd"));
                alert.setFeature(text(item, "etcSpfeatr"));
                alert.setPhotoUrl(text(item, "tknphotoFile"));

                alert.setExternalKey(String.join("|",
                        safe(name),
                        safe(occurredDate),
                        safe(occurredAddress),
                        safe(gender)
                ));

                result.add(alert);
            }

            return result;
        } catch (Exception error) {
            throw new RuntimeException("Safe182 XML parse failed", error);
        }
    }

    private String text(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        return nodes.item(0).getTextContent();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private void copyAlert(PoliceMissingAlert source, PoliceMissingAlert target) {
        target.setExternalKey(source.getExternalKey());
        target.setName(source.getName());
        target.setGender(source.getGender());
        target.setTargetType(source.getTargetType());
        target.setOccurredDate(source.getOccurredDate());
        target.setOccurredAddress(source.getOccurredAddress());
        target.setAge(source.getAge());
        target.setAgeNow(source.getAgeNow());
        target.setHeight(source.getHeight());
        target.setWeight(source.getWeight());
        target.setBodyType(source.getBodyType());
        target.setFaceShape(source.getFaceShape());
        target.setHairShape(source.getHairShape());
        target.setHairColor(source.getHairColor());
        target.setClothing(source.getClothing());
        target.setFeature(source.getFeature());
        target.setPhotoUrl(source.getPhotoUrl());
    }
}
