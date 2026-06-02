package com.nuri.woori.controller;

import com.nuri.woori.entity.AssistantConversation;
import com.nuri.woori.entity.AssistantMessage;
import com.nuri.woori.service.AssistantConversationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/assistant-conversations")
@CrossOrigin(origins = "*")
public class AssistantConversationController {
    private static final Set<String> ALLOWED_ROLES = Set.of("USER", "ASSISTANT");

    private final AssistantConversationService conversationService;

    public AssistantConversationController(AssistantConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/senior/{seniorId}")
    public AssistantConversation createConversation(@PathVariable Long seniorId) {
        return conversationService.createConversation(seniorId);
    }

    @GetMapping("/senior/{seniorId}")
    public List<AssistantConversation> getRecentConversations(@PathVariable Long seniorId) {
        return conversationService.getRecentConversations(seniorId);
    }

    @GetMapping("/{conversationId}/messages")
    public List<AssistantMessage> getMessages(
            @PathVariable Long conversationId,
            @RequestParam Long seniorId
    ) {
        return conversationService.getMessages(seniorId, conversationId);
    }

    @PostMapping("/{conversationId}/messages")
    public AssistantMessage addMessage(
            @PathVariable Long conversationId,
            @RequestParam Long seniorId,
            @RequestBody AssistantMessageRequest request
    ) {
        String role = request.role() == null ? "" : request.role().trim().toUpperCase();
        String content = request.content() == null ? "" : request.content().trim();

        if (!ALLOWED_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be USER or ASSISTANT");
        }
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Content must not be blank");
        }

        return conversationService.addMessage(seniorId, conversationId, role, content);
    }

    @PatchMapping("/{conversationId}")
    public AssistantConversation updateTitle(
            @PathVariable Long conversationId,
            @RequestParam Long seniorId,
            @RequestBody AssistantConversationTitleRequest request
    ) {
        String title = request.title() == null ? "" : request.title().trim();
        if (title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title must not be blank");
        }

        return conversationService.updateTitle(seniorId, conversationId, title);
    }

    @DeleteMapping("/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(
            @PathVariable Long conversationId,
            @RequestParam Long seniorId
    ) {
        conversationService.deleteConversation(seniorId, conversationId);
    }

    public record AssistantMessageRequest(String role, String content) {
    }

    public record AssistantConversationTitleRequest(String title) {
    }
}
