package com.nuri.woori.service;

import com.nuri.woori.repository.MissingReportRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;

@Component
public class ReportCleanupService {

    private final MissingReportRepository missingReportRepository;

    public ReportCleanupService(MissingReportRepository missingReportRepository) {
        this.missingReportRepository = missingReportRepository;
    }

    // 매일 새벽 3시에 취소된 지 3일 지난 신고 삭제
    @Scheduled(cron = "0 0 3 * * *")
    public void deleteOldCancelledReports() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(3);
        var toDelete = missingReportRepository
                .findByStatusAndCancelledAtBefore("CANCELLED", cutoff);
        missingReportRepository.deleteAll(toDelete);
        System.out.println("취소 신고 " + toDelete.size() + "건 자동 삭제됨");
    }
}