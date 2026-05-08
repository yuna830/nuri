package com.nuri.woori.controller;

import com.nuri.woori.entity.SafeZones;
import com.nuri.woori.repository.SafeZonesRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/safe-zones")
@CrossOrigin(origins = "*")
public class SafeZonesController {
    private final SafeZonesRepository safeZonesRepository;

    public SafeZonesController(SafeZonesRepository safeZoneRepository) {
        this.safeZonesRepository = safeZoneRepository;
    }

    @GetMapping("/senior/{seniorId}")
    public ResponseEntity<SafeZones> getSafeZone(@PathVariable Long seniorId) {
        return safeZonesRepository.findBySeniorId(seniorId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/senior/{seniorId}")
    public SafeZones saveSafeZone(
            @PathVariable Long seniorId,
            @RequestBody SafeZoneRequest request
    ) {
        SafeZones safeZone = safeZonesRepository.findBySeniorId(seniorId)
                .orElseGet(SafeZones::new);

        safeZone.setSeniorId(seniorId);
        safeZone.setName(request.name());
        safeZone.setAddress(request.address());
        safeZone.setCenterLatitude(request.centerLatitude());
        safeZone.setCenterLongitude(request.centerLongitude());
        safeZone.setRadiusMeters(request.radiusMeters());

        return safeZonesRepository.save(safeZone);
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
