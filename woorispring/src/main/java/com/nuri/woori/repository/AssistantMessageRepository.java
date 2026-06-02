package com.nuri.woori.repository;

import com.nuri.woori.entity.AssistantMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssistantMessageRepository extends JpaRepository<AssistantMessage, Long> {
    List<AssistantMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    void deleteByConversationId(Long conversationId);
}
