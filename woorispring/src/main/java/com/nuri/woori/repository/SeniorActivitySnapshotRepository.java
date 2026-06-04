package com.nuri.woori.repository;

import com.nuri.woori.entity.SeniorActivitySnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface SeniorActivitySnapshotRepository extends JpaRepository<SeniorActivitySnapshot, Long> {

    Optional<SeniorActivitySnapshot> findBySeniorIdAndSnapshotDate(Long seniorId, LocalDate date);

    Optional<SeniorActivitySnapshot> findTopBySeniorIdOrderBySnapshotDateDesc(Long seniorId);
}
