UPDATE wl_care_alerts
SET title = '안부 응답 확인',
    message = REPLACE(message, '어르신', '님')
WHERE type = 'CHECK_IN_MISSED'
  AND status = 'RESOLVED';