import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  getCheckIns,
  getGuardianAlerts,
  getLatestLocation,
  getLatestRisk,
  getSafetyZone,
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import GuardianLayout from './GuardianLayout.jsx';
import DisconnectSeniorButton from './DisconnectSeniorButton.jsx';
import KakaoSafetyMap from './KakaoSafetyMap.jsx';

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


const EMPTY_CARE = {
  alerts: [],
  location: null,
  zone: null,
  zones: [],
  checkIn: null,
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

  if (
    risk.aiNoResponse
    || risk.checkInRisk
  ) {
    reasons.push('최근 안부 응답 미확인');
  }

  if (risk.weatherRisk) {
    reasons.push('심각한 기상특보');
  }

  if (
    risk.recallRisk
    || risk.recallUsageUnknown
  ) {
    reasons.push('리콜 제품 확인 필요');
  }

  if (
    risk.safetyRisk
    || risk.safetyInspectionOverdue
  ) {
    reasons.push('전기·가스 안전 확인 필요');
  }

  return reasons;
}


function getCheckInText(checkIn) {
  if (!checkIn) {
    return '기록 없음';
  }

  const status = String(
    checkIn.status ?? '',
  ).toUpperCase();

  return (
    CHECK_IN_LABELS[status]
    ?? checkIn.status
    ?? '기록 있음'
  );
}


function getHouseholdText(value) {
  const labels = {
    ALONE: '독거 가구',
    SINGLE: '1인 가구',
    SINGLE_PERSON: '독거 가구',
    COUPLE: '부부 가구',
    FAMILY: '가족 동거',
    LIVING_WITH_CHILDREN: '자녀 동거',
    FACILITY: '시설 거주',
    OTHER: '기타',
  };

  return (
    labels[String(value ?? '').toUpperCase()]
    ?? value
    ?? '미확인'
  );
}


function getLivingText(senior) {
  if (senior?.livingAlone === true) return '독거';
  if (senior?.livingAlone === false && String(senior?.householdType ?? '').toUpperCase() === 'COUPLE') return '배우자와 동거';
  return getHouseholdText(senior?.householdType);
}

function getHealthCautionText(senior, risk) {
  const cautions = [];
  if (senior?.severeDiseaseHouseholdMember) cautions.push('중증질환');
  if (senior?.rareDiseaseHouseholdMember) cautions.push('희귀질환');
  if (senior?.intractableDiseaseHouseholdMember) cautions.push('난치질환');
  if (risk?.fallRisk || risk?.fallRiskHigh || risk?.fallHistory) cautions.push('낙상 위험 높음');
  if (cautions.length === 0) return '등록 정보 없음';
  const cautionText = cautions.join(' · ');
  return senior?.disabilityGrade
    ? `${cautionText} (${senior.disabilityGrade})`
    : cautionText;
}

function getCareSupportView(senior) {
  const primary = senior?.longTermCare === true
    ? (senior?.longTermCareGrade ? `장기요양 ${senior.longTermCareGrade}등급` : '장기요양 대상')
    : senior?.longTermCare === false
      ? '장기요양 대상 아님'
      : '장기요양 정보 미확인';
  return { primary };
}

