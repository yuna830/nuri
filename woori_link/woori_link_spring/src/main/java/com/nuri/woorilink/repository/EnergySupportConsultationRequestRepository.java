package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.EnergySupportConsultationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnergySupportConsultationRequestRepository
        extends JpaRepository<
        EnergySupportConsultationRequest,
        Long
        > {

    Optional<EnergySupportConsultationRequest>
    findFirstBySeniorIdAndStatusInOrderByCreatedAtDesc(
            Long seniorId,
            List<EnergySupportConsultationRequest.ConsultationStatus>
                    statuses
    );

    List<EnergySupportConsultationRequest>
    findByWelfareWorkerIdAndStatusInOrderByCreatedAtDesc(
            Long welfareWorkerId,
            List<EnergySupportConsultationRequest.ConsultationStatus>
                    statuses
    );

    List<EnergySupportConsultationRequest>
    findBySeniorIdOrderByCreatedAtDesc(
            Long seniorId
    );
}