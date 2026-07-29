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
  getCheckInAnalysis,
  getCareEvents,
  getGuardianAlerts,
  getLatestLocation,
  getLatestRisk,
  getSafetyZone,
  getSeniorsByGuardian,
  requestCheckIn,
} from '../../api/guardianApi.js';

import GuardianLayout from './GuardianLayout.jsx';
import DisconnectSeniorButton from './DisconnectSeniorButton.jsx';
import KakaoSafetyMap from './KakaoSafetyMap.jsx';
import CheckInScheduleModal from './CheckInScheduleModal.jsx';
import AiDecisionNotice from '../../components/common/AiDecisionNotice.jsx';
import {
  connectGuardianSenior,
} from '../../api/guardianRelationshipApi.js';

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


const CHECK_IN_ANALYSIS_VIEW = {
  INSUFFICIENT: {
    label: '분석 준비 중',
    tone: 'neutral',
  },

  NORMAL: {
    label: '정상',
    tone: 'safe',
  },

  CAUTION: {
    label: '확인 필요',
    tone: 'warning',
  },

  URGENT: {
    label: '빠른 확인 필요',
    tone: 'danger',
  },
};


const EMPTY_CARE = {
  alerts: [],
  fallEvents: [],
  location: null,
  zone: null,
  zones: [],
  checkIn: null,
  checkInAnalysis: null,
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

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
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
    RISK_VIEW[
    String(level ?? '').toUpperCase()
    ]
    ?? {
      label: '상태 확인 중',
      tone: 'neutral',
      description: '아직 종합 상태 평가 결과가 없습니다.',
    }
  );
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


function getFallStatusText(
  events,
  loading,
) {
  if (loading) {
    return '확인 중';
  }

  const latestEvent = events?.[0];

  if (!latestEvent) {
    return '최근 감지 없음';
  }

  const status = String(
    latestEvent.status ?? '',
  ).toUpperCase();

  if (
    [
      'RESOLVED',
      'COMPLETED',
      'CLOSED',
      'SAFETY_CONFIRMED',
    ].includes(status)
  ) {
    return '안전 확인 완료';
  }

  if (
    [
      'FALSE_ALARM',
      'DISMISSED',
    ].includes(status)
  ) {
    return '오감지 확인';
  }

  if (
    [
      'FALL_SUSPECTED',
      'SUSPECTED',
    ].includes(status)
  ) {
    return '낙상 의심';
  }

  return '낙상 감지';
}


function getCheckInDescription(
  checkIn,
) {
  if (!checkIn) {
    return '아직 안부 확인 기록이 없습니다.';
  }

  const status = String(
    checkIn.status ?? '',
  ).toUpperCase();

  if (
    status === 'PENDING'
    || status === 'WAITING'
  ) {
    return '님의 응답을 기다리고 있습니다.';
  }

  if (
    status === 'MISSED'
    || status === 'NO_RESPONSE'
  ) {
    return '응답이 없어 직접 확인이 필요합니다.';
  }

  if (
    status === 'RESPONDED'
    || status === 'COMPLETED'
    || status === 'SUCCESS'
  ) {
    return (
      checkIn.responseMessage
      || '님이 괜찮다고 응답했습니다.'
    );
  }

  return '최근 안부 확인 결과를 확인해 주세요.';
}


function getCheckInAnalysisView(
  level,
) {
  return (
    CHECK_IN_ANALYSIS_VIEW[
    String(level ?? '').toUpperCase()
    ]
    ?? CHECK_IN_ANALYSIS_VIEW.INSUFFICIENT
  );
}


function formatPercent(value) {
  if (
    value == null
    || Number.isNaN(Number(value))
  ) {
    return '-';
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatCheckInDateTime(
  value,
) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
  ).format(date);
}


function getCheckInAnalysisGuide(analysis) {
  const level = String(
    analysis?.riskLevel ?? '',
  ).toUpperCase();

  if (level === 'URGENT') {
    return (
      '가능한 한 빠르게 전화나 방문으로 '
      + '현재 상태를 확인해 주세요.'
    );
  }

  if (level === 'CAUTION') {
    return (
      '오늘 중 전화로 최근 상태를 '
      + '한 번 확인해 주세요.'
    );
  }

  if (level === 'NORMAL') {
    return (
      '현재 응답 패턴은 정상 범위입니다. '
      + '기존 안부 확인을 이어가 주세요.'
    );
  }

  return (
    '종료된 안부 기록이 2건 이상 쌓이면 '
    + '응답 패턴을 분석합니다.'
  );
}

/**
 * FastAPI에서 전달한 Gemini 안내문을 우선 사용한다.
 *
 * Gemini 안내문이 없으면 위험 단계별 기본 안내문을 사용하고,
 * 분석 데이터 자체가 없으면 최근 안부 상태 문구를 사용한다.
 */
function getCheckInSummary(
  analysis,
  checkIn,
) {
  const guardianSummary = String(
    analysis?.guardianSummary ?? '',
  ).trim();

  if (guardianSummary) {
    return guardianSummary;
  }

  if (analysis) {
    return getCheckInAnalysisGuide(
      analysis,
    );
  }

  return getCheckInDescription(
    checkIn,
  );
}

