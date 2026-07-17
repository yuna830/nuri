package com.nuri.woorilink.common.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class SafetyZoneSchemaMigration {
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void allowMultipleSafetyZonesPerSenior() {
        List<String> constraints = jdbcTemplate.queryForList("""
                select distinct constraint_name
                from information_schema.constraint_column_usage
                where table_schema = current_schema()
                  and table_name = 'wl_safety_zones'
                  and column_name = 'senior_id'
                  and constraint_name in (
                    select constraint_name
                    from information_schema.table_constraints
                    where table_schema = current_schema()
                      and table_name = 'wl_safety_zones'
                      and constraint_type = 'UNIQUE'
                  )
                """, String.class);

        constraints.forEach(name -> jdbcTemplate.execute(
                "alter table wl_safety_zones drop constraint if exists \""
                        + name.replace("\"", "\"\"") + "\""));
    }
}
