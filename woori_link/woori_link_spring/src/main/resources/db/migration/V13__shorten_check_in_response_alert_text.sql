/*
 * 이후 정상 안부 응답이 확인된 기존 알림 문구를
 * 보호자 화면에서 중복되지 않도록 간결하게 수정한다.
 */

UPDATE wl_care_alerts AS alert
SET
    title = '안부 응답 확인',

    message = COALESCE(
                      (
                          SELECT senior.name
                          FROM wl_seniors AS senior
                          WHERE senior.id = alert.senior_id
                      ),
                      '어르신'
              ) || '님이 정상적으로 응답했습니다.'

WHERE alert.type = 'CHECK_IN_MISSED'
  AND alert.status = 'RESOLVED'
  AND alert.title IN (
                      '이후 안부 응답 확인',
                      '안부 응답 확인'
    );
