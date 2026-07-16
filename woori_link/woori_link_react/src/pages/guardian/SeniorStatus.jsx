import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  getCheckIns,
  getGuardianAlerts,
  getLatestLocation,
  getLatestRisk,
  getSafetyZone,
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import GuardianLayout from './GuardianLayout.jsx';
import CareStatusPanel from './CareStatusPanel.jsx';

import '../../css/guardian/SeniorStatus.css';


const RISK_VIEW = {
  HIGH: {
    label: '확인 필요',
    tone: 'danger',
    description: '현재 보호자가 확인해야 할 항목이 있습니다.',
  },

  PRIORITY_REVIEW: {
    label: '확인 필요',
    tone: 'danger',
    description: '현재 보호자가 확인해야 할 항목이 있습니다.',
  },

  MEDIUM: {
    label: '관심 필요',
    tone: 'warning',
    description: '최근 상태와 알림을 한 번 확인해 주세요.',
  },

  ATTENTION: {
    label: '관심 필요',
    tone: 'warning',
    description: '최근 상태와 알림을 한 번 확인해 주세요.',
  },

  LOW: {
    label: '현재 안전',
    tone: 'safe',
    description: '현재 확인된 긴급 위험 항목이 없습니다.',
  },

  NORMAL: {
    label: '현재 안전',
    tone: 'safe',
    description: '현재 확인된 긴급 위험 항목이 없습니다.',
  },
};


const CHECK_IN_LABELS = {
  RESPONDED: '응답 완료',
  COMPLETED: '응답 완료',
  SUCCESS: '응답 완료',
  CONFIRMED: '응답 완료',

  NO_RESPONSE: '응답 미확인',
  MISSED: '응답 미확인',

  PENDING: '응답 대기',
  WAITING: '응답 대기',

  FAILED: '확인 실패',
};


function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
}


function normalizeSingle(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (Array.isArray(value?.content)) {
    return value.content[0] ?? null;
  }

  if (Array.isArray(value?.items)) {
    return value.items[0] ?? null;
  }

  return value;
}


function selectSafetyZone(value) {
  const zones = normalizeArray(value);

  return (
    zones.find((zone) => zone?.enabled === true)
    ?? zones[0]
    ?? normalizeSingle(value)
  );
}


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


function formatPhone(value) {
  if (!value) {
    return '미등록';
  }

  const original = String(value);
  const digits = original.replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(
      /(\d{3})(\d{4})(\d{4})/,
      '$1-$2-$3',
    );
  }

  if (digits.length === 10) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{4})/,
      '$1-$2-$3',
    );
  }

  return original;
}


function getRiskView(level) {
  return (
    RISK_VIEW[String(level ?? '').toUpperCase()]
    ?? {
      label: '상태 확인 중',
      tone: 'neutral',
      description: '아직 종합 상태 평가 결과가 없습니다.',
    }
  );
}


function getRiskReasons(risk) {
  if (!risk) {
    return [];
  }

  const reasons = [];

  if (risk.aiNoResponse || risk.checkInRisk) {
    reasons.push('최근 안부 응답 미확인');
  }

  if (risk.locationAnomaly || risk.safetyZoneRisk) {
    reasons.push('안전구역 또는 위치 이상');
  }

  if (risk.weatherRisk) {
    reasons.push('심각한 기상특보');
  }

  if (risk.recallRisk || risk.recallUsageUnknown) {
    reasons.push('리콜 제품 확인 필요');
  }

  if (risk.safetyRisk || risk.safetyInspectionOverdue) {
    reasons.push('전기·가스 안전 확인 필요');
  }

  return reasons;
}


function getCheckInText(checkIn) {
  if (!checkIn) {
    return '기록 없음';
  }

  const status = String(checkIn.status ?? '').toUpperCase();

  return (
    CHECK_IN_LABELS[status]
    ?? checkIn.status
    ?? '기록 있음'
  );
}


function getHouseholdText(value) {
  const labels = {
    SINGLE: '1인 가구',
    SINGLE_PERSON: '1인 가구',
    COUPLE: '부부 가구',
    FAMILY: '가족 동거',
    LIVING_WITH_CHILDREN: '자녀 동거',
    FACILITY: '시설 거주',
    OTHER: '기타',
  };

  return labels[String(value ?? '').toUpperCase()] ?? value ?? '미확인';
}


function getLongTermCareText(value) {
  if (value === true) {
    return '대상';
  }

  if (value === false) {
    return '대상 아님';
  }

  return '미확인';
}


