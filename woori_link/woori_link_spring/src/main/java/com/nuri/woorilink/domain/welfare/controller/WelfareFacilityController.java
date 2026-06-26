package com.nuri.woorilink.domain.welfare.controller;

import com.nuri.woorilink.common.client.WelfareFacilityApiClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/welfare-facilities")
@RequiredArgsConstructor
public class WelfareFacilityController {

    private final WelfareFacilityApiClient apiClient;

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, String>>> search(
            @RequestParam(defaultValue = "") String name) {
        if (name.isBlank()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(apiClient.searchFacilities(name));
    }
}
