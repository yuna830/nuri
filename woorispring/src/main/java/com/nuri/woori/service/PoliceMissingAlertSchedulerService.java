package com.nuri.woori.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PoliceMissingAlertSchedulerService {

    private final PoliceMissingAlertService policeMissingAlertService;

    public PoliceMissingAlertSchedulerService(PoliceMissingAlertService policeMissingAlertService) {
        this.policeMissingAlertService = policeMissingAlertService;
    }

    @Scheduled(cron = "0 0 6 * * *", zone = "Asia/Seoul")
    public void syncTodayMissingAlertsEveryMorning() {
        try {
            policeMissingAlertService.syncTodayAlerts();
        } catch (Exception error) {
            System.out.println("경찰청 실종정보 자동 동기화 실패: " + error.getMessage());
        }
    }
}