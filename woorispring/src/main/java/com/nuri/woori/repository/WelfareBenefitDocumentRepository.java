package com.nuri.woori.repository;

import com.nuri.woori.entity.WelfareBenefitDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WelfareBenefitDocumentRepository extends JpaRepository<WelfareBenefitDocument, Long> {
    Optional<WelfareBenefitDocument> findByExternalId(String externalId);
}

