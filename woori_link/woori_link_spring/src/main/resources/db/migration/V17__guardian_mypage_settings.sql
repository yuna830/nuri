ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMP;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS check_in_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS fall_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS safety_zone_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS recall_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS weather_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS welfare_alert_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS app_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS web_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wl_guardians ADD COLUMN IF NOT EXISTS kakao_notification_enabled BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE wl_guardians SET invite_code_expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days' WHERE invite_code_expires_at IS NULL;

ALTER TABLE wl_seniors ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(30);
ALTER TABLE wl_seniors ADD COLUMN IF NOT EXISTS guardian_linked_at TIMESTAMP;
UPDATE wl_seniors SET guardian_linked_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE guardian_id IS NOT NULL AND guardian_linked_at IS NULL;
