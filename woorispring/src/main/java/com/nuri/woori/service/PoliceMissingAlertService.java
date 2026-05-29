package com.nuri.woori.service;

import com.nuri.woori.entity.PoliceMissingAlert;
import com.nuri.woori.repository.PoliceMissingAlertRepository;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class PoliceMissingAlertService {

    private static final String AMBER_API_URL = "https://www.safe182.go.kr/api/lcm/amberList.do";
    private static final String FIND_CHILD_API_URL = "https://www.safe182.go.kr/api/lcm/findChildList.do";
    private static final int ROW_SIZE = 100;
    private static final int MAX_PAGES = 4;

    private final PoliceMissingAlertRepository policeMissingAlertRepository;
    private final Environment environment;
    private final RestClient restClient = RestClient.create();

    public PoliceMissingAlertService(
            PoliceMissingAlertRepository policeMissingAlertRepository,
            Environment environment
    ) {
        this.policeMissingAlertRepository = policeMissingAlertRepository;
        this.environment = environment;
    }

    public List<PoliceMissingAlert> getLatestAlerts() {
        return policeMissingAlertRepository.findTop100ByOrderBySyncedAtDesc();
    }

    public List<PoliceMissingAlert> syncTodayAlerts() {
        return syncAlerts(LocalDate.now());
    }

    public List<PoliceMissingAlert> syncAlerts(LocalDate date) {
        validateApiKeys();
        return syncPages(date);
    }

    public List<PoliceMissingAlert> syncAlerts(LocalDate from, LocalDate to) {
        validateApiKeys();

        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must be before or equal to to");
        }

        List<PoliceMissingAlert> savedAlerts = new ArrayList<>();

        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            savedAlerts.addAll(syncPages(date));
        }

        return savedAlerts;
    }

    public List<PoliceMissingAlert> syncAllAlerts() {
        validateApiKeys();

        List<PoliceMissingAlert> savedAlerts = new ArrayList<>();

        for (int page = 1; page <= MAX_PAGES; page++) {
            Safe182Page parsedPage = requestPageWithoutDate(page);
            List<PoliceMissingAlert> parsedAlerts = parsedPage.alerts();

            logSyncResult(null, page, parsedPage);

            if (parsedAlerts.isEmpty()) {
                break;
            }

            for (PoliceMissingAlert parsedAlert : parsedAlerts) {
                savedAlerts.add(saveAlert(parsedAlert));
            }

            if (isLastPage(page, parsedPage)) {
                break;
            }
        }

        return savedAlerts;
    }

    private List<PoliceMissingAlert> syncPages(LocalDate date) {
        List<PoliceMissingAlert> savedAlerts = new ArrayList<>();

        for (int page = 1; page <= MAX_PAGES; page++) {
            Safe182Page parsedPage = requestPage(date, page);
            List<PoliceMissingAlert> parsedAlerts = parsedPage.alerts();

            logSyncResult(date, page, parsedPage);

            if (parsedAlerts.isEmpty()) {
                break;
            }

            for (PoliceMissingAlert parsedAlert : parsedAlerts) {
                savedAlerts.add(saveAlert(parsedAlert));
            }

            if (isLastPage(page, parsedPage)) {
                break;
            }
        }

        return savedAlerts;
    }

    private Safe182Page requestPage(LocalDate date, int page) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("esntlId", getSafe182EsntlId());
        form.add("authKey", getSafe182AuthKey());
        form.add("rowSize", String.valueOf(ROW_SIZE));
        form.add("page", String.valueOf(page));
        form.add("xmlUseYN", "Y");
        form.add("occrde", date.format(DateTimeFormatter.BASIC_ISO_DATE));

        byte[] response = restClient.post()
                .uri(AMBER_API_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(byte[].class);

        return parseXml(response);
    }

    private Safe182Page requestPageWithoutDate(int page) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("esntlId", getSafe182EsntlId());
        form.add("authKey", getSafe182AuthKey());
        form.add("rowSize", String.valueOf(ROW_SIZE));
        form.add("page", String.valueOf(page));
        form.add("xmlUseYN", "Y");

        byte[] response = restClient.post()
                .uri(FIND_CHILD_API_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(byte[].class);

        return parseXml(response);
    }

    private boolean isLastPage(int page, Safe182Page parsedPage) {
        if (parsedPage.totalCount() > 0) {
            return page * ROW_SIZE >= parsedPage.totalCount();
        }

        return parsedPage.alerts().size() < ROW_SIZE;
    }

    private PoliceMissingAlert saveAlert(PoliceMissingAlert parsedAlert) {
        PoliceMissingAlert alert = policeMissingAlertRepository
                .findByExternalKey(parsedAlert.getExternalKey())
                .orElse(parsedAlert);

        copyAlert(parsedAlert, alert);
        alert.setSyncedAt(LocalDateTime.now());

        return policeMissingAlertRepository.save(alert);
    }

    private Safe182Page parseXml(byte[] xmlBytes) {
        try {
            String xml = decodeSafe182Xml(xmlBytes);

            Document document = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder()
                    .parse(new InputSource(new StringReader(xml)));

            document.getDocumentElement().normalize();

            int totalCount = parseInt(firstText(document, "totalCount"));
            String resultCode = firstText(document, "result");
            String resultMessage = firstText(document, "msg");

            List<Element> items = collectAlertElements(document);
            List<PoliceMissingAlert> alerts = new ArrayList<>();

            for (Element item : items) {
                alerts.add(parseAlert(item));
            }

            return new Safe182Page(alerts, totalCount, resultCode, resultMessage);
        } catch (Exception error) {
            throw new RuntimeException("Safe182 XML parse failed", error);
        }
    }

    private List<Element> collectAlertElements(Document document) {
        List<Element> alerts = new ArrayList<>();
        NodeList lists = document.getElementsByTagName("list");

        for (int index = 0; index < lists.getLength(); index++) {
            Element list = (Element) lists.item(index);

            if (hasDirectChild(list, "nm") || hasDirectChild(list, "occrde")) {
                alerts.add(list);
            }
        }

        if (!alerts.isEmpty()) {
            return alerts;
        }

        for (int index = 0; index < lists.getLength(); index++) {
            Element list = (Element) lists.item(index);
            NodeList children = list.getChildNodes();

            for (int childIndex = 0; childIndex < children.getLength(); childIndex++) {
                Node child = children.item(childIndex);

                if (child instanceof Element childElement && containsAlertFields(childElement)) {
                    alerts.add(childElement);
                }
            }
        }

        return alerts;
    }

    private boolean hasDirectChild(Element element, String tagName) {
        NodeList children = element.getChildNodes();

        for (int index = 0; index < children.getLength(); index++) {
            Node child = children.item(index);

            if (child instanceof Element childElement && tagName.equals(childElement.getTagName())) {
                return true;
            }
        }

        return false;
    }

    private boolean containsAlertFields(Element element) {
        return element.getElementsByTagName("nm").getLength() > 0
                || element.getElementsByTagName("occrde").getLength() > 0
                || element.getElementsByTagName("occrAdres").getLength() > 0;
    }

    private PoliceMissingAlert parseAlert(Element item) {
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

        String externalKey = String.join("|",
                safe(name),
                safe(occurredDate),
                safe(occurredAddress),
                safe(gender)
        );

        alert.setExternalKey(externalKey);
        alert.setPhotoUrl(savePolicePhoto(externalKey, text(item, "tknphotoFile")));

        return alert;
    }

    private String savePolicePhoto(String externalKey, String photoBase64) {
        if (photoBase64 == null || photoBase64.isBlank()) {
            return "";
        }

        try {
            byte[] imageBytes = Base64.getMimeDecoder().decode(photoBase64);

            Path directory = Paths.get("uploads", "police-missing");
            Files.createDirectories(directory);

            String fileName = Integer.toHexString(externalKey.hashCode()) + ".jpg";
            Path filePath = directory.resolve(fileName);

            Files.write(filePath, imageBytes);

            return "/uploads/police-missing/" + fileName;
        } catch (Exception error) {
            return "";
        }
    }

    private String text(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        String value = nodes.item(0).getTextContent();

        if (value == null) {
            return "";
        }

        return fixMojibake(value);
    }

    private String fixMojibake(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        String trimmed = value.trim();

        boolean looksBroken =
                trimmed.indexOf('\u00EC') >= 0
                        || trimmed.indexOf('\u00EB') >= 0
                        || trimmed.indexOf('\u00EA') >= 0
                        || trimmed.indexOf('\u00ED') >= 0
                        || trimmed.indexOf('\u00EF') >= 0
                        || trimmed.indexOf('\u00BF') >= 0
                        || trimmed.indexOf('\u00BD') >= 0
                        || trimmed.indexOf('\u0192') >= 0
                        || trimmed.indexOf('\u20AC') >= 0;

        if (!looksBroken) {
            return trimmed;
        }

        List<String> candidates = new ArrayList<>();
        candidates.add(trimmed);
        candidates.add(redecodeMojibake(trimmed, Charset.forName("windows-1252")));
        candidates.add(redecodeMojibake(trimmed, StandardCharsets.ISO_8859_1));

        String best = candidates.get(0);
        int bestScore = koreanScore(best);

        for (String candidate : candidates) {
            int score = koreanScore(candidate);

            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }

        return best;
    }

    private String redecodeMojibake(String value, Charset wrongCharset) {
        try {
            return new String(
                    value.getBytes(wrongCharset),
                    StandardCharsets.UTF_8
            ).trim();
        } catch (Exception error) {
            return value;
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

    private String decodeSafe182Xml(byte[] xmlBytes) {
        String utf8 = new String(xmlBytes, StandardCharsets.UTF_8);
        String ms949 = new String(xmlBytes, Charset.forName("MS949"));
        String eucKr = new String(xmlBytes, Charset.forName("EUC-KR"));

        List<String> candidates = List.of(
                utf8,
                fixMojibake(utf8),
                ms949,
                fixMojibake(ms949),
                eucKr,
                fixMojibake(eucKr)
        );

        String best = candidates.get(0);
        int bestScore = koreanScore(best);

        for (String candidate : candidates) {
            int score = koreanScore(candidate);

            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }

        return best;
    }

    private int koreanScore(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }

        int score = 0;

        for (int index = 0; index < value.length(); index++) {
            char ch = value.charAt(index);

            if (ch >= '\uAC00' && ch <= '\uD7A3') {
                score += 2;
            }

            if (ch == '\uFFFD') {
                score -= 5;
            }

            if (ch == '\u00EC' || ch == '\u00EB' || ch == '\u00EA' || ch == '\u00ED') {
                score -= 2;
            }
        }

        return score;
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

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private void validateApiKeys() {
        String esntlId = getSafe182EsntlId();
        String authKey = getSafe182AuthKey();

        if (esntlId.isBlank() || authKey.isBlank()) {
            throw new RuntimeException("Safe182 API key is missing");
        }
    }

    private String getSafe182EsntlId() {
        return firstNonBlank(
                safeProperty("police.safe182.esntl-id"),
                safeProperty("SAFE182_ESNTL_ID")
        );
    }

    private String getSafe182AuthKey() {
        return firstNonBlank(
                safeProperty("police.safe182.auth-key"),
                safeProperty("SAFE182_AUTH_KEY")
        );
    }

    private String safeProperty(String key) {
        try {
            return environment.getProperty(key, "");
        } catch (IllegalArgumentException error) {
            return "";
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private void logSyncResult(LocalDate date, int page, Safe182Page parsedPage) {
        System.out.println(
                "Safe182 date=" + date
                        + ", page=" + page
                        + ", totalCount=" + parsedPage.totalCount()
                        + ", listCount=" + parsedPage.alerts().size()
                        + ", result=" + parsedPage.resultCode()
                        + ", msg=" + parsedPage.resultMessage()
        );
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

    private record Safe182Page(
            List<PoliceMissingAlert> alerts,
            int totalCount,
            String resultCode,
            String resultMessage
    ) {
    }
}