function getEnergyVoucherText(senior) {
  if (senior?.energyVoucherEligible === false) {
    return '대상 아님';
  }

  if (senior?.energyVoucherEligible == null) {
    return '자격 확인 중';
  }

  if (senior?.energyVoucherApplied === true) {
    return '신청 완료';
  }

  return '미신청 확인';
}


function buildAddress(senior) {
  return [
    senior?.address,
    senior?.detailAddress,
  ]
    .filter(Boolean)
    .join(' ')
    || '주소 미등록';
}


function getAlertSeniorId(alert) {
  return (
    alert?.seniorId
    ?? alert?.senior?.id
    ?? alert?.targetSeniorId
    ?? null
  );
}


function isZoneEnabled(zone) {
  if (!zone) {
    return false;
  }

  return zone.enabled == null || zone.enabled === true;
}


function getZoneRadius(zone) {
  return (
    zone?.radiusMeters
    ?? zone?.radius
    ?? zone?.distance
    ?? null
  );
}


export default function SeniorStatus() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [seniors, setSeniors] = useState([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState(null);

  const [risk, setRisk] = useState(null);

  const [care, setCare] = useState({
    alerts: [],
    location: null,
    zone: null,
    checkIn: null,
  });

  const [loading, setLoading] = useState(true);
  const [careLoading, setCareLoading] = useState(false);
  const [error, setError] = useState('');


  useEffect(() => {
    let cancelled = false;

    async function loadSeniors() {
      setLoading(true);
      setError('');

      try {
        const response = await getSeniorsByGuardian();
        const seniorList = normalizeArray(response.data);

        if (cancelled) {
          return;
        }

        setSeniors(seniorList);

        const requestedId = searchParams.get('seniorId');

        const requestedSenior = seniorList.find((senior) => (
          String(senior.id) === String(requestedId)
        ));

        const initialSeniorId = (
          requestedSenior?.id
          ?? seniorList[0]?.id
          ?? null
        );

        setSelectedSeniorId(initialSeniorId);

        if (initialSeniorId) {
          setSearchParams({
            seniorId: String(initialSeniorId),
          }, {
            replace: true,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.response?.data?.message
            || '담당 어르신 정보를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSeniors();

    return () => {
      cancelled = true;
    };
  }, []);


  const loadSeniorDetail = useCallback(async (seniorId) => {
    if (!seniorId) {
      return;
    }

    setCareLoading(true);

    try {
      const [
        riskResult,
        alertsResult,
        locationResult,
        zoneResult,
        checkInResult,
      ] = await Promise.allSettled([
        getLatestRisk(seniorId),
        getGuardianAlerts(),
        getLatestLocation(seniorId),
        getSafetyZone(seniorId),
        getCheckIns(seniorId),
      ]);

      const allAlerts = (
        alertsResult.status === 'fulfilled'
          ? normalizeArray(alertsResult.value.data)
          : []
      );

      const seniorAlerts = allAlerts.filter((alert) => (
        String(getAlertSeniorId(alert))
        === String(seniorId)
      ));

      const checkIns = (
        checkInResult.status === 'fulfilled'
          ? normalizeArray(checkInResult.value.data)
          : []
      );

      const sortedCheckIns = [...checkIns].sort((first, second) => (
        new Date(getTimestamp(second) ?? 0).getTime()
        - new Date(getTimestamp(first) ?? 0).getTime()
      ));

      setRisk(
        riskResult.status === 'fulfilled'
          ? normalizeSingle(riskResult.value.data)
          : null,
      );

      setCare({
        alerts: seniorAlerts,

        location: locationResult.status === 'fulfilled'
          ? normalizeSingle(locationResult.value.data)
          : null,

        zone: zoneResult.status === 'fulfilled'
          ? selectSafetyZone(zoneResult.value.data)
          : null,

        checkIn: sortedCheckIns[0] ?? null,
      });
    } finally {
      setCareLoading(false);
    }
  }, []);


  useEffect(() => {
    loadSeniorDetail(selectedSeniorId);
  }, [
    loadSeniorDetail,
    selectedSeniorId,
  ]);


  const selectedSenior = useMemo(() => (
    seniors.find((senior) => (
      String(senior.id) === String(selectedSeniorId)
    )) ?? null
  ), [
    seniors,
    selectedSeniorId,
  ]);


  const riskView = getRiskView(risk?.level);
  const riskReasons = getRiskReasons(risk);

  const unreadAlertCount = care.alerts.filter((alert) => (
    [
      'NEW',
      'UNREAD',
      'OPEN',
      'PENDING',
      'IN_PROGRESS',
    ].includes(String(alert?.status ?? '').toUpperCase())
  )).length;

  const zoneEnabled = isZoneEnabled(care.zone);
  const zoneRadius = getZoneRadius(care.zone);


  const handleSeniorChange = (event) => {
    const seniorId = event.target.value;

    setSelectedSeniorId(seniorId);

    setSearchParams({
      seniorId: String(seniorId),
    });
  };


  const callSenior = () => {
    if (!selectedSenior?.phone) {
      return;
    }

    window.location.href = `tel:${String(selectedSenior.phone).replace(/[^\d+]/g, '')}`;
  };


  return (
    <GuardianLayout activeMenu="seniors">
      <main className="guardian-senior-page">
        <section className="guardian-senior-page__heading">
          <div>
            <h1>어르신 현황</h1>
          </div>

          {seniors.length > 1 && (
            <select
              className="guardian-senior-page__select"
              value={selectedSeniorId ?? ''}
              onChange={handleSeniorChange}
            >
              {seniors.map((senior) => (
                <option
                  key={senior.id}
                  value={senior.id}
                >
                  {senior.name} 어르신
                </option>
              ))}
            </select>
          )}
        </section>

        {error && (
          <div className="guardian-senior-page__error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="guardian-senior-page__state">
            담당 어르신 정보를 불러오는 중입니다.
          </div>
        ) : !selectedSenior ? (
          <div className="guardian-senior-page__state">
            연결된 담당 어르신이 없습니다.
          </div>
        ) : (
          <>
            <section
              className={[
                'guardian-senior-hero',
                `guardian-senior-hero--${riskView.tone}`,
              ].join(' ')}
            >
              <div className="guardian-senior-hero__top">
                <div>
                  <div className="guardian-senior-hero__title">
                    <h2>{selectedSenior.name} 어르신</h2>

                    <span
                      className={[
                        'guardian-senior-hero__status',
                        `guardian-senior-hero__status--${riskView.tone}`,
                      ].join(' ')}
                    >
                      {riskView.label}
                    </span>
                  </div>

                  <p className="guardian-senior-hero__address">
                    {selectedSenior.age
                      ? `${selectedSenior.age}세 · `
                      : ''}

                    {buildAddress(selectedSenior)}
                  </p>

                  <p className="guardian-senior-hero__description">
                    {riskReasons.length > 0
                      ? riskReasons.join(' · ')
                      : riskView.description}
                  </p>
                </div>

                <div className="guardian-senior-hero__actions">
                  <button
                    type="button"
                    className="guardian-senior-hero__call"
                    onClick={callSenior}
                    disabled={!selectedSenior.phone}
                  >
                    전화하기
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById('guardian-care-status')
                        ?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                    }}
                  >
                    최근 위치·알림 보기
                  </button>
                </div>
              </div>

              <div className="guardian-senior-hero__information">
                <div>
                  <span>연락처</span>
                  <strong>{formatPhone(selectedSenior.phone)}</strong>
                </div>

                <div>
                  <span>가구 형태</span>
                  <strong>
                    {getHouseholdText(selectedSenior.householdType)}
                  </strong>
                </div>

                <div>
                  <span>장기요양</span>
                  <strong>
                    {getLongTermCareText(selectedSenior.longTermCare)}
                  </strong>
                </div>

                <div>
                  <span>장애 정보</span>
                  <strong>
                    {selectedSenior.disabilityGrade
                      || '해당 없음 또는 미확인'}
                  </strong>
                </div>
              </div>
            </section>

            <section className="guardian-senior-summary">
              <article>
                <span>안부 상태</span>
                <strong>{getCheckInText(care.checkIn)}</strong>

                <small>
                  {formatDateTime(getTimestamp(care.checkIn))}
                </small>
              </article>

              <article>
                <span>위치·안전</span>

                <strong>
                  {zoneEnabled
                    ? '안전구역 설정'
                    : '안전구역 미설정'}
                </strong>

                <small>
                  {care.location
                    ? `최근 위치 수신 · 반경 ${zoneRadius ?? '-'}m`
                    : '최근 위치 정보 없음'}
                </small>
              </article>

              <article>
                <span>확인 필요 알림</span>
                <strong>{unreadAlertCount}건</strong>

                <small>
                  {unreadAlertCount > 0
                    ? '최근 알림 확인이 필요합니다.'
                    : '새 알림이 없습니다.'}
                </small>
              </article>

              <article>
                <span>에너지복지</span>

                <strong>
                  {getEnergyVoucherText(selectedSenior)}
                </strong>

                <small>복지사 확인 결과 기준</small>
              </article>
            </section>

            <CareStatusPanel
              location={care.location}
              zone={care.zone}
              alerts={care.alerts}
              loading={careLoading}
              onRefresh={() => loadSeniorDetail(selectedSenior.id)}
            />
          </>
        )}
      </main>
    </GuardianLayout>
  );
}