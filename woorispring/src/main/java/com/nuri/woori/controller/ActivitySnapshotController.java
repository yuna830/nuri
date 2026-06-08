package com.nuri.woori.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nuri.woori.entity.SeniorActivitySnapshot;
import com.nuri.woori.repository.SeniorActivitySnapshotRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/seniors/{seniorId}/activity")
public class ActivitySnapshotController {

    private final SeniorActivitySnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ActivitySnapshotController(SeniorActivitySnapshotRepository snapshotRepository) {
        this.snapshotRepository = snapshotRepository;
    }

    // ── GET 엔드포인트 (최근 10개 스냅샷에서 실제 데이터 탐색) ──────────────

    @GetMapping("/today")
    public ResponseEntity<JsonNode> getActivityToday(@PathVariable Long seniorId) {
        return respond(seniorId, "today");
    }

    @GetMapping("/baseline")
    public ResponseEntity<JsonNode> getBaseline(@PathVariable Long seniorId) {
        return respond(seniorId, "baseline");
    }

    @GetMapping("/fall-pattern")
    public ResponseEntity<JsonNode> getFallPattern(@PathVariable Long seniorId) {
        return respond(seniorId, "fallPattern");
    }

    @GetMapping("/slots")
    public ResponseEntity<JsonNode> getSlots(@PathVariable Long seniorId) {
        return respond(seniorId, "slots");
    }

    @GetMapping("/trend")
    public ResponseEntity<JsonNode> getTrend(@PathVariable Long seniorId) {
        return respond(seniorId, "trend");
    }

    // ── PUT 엔드포인트 (프론트가 FastAPI 데이터를 Spring Boot에 캐시) ────────

    @PutMapping("/today")
    public ResponseEntity<Void> pushToday(@PathVariable Long seniorId, @RequestBody String body) {
        pushData(seniorId, "today", body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/baseline")
    public ResponseEntity<Void> pushBaseline(@PathVariable Long seniorId, @RequestBody String body) {
        pushData(seniorId, "baseline", body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/fall-pattern")
    public ResponseEntity<Void> pushFallPattern(@PathVariable Long seniorId, @RequestBody String body) {
        pushData(seniorId, "fallPattern", body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/slots")
    public ResponseEntity<Void> pushSlots(@PathVariable Long seniorId, @RequestBody String body) {
        pushData(seniorId, "slots", body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/trend")
    public ResponseEntity<Void> pushTrend(@PathVariable Long seniorId, @RequestBody String body) {
        pushData(seniorId, "trend", body);
        return ResponseEntity.ok().build();
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────

    private ResponseEntity<JsonNode> respond(Long seniorId, String field) {
        List<SeniorActivitySnapshot> recent = snapshotRepository
                .findTop10BySeniorIdOrderBySnapshotDateDesc(seniorId);

        for (SeniorActivitySnapshot snap : recent) {
            String json = getJson(snap, field);
            if (json == null || isPending(json)) continue;
            try {
                return ResponseEntity.ok(objectMapper.readTree(json));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(pending());
    }

    private void pushData(Long seniorId, String field, String json) {
        if (json == null || isPending(json)) return;
        LocalDate today = LocalDate.now();

        SeniorActivitySnapshot snapshot = snapshotRepository
                .findTopBySeniorIdOrderBySnapshotDateDesc(seniorId)
                .filter(s -> today.equals(s.getSnapshotDate()))
                .orElseGet(() -> {
                    SeniorActivitySnapshot fresh = new SeniorActivitySnapshot();
                    fresh.setSeniorId(seniorId);
                    fresh.setSnapshotDate(today);
                    return fresh;
                });

        switch (field) {
            case "today"       -> snapshot.setActivityTodayJson(json);
            case "baseline"    -> snapshot.setBaselineJson(json);
            case "fallPattern" -> snapshot.setFallPatternJson(json);
            case "slots"       -> snapshot.setActivitySlotsJson(json);
            case "trend"       -> snapshot.setActivityTrendJson(json);
        }
        snapshot.setUpdatedAt(LocalDateTime.now());
        snapshotRepository.save(snapshot);
    }

    private String getJson(SeniorActivitySnapshot snap, String field) {
        return switch (field) {
            case "today"       -> snap.getActivityTodayJson();
            case "baseline"    -> snap.getBaselineJson();
            case "fallPattern" -> snap.getFallPatternJson();
            case "slots"       -> snap.getActivitySlotsJson();
            case "trend"       -> snap.getActivityTrendJson();
            default            -> null;
        };
    }

    private boolean isPending(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            return "pending".equals(node.path("status").asText(null));
        } catch (Exception e) {
            return false;
        }
    }

    private ObjectNode pending() {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("status", "pending");
        node.put("message", "정보를 모으는 중이에요. 며칠 지나면 평소 움직임과 비교해 보여드려요.");
        return node;
    }
}
