package com.nuri.woori.repository;

import com.nuri.woori.entity.MissingReportImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MissingReportImageRepository extends JpaRepository<MissingReportImage, Long> {
    List<MissingReportImage> findByMissingReportIdOrderBySortOrderAscIdAsc(Long missingReportId);
}