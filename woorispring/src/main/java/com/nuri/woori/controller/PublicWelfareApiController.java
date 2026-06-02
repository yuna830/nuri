package com.nuri.woori.controller;

import com.nuri.woori.entity.WelfareServiceInfo;
import com.nuri.woori.repository.WelfareServiceInfoRepository;
import com.nuri.woori.service.PublicWelfareApiSyncService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public-welfare")
@CrossOrigin(origins = "*")
public class PublicWelfareApiController {

    private final PublicWelfareApiSyncService publicWelfareApiSyncService;
    private final WelfareServiceInfoRepository welfareServiceInfoRepository;

    public PublicWelfareApiController(
            PublicWelfareApiSyncService publicWelfareApiSyncService,
            WelfareServiceInfoRepository welfareServiceInfoRepository
    ) {
        this.publicWelfareApiSyncService = publicWelfareApiSyncService;
        this.welfareServiceInfoRepository = welfareServiceInfoRepository;
    }

    @PostMapping("/services/sync")
    public List<WelfareServiceInfo> syncWelfareServices() {
        return publicWelfareApiSyncService.syncWelfareServices();
    }

    @GetMapping("/services")
    public List<WelfareServiceInfo> getWelfareServices() {
        return welfareServiceInfoRepository.findAll();
    }

    @GetMapping("/services/{serviceId}")
    public WelfareServiceInfo getWelfareService(@PathVariable String serviceId) {
        return welfareServiceInfoRepository.findByServiceId(serviceId)
                .orElseThrow(() -> new RuntimeException("복지서비스를 찾을 수 없습니다. serviceId=" + serviceId));
    }

    @GetMapping("/services/{serviceId}/detail")
    public WelfareServiceInfo syncOneWelfareServiceDetail(@PathVariable String serviceId) {
        return publicWelfareApiSyncService.syncWelfareServiceDetail(serviceId);
    }

    @PostMapping("/services/details/sync")
    public List<WelfareServiceInfo> syncWelfareServiceDetails(
            @RequestParam(defaultValue = "10") int limit
    ) {
        return publicWelfareApiSyncService.syncWelfareServiceDetails(limit);
    }
}