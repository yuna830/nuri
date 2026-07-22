/*
 * 안부 요청이 생성될 당시의 응답 제한 시간을 저장한다.
 *
 * 보호자가 나중에 자동 안부 설정을 변경해도
 * 이미 발송된 요청의 제한 시간은 유지된다.
 */

ALTER TABLE wl_check_ins
    ADD COLUMN IF NOT EXISTS timeout_minutes INTEGER;


UPDATE wl_check_ins
SET timeout_minutes = 30
WHERE timeout_minutes IS NULL;


ALTER TABLE wl_check_ins
    ALTER COLUMN timeout_minutes SET DEFAULT 30;


ALTER TABLE wl_check_ins
    ALTER COLUMN timeout_minutes SET NOT NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_wl_check_ins_timeout_minutes'
    ) THEN
ALTER TABLE wl_check_ins
    ADD CONSTRAINT ck_wl_check_ins_timeout_minutes
        CHECK (
            timeout_minutes >= 5
                AND timeout_minutes <= 180
            );
END IF;
END
$$;