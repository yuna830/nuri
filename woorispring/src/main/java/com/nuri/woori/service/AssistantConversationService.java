package com.nuri.woori.service;

import com.nuri.woori.entity.AssistantConversation;
import com.nuri.woori.entity.AssistantMessage;
import com.nuri.woori.repository.AssistantConversationRepository;
import com.nuri.woori.repository.AssistantMessageRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AssistantConversationService {
    private static final int RETENTION_DAYS = 7;
    private static final int MAX_TITLE_LENGTH = 40;

    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;

    public AssistantConversationService(
            AssistantConversationRepository conversationRepository,
            AssistantMessageRepository messageRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    public AssistantConversation createConversation(Long seniorId) {
        AssistantConversation conversation = new AssistantConversation();
        conversation.setSeniorId(seniorId);
        return conversationRepository.save(conversation);
    }

    public List<AssistantConversation> getRecentConversations(Long seniorId) {
        return conversationRepository
                .findBySeniorIdAndLastMessageAtGreaterThanEqualOrderByLastMessageAtDesc(seniorId, expiresAt());
    }

    public List<AssistantMessage> getMessages(Long seniorId, Long conversationId) {
        requireConversation(seniorId, conversationId);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    public AssistantConversation updateTitle(Long seniorId, Long conversationId, String title) {
        AssistantConversation conversation = requireConversation(seniorId, conversationId);
        conversation.setTitle(toTitle(title));
        return conversationRepository.save(conversation);
    }

    @Transactional
    public AssistantMessage addMessage(Long seniorId, Long conversationId, String role, String content) {
        AssistantConversation conversation = requireConversation(seniorId, conversationId);

        AssistantMessage message = new AssistantMessage();
        message.setConversationId(conversationId);
        message.setRole(role);
        message.setContent(content);
        AssistantMessage savedMessage = messageRepository.save(message);

        if ("USER".equals(role) && "새 대화".equals(conversation.getTitle())) {
            conversation.setTitle(toTitle(content));
        }
        conversation.setLastMessageAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return savedMessage;
    }

    @Transactional
    public void deleteConversation(Long seniorId, Long conversationId) {
        AssistantConversation conversation = requireConversation(seniorId, conversationId);
        messageRepository.deleteByConversationId(conversationId);
        conversationRepository.delete(conversation);
    }

    @Transactional
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void deleteExpiredConversations() {
        for (AssistantConversation conversation : conversationRepository.findByLastMessageAtBefore(expiresAt())) {
            messageRepository.deleteByConversationId(conversation.getId());
            conversationRepository.delete(conversation);
        }
    }

    private AssistantConversation requireConversation(Long seniorId, Long conversationId) {
        return conversationRepository.findByIdAndSeniorId(conversationId, seniorId)
                .filter(conversation -> !conversation.getLastMessageAt().isBefore(expiresAt()))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Conversation not found"));
    }

    private LocalDateTime expiresAt() {
        return LocalDateTime.now().minusDays(RETENTION_DAYS);
    }

    private String toTitle(String content) {
        String title = content.replaceAll("\\s+", " ").trim();
        return title.length() <= MAX_TITLE_LENGTH ? title : title.substring(0, MAX_TITLE_LENGTH) + "...";
    }
}