/**
 * Gemini 안내문이 두 문장 이상이면
 * 마지막 행동 안내 문장을 권장 조치로 분리한다.
 *
 * 예:
 * 요약: 최근 미응답 사례가 발생하여 주의가 필요합니다.
 * 조치: 오늘 중 직접 전화하여 안부를 확인해 주세요.
 */
function splitCheckInSummary(
  analysis,
  checkIn,
) {
  const fullText = getCheckInSummary(
    analysis,
    checkIn,
  );

  const sentences = (
    fullText.match(
      /[^.!?。！？]+[.!?。！？]?/g,
    )
    ?? [fullText]
  )
    .map(
      (sentence) => sentence.trim(),
    )
    .filter(Boolean);

  if (sentences.length < 2) {
    return {
      summary: fullText,
      action: '',
    };
  }

  const lastSentence = sentences[
    sentences.length - 1
  ];

  const looksLikeAction =
    /전화|방문|연락|확인|권장|요청|점검|이어가|살펴/.test(
      lastSentence,
    );

  if (!looksLikeAction) {
    return {
      summary: fullText,
      action: '',
    };
  }

  return {
    summary: sentences
      .slice(0, -1)
      .join(' '),

    action: lastSentence,
  };
}

function formatFallOccurredAt(
  value,
) {
  if (!value) {
    return '시간 정보 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}


function getHealthCautionText(
  senior,
  risk,
) {
  const cautions = [];

  if (
    senior?.severeDiseaseHouseholdMember
  ) {
    cautions.push('중증질환');
  }

  if (
    senior?.rareDiseaseHouseholdMember
  ) {
    cautions.push('희귀질환');
  }

  if (
    senior?.intractableDiseaseHouseholdMember
  ) {
    cautions.push('난치질환');
  }

  if (
    risk?.fallRisk
    || risk?.fallRiskHigh
    || risk?.fallHistory
  ) {
    cautions.push('낙상 위험 높음');
  }

  if (cautions.length === 0) {
    return '등록 정보 없음';
  }

  const cautionText = cautions.join(
    ' · ',
  );

  return senior?.disabilityGrade
    ? `${cautionText} (${senior.disabilityGrade})`
    : cautionText;
}


function getLongTermCareText(
  value,
) {
  if (value === true) {
    return '대상';
  }

  if (value === false) {
    return '대상 아님';
  }

  return '미확인';
}

function getAlertSeniorId(
  alert,
) {
  return (
    alert?.seniorId
    ?? alert?.senior?.id
    ?? alert?.targetSeniorId
    ?? null
  );
}


function getZoneRadius(
  zone,
) {
  return (
    zone?.radiusMeters
    ?? zone?.radius
    ?? zone?.distance
    ?? null
  );
}

function getLocationSummary(
  senior,
  location,
) {
  if (!location) {
    return {
      primary: '현재 위치 미수신',
      secondary: (
        senior?.address
          ? '등록 주소 기준'
          : '등록 주소 없음'
      ),
    };
  }

  const address = String(
    location.address
    ?? location.roadAddress
    ?? location.placeName
    ?? senior?.address
    ?? '',
  ).trim();

  const shortAddress = address
    ? address
      .split(/\s+/)
      .slice(-2)
      .join(' ')
    : '최근 위치 수신';

  return {
    primary: shortAddress,
    secondary: formatDateTime(
      getTimestamp(location),
    ),
  };
}


function getCheckInStatusSummary(
  checkIn,
  analysis,
) {
  const status = String(
    checkIn?.status ?? '',
  ).toUpperCase();

  const consecutiveMissedCount = Number(
    analysis?.consecutiveMissedCount
    ?? analysis?.consecutiveNoResponseCount
    ?? 0,
  );

  const missedCount = Number(
    analysis?.missedCount ?? 0,
  );

  if (consecutiveMissedCount > 0) {
    return {
      primary: `연속 미응답 ${consecutiveMissedCount}회`,
      secondary: checkIn
        ? `최근 요청 ${formatDateTime(getTimestamp(checkIn))}`
        : '최근 요청 정보 없음',
      dangerous: true,
    };
  }

  if (
    status === 'MISSED'
    || status === 'NO_RESPONSE'
  ) {
    return {
      primary: '최근 안부 미응답',
      secondary: checkIn
        ? `최근 요청 ${formatDateTime(getTimestamp(checkIn))}`
        : '최근 요청 정보 없음',
      dangerous: true,
    };
  }

  if (missedCount > 0) {
    return {
      primary: `누적 미응답 ${missedCount}회`,
      secondary: checkIn
        ? `최근 요청 ${formatDateTime(getTimestamp(checkIn))}`
        : '최근 요청 정보 없음',
      dangerous: true,
    };
  }

  if (
    status === 'PENDING'
    || status === 'WAITING'
  ) {
    return {
      primary: '응답 대기 중',
      secondary: checkIn
        ? `요청 ${formatDateTime(getTimestamp(checkIn))}`
        : '최근 요청 정보 없음',
      dangerous: false,
    };
  }

  if (
    status === 'RESPONDED'
    || status === 'COMPLETED'
    || status === 'SUCCESS'
    || status === 'CONFIRMED'
  ) {
    return {
      primary: '최근 안부 응답 완료',
      secondary: formatDateTime(
        getTimestamp(checkIn),
      ),
      dangerous: false,
    };
  }

  return {
    primary: '안부 기록 없음',
    secondary: '최근 요청 정보 없음',
    dangerous: false,
  };
}


function getProductSafetySummary(
  risk,
) {
  if (risk?.recallRisk === true) {
    return {
      primary: '리콜 조치 필요',
      secondary: '사용 중인 리콜 제품 확인 필요',
      dangerous: true,
    };
  }

  if (
    risk?.recallUsageUnknown === true
  ) {
    return {
      primary: '리콜 사용 여부 확인 필요',
      secondary: '제품 사용 상태를 확인해 주세요',
      dangerous: true,
    };
  }

  return {
    primary: '조치 필요 없음',
    secondary: '현재 확인된 리콜 위험 없음',
    dangerous: false,
  };
}


function getSafetyZoneSummary(
  zone,
) {
  if (!zone) {
    return {
      primary: '안전구역 미설정',
      secondary: '안전구역을 등록해 주세요',
      dangerous: false,
    };
  }

  const zoneName = (
    zone.name
    ?? zone.zoneName
    ?? zone.label
    ?? '안전구역'
  );

  const radius = getZoneRadius(zone);

  return {
    primary: zoneName,
    secondary: radius
      ? `반경 ${radius}m`
      : '반경 정보 없음',
    dangerous: false,
  };
}


function getHeroRiskLabels({
  risk,
  fallEvents,
  careLoading,
  checkIn,
  checkInAnalysis,
}) {
  const labels = [];

  if (risk?.weatherRisk === true) {
    labels.push(
      risk.weatherAlertName
      ?? '심각한 기상특보',
    );
  }

  const fallStatus = getFallStatusText(
    fallEvents,
    careLoading,
  );

  if (
    !careLoading
    && [
      '낙상 감지',
      '낙상 의심',
    ].includes(fallStatus)
  ) {
    labels.push(fallStatus);
  }

  const checkInStatus =
    getCheckInStatusSummary(
      checkIn,
      checkInAnalysis,
    );

  if (checkInStatus.dangerous) {
    labels.push('안부 미응답');
  }

  if (
    risk?.recallRisk === true
    || risk?.recallUsageUnknown === true
  ) {
    labels.push('리콜 확인 필요');
  }

  return labels;
}

export default function SeniorStatus() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [
    checkInAnalysisLoading,
    setCheckInAnalysisLoading,
  ] = useState(false);

  const [
    seniors,
    setSeniors,
  ] = useState([]);

  const [
    selectedSeniorId,
    setSelectedSeniorId,
  ] = useState(null);

  const [
    risk,
    setRisk,
  ] = useState(null);

  const [
    care,
    setCare,
  ] = useState({
    ...EMPTY_CARE,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    careLoading,
    setCareLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    connectOpen,
    setConnectOpen,
  ] = useState(false);

  const [
    connectForm,
    setConnectForm,
  ] = useState({
    name: '',
    phone: '',
  });

  const [
    connecting,
    setConnecting,
  ] = useState(false);

  const [
    connectError,
    setConnectError,
  ] = useState('');

  const [
    fallDetailOpen,
    setFallDetailOpen,
  ] = useState(false);

  const [
    summaryDetail,
    setSummaryDetail,
  ] = useState(null);

  const [
    checkInRequesting,
    setCheckInRequesting,
  ] = useState(false);

  const [
    checkInError,
    setCheckInError,
  ] = useState('');

  const [
    checkInAnalysisError,
    setCheckInAnalysisError,
  ] = useState('');

  const [
    checkInScheduleOpen,
    setCheckInScheduleOpen,
  ] = useState(false);


  const loadSeniorDetail = useCallback(
    async (seniorId) => {
      if (!seniorId) {
        setRisk(null);

        setCare({
          ...EMPTY_CARE,
        });

        setCareLoading(false);
        setCheckInAnalysisLoading(false);
        setCheckInAnalysisError('');

        return;
      }

      /*
       * 기본 정보부터 먼저 불러온다.
       * Gemini 안부 분석은 이 요청들과 분리한다.
       */
      setCareLoading(true);
      setCheckInAnalysisLoading(true);
      setCheckInAnalysisError('');

      /*
       * 님을 변경했을 때 이전 님의
       * 분석 결과가 잠깐 남지 않도록 초기화한다.
       */
      setCare((current) => ({
        ...current,
        checkInAnalysis: null,
      }));

      try {
        const [
          riskResult,
          alertsResult,
          locationResult,
          zoneResult,
          checkInResult,
          eventResult,
        ] = await Promise.allSettled([
          getLatestRisk(seniorId),
          getGuardianAlerts(),
          getLatestLocation(seniorId),
          getSafetyZone(seniorId),
          getCheckIns(seniorId),
          getCareEvents(seniorId),
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
            String(
              getAlertSeniorId(alert),
            ) === String(seniorId)
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
        ].sort(
          (first, second) => (
            new Date(
              getTimestamp(second) ?? 0,
            ).getTime()
            - new Date(
              getTimestamp(first) ?? 0,
            ).getTime()
          ),
        );

        const fallEvents = (
          eventResult.status === 'fulfilled'
            ? normalizeArray(
              eventResult.value.data,
            )
            : []
        )
          .filter(
            (event) => (
              event.type === 'FALL_DETECTED'
            ),
          )
          .sort(
            (first, second) => (
              new Date(
                second.occurredAt ?? 0,
              ).getTime()
              - new Date(
                first.occurredAt ?? 0,
              ).getTime()
            ),
          );

        setRisk(
          riskResult.status === 'fulfilled'
            ? normalizeSingle(
              riskResult.value.data,
            )
            : null,
        );

        /*
         * 기본 정보는 Gemini 응답을 기다리지 않고
         * 여기서 먼저 화면에 표시한다.
         */
        setCare({
          alerts: seniorAlerts,

          fallEvents,

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
              ? normalizeArray(
                zoneResult.value.data,
              ).slice(0, 3)
              : []
          ),

          checkIn: (
            sortedCheckIns[0]
            ?? null
          ),

          checkInAnalysis: null,
        });
      } catch (detailError) {
        setError(
          detailError
            .response
            ?.data
            ?.message
          || '어르신 상세 정보를 불러오지 못했습니다.',
        );
      } finally {
        /*
         * 위치·안전구역·낙상·안부 기록 로딩은 여기서 종료한다.
         * Gemini 분석 로딩과는 별도이다.
         */
        setCareLoading(false);
      }

      /*
       * 기본 정보 표시 후 안부 분석만 별도로 요청한다.
       * FastAPI 캐시가 적중하면 Gemini는 다시 호출되지 않는다.
       */
      try {
        const analysisResponse = (
          await getCheckInAnalysis(
            seniorId,
          )
        );

        setCare((current) => ({
          ...current,

          checkInAnalysis: normalizeSingle(
            analysisResponse.data,
          ),
        }));
      } catch (analysisError) {
        setCheckInAnalysisError(
          analysisError
            .response
            ?.data
            ?.message
          || '안부 응답 분석 정보를 불러오지 못했습니다.',
        );
      } finally {
        setCheckInAnalysisLoading(false);
      }
    },
    [],
  );

  const handleRequestCheckIn = async () => {
    if (
      !selectedSeniorId
      || checkInRequesting
    ) {
      return;
    }

    setCheckInRequesting(true);
    setCheckInError('');

    try {
      const response = await requestCheckIn(
        selectedSeniorId,
      );

      setCare(
        (current) => ({
          ...current,
          checkIn: response.data,
        }),
      );

      /*
       * 안부 요청 생성 후 최근 기록과
       * 분석 통계를 다시 조회한다.
       */
      await loadSeniorDetail(
        selectedSeniorId,
      );
    } catch (requestError) {
      setCheckInError(
        requestError
          .response
          ?.data
          ?.message
        || '안부 확인을 요청하지 못했습니다.',
      );
    } finally {
      setCheckInRequesting(false);
    }
  };


  const handleConnectSenior = async (
    event,
  ) => {
    event.preventDefault();

    setConnecting(true);
    setConnectError('');

    try {
      const connectedSenior =
        await connectGuardianSenior(
          connectForm.name,
          connectForm.phone,
        );

      setSeniors(
        (current) => (
          current.some(
            (senior) => (
              String(senior.id)
              === String(
                connectedSenior.id,
              )
            ),
          )
            ? current
            : [
              ...current,
              connectedSenior,
            ]
        ),
      );

      setSelectedSeniorId(
        connectedSenior.id,
      );

      setSearchParams({
        seniorId:
          connectedSenior.id,
      });

      setConnectOpen(false);

      setConnectForm({
        name: '',
        phone: '',
      });

      setError('');
    } catch (connectRequestError) {
      setConnectError(
        connectRequestError.message
        || '님을 연결하지 못했습니다.',
      );
    } finally {
      setConnecting(false);
    }
  };


  /*
   * 로그인한 보호자와 연결된
   * 어르신 목록 조회
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSeniors() {
      setLoading(true);
      setError('');

      try {
        const response =
          await getSeniorsByGuardian();

        const seniorList =
          normalizeArray(
            response.data,
          );

        if (cancelled) {
          return;
        }

        setSeniors(seniorList);

        const requestedId =
          searchParams.get(
            'seniorId',
          );

        const requestedSenior =
          seniorList.find(
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

        setSelectedSeniorId(
          initialSeniorId,
        );

        if (initialSeniorId) {
          setSearchParams(
            {
              seniorId:
                String(
                  initialSeniorId,
                ),
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
            loadError
              .response
              ?.data
              ?.message
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


  useEffect(() => {
    loadSeniorDetail(
      selectedSeniorId,
    );
  }, [
    loadSeniorDetail,
    selectedSeniorId,
  ]);


  const selectedSenior = useMemo(
    () => (
      seniors.find(
        (senior) => (
          String(senior.id)
          === String(
            selectedSeniorId,
          )
        ),
      )
      ?? null
    ),
    [
      seniors,
      selectedSeniorId,
    ],
  );


  const riskView = getRiskView(
    risk?.level,
  );

  const checkInAnalysisView =
    getCheckInAnalysisView(
      care.checkInAnalysis
        ?.riskLevel,
    );

  const locationSummary =
    getLocationSummary(
      selectedSenior,
      care.location,
    );

  const checkInStatusSummary =
    getCheckInStatusSummary(
      care.checkIn,
      care.checkInAnalysis,
    );

  const productSafetySummary =
    getProductSafetySummary(
      risk,
    );

  const safetyZoneSummary =
    getSafetyZoneSummary(
      care.zone,
    );

  const heroRiskLabels =
    getHeroRiskLabels({
      risk,
      fallEvents: care.fallEvents,
      careLoading,
      checkIn: care.checkIn,
      checkInAnalysis:
        care.checkInAnalysis,
    });

  /*
   * 다른 어르신 선택
   */
  const handleSeniorChange = (
    seniorId,
  ) => {
    setSelectedSeniorId(
      seniorId,
    );

    setError('');

    setSearchParams({
      seniorId:
        String(seniorId),
    });
  };


  /*
   * 연결 해제 완료 후
   * 현재 화면의 목록만 갱신한다.
   */
  const handleSeniorDisconnected = (
    disconnectedSeniorId,
  ) => {
    const disconnectedIndex =
      seniors.findIndex(
        (senior) => (
          String(senior.id)
          === String(
            disconnectedSeniorId,
          )
        ),
      );

    const remainingSeniors =
      seniors.filter(
        (senior) => (
          String(senior.id)
          !== String(
            disconnectedSeniorId,
          )
        ),
      );

    setSeniors(
      remainingSeniors,
    );

    setRisk(null);

    setCare({
      ...EMPTY_CARE,
    });

    setError('');

    const nextSenior = (
      remainingSeniors[
      disconnectedIndex
      ]
      ?? remainingSeniors[
      disconnectedIndex - 1
      ]
      ?? remainingSeniors[0]
      ?? null
    );

    if (nextSenior) {
      setSelectedSeniorId(
        nextSenior.id,
      );

      setSearchParams(
        {
          seniorId:
            String(
              nextSenior.id,
            ),
        },
        {
          replace: true,
        },
      );

      return;
    }

    setSelectedSeniorId(null);
    setCareLoading(false);

    setSearchParams(
      {},
      {
        replace: true,
      },
    );
  };


  const checkInInsight = splitCheckInSummary(
    care.checkInAnalysis,
    care.checkIn,
  );


  return (
    <GuardianLayout
      activeMenu="seniors"
    >
      <main
        className="guardian-senior-page"
      >
        <section
          className="guardian-senior-page__heading"
        >
          <div>
            <h1>
              {selectedSenior?.name
                ? `${selectedSenior.name} 님 현황`
                : '어르신 현황'}
            </h1>
          </div>

          <div
            className="guardian-senior-page__selector"
            role="group"
            aria-label="어르신 선택 및 연결"
          >
            <button
              type="button"
              className="guardian-senior-page__connect"
              onClick={() => {
                setConnectError('');
                setConnectOpen(true);
              }}
            >
              <span aria-hidden="true">
                +
              </span>

              어르신 연결
            </button>

            {seniors.map(
              (senior) => (
                <button
                  type="button"
                  key={senior.id}
                  className={
                    String(
                      selectedSeniorId,
                    )
                      === String(
                        senior.id,
                      )
                      ? 'active'
                      : ''
                  }
                  onClick={() => (
                    handleSeniorChange(
                      senior.id,
                    )
                  )}
                >
                  {senior.name}
                </button>
              ),
            )}
          </div>
        </section>


        {connectOpen && (
          <div
            className="guardian-connect-overlay"
            onMouseDown={
              (event) => {
                if (
                  event.target
                  === event.currentTarget
                ) {
                  setConnectOpen(false);
                }
              }
            }
          >
            <form
              className="guardian-connect-modal"
              onSubmit={
                handleConnectSenior
              }
            >
              <header>
                <div>
                  <span>
                    보호자 연결 관리
                  </span>

                  <h2>
                    어르신 연결
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => (
                    setConnectOpen(false)
                  )}
                >
                  ×
                </button>
              </header>

              <p>
                어르신 계정에 등록된 이름과
                전화번호를 입력해 주세요.
              </p>

              <label>
                어르신 이름

                <input
                  required
                  autoFocus
                  value={
                    connectForm.name
                  }
                  onChange={
                    (event) => (
                      setConnectForm({
                        ...connectForm,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="예: 최숙희"
                />
              </label>

              <label>
                전화번호

                <input
                  required
                  inputMode="tel"
                  value={
                    connectForm.phone
                  }
                  onChange={
                    (event) => (
                      setConnectForm({
                        ...connectForm,
                        phone:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="예: 010-5000-0001"
                />
              </label>

              {connectError && (
                <div
                  className="guardian-connect-modal__error"
                >
                  {connectError}
                </div>
              )}

              <footer>
                <button
                  type="button"
                  onClick={() => (
                    setConnectOpen(false)
                  )}
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={connecting}
                >
                  {connecting
                    ? '연결 중...'
                    : '연결하기'}
                </button>
              </footer>
            </form>
          </div>
        )}

        <CheckInScheduleModal
          open={checkInScheduleOpen}
          seniorId={selectedSeniorId}
          seniorName={
            selectedSenior?.name
          }
          onClose={() => {
            setCheckInScheduleOpen(false);
          }}
        />

        {fallDetailOpen
          && selectedSenior
          && (
            <div
              className="guardian-fall-modal"
              role="presentation"
              onMouseDown={
                (event) => {
                  if (
                    event.target
                    === event.currentTarget
                  ) {
                    setFallDetailOpen(
                      false,
                    );
                  }
                }
              }
            >
              <div
                className="guardian-fall-modal__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="fall-summary-title"
              >
                <div
                  className="guardian-fall-modal__heading"
                >
                  <div>
                    <h3
                      id="fall-summary-title"
                    >
                      낙상 상태
                    </h3>

                    <p>
                      {selectedSenior.name}
                      {' '}
                      님의 최근 낙상 감지
                      정보입니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="닫기"
                    onClick={() => (
                      setFallDetailOpen(
                        false,
                      )
                    )}
                  >
                    ×
                  </button>
                </div>

                {careLoading ? (
                  <div
                    className="guardian-fall-modal__empty"
                  >
                    낙상 기록을 불러오는
                    중입니다.
                  </div>
                ) : !care.fallEvents[0] ? (
                  <div
                    className="guardian-fall-modal__empty"
                  >
                    최근 감지된 낙상이
                    없습니다.
                  </div>
                ) : (
                  <dl
                    className="guardian-fall-modal__details"
                  >
                    <div>
                      <dt>
                        현재 상태
                      </dt>

                      <dd>
                        {getFallStatusText(
                          care.fallEvents,
                          false,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        감지 시간
                      </dt>

                      <dd>
                        {formatFallOccurredAt(
                          care.fallEvents[0]
                            .occurredAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        감지 점수
                      </dt>

                      <dd>
                        {care.fallEvents[0]
                          .detectionScore
                          ?? '정보 없음'}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        전체 기록
                      </dt>

                      <dd>
                        {care.fallEvents.length}
                        건
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          )}


        {summaryDetail
          && selectedSenior
          && (
            <div
              className="guardian-fall-modal"
              role="presentation"
              onMouseDown={
                (event) => {
                  if (
                    event.target
                    === event.currentTarget
                  ) {
                    setSummaryDetail(null);
                  }
                }
              }
            >
              <div
                className="guardian-fall-modal__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="senior-summary-detail-title"
              >
                <div
                  className="guardian-fall-modal__heading"
                >
                  <div>
                    <h3
                      id="senior-summary-detail-title"
                    >
                      {summaryDetail
                        === 'health'
                        && '건강 주의'}

                      {summaryDetail
                        === 'care'
                        && '돌봄·지원'}

                      {summaryDetail
                        === 'welfare'
                        && '맞춤 복지'}
                    </h3>

                    <p>
                      {selectedSenior.name}
                      {' '}
                      님의 등록 정보입니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="닫기"
                    onClick={() => (
                      setSummaryDetail(null)
                    )}
                  >
                    ×
                  </button>
                </div>

                {summaryDetail
                  === 'health'
                  && (
                    <dl
                      className="guardian-fall-modal__details"
                    >
                      <div>
                        <dt>
                          건강 주의 상태
                        </dt>

                        <dd>
                          {getHealthCautionText(
                            selectedSenior,
                            risk,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          중증질환 가구원
                        </dt>

                        <dd>
                          {selectedSenior
                            .severeDiseaseHouseholdMember
                            ? '해당'
                            : '해당 없음'}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          희귀·난치질환 가구원
                        </dt>

                        <dd>
                          {(
                            selectedSenior
                              .rareDiseaseHouseholdMember
                            || selectedSenior
                              .intractableDiseaseHouseholdMember
                          )
                            ? '해당'
                            : '해당 없음'}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          장애 등급
                        </dt>

                        <dd>
                          {selectedSenior
                            .disabilityGrade
                            || '등록 정보 없음'}
                        </dd>
                      </div>
                    </dl>
                  )}

                {summaryDetail
                  === 'care'
                  && (
                    <dl
                      className="guardian-fall-modal__details"
                    >
                      <div>
                        <dt>
                          장기요양 대상 여부
                        </dt>

                        <dd>
                          {getLongTermCareText(
                            selectedSenior
                              .longTermCare,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          장기요양 등급
                        </dt>

                        <dd>
                          {selectedSenior
                            .longTermCareGrade
                            || '등록 정보 없음'}
                        </dd>
                      </div>
                    </dl>
                  )}

                {summaryDetail
                  === 'welfare'
                  && (
                    <dl
                      className="guardian-fall-modal__details"
                    >
                      <div>
                        <dt>
                          에너지바우처
                        </dt>

                        <dd>
                          {selectedSenior
                            .energyVoucherApplied
                            ? '신청 완료'
                            : selectedSenior
                              .energyVoucherEligible
                              ? '신청 가능'
                              : '확인 필요'}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          전기요금 할인
                        </dt>

                        <dd>
                          {selectedSenior
                            .electricityDiscountApplied
                            ? '신청 완료'
                            : selectedSenior
                              .electricityDiscountEligible
                              ? '신청 가능'
                              : '확인 필요'}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          가스요금 할인
                        </dt>

                        <dd>
                          {selectedSenior
                            .gasDiscountApplied
                            ? '신청 완료'
                            : selectedSenior
                              .gasDiscountEligible
                              ? '신청 가능'
                              : '확인 필요'}
                        </dd>
                      </div>
                    </dl>
                  )}
              </div>
            </div>
          )}


        {error && (
          <div
            className="guardian-senior-page__error"
          >
            {error}
          </div>
        )}


        {loading ? (
          <div
            className="guardian-senior-page__state"
          >
            담당 어르신 정보를
            불러오는 중입니다.
          </div>
        ) : !selectedSenior ? (
          <div
            className="guardian-senior-page__state"
          >
            연결된 담당 님이
            없습니다.
          </div>
        ) : (
          <>
            <section
              className={[
                'guardian-senior-hero',
                `guardian-senior-hero--${riskView.tone}`,
              ].join(' ')}
            >
              <div
                className="guardian-senior-hero__top"
              >
                <div
                  className="guardian-senior-hero__identity"
                >
                  <div
                    className="guardian-senior-hero__title"
                  >
                    <h2>
                      {selectedSenior.name}

                      {selectedSenior.age
                        ? ` (${selectedSenior.age}세)`
                        : ''}
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

                  {heroRiskLabels.length > 0 ? (
                    <p className="guardian-senior-hero__risk-text">
                      {heroRiskLabels.join(' · ')}
                    </p>
                  ) : (
                    <p
                      className="guardian-senior-hero__safe-message"
                    >
                      현재 확인된 긴급 위험 항목이 없습니다.
                    </p>
                  )}
                </div>

                <div
                  className="guardian-senior-hero__actions"
                >
                  <DisconnectSeniorButton
                    senior={
                      selectedSenior
                    }
                    onDisconnected={
                      handleSeniorDisconnected
                    }
                  />
                </div>
              </div>

              <div
                className="guardian-senior-hero__information"
              >
                <div
                  className="guardian-senior-hero__summary-item"
                >
                  <span>
                    최근 위치
                  </span>

                  <strong>
                    {locationSummary.primary}
                  </strong>

                  <small>
                    {locationSummary.secondary}
                  </small>
                </div>

                <div
                  className={[
                    'guardian-senior-hero__summary-item',
                    checkInStatusSummary.dangerous
                      ? 'guardian-senior-hero__summary-item--danger'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span>
                    안부 상태
                  </span>

                  <strong>
                    {checkInStatusSummary.primary}
                  </strong>

                  <small>
                    {checkInStatusSummary.secondary}
                  </small>
                </div>

                <div
                  className={[
                    'guardian-senior-hero__summary-item',
                    productSafetySummary.dangerous
                      ? 'guardian-senior-hero__summary-item--danger'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span>
                    제품 안전
                  </span>

                  <strong>
                    {productSafetySummary.primary}
                  </strong>

                  <small>
                    {productSafetySummary.secondary}
                  </small>
                </div>

                <div
                  className="guardian-senior-hero__summary-item"
                >
                  <span>
                    안전구역
                  </span>

                  <strong>
                    {safetyZoneSummary.primary}
                  </strong>

                  <small>
                    {safetyZoneSummary.secondary}
                  </small>
                </div>
              </div>
            </section>

            <AiDecisionNotice
              className="guardian-senior-page__ai-notice"
            />

            <section
              className={[
                'guardian-ai-checkin',
                `guardian-ai-checkin--${checkInAnalysisView.tone}`,
              ].join(' ')}
              aria-labelledby="guardian-ai-checkin-title"
            >
              <div className="guardian-ai-checkin__main">
                <div className="guardian-ai-checkin__header-row">
                  <div className="guardian-ai-checkin__content">
                    <div className="guardian-ai-checkin__title">
                      <h2 id="guardian-ai-checkin-title">
                        {getCheckInText(
                          care.checkIn,
                        )}
                      </h2>

                      {!checkInAnalysisLoading
                        && care.checkInAnalysis
                        && (
                          <strong
                            className={[
                              'guardian-ai-checkin__status',
                              `guardian-ai-checkin__status--${checkInAnalysisView.tone}`,
                            ].join(' ')}
                          >
                            {care.checkInAnalysis.riskLabel
                              ?? checkInAnalysisView.label}
                          </strong>
                        )}
                    </div>

                    {checkInError && (
                      <small className="guardian-ai-checkin__error">
                        {checkInError}
                      </small>
                    )}
                  </div>

                  <div className="guardian-ai-checkin__action">
                    {care.checkIn && (
                      <time className="guardian-ai-checkin__requested-at">
                        {formatDateTime(
                          getTimestamp(
                            care.checkIn,
                          ),
                        )}
                      </time>
                    )}

                    <button
                      type="button"
                      className={[
                        'guardian-ai-checkin__request-button',
                        'guardian-ai-checkin__request-button--secondary',
                      ].join(' ')}
                      disabled={!selectedSeniorId}
                      onClick={() => {
                        setCheckInScheduleOpen(true);
                      }}
                    >
                      자동 설정
                    </button>

                    <button
                      type="button"
                      className="guardian-ai-checkin__request-button"
                      onClick={handleRequestCheckIn}
                      disabled={
                        checkInRequesting
                        || String(
                          care.checkIn?.status ?? '',
                        ).toUpperCase() === 'PENDING'
                      }
                    >
                      {checkInRequesting
                        ? '요청 중...'
                        : String(
                          care.checkIn?.status ?? '',
                        ).toUpperCase() === 'PENDING'
                          ? '응답 대기 중'
                          : '안부 요청'}
                    </button>
                  </div>
                </div>

                <div
                  className={[
                    'guardian-ai-checkin__insight-card',
                    `guardian-ai-checkin__insight-card--${checkInAnalysisView.tone}`,
                  ].join(' ')}
                >
                  {checkInAnalysisLoading ? (
                    <div className="guardian-ai-checkin__insight-state">
                      최근 안부 기록을 분석하고 있습니다.
                    </div>
                  ) : checkInAnalysisError ? (
                    <div className="guardian-ai-checkin__analysis-unavailable">
                      <div>
                        <strong>
                          안부 분석 정보를 불러오지 못했습니다.
                        </strong>

                        <p>
                          최근 안부 기록은 정상적으로 저장되어 있습니다.
                          잠시 후 다시 확인해 주세요.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          loadSeniorDetail(
                            selectedSeniorId,
                          );
                        }}
                        disabled={
                          checkInAnalysisLoading
                          || !selectedSeniorId
                        }
                      >
                        다시 불러오기
                      </button>
                    </div>
                  ) : (
                    <div className="guardian-ai-checkin__analysis-row">
                      <strong>
                        안부 분석
                      </strong>

                      <p className="guardian-ai-checkin__insight-summary">
                        {checkInInsight.summary}

                        {checkInInsight.action && (
                          <>
                            {' '}
                            {checkInInsight.action}
                          </>
                        )}
                      </p>

                      {care.checkInAnalysis?.summarySource && (
                        <small className="guardian-ai-checkin__source">
                          {String(
                            care.checkInAnalysis.summarySource,
                          ).toUpperCase() === 'GEMINI'
                            ? 'AI 생성 안내'
                            : '기본 안내'}
                        </small>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!checkInAnalysisLoading && (
                <div className="guardian-ai-checkin__summary">
                  {checkInAnalysisError ? (
                    <div className="guardian-ai-checkin__summary-unavailable">
                      최근 7일 분석 결과를 표시할 수 없습니다.
                    </div>
                  ) : !care.checkInAnalysis ? (
                    <div className="guardian-ai-checkin__summary-unavailable">
                      분석할 수 있는 안부 기록이 아직 부족합니다.
                    </div>
                  ) : (
                    <>
                      <div className="guardian-ai-checkin__summary-heading">
                        <h3>
                          최근 7일 기록
                        </h3>

                        <small>
                          총
                          {' '}
                          {care.checkInAnalysis.closedRequestCount ?? 0}
                          건 분석
                        </small>
                      </div>

                      <dl className="guardian-ai-checkin__metrics">
                        <div>
                          <dt>
                            전체 요청
                          </dt>

                          <dd>
                            {care.checkInAnalysis.requestCount ?? 0}
                            회
                          </dd>
                        </div>

                        <div>
                          <dt>
                            응답 완료
                          </dt>

                          <dd>
                            {care.checkInAnalysis.respondedCount ?? 0}
                            회
                          </dd>
                        </div>

                        <div>
                          <dt>
                            응답률
                          </dt>

                          <dd>
                            {formatPercent(
                              care.checkInAnalysis.responseRate,
                            )}
                          </dd>

                          <small>
                            {Number(
                              care.checkInAnalysis.responseRate,
                            ) < 80
                              ? '기준인 80% 미달'
                              : '기준인 80% 이상'}
                          </small>
                        </div>

                        <div>
                          <dt>
                            누적 미응답
                          </dt>

                          <dd>
                            {care.checkInAnalysis.missedCount ?? 0}
                            회
                          </dd>

                          <small>
                            {Array.isArray(
                              care.checkInAnalysis.missedRecords,
                            )
                              && care.checkInAnalysis.missedRecords.length > 0
                              ? (
                                `최근 미응답: ${formatCheckInDateTime(
                                  care.checkInAnalysis
                                    .missedRecords[0]
                                    .requestedAt,
                                )} 요청`
                              )
                              : '미응답 기록 없음'}
                          </small>
                        </div>
                      </dl>
                    </>
                  )}
                </div>
              )}
            </section>


            <div id="location-map">
              <KakaoSafetyMap
                senior={
                  selectedSenior
                }
                location={
                  care.location
                }
                zones={
                  care.zones
                }
                hasLocationRisk={
                  Boolean(
                    risk?.locationAnomaly
                    || risk?.safetyZoneRisk,
                  )
                }
                loading={
                  careLoading
                }
                onRefreshLocation={() => (
                  loadSeniorDetail(
                    selectedSeniorId,
                  )
                )}
              />
            </div>
          </>
        )}
      </main>
    </GuardianLayout>
  );
}
