package com.nuri.woori.controller;

import com.nuri.woori.entity.WelfarePolicyChatHistory;
import com.nuri.woori.repository.WelfarePolicyChatHistoryRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.List;

@RestController
@RequestMapping("/api/welfare-policy-chat-histories")
@CrossOrigin(origins = "*")
public class WelfarePolicyChatHistoryController {
    private final WelfarePolicyChatHistoryRepository repository;

    public WelfarePolicyChatHistoryController(WelfarePolicyChatHistoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/senior/{seniorId}")
    public List<WelfarePolicyChatHistory> getBySenior(@PathVariable Long seniorId) {
        return repository.findBySeniorIdOrderByCreatedAtAsc(seniorId);
    }

    @PostMapping
    public WelfarePolicyChatHistory create(@RequestBody CreateRequest request) {
        WelfarePolicyChatHistory history = new WelfarePolicyChatHistory();
        history.setSeniorId(request.seniorId());
        history.setWorkerId(request.workerId());
        history.setQuestion(request.question());
        history.setAnswer(request.answer());
        history.setEvidenceJson(request.evidenceJson());

        return repository.save(history);
    }

    // Q&A를 삭제하고 싶을 때
    @DeleteMapping("/senior/{seniorId}")
    public ResponseEntity<Void> deleteBySenior(@PathVariable Long seniorId) {
        repository.deleteAll(repository.findBySeniorIdOrderByCreatedAtAsc(seniorId));
        return ResponseEntity.noContent().build();
    }

    // 전체 Q&A를 삭제하고 싶을 때
    @DeleteMapping
    public ResponseEntity<Void> deleteAll() {
        repository.deleteAll();
        return ResponseEntity.noContent().build();
    }

    public record CreateRequest(
            Long seniorId,
            Long workerId,
            String question,
            String answer,
            String evidenceJson
    ) {
    }
}