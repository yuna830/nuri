ALTER TABLE wl_energy_support_activities
    ADD COLUMN IF NOT EXISTS existing_application_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS application_intent VARCHAR(30),
    ADD COLUMN IF NOT EXISTS decline_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS updated_by_role VARCHAR(30),
    ADD COLUMN IF NOT EXISTS updated_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS change_summary VARCHAR(2000);
