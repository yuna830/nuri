ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS consultation_date DATE;

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS available_start_time VARCHAR(5);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS available_end_time VARCHAR(5);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS consultation_method VARCHAR(30);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS schedule_status VARCHAR(30);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS schedule_proposed_by VARCHAR(30);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS schedule_message VARCHAR(1000);

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS schedule_proposed_at TIMESTAMP;

ALTER TABLE wl_energy_support_consultation_requests
    ADD COLUMN IF NOT EXISTS schedule_responded_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS
    idx_energy_consultation_schedule_status
    ON wl_energy_support_consultation_requests (
    schedule_status
    );