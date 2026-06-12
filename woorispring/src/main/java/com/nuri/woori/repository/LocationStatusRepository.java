package com.nuri.woori.repository;

import com.nuri.woori.entity.LocationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LocationStatusRepository extends JpaRepository<LocationStatus, Long> {
    Optional<LocationStatus> findTopBySeniorIdOrderByReceivedAtDesc(Long seniorId);

    List<LocationStatus> findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(
            Long seniorId,
            LocalDateTime start,
            LocalDateTime end
    );

    // 기준 시각보다 오래된 위치를 삭제하되, 어르신별 가장 최근 1건은 남긴다.
    // ('마지막 위치' 표시가 깨지지 않도록)
    @Modifying
    @Query("""
            DELETE FROM LocationStatus l
            WHERE l.receivedAt < :cutoff
              AND l.id NOT IN (
                SELECT MAX(l2.id) FROM LocationStatus l2 GROUP BY l2.seniorId
              )
            """)
    int deleteOlderThanKeepingLatest(@Param("cutoff") LocalDateTime cutoff);
}