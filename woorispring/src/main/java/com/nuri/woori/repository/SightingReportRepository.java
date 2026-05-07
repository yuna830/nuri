package com.nuri.woori.repository;

import com.nuri.woori.entity.SightingReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SightingReportRepository extends JpaRepository<SightingReport, Long> {
    List<SightingReport> findByMissingReportIdOrderByCreatedAtDesc(Long missingReportId);
}
