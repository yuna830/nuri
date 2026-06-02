package com.nuri.woori.repository;

import com.nuri.woori.entity.RagDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RagDocumentRepository extends JpaRepository<RagDocument, String> {

    Optional<RagDocument> findBySourceTypeAndSourceId(String sourceType, String sourceId);

    List<RagDocument> findByStatusAndSourceTypeOrderByUpdatedAtAsc(
            String status,
            String sourceType,
            Pageable pageable
    );

    long countBySourceType(String sourceType);

    long countByStatusAndSourceType(String status, String sourceType);
}