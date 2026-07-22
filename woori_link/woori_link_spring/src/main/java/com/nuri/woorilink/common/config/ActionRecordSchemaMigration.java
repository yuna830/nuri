package com.nuri.woorilink.common.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class ActionRecordSchemaMigration {
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void alignActionStatusConstraint() {
        jdbcTemplate.execute("""
                alter table wl_action_records
                drop constraint if exists wl_action_records_action_status_check
                """);
        jdbcTemplate.execute("""
                alter table wl_action_records
                add constraint wl_action_records_action_status_check
                check (action_status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
                """);
    }
}
