CREATE TABLE IF NOT EXISTS
    wl_energy_support_consultation_requests
(
    id BIGSERIAL PRIMARY KEY,

    senior_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,
    welfare_worker_id BIGINT NOT NULL,

    missing_count INTEGER NOT NULL DEFAULT 0,

    missing_information VARCHAR(4000) NOT NULL,

    request_message VARCHAR(1000),

    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',

    resolved_by BIGINT,
    resolution_note VARCHAR(1000),
    resolved_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );


CREATE INDEX IF NOT EXISTS
    idx_energy_consultation_senior
    ON wl_energy_support_consultation_requests (
    senior_id
    );


CREATE INDEX IF NOT EXISTS
    idx_energy_consultation_worker
    ON wl_energy_support_consultation_requests (
    welfare_worker_id
    );


CREATE INDEX IF NOT EXISTS
    idx_energy_consultation_status
    ON wl_energy_support_consultation_requests (
    status
    );