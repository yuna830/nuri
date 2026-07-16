import { useState } from 'react';

import {
  acknowledgeAlert,
} from '../../api/guardianApi.js';


const ALERT_TYPE_LABELS = {
  CHECK_IN: '안부',
  CHECKIN: '안부',

  LOCATION: '위치',
  GEOFENCE: '안전구역',
  SAFETY_ZONE: '안전구역',

  WEATHER: '기상',
  WEATHER_ALERT: '기상',

  RECALL: '리콜',
  PRODUCT_RECALL: '리콜',

  WELFARE: '복지',
  MEDICATION: '복약',
};


function getTimestamp(item) {
  return (
    item?.checkedAt
    ?? item?.respondedAt
    ?? item?.recordedAt
    ?? item?.capturedAt
    ?? item?.locatedAt
    ?? item?.sentAt
    ?? item?.occurredAt
    ?? item?.timestamp
    ?? item?.createdAt
    ?? item?.updatedAt
    ?? null
  );
}


function formatDateTime(value) {
  if (!value) {
    return '기록 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '기록 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}


function getAlertType(alert) {
  const type = String(
    alert?.type
    ?? alert?.alertType
    ?? alert?.category
    ?? '',
  ).toUpperCase();

  return ALERT_TYPE_LABELS[type] ?? '알림';
}


function getAlertTitle(alert) {
  return (
    alert?.title
    ?? alert?.subject
    ?? alert?.alertTitle
    ?? '확인 필요 알림'
  );
}


function getAlertMessage(alert) {
  return (
    alert?.message
    ?? alert?.content
    ?? alert?.description
    ?? ''
  );
}


function isUnread(alert) {
  return [
    'NEW',
    'UNREAD',
    'OPEN',
    'PENDING',
  ].includes(String(alert?.status ?? '').toUpperCase());
}


function getZoneRadius(zone) {
  return (
    zone?.radiusMeters
    ?? zone?.radius
    ?? zone?.distance
    ?? null
  );
}


function isZoneEnabled(zone) {
  if (!zone) {
    return false;
  }

  return zone.enabled == null || zone.enabled === true;
}


export default function CareStatusPanel({
  location,
  zone,
  alerts = [],
  loading = false,
  onRefresh,
}) {
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');


  const handleAcknowledge = async (alertId) => {
    if (!alertId) {
      return;
    }

    setProcessingId(alertId);
    setError('');

    try {
      await acknowledgeAlert(alertId, false);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message
        || '알림 확인 처리에 실패했습니다.',
      );
    } finally {
      setProcessingId(null);
    }
  };


  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  const hasCoordinates = (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
  );

  const zoneEnabled = isZoneEnabled(zone);
  const zoneRadius = getZoneRadius(zone);

  const recentAlerts = [...alerts]
    .sort((first, second) => (
      new Date(getTimestamp(second) ?? 0).getTime()
      - new Date(getTimestamp(first) ?? 0).getTime()
    ))
    .slice(0, 5);


  return (
    <article
      id="guardian-care-status"
      className="guardian-content-card"
    >
      <div className="guardian-card-heading">
        <h3>최근 위치·알림</h3>

        <p>
          최근 수신된 위치와 보호자가 확인할 알림을 표시합니다.
        </p>
      </div>

      {loading ? (
        <div className="guardian-card-state">
          최근 상태를 불러오는 중입니다.
        </div>
      ) : (
        <>
          {location ? (
            <div className="guardian-location-summary">
              <div>
                <strong>최근 위치가 수신되었습니다.</strong>

                <p>
                  마지막 수신 {formatDateTime(getTimestamp(location))}
                  {' · '}

                  {zoneEnabled
                    ? `안전구역 반경 ${zoneRadius ?? '-'}m`
                    : '안전구역 미설정'}
                </p>
              </div>

              <span>
                {hasCoordinates
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : '좌표 정보 없음'}
              </span>
            </div>
          ) : (
            <div
              className="guardian-empty-alert"
              style={{
                margin: '18px 21px 0',
              }}
            >
              최근 위치 정보가 없습니다.
            </div>
          )}

          <div className="guardian-alert-section">
            <div className="guardian-alert-section-heading">
              <h4>최근 알림</h4>
              <span>{recentAlerts.length}건</span>
            </div>

            {error && (
              <div className="guardian-senior-page__error">
                {error}
              </div>
            )}

            {recentAlerts.length === 0 ? (
              <div className="guardian-empty-alert">
                최근 알림이 없습니다.
              </div>
            ) : (
              <div className="guardian-alert-list">
                {recentAlerts.map((alert, index) => {
                  const alertId = (
                    alert?.id
                    ?? alert?.alertId
                    ?? `alert-${index}`
                  );

                  const canAcknowledge = (
                    isUnread(alert)
                    && alert?.id != null
                  );

                  return (
                    <div
                      className="guardian-alert-item"
                      key={alertId}
                    >
                      <div className="guardian-alert-copy">
                        <div className="guardian-alert-title-row">
                          <span className="guardian-alert-type">
                            {getAlertType(alert)}
                          </span>

                          <strong>{getAlertTitle(alert)}</strong>
                        </div>

                        {getAlertMessage(alert) && (
                          <p>{getAlertMessage(alert)}</p>
                        )}

                        <small>
                          {formatDateTime(getTimestamp(alert))}
                        </small>
                      </div>

                      {canAcknowledge ? (
                        <button
                          type="button"
                          className="guardian-alert-confirm-button"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={processingId === alert.id}
                        >
                          {processingId === alert.id
                            ? '처리 중...'
                            : '확인했어요'}
                        </button>
                      ) : (
                        <span className="guardian-alert-read">
                          확인됨
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}