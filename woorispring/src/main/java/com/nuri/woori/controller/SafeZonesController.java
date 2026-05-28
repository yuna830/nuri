package com.nuri.woori.controller;

import com.nuri.woori.entity.SafeZones;
import com.nuri.woori.repository.SafeZonesRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/safe-zones")
@CrossOrigin(origins = "*")
public class SafeZonesController {
    private final SafeZonesRepository safeZonesRepository;

    public SafeZonesController(SafeZonesRepository safeZoneRepository) {
        this.safeZonesRepository = safeZoneRepository;
    }

    @GetMapping("/senior/{seniorId}")
    public List<SafeZones> getSafeZones(@PathVariable Long seniorId) {
        return safeZonesRepository.findBySeniorIdOrderByIdAsc(seniorId);
    }

    @PostMapping("/senior/{seniorId}")
    public SafeZones createSafeZone(
            @PathVariable Long seniorId,
            @RequestBody SafeZoneRequest request
    ) {
        List<SafeZones> currentZones = safeZonesRepository.findBySeniorIdOrderByIdAsc(seniorId);

        if (currentZones.size() >= 3) {
            throw new IllegalArgumentException("안전 반경은 최대 3개까지 등록할 수 있습니다.");
        }

        SafeZones safeZone = new SafeZones();
        safeZone.setSeniorId(seniorId);
        safeZone.setName(request.name());
        safeZone.setAddress(request.address());
        safeZone.setCenterLatitude(request.centerLatitude());
        safeZone.setCenterLongitude(request.centerLongitude());
        safeZone.setRadiusMeters(request.radiusMeters());

        return safeZonesRepository.save(safeZone);
    }

    @PutMapping("/senior/{seniorId}/{safeZoneId}")
    public SafeZones updateSafeZone(
            @PathVariable Long seniorId,
            @PathVariable Long safeZoneId,
            @RequestBody SafeZoneRequest request
    ) {
        SafeZones safeZone = safeZonesRepository.findByIdAndSeniorId(safeZoneId, seniorId)
                .orElseThrow(() -> new RuntimeException("Safe zone not found"));

        safeZone.setName(request.name());
        safeZone.setAddress(request.address());
        safeZone.setCenterLatitude(request.centerLatitude());
        safeZone.setCenterLongitude(request.centerLongitude());
        safeZone.setRadiusMeters(request.radiusMeters());

        return safeZonesRepository.save(safeZone);
    }

    @DeleteMapping("/senior/{seniorId}/{safeZoneId}")
    public void deleteSafeZone(
            @PathVariable Long seniorId,
            @PathVariable Long safeZoneId
    ) {
        SafeZones safeZone = safeZonesRepository.findByIdAndSeniorId(safeZoneId, seniorId)
                .orElseThrow(() -> new RuntimeException("Safe zone not found"));

        safeZonesRepository.delete(safeZone);
    }

    public record SafeZoneRequest(
            String name,
            String address,
            Double centerLatitude,
            Double centerLongitude,
            Integer radiusMeters
    ) {
    }
}
