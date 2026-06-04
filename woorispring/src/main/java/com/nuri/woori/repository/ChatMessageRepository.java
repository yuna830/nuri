package com.nuri.woori.repository;

import com.nuri.woori.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findTop100BySeniorIdOrderByCreatedAtAsc(Long seniorId);
    List<ChatMessage> findTop100BySeniorIdAndRoomTypeOrderByCreatedAtAsc(Long seniorId, String roomType);
    List<ChatMessage> findTop100BySeniorIdAndRoomTypeAndMessageContainingIgnoreCaseOrderByCreatedAtAsc(
            Long seniorId,
            String roomType,
            String keyword
    );
    List<ChatMessage> findBySeniorIdAndRoomTypeOrderByCreatedAtDesc(Long seniorId, String roomType, Pageable pageable);
    List<ChatMessage> findBySeniorIdAndRoomTypeAndMessageContainingIgnoreCaseOrderByCreatedAtDesc(
            Long seniorId,
            String roomType,
            String keyword,
            Pageable pageable
    );
    List<ChatMessage> findBySeniorId(Long seniorId);
    List<ChatMessage> findBySeniorIdIn(List<Long> seniorIds);
    List<ChatMessage> findBySeniorIdAndRoomType(Long seniorId, String roomType);
}
