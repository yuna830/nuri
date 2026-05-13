package com.nuri.woori.repository;

import com.nuri.woori.entity.WelfareWorker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WelfareWorkerRepository extends JpaRepository<WelfareWorker, Long> {

    Optional<WelfareWorker> findByWorkerId(String workerId);

    boolean existsByWorkerId(String workerId);

    Optional<WelfareWorker> findByNameAndCenter(String name, String center);

    Optional<WelfareWorker> findByWorkerIdAndName(String workerId, String name);
}
