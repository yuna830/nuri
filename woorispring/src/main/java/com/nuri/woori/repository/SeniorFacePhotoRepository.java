package com.nuri.woori.repository;

import com.nuri.woori.entity.SeniorFacePhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeniorFacePhotoRepository extends JpaRepository<SeniorFacePhoto, Long> {
    List<SeniorFacePhoto> findBySeniorIdOrderByIdAsc(Long seniorId);
}
