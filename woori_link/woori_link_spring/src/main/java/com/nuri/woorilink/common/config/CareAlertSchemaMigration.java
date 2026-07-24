package com.nuri.woorilink.common.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class CareAlertSchemaMigration {
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void alignCareAlertTypeConstraint() {
        jdbcTemplate.execute("""
                alter table wl_care_alerts
                drop constraint if exists wl_care_alerts_type_check
                """);
        jdbcTemplate.execute("""
                alter table wl_care_alerts
                add constraint wl_care_alerts_type_check
                check (type in (
                    'FALL_SUSPECTED',
                    'FALL_DETECTED',
                    'SOS',
                    'SAFETY_RADIUS_EXIT',
                    'CHECK_IN_MISSED',
                    'WELFARE_NOTICE',
                    'CONSULTATION_REQUEST'
                ))
                """);
    }
}