function getWelfareSummary(senior) {
  const eligible = [senior?.energyVoucherEligible, senior?.electricityDiscountEligible, senior?.gasDiscountEligible]
    .filter((value) => value === true).length;
  const completed = [senior?.energyVoucherApplied, senior?.electricityDiscountApplied, senior?.gasDiscountApplied]
    .filter((value) => value === true).length;
  if (eligible > 0) return `신청 가능성 ${eligible}건`;
  if (completed > 0) return `확인 완료 ${completed}건`;
  return '정보 확인 필요';
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

  return (
    zone.enabled == null
    || zone.enabled === true
  );
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
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [seniors, setSeniors] = useState([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState(null);

  const [risk, setRisk] = useState(null);

  const [care, setCare] = useState({
    ...EMPTY_CARE,
  });

  const [loading, setLoading] = useState(true);
  const [careLoading, setCareLoading] = useState(false);
  const [error, setError] = useState('');


  /*
   * 로그인한 보호자와 연결된 어르신 목록 조회
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSeniors() {
      setLoading(true);
      setError('');

      try {
        const response = await getSeniorsByGuardian();

        const seniorList = normalizeArray(
          response.data,
        );

        if (cancelled) {
          return;
        }

        setSeniors(seniorList);

        const requestedId = searchParams.get(
          'seniorId',
        );

        const requestedSenior = seniorList.find(
          (senior) => (
            String(senior.id)
            === String(requestedId)
          ),
        );

        const initialSeniorId = (
          requestedSenior?.id
          ?? seniorList[0]?.id
          ?? null
        );

        setSelectedSeniorId(initialSeniorId);

        if (initialSeniorId) {
          setSearchParams(
            {
              seniorId: String(initialSeniorId),
            },
            {
              replace: true,
            },
          );
        } else {
          setSearchParams(
            {},
            {
              replace: true,
            },
          );
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


  /*
   * 선택된 어르신의 상세 정보 조회
   */
  const loadSeniorDetail = useCallback(
    async (seniorId) => {
      if (!seniorId) {
        setRisk(null);

        setCare({
          ...EMPTY_CARE,
        });

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
            ? normalizeArray(
              alertsResult.value.data,
            )
            : []
        );

        const seniorAlerts = allAlerts.filter(
          (alert) => (
            String(getAlertSeniorId(alert))
            === String(seniorId)
          ),
        );

        const checkIns = (
          checkInResult.status === 'fulfilled'
            ? normalizeArray(
              checkInResult.value.data,
            )
            : []
        );

        const sortedCheckIns = [
          ...checkIns,
        ].sort((first, second) => (
          new Date(
            getTimestamp(second) ?? 0,
          ).getTime()
          - new Date(
            getTimestamp(first) ?? 0,
          ).getTime()
        ));

        setRisk(
          riskResult.status === 'fulfilled'
            ? normalizeSingle(
              riskResult.value.data,
            )
            : null,
        );

        setCare({
          alerts: seniorAlerts,

          location: (
            locationResult.status === 'fulfilled'
              ? normalizeSingle(
                locationResult.value.data,
              )
              : null
          ),

          zone: (
            zoneResult.status === 'fulfilled'
              ? selectSafetyZone(
                zoneResult.value.data,
              )
              : null
          ),

          zones: (
            zoneResult.status === 'fulfilled'
              ? normalizeArray(zoneResult.value.data).slice(0, 3)
              : []
          ),

          checkIn: sortedCheckIns[0] ?? null,
        });
      } finally {
        setCareLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    loadSeniorDetail(
      selectedSeniorId,
    );
  }, [
    loadSeniorDetail,
    selectedSeniorId,
  ]);


  const selectedSenior = useMemo(() => (
    seniors.find((senior) => (
      String(senior.id)
      === String(selectedSeniorId)
    )) ?? null
  ), [
    seniors,
    selectedSeniorId,
  ]);


  const riskView = getRiskView(
    risk?.level,
  );

  const riskReasons = getRiskReasons(
    risk,
  );


  const unreadAlertCount = care.alerts.filter(
    (alert) => (
      [
        'NEW',
        'UNREAD',
        'OPEN',
        'PENDING',
        'IN_PROGRESS',
      ].includes(
        String(
          alert?.status ?? '',
        ).toUpperCase(),
      )
    ),
  ).length;


  const zoneEnabled = isZoneEnabled(
    care.zone,
  );

  const zoneRadius = getZoneRadius(
    care.zone,
  );


  /*
   * 다른 어르신 선택
   */
  const handleSeniorChange = (seniorId) => {
    setSelectedSeniorId(seniorId);
    setError('');

    setSearchParams({
      seniorId: String(seniorId),
    });
  };


  /*
   * 전화하기
   */
  const callSenior = () => {
    if (!selectedSenior?.phone) {
      return;
    }

    const normalizedPhone = String(
      selectedSenior.phone,
    ).replace(/[^\d+]/g, '');

    window.location.href = `tel:${normalizedPhone}`;
  };


  /*
   * 연결 해제 완료 후 현재 화면의 목록만 갱신한다.
   *
   * 별도 페이지로 이동하거나 새로고침하지 않는다.
   */
  const handleSeniorDisconnected = (
    disconnectedSeniorId,
  ) => {
    const disconnectedIndex = seniors.findIndex(
      (senior) => (
        String(senior.id)
        === String(disconnectedSeniorId)
      ),
    );

    const remainingSeniors = seniors.filter(
      (senior) => (
        String(senior.id)
        !== String(disconnectedSeniorId)
      ),
    );

    setSeniors(remainingSeniors);
    setRisk(null);

    setCare({
      ...EMPTY_CARE,
    });

    setError('');

    /*
     * 해제된 어르신의 다음 항목을 선택한다.
     * 마지막 항목이었다면 이전 항목을 선택한다.
     */
    const nextSenior = (
      remainingSeniors[disconnectedIndex]
      ?? remainingSeniors[disconnectedIndex - 1]
      ?? remainingSeniors[0]
      ?? null
    );

    if (nextSenior) {
      setSelectedSeniorId(
        nextSenior.id,
      );

      setSearchParams(
        {
          seniorId: String(nextSenior.id),
        },
        {
          replace: true,
        },
      );

      return;
    }

    /*
     * 연결된 어르신이 한 명도 남지 않은 경우
     */
    setSelectedSeniorId(null);
    setCareLoading(false);

    setSearchParams(
      {},
      {
        replace: true,
      },
    );
  };


  return (
    <GuardianLayout activeMenu="seniors">
      <main className="guardian-senior-page">
        <section className="guardian-senior-page__heading">
          <div>
            <h1>어르신 현황</h1>
          </div>

          {seniors.length > 1 && (
            <div className="guardian-senior-page__selector" role="group" aria-label="어르신 선택">
              {seniors.map((senior) => (
                <button
                  type="button"
                  key={senior.id}
                  className={String(selectedSeniorId) === String(senior.id) ? 'active' : ''}
                  onClick={() => handleSeniorChange(senior.id)}
                >
                  {senior.name}
                </button>
              ))}
            </div>
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
                    <h2>
                      {selectedSenior.name}
                      {selectedSenior.age ? ` (${selectedSenior.age}세)` : ''}
                    </h2>

                    <span
                      className={[
                        'guardian-senior-hero__status',
                        `guardian-senior-hero__status--${riskView.tone}`,
                      ].join(' ')}
                    >
                      {riskView.label}
                    </span>
                  </div>

                  <p className="guardian-senior-hero__phone">
                    {formatPhone(selectedSenior.phone)}
                  </p>

                  {riskReasons.length > 0 && (
                    <p className="guardian-senior-hero__description">
                      {riskReasons.join(' · ')}
                    </p>
                  )}
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

                  <DisconnectSeniorButton
                    senior={selectedSenior}
                    onDisconnected={
                      handleSeniorDisconnected
                    }
                  />
                </div>
              </div>

              <div className="guardian-senior-hero__information">
                <div>
                  <span>거주 상황</span>

                  <strong>
                    {getLivingText(selectedSenior)}
                  </strong>
                </div>

                <div>
                  <span>건강 주의</span>

                  <strong>
                    {getHealthCautionText(selectedSenior, risk)}
                  </strong>
                </div>

                <div>
                  <span>돌봄·지원</span>

                  <strong>
                    {getCareSupportView(selectedSenior).primary}
                  </strong>
                </div>

                <div>
                  <span>맞춤 복지</span>

                  <strong>
                    {getWelfareSummary(selectedSenior)}
                  </strong>
                </div>
              </div>
            </section>

            <KakaoSafetyMap
              senior={selectedSenior}
              location={care.location}
              zones={care.zones}
              hasLocationRisk={Boolean(risk?.locationAnomaly || risk?.safetyZoneRisk)}
              loading={careLoading}
              onRefreshLocation={() => loadSeniorDetail(selectedSeniorId)}
            />

          </>
        )}
      </main>
    </GuardianLayout>
  );
}
