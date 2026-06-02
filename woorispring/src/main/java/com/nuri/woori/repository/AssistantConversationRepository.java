package com.nuri.woori.repository;

import com.nuri.woori.entity.AssistantConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AssistantConversationRepository extends JpaRepository<AssistantConversation, Long> {
    List<AssistantConversation> findBySeniorIdAndLastMessageAtGreaterThanEqualOrderByLastMessageAtDesc(
            Long seniorId,
            LocalDateTime expiresAt
    );

    List<AssistantConversation> findByLastMessageAtBefore(LocalDateTime expiresAt);

    Optional<AssistantConversation> findByIdAndSeniorId(Long id, Long seniorId);
}
