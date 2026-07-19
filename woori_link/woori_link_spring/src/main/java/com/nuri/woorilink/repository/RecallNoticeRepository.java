package com.nuri.woorilink.repository;
import com.nuri.woorilink.entity.RecallNotice;import org.springframework.data.jpa.repository.JpaRepository;import java.util.Optional;
public interface RecallNoticeRepository extends JpaRepository<RecallNotice,Long>{Optional<RecallNotice>findByRecallUid(String uid);}
