package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.repository.AlertRepository;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 낙상 이벤트 목록 API
 * FallEvent 전용 엔티티가 없으므로 Alert 테이블의 FALL_DETECTED / FALL_RISK 타입을 이벤트 형태로 반환.
 * Flutter 앱의 GET /api/fall-events?page=&size= 요청을 처리.
 */
@RestController
@RequestMapping("/api/fall-events")
@CrossOrigin(origins = "*")
public class FallEventController {

    private final AlertRepository alertRepository;

    public FallEventController(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getFallEvents(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        List<Alert> fallAlerts = alertRepository
                .findByTypeInOrderByCreatedAtDesc(List.of("FALL_DETECTED", "FALL_RISK"))
                .stream()
                .skip((long) (page - 1) * size)
                .limit(size)
                .collect(Collectors.toList());

        return fallAlerts.stream()
                .map(alert -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",               alert.getId());
                    m.put("seniorId",         alert.getSeniorId() != null ? alert.getSeniorId() : 0L);
                    m.put("type",             alert.getType() != null ? alert.getType() : "FALL_DETECTED");
                    m.put("timestamp",        alert.getCreatedAt() != null ? alert.getCreatedAt().toString() : "");
                    m.put("score",            0);
                    m.put("posture",          "확인 중");
                    m.put("ensemble_mode",    "-");
                    m.put("capture_filename", alert.getImageUrl() != null ? alert.getImageUrl() : "");
                    m.put("confirmed",        Boolean.TRUE.equals(alert.getIsRead()));
                    m.put("latitude",         alert.getLatitude() != null ? alert.getLatitude() : 0.0);
                    m.put("longitude",        alert.getLongitude() != null ? alert.getLongitude() : 0.0);
                    m.put("message",          alert.getMessage() != null ? alert.getMessage() : "");
                    return m;
                })
                .collect(Collectors.toList());
    }
}
