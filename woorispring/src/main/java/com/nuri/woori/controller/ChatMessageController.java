package com.nuri.woori.controller;

import com.nuri.woori.entity.ChatMessage;
import com.nuri.woori.repository.ChatMessageRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ChatMessageController {
    private final ChatMessageRepository chatMessageRepository;
    private final SeniorRepository seniorRepository;

    public ChatMessageController(ChatMessageRepository chatMessageRepository, SeniorRepository seniorRepository) {
        this.chatMessageRepository = chatMessageRepository;
        this.seniorRepository = seniorRepository;
    }

    @GetMapping("/senior/{seniorId}")
    public List<ChatMessage> getMessages(
            @PathVariable Long seniorId,
            @RequestParam(defaultValue = "SENIOR_GUARDIAN") String roomType,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "") String viewerRole,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(20, Math.min(size, 100));
        List<ChatMessage> messages = keyword == null || keyword.isBlank()
                ? chatMessageRepository.findBySeniorIdAndRoomTypeOrderByCreatedAtDesc(
                        seniorId,
                        roomType,
                        PageRequest.of(safePage, safeSize)
                )
                : chatMessageRepository.findBySeniorIdAndRoomTypeAndMessageContainingIgnoreCaseOrderByCreatedAtDesc(
                        seniorId,
                        roomType,
                        keyword.trim(),
                        PageRequest.of(safePage, safeSize)
                );

        if (viewerRole != null && !viewerRole.isBlank()) {
            markRoomRead(seniorId, roomType, viewerRole);
        }

        List<ChatMessage> orderedMessages = new ArrayList<>(messages);
        Collections.reverse(orderedMessages);
        return orderedMessages;
    }

    @GetMapping("/unread")
    public Map<String, Long> getUnreadCount(
            @RequestParam String viewerRole,
            @RequestParam(required = false) Long seniorId,
            @RequestParam(required = false) Long welfareWorkerId
    ) {
        List<ChatMessage> messages;
        if (seniorId != null) {
            messages = chatMessageRepository.findBySeniorId(seniorId);
        } else if (welfareWorkerId != null) {
            List<Long> seniorIds = seniorRepository.findByWelfareWorkerIdOrderByIdAsc(welfareWorkerId)
                    .stream().map(s -> s.getId()).toList();
            messages = seniorIds.isEmpty() ? List.of() : chatMessageRepository.findBySeniorIdIn(seniorIds);
        } else {
            messages = chatMessageRepository.findAll();
        }

        long count = messages.stream()
                .filter(message -> isUnreadForViewer(message, viewerRole))
                .count();

        return Map.of("count", count);
    }

    @PostMapping("/senior/{seniorId}")
    public ChatMessage createMessage(
            @PathVariable Long seniorId,
            @RequestBody ChatMessageRequest request) {
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setSeniorId(seniorId);
        chatMessage.setRoomType(request.roomType() == null || request.roomType().isBlank()
                ? "SENIOR_GUARDIAN"
                : request.roomType().trim());
        chatMessage.setSenderRole(request.senderRole());
        chatMessage.setSenderId(request.senderId());
        chatMessage.setSenderName(request.senderName());
        chatMessage.setMessage(request.message() == null ? "" : request.message().trim());
        chatMessage.setAttachmentUrl(request.attachmentUrl());
        chatMessage.setAttachmentType(request.attachmentType());
        chatMessage.setAttachmentName(request.attachmentName());
        setUnreadTargets(chatMessage);

        return chatMessageRepository.save(chatMessage);
    }

    // 잘못 보낸 메시지 삭제 — 본인이 보낸 메시지만 삭제할 수 있다.
    @DeleteMapping("/messages/{messageId}")
    public void deleteMessage(
            @PathVariable Long messageId,
            @RequestParam String senderRole,
            @RequestParam Long senderId
    ) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        boolean isSender = senderRole != null
                && senderRole.equals(message.getSenderRole())
                && senderId != null
                && senderId.equals(message.getSenderId());

        if (!isSender) {
            throw new RuntimeException("본인이 보낸 메시지만 삭제할 수 있습니다.");
        }

        chatMessageRepository.deleteById(messageId);
    }

    private void setUnreadTargets(ChatMessage chatMessage) {
        String roomType = chatMessage.getRoomType();
        String senderRole = chatMessage.getSenderRole();

        if ("SENIOR_GUARDIAN".equals(roomType)) {
            chatMessage.setUnreadForGuardian(!"GUARDIAN".equals(senderRole));
            chatMessage.setUnreadForSenior(!"SENIOR".equals(senderRole));
        } else if ("SENIOR_WELFARE".equals(roomType)) {
            chatMessage.setUnreadForWelfare(!"WELFARE".equals(senderRole));
            chatMessage.setUnreadForSenior(!"SENIOR".equals(senderRole));
        } else if ("GUARDIAN_WELFARE".equals(roomType)) {
            chatMessage.setUnreadForWelfare(!"WELFARE".equals(senderRole));
            chatMessage.setUnreadForGuardian(!"GUARDIAN".equals(senderRole));
        }
    }

    private boolean isUnreadForViewer(ChatMessage message, String viewerRole) {
        if ("SENIOR".equals(viewerRole)) return Boolean.TRUE.equals(message.getUnreadForSenior());
        if ("GUARDIAN".equals(viewerRole)) return Boolean.TRUE.equals(message.getUnreadForGuardian());
        if ("WELFARE".equals(viewerRole)) return Boolean.TRUE.equals(message.getUnreadForWelfare());
        return false;
    }

    private void markRoomRead(Long seniorId, String roomType, String viewerRole) {
        List<ChatMessage> messages = chatMessageRepository.findBySeniorIdAndRoomType(seniorId, roomType);

        boolean changed = false;
        for (ChatMessage message : messages) {
            if ("SENIOR".equals(viewerRole) && Boolean.TRUE.equals(message.getUnreadForSenior())) {
                message.setUnreadForSenior(false);
                changed = true;
            }
            if ("GUARDIAN".equals(viewerRole) && Boolean.TRUE.equals(message.getUnreadForGuardian())) {
                message.setUnreadForGuardian(false);
                changed = true;
            }
            if ("WELFARE".equals(viewerRole) && Boolean.TRUE.equals(message.getUnreadForWelfare())) {
                message.setUnreadForWelfare(false);
                changed = true;
            }
        }

        if (changed) {
            chatMessageRepository.saveAll(messages);
        }
    }

    public record ChatMessageRequest(
            String roomType,
            String senderRole,
            Long senderId,
            String senderName,
            String message,
            String attachmentUrl,
            String attachmentType,
            String attachmentName
    ) {
    }
}
