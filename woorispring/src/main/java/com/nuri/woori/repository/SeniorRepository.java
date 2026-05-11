package com.nuri.woori.repository;

import com.nuri.woori.entity.Senior;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SeniorRepository extends JpaRepository<Senior, Long> {
    Optional<Senior> findByNameAndPhone(String name, String phone);

    @Query("""
            select s from Senior s
            where lower(s.name) like lower(concat('%', :keyword, '%'))
               or s.phone like concat('%', :keyword, '%')
            order by s.createdAt desc
            """)
    List<Senior> searchByNameOrPhone(@Param("keyword") String keyword);

    // - 인식하기 위한
    @Query("""
        select s from Senior s
        where s.name = :name
          and replace(s.phone, '-', '') = :phone
        """)
    Optional<Senior> findByNameAndNormalizedPhone(
            @Param("name") String name,
            @Param("phone") String phone
    );
    
    // 이름, 전화번호 찾기 기능 추가
    @Query("""
        select s from Senior s
        where function('replace', s.phone, '-', '') = :phone
        """)
    Optional<Senior> findByNormalizedPhone(@Param("phone") String phone);

    @Query("""
        select s from Senior s
        where s.name = :name
          and s.region = :region
        order by s.createdAt desc
        """)
    List<Senior> findByNameAndRegion(
            @Param("name") String name,
            @Param("region") String region
    );
}
