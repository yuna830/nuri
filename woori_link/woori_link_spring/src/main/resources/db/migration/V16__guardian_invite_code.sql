ALTER TABLE wl_guardians
    ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8);

UPDATE wl_guardians
SET invite_code = UPPER(SUBSTRING(MD5(id::text || clock_timestamp()::text) FROM 1 FOR 8))
WHERE invite_code IS NULL;

ALTER TABLE wl_guardians
    ALTER COLUMN invite_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_wl_guardians_invite_code
    ON wl_guardians (invite_code);
