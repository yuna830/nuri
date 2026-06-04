package com.nuri.woori.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nuri.woori.entity.SeniorActivitySnapshot;
import com.nuri.woori.repository.SeniorActivitySnapshotRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/seniors/{seniorId}/activity")
public class ActivitySnapshotController {

    private final SeniorActivitySnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ActivitySnapshotController(SeniorActivitySnapshotRepository snapshotRepository) {
        this.snapshotRepository = snapshotRepository;
    }

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

    private ResponseEntity<JsonNode> respond(Long seniorId, String field) {
        Optional<SeniorActivitySnapshot> opt = snapshotRepository
                .findTopBySeniorIdOrderBySnapshotDateDesc(seniorId);

        if (opt.isEmpty()) {
            return ResponseEntity.ok(pending());
        }

        SeniorActivitySnapshot snap = opt.get();
        String json = switch (field) {
            case "today"       -> snap.getActivityTodayJson();
            case "baseline"    -> snap.getBaselineJson();
            case "fallPattern" -> snap.getFallPatternJson();
            case "slots"       -> snap.getActivitySlotsJson();
            case "trend"       -> snap.getActivityTrendJson();
            default            -> null;
        };

        if (json == null) return ResponseEntity.ok(pending());

        try {
            return ResponseEntity.ok(objectMapper.readTree(json));
        } catch (Exception e) {
            return ResponseEntity.ok(pending());
        }
    }

    private ObjectNode pending() {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("status", "pending");
        node.put("message", "정보를 모으는 중이에요. 며칠 지나면 평소 움직임과 비교해 보여드려요.");
        return node;
    }
}
