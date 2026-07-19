ALTER TABLE wl_action_records
    DROP CONSTRAINT IF EXISTS wl_action_records_action_status_check;

ALTER TABLE wl_action_records
    ADD CONSTRAINT wl_action_records_action_status_check
    CHECK (action_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
