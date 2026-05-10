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
}
