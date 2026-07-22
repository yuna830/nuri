/*
 * 어르신 한 명에게 여러 자동 안부 요청 시간을
 * 설정할 수 있도록 시간 목록 테이블을 추가한다.
 *
 * 예:
 * schedule_id = 1
 * request_time = 09:00
 *
 * schedule_id = 1
 * request_time = 12:00
 *
 * schedule_id = 1
 * request_time = 18:00
 */


/* =========================================================
 * 1. 자동 안부 발송 방식 컬럼 추가
 * =========================================================
 *
 * DIRECT:
 * 보호자가 09:00, 12:00, 18:00처럼 시간을 직접 설정
 *
 * INTERVAL:
 * 6시간 간격처럼 시스템이 시간 목록을 생성
 */
ALTER TABLE wl_check_in_schedules
    ADD COLUMN IF NOT EXISTS schedule_mode VARCHAR(20);


UPDATE wl_check_in_schedules
SET schedule_mode = 'DIRECT'
WHERE schedule_mode IS NULL;


ALTER TABLE wl_check_in_schedules
    ALTER COLUMN schedule_mode SET DEFAULT 'DIRECT';


ALTER TABLE wl_check_in_schedules
    ALTER COLUMN schedule_mode SET NOT NULL;


/*
 * 간격 발송을 선택했을 때 사용할 시간 간격.
 *
 * DIRECT 방식이면 NULL이어도 된다.
 * INTERVAL 방식이면 예를 들어 6이 저장된다.
 */
ALTER TABLE wl_check_in_schedules
    ADD COLUMN IF NOT EXISTS interval_hours INTEGER;


/*
 * 발송 방식 허용값 제한
 */
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_check_in_schedule_mode'
    ) THEN
ALTER TABLE wl_check_in_schedules
    ADD CONSTRAINT ck_check_in_schedule_mode
        CHECK (
            schedule_mode IN (
                              'DIRECT',
                              'INTERVAL'
                )
            );
END IF;
END
$$;


/*
 * 간격 시간 허용 범위
 *
 * 1시간 이상 24시간 이하로 제한한다.
 */
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_check_in_schedule_interval_hours'
    ) THEN
ALTER TABLE wl_check_in_schedules
    ADD CONSTRAINT ck_check_in_schedule_interval_hours
        CHECK (
            interval_hours IS NULL
                OR (
                interval_hours >= 1
                    AND interval_hours <= 24
                )
            );
END IF;
END
$$;


/* =========================================================
 * 2. 자동 안부 요청 시간 목록 테이블
 * ========================================================= */
CREATE TABLE IF NOT EXISTS wl_check_in_schedule_times (
                                                          id BIGSERIAL PRIMARY KEY,

                                                          schedule_id BIGINT NOT NULL,

                                                          request_time TIME NOT NULL,

    /*
     * 이 시간대에 마지막으로 자동 요청을 발송한 날짜.
     *
     * 같은 날 같은 시간에 중복 발송되는 것을 방지한다.
     */
                                                          last_sent_date DATE,

                                                          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                                          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                                          CONSTRAINT fk_check_in_schedule_time_schedule
                                                          FOREIGN KEY (schedule_id)
    REFERENCES wl_check_in_schedules(id)
    ON DELETE CASCADE,

    /*
     * 하나의 설정 안에서 같은 시간을 중복 저장하지 않는다.
     *
     * 예:
     * 09:00
     * 09:00
     *
     * 위와 같은 중복 저장을 차단한다.
     */
    CONSTRAINT uk_check_in_schedule_time
    UNIQUE (
               schedule_id,
               request_time
           )
    );


/*
 * 스케줄러가 활성화된 설정의 시간을
 * 빠르게 조회할 수 있도록 인덱스를 추가한다.
 */
CREATE INDEX IF NOT EXISTS
    idx_check_in_schedule_times_request_time
    ON wl_check_in_schedule_times (
    request_time
    );


/* =========================================================
 * 3. 기존 단일 시간 설정을 새 시간 목록으로 이전
 * =========================================================
 *
 * 기존 request_time 값은 삭제하지 않고 유지한다.
 * Java 코드 변경이 모두 끝난 다음 별도 마이그레이션으로
 * 기존 컬럼을 제거할 예정이다.
 */
INSERT INTO wl_check_in_schedule_times (
    schedule_id,
    request_time,
    last_sent_date
)
SELECT
    schedule.id,
    schedule.request_time,
    schedule.last_sent_date
FROM wl_check_in_schedules AS schedule
WHERE schedule.request_time IS NOT NULL
    ON CONFLICT (
    schedule_id,
    request_time
)
DO NOTHING;


/* =========================================================
 * 4. 안부 요청에 예정 시간을 저장
 * =========================================================
 *
 * 같은 날짜라도 09:00, 12:00, 18:00 요청을
 * 각각 구분할 수 있도록 scheduled_time을 추가한다.
 */
ALTER TABLE wl_check_ins
    ADD COLUMN IF NOT EXISTS scheduled_time TIME;


/*
 * 기존 하루 1회 자동 요청 중복 방지 인덱스를 제거한다.
 *
 * 기존 구조:
 * senior_id + scheduled_date
 *
 * 변경 구조:
 * senior_id + scheduled_date + scheduled_time
 */
DROP INDEX IF EXISTS uk_wl_check_ins_auto_daily;


/*
 * 같은 어르신에게 같은 날짜, 같은 시간의 자동 요청이
 * 중복 생성되는 것을 DB에서 차단한다.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
    uk_wl_check_ins_auto_schedule_time
    ON wl_check_ins (
    senior_id,
    scheduled_date,
    scheduled_time
    )
    WHERE request_type = 'AUTOMATIC'
    AND scheduled_date IS NOT NULL
    AND scheduled_time IS NOT NULL;