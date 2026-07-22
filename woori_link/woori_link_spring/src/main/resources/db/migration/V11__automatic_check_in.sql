/*
 * 안부 요청이 보호자의 수동 요청인지,
 * 스케줄러가 생성한 자동 요청인지 구분한다.
 */

ALTER TABLE wl_check_ins
    ADD COLUMN IF NOT EXISTS request_type VARCHAR(20);


UPDATE wl_check_ins
SET request_type = 'MANUAL'
WHERE request_type IS NULL;


ALTER TABLE wl_check_ins
    ALTER COLUMN request_type SET DEFAULT 'MANUAL';


ALTER TABLE wl_check_ins
    ALTER COLUMN request_type SET NOT NULL;


/*
 * 자동 요청이 예정된 날짜.
 *
 * 수동 요청은 NULL이고,
 * 자동 요청만 날짜가 저장된다.
 */
ALTER TABLE wl_check_ins
    ADD COLUMN IF NOT EXISTS scheduled_date DATE;


/*
 * request_type에 허용된 값만 저장한다.
 */
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_wl_check_ins_request_type'
    ) THEN
ALTER TABLE wl_check_ins
    ADD CONSTRAINT ck_wl_check_ins_request_type
        CHECK (
            request_type IN (
                             'MANUAL',
                             'AUTOMATIC'
                )
            );
END IF;
END
$$;


/*
 * 한 어르신에게 하루에 자동 요청이
 * 두 번 생성되지 않도록 DB에서도 막는다.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
    uk_wl_check_ins_auto_daily
    ON wl_check_ins (
    senior_id,
    scheduled_date
    )
    WHERE request_type = 'AUTOMATIC'
    AND scheduled_date IS NOT NULL;
