package com.nuri.woori.controller;

import com.nuri.woori.entity.LocationStatus;
import com.nuri.woori.repository.LocationStatusRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
@CrossOrigin(origins = "*")
public class LocationController {
    private final LocationStatusRepository locationStatusRepository;

    public LocationController(LocationStatusRepository locationStatusRepository) {
        this.locationStatusRepository = locationStatusRepository;
    }

    @PostMapping
    public LocationStatus saveLocation(@RequestBody LocationSaveRequest request) {
        LocationStatus locationStatus = new LocationStatus();
        locationStatus.setSeniorId(request.seniorId());
        locationStatus.setLatitude(request.latitude());

        locationStatus.setLongitude(request.longitude());
        locationStatus.setAddress(request.address());

        return locationStatusRepository.save(locationStatus);
    }

    @GetMapping("/senior/{seniorId}/latest")
    public ResponseEntity<LocationStatus> getLatestLocation(@PathVariable Long seniorId) {
        return locationStatusRepository.findTopBySeniorIdOrderByReceivedAtDesc(seniorId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/senior/{seniorId}/today")
    public List<LocationStatus> getTodayLocations(@PathVariable Long seniorId) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        return locationStatusRepository.findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(
                seniorId,
                start,
                end
        );
    }

    @GetMapping("/senior/{seniorId}/date")
    public List<LocationStatus> getLocationsByDate(
            @PathVariable Long seniorId,
            @RequestParam LocalDate date
    ) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        return locationStatusRepository.findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(
                seniorId,
                start,
                end
        );
    }

    public record LocationSaveRequest(
            Long seniorId,
            Double latitude,
            Double longitude,
            String address
    ) {
    }
}
