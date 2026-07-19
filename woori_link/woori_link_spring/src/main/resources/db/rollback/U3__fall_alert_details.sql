ALTER TABLE wl_care_alerts
    DROP COLUMN IF EXISTS fall_details,
    DROP COLUMN IF EXISTS detection_score,
    DROP COLUMN IF EXISTS image_url;

ALTER TABLE wl_care_events
    DROP COLUMN IF EXISTS fall_details,
    DROP COLUMN IF EXISTS detection_score,
    DROP COLUMN IF EXISTS image_url;
