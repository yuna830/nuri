CREATE TABLE IF NOT EXISTS wl_check_in_schedules (
                                                     id BIGSERIAL PRIMARY KEY,

                                                     senior_id BIGINT NOT NULL,

                                                     enabled BOOLEAN NOT NULL DEFAULT TRUE,

                                                     request_time TIME NOT NULL,

                                                     timeout_minutes INTEGER NOT NULL DEFAULT 30,

                                                     timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Seoul',

    last_sent_date DATE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_check_in_schedule_senior
    FOREIGN KEY (senior_id)
    REFERENCES wl_seniors(id)
    ON DELETE CASCADE,

    CONSTRAINT uk_check_in_schedule_senior
    UNIQUE (senior_id),

    CONSTRAINT check_in_schedule_timeout_check
    CHECK (
              timeout_minutes >= 5
              AND timeout_minutes <= 180
          )
    );


CREATE INDEX IF NOT EXISTS
    idx_check_in_schedule_enabled_time
    ON wl_check_in_schedules (
    enabled,
    request_time
    );