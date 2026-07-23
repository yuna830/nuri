ALTER TABLE wl_seniors
    ADD COLUMN IF NOT EXISTS invite_code_used_at TIMESTAMP;
