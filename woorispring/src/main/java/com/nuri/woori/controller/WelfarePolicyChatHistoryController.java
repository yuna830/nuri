package com.nuri.woori.controller;

import com.nuri.woori.entity.WelfarePolicyChatHistory;
import com.nuri.woori.repository.WelfarePolicyChatHistoryRepository;
import org.springframework.web.bind.annotation.*;

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

    public record CreateRequest(
            Long seniorId,
            Long workerId,
            String question,
            String answer,
            String evidenceJson
    ) {
    }
}