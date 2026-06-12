package com.nuri.woori.service;

import com.nuri.woori.repository.LocationStatusRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 위치 데이터 정리 — DB 용량 절약을 위해 30분이 지난 위치 기록을 삭제한다.
 * 단, 어르신별 가장 최근 위치 1건은 남겨 '마지막 위치' 표시가 깨지지 않게 한다.
 */
@Service
public class LocationCleanupService {

    private static final int RETENTION_MINUTES = 30;

    private final LocationStatusRepository locationStatusRepository;

    public LocationCleanupService(LocationStatusRepository locationStatusRepository) {
        this.locationStatusRepository = locationStatusRepository;
    }

    @Scheduled(fixedDelay = 300_000, initialDelay = 30_000) // 5분마다
    @Transactional
    public void deleteOldLocations() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(RETENTION_MINUTES);
        int deleted = locationStatusRepository.deleteOlderThanKeepingLatest(cutoff);

        if (deleted > 0) {
            System.out.println("old location records deleted: " + deleted);
        }
    }
}
