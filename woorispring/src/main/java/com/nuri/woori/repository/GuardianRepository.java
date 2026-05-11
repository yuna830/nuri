package com.nuri.woori.repository;

import com.nuri.woori.entity.Guardian;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GuardianRepository extends JpaRepository<Guardian, Long> {
    Optional<Guardian> findByEmail(String email);

    @Query("""
            select g from Guardian g
            where g.name = :name
              and function('replace', g.phone, '-', '') = :phone
            """)
    Optional<Guardian> findByNameAndNormalizedPhone(
            @Param("name") String name,
            @Param("phone") String phone
    );

    @Query("""
            select g from Guardian g
            where lower(g.email) = lower(:email)
              and function('replace', g.phone, '-', '') = :phone
            """)
    Optional<Guardian> findByEmailAndNormalizedPhone(
            @Param("email") String email,
            @Param("phone") String phone
    );
}