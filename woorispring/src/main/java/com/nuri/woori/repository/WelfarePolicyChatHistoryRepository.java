package com.nuri.woori.repository;

import com.nuri.woori.entity.WelfarePolicyChatHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WelfarePolicyChatHistoryRepository extends JpaRepository<WelfarePolicyChatHistory, Long> {
    List<WelfarePolicyChatHistory> findBySeniorIdOrderByCreatedAtAsc(Long seniorId);
}