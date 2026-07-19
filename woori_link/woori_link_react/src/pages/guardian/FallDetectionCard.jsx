import { useMemo, useState } from 'react';


function formatOccurredAt(value) {
  if (!value) {
    return '시간 정보 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}


function getStatusView(status) {
  const normalized = String(status ?? 'PENDING').toUpperCase();

  if (['RESOLVED', 'COMPLETED', 'CLOSED'].includes(normalized)) {
    return { label: '처리 완료', tone: 'resolved' };
  }

  if (['ACKNOWLEDGED', 'CONFIRMED', 'READ'].includes(normalized)) {
    return { label: '확인됨', tone: 'confirmed' };
  }

  return { label: '확인 필요', tone: 'pending' };
}


function getDetailEntries(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return [];
  }

  return Object.entries(details).filter(([, value]) => (
    value !== null
    && value !== undefined
    && typeof value !== 'object'
  ));
}


export default function FallDetectionCard({
  events = [],
  loading = false,
}) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const latestEvent = events[0] ?? null;
  const statusView = getStatusView(latestEvent?.status);
  const detailEntries = useMemo(
    () => getDetailEntries(selectedEvent?.fallDetails),
    [selectedEvent],
  );

  return (
    <section className="guardian-fall-card" aria-labelledby="fall-card-title">
      <div className="guardian-fall-card__heading">
        <div>
          <p className="guardian-fall-card__eyebrow">낙상 감지</p>
          <h2 id="fall-card-title">최근 낙상 기록</h2>
        </div>

        {latestEvent && (
          <span className={`guardian-fall-status guardian-fall-status--${statusView.tone}`}>
            {statusView.label}
          </span>
        )}
      </div>

      {loading && (
        <div className="guardian-fall-card__state" role="status">
          낙상 기록을 불러오는 중입니다.
        </div>
      )}

      {!loading && !latestEvent && (
        <div className="guardian-fall-card__state guardian-fall-card__state--safe">
          최근 감지된 낙상이 없습니다.
        </div>
      )}

      {!loading && latestEvent && (
        <div className="guardian-fall-card__content">
          <div className="guardian-fall-card__image-wrap">
            {latestEvent.imageUrl ? (
              <img
                src={latestEvent.imageUrl}
                alt="낙상 감지 당시 촬영 이미지"
                className="guardian-fall-card__image"
              />
            ) : (
              <div className="guardian-fall-card__image-empty">
                촬영된 이미지가 없습니다.
              </div>
            )}
          </div>

          <div className="guardian-fall-card__information">
            <p className="guardian-fall-card__time">
              {formatOccurredAt(latestEvent.occurredAt)}
            </p>

            <div className="guardian-fall-card__score">
              <span>감지 점수</span>
              <strong>
                {Number.isFinite(Number(latestEvent.detectionScore))
                  ? `${Math.round(Number(latestEvent.detectionScore))}점`
                  : '정보 없음'}
              </strong>
            </div>

            <p className="guardian-fall-card__count">
              전체 낙상 기록 {events.length}건
            </p>

            <button
              type="button"
              className="guardian-fall-card__detail-button"
              onClick={() => setSelectedEvent(latestEvent)}
            >
              상세 정보 보기
            </button>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div
          className="guardian-fall-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedEvent(null);
            }
          }}
        >
          <div
            className="guardian-fall-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fall-detail-title"
          >
            <div className="guardian-fall-modal__heading">
              <h3 id="fall-detail-title">낙상 감지 상세 정보</h3>
              <button
                type="button"
                aria-label="상세 정보 닫기"
                onClick={() => setSelectedEvent(null)}
              >
                ×
              </button>
            </div>

            <dl className="guardian-fall-modal__details">
              <div>
                <dt>감지 시간</dt>
                <dd>{formatOccurredAt(selectedEvent.occurredAt)}</dd>
              </div>
              <div>
                <dt>감지 점수</dt>
                <dd>{selectedEvent.detectionScore ?? '정보 없음'}</dd>
              </div>
              <div>
                <dt>처리 상태</dt>
                <dd>{getStatusView(selectedEvent.status).label}</dd>
              </div>

              {detailEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
