ALTER TABLE wl_action_records
    ADD COLUMN IF NOT EXISTS fall_environment_risk VARCHAR(20);
