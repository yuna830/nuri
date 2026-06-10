package com.nuri.woori.repository;

import com.nuri.woori.entity.MissingReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MissingReportRepository extends JpaRepository<MissingReport, Long> {
    List<MissingReport> findByGuardianId(Long guardianId);
    List<MissingReport> findBySeniorId(Long seniorId);
    List<MissingReport> findByStatus(String status);
    // 신고 취소
    List<MissingReport> findByStatusAndCancelledAtBefore(String status, java.time.LocalDateTime cutoff);
}
