import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  getGuardianAlerts,
  getLatestLocation,
  getLatestRisk,
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import {
  askGuardianRag,
  getGuardianRecallProducts,
} from '../../api/guardianHomeApi.js';

import {
  getUser,
} from '../../utils/auth.js';

import GuardianLayout from './GuardianLayout.jsx';

import '../../css/guardian/Home.css';


const UNREAD_STATUSES = [
  'NEW',
  'UNREAD',
  'OPEN',
  'PENDING',
  'IN_PROGRESS',
];


const COMPLETED_ACTION_STATUSES = [
  'COMPLETED',
  'RESOLVED',
  'DONE',
  'CLOSED',
  'ACTION_COMPLETED',
  'REPLACED',
  'RETURNED',
  'DISPOSED',
];


const RECOMMENDED_QUESTIONS = [
  '에너지바우처 신청 조건은 무엇인가요?',
  '리콜 제품을 사용 중이면 어떻게 해야 하나요?',
  '도시가스요금 경감 신청에 필요한 서류는 무엇인가요?',
  '폭염특보가 발생하면 어르신에게 어떤 조치를 해야 하나요?',
];


const RECALL_CATEGORY_ORDER = [
  '전기·난방제품',
  '배터리·충전기',
  '주방·생활용품',
  '의료·건강용품',
  '기타 제품',
];


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

  if (Array.isArray(value?.data?.content)) {
    return value.data.content;
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

  if (
    value?.data
    && typeof value.data === 'object'
    && !Array.isArray(value.data)
  ) {
    return value.data;
  }

  return value;
}


function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
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
    ?? item?.assessedAt
    ?? item?.timestamp
    ?? item?.createdAt
    ?? item?.updatedAt
    ?? null
  );
}


function formatDateTime(value) {
  if (!value) {
    return '시간 정보 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  const today = new Date();

  const sameDate = (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );

  if (sameDate) {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}


function getAlertSeniorId(alert) {
  return (
    alert?.seniorId
    ?? alert?.senior?.id
    ?? alert?.targetSeniorId
    ?? null
  );
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


function getAlertType(alert) {
  return normalizeText(
    alert?.type
    ?? alert?.alertType
    ?? alert?.category,
  );
}


function isUnreadAlert(alert) {
  return UNREAD_STATUSES.includes(
    normalizeText(alert?.status),
  );
}


function isRecallAlert(alert) {
  const type = getAlertType(alert);

  const text = normalizeText([
    getAlertTitle(alert),
    getAlertMessage(alert),
  ].join(' '));

  return (
    type.includes('RECALL')
    || type.includes('PRODUCT')
    || text.includes('리콜')
  );
}


function getPriorityTypeLabel(type) {
  const normalizedType = normalizeText(type);

  if (
    normalizedType.includes('CHECK')
    || normalizedType.includes('AI')
  ) {
    return '안부';
  }

  if (normalizedType.includes('LOCATION')) {
    return '위치';
  }

  if (
    normalizedType.includes('GEOFENCE')
    || normalizedType.includes('ZONE')
  ) {
    return '안전구역';
  }

  if (
    normalizedType.includes('RECALL')
    || normalizedType.includes('PRODUCT')
  ) {
    return '리콜';
  }

  if (normalizedType.includes('WEATHER')) {
    return '기상';
  }

  if (
    normalizedType.includes('ELECTRIC')
    || normalizedType.includes('GAS')
    || normalizedType.includes('SAFETY')
  ) {
    return '생활안전';
  }

  return '상태';
}


function hasNoLocationData(location) {
  if (!location) {
    return true;
  }

  return !getTimestamp(location);
}


function getRiskActionItems(risk) {
  if (!risk) {
    return [];
  }

  const items = [];

  if (
    risk.aiNoResponse === true
    || risk.checkInRisk === true
  ) {
    items.push({
      type: '안부',
      title: '최근 안부 응답이 확인되지 않았습니다.',
    });
  }

  if (risk.locationAnomaly === true) {
    items.push({
      type: '위치',
      title: '최근 위치 정보에 이상이 감지되었습니다.',
    });
  }

  if (risk.safetyZoneRisk === true) {
    items.push({
      type: '안전구역',
      title: '안전구역 이탈 여부를 확인해 주세요.',
    });
  }

  if (risk.weatherRisk === true) {
    items.push({
      type: '기상',
      title: '심각한 기상 위험이 발생했습니다.',
    });
  }

  if (risk.recallRisk === true) {
    items.push({
      type: '리콜',
      title: '사용 중인 미조치 리콜 제품이 있습니다.',
    });
  } else if (risk.recallUsageUnknown === true) {
    items.push({
      type: '리콜',
      title: '리콜 제품의 실제 사용 여부를 확인해 주세요.',
    });
  }

  if (risk.safetyRisk === true) {
    items.push({
      type: '생활안전',
      title: '전기·가스 안전 상태를 확인해 주세요.',
    });
  }

  if (risk.safetyInspectionOverdue === true) {
    items.push({
      type: '생활안전',
      title: '예정된 전기·가스 안전점검이 완료되지 않았습니다.',
    });
  }

  if (
    risk.overdueAction === true
    || risk.delayedVisit === true
  ) {
    items.push({
      type: '조치',
      title: risk.delayedVisit === true
        ? '예정된 방문 또는 확인 일정이 지연되었습니다.'
        : '예정된 후속 조치가 완료되지 않았습니다.',
    });
  }

  if (risk.repeatedIssue === true) {
    items.push({
      type: '조치',
      title: '동일한 미처리 문제가 반복되고 있습니다.',
    });
  }

  return items;
}


function getProductSeniorId(product) {
  return (
    product?.seniorId
    ?? product?.senior?.id
    ?? product?.ownerSeniorId
    ?? null
  );
}


function getProductName(product) {
  return (
    product?.productName
    ?? product?.name
    ?? product?.itemName
    ?? product?.product?.name
    ?? '제품명 미확인'
  );
}


function getProductModel(product) {
  return (
    product?.modelName
    ?? product?.modelNumber
    ?? product?.model
    ?? product?.productModel
    ?? ''
  );
}


function getRecallStatus(product) {
  return normalizeText(
    product?.recallStatus
    ?? product?.productRecallStatus
    ?? product?.recall?.status
    ?? product?.status,
  );
}


function getActionStatus(product) {
  return normalizeText(
    product?.actionStatus
    ?? product?.recallActionStatus
    ?? product?.handlingStatus
    ?? product?.resolutionStatus,
  );
}


function getCurrentUseStatus(product) {
  return normalizeText(
    product?.currentUseStatus
    ?? product?.useStatus
    ?? product?.usageStatus,
  );
}


function isRecalledProduct(product) {
  const recallStatus = getRecallStatus(product);

  return (
    recallStatus === 'RECALLED'
    || recallStatus === 'RECALL'
    || recallStatus === 'TARGET'
    || recallStatus === 'MATCHED'
    || recallStatus.includes('RECALL')
  );
}


function isRecallActionCompleted(product) {
  return COMPLETED_ACTION_STATUSES.includes(
    getActionStatus(product),
  );
}


function isRecallPending(product) {
  return (
    isRecalledProduct(product)
    && !isRecallActionCompleted(product)
  );
}


function getRecallCategoryFromText(value) {
  const text = normalizeText(value);

  if (
    text.includes('전기요')
    || text.includes('전기매트')
    || text.includes('전기장판')
    || text.includes('히터')
    || text.includes('난로')
    || text.includes('온풍기')
    || text.includes('HEATER')
    || text.includes('HEATING')
  ) {
    return '전기·난방제품';
  }

  if (
    text.includes('배터리')
    || text.includes('보조배터리')
    || text.includes('충전기')
    || text.includes('어댑터')
    || text.includes('BATTERY')
    || text.includes('CHARGER')
    || text.includes('ADAPTER')
  ) {
    return '배터리·충전기';
  }

  if (
    text.includes('밥솥')
    || text.includes('전기포트')
    || text.includes('주전자')
    || text.includes('프라이팬')
    || text.includes('조리')
    || text.includes('주방')
    || text.includes('KITCHEN')
    || text.includes('COOKER')
  ) {
    return '주방·생활용품';
  }

  if (
    text.includes('의료')
    || text.includes('혈압')
    || text.includes('안마')
    || text.includes('건강')
    || text.includes('보행기')
    || text.includes('MEDICAL')
    || text.includes('HEALTH')
  ) {
    return '의료·건강용품';
  }

  return '기타 제품';
}


function getRecallCategory(product) {
  const explicitCategory = (
    product?.productCategory
    ?? product?.category
    ?? product?.itemCategory
    ?? product?.productType
    ?? ''
  );

  return getRecallCategoryFromText([
    explicitCategory,
    getProductName(product),
    getProductModel(product),
  ].join(' '));
}


function getSeniorNameByProduct(product, seniors) {
  const seniorId = getProductSeniorId(product);

  const senior = seniors.find((item) => (
    String(item.id) === String(seniorId)
  ));

  return (
    senior?.name
    ?? product?.seniorName
    ?? product?.senior?.name
    ?? '담당 어르신'
  );
}


function getProductStatusLabel(product) {
  if (isRecallActionCompleted(product)) {
    return '조치 완료';
  }

  const useStatus = getCurrentUseStatus(product);

  if (useStatus === 'IN_USE') {
    return '사용 중';
  }

  if (
    !useStatus
    || useStatus === 'UNKNOWN'
    || useStatus === 'UNCONFIRMED'
  ) {
    return '사용 여부 미확인';
  }

  return '확인 필요';
}


function createAlertKey(alert, index) {
  return (
    alert?.id
    ?? alert?.alertId
    ?? [
      getAlertSeniorId(alert) ?? 'unknown',
      getTimestamp(alert) ?? 'unknown',
      index,
    ].join('-')
  );
}


function getPriorityAction(item) {
  if (
    item.type === '리콜'
    || item.type === '생활안전'
  ) {
    return {
      label: item.type === '리콜'
        ? '제품 확인'
        : '안전 확인',

      path: item.seniorId
        ? `/guardian/safety?seniorId=${item.seniorId}`
        : '/guardian/safety',
    };
  }

  return {
    label: '현황 보기',

    path: item.seniorId
      ? `/guardian/seniors?seniorId=${item.seniorId}`
      : '/guardian/seniors',
  };
}


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


export default function GuardianHome() {
  const navigate = useNavigate();
  const currentUser = getUser();

  const [seniors, setSeniors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [seniorStates, setSeniorStates] = useState({});
  const [registeredProducts, setRegisteredProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recallLoadError, setRecallLoadError] = useState('');

  const [recallModalOpen, setRecallModalOpen] = useState(false);

  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragSources, setRagSources] = useState([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState('');


  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError('');
      setRecallLoadError('');

      try {
        const [
          seniorResult,
          alertResult,
        ] = await Promise.allSettled([
          getSeniorsByGuardian(),
          getGuardianAlerts(),
        ]);

        if (seniorResult.status === 'rejected') {
          throw seniorResult.reason;
        }

        const seniorList = normalizeArray(
          seniorResult.value.data,
        );

        const alertList = (
          alertResult.status === 'fulfilled'
            ? normalizeArray(alertResult.value.data)
            : []
        );

        if (cancelled) {
          return;
        }

        setSeniors(seniorList);
        setAlerts(alertList);

        const stateResults = await Promise.all(
          seniorList.map(async (senior) => {
            const [
              riskResult,
              locationResult,
            ] = await Promise.allSettled([
              getLatestRisk(senior.id),
              getLatestLocation(senior.id),
            ]);

            return {
              seniorId: senior.id,

              risk: riskResult.status === 'fulfilled'
                ? normalizeSingle(riskResult.value.data)
                : null,

              location: locationResult.status === 'fulfilled'
                ? normalizeSingle(locationResult.value.data)
                : null,
            };
          }),
        );

        if (cancelled) {
          return;
        }

        const nextStateMap = {};

        stateResults.forEach((item) => {
          nextStateMap[String(item.seniorId)] = item;
        });

        setSeniorStates(nextStateMap);

        try {
          const products = await getGuardianRecallProducts(
            seniorList.map((senior) => senior.id),
          );

          if (!cancelled) {
            setRegisteredProducts(products);
          }
        } catch (productError) {
          if (!cancelled) {
            setRegisteredProducts([]);

            setRecallLoadError(
              productError.message
              || '등록 제품 정보를 불러오지 못했습니다.',
            );
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.response?.data?.message
            || loadError.message
            || '홈 정보를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    if (!recallModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setRecallModalOpen(false);
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [recallModalOpen]);


  const unreadAlerts = useMemo(() => (
    alerts.filter(isUnreadAlert)
  ), [alerts]);


  const seniorSummaries = useMemo(() => (
    seniors.map((senior) => {
      const state = (
        seniorStates[String(senior.id)]
        ?? {
          risk: null,
          location: null,
        }
      );

      const assessedRiskActionItems = getRiskActionItems(
        state.risk,
      );

      const locationDataMissing = hasNoLocationData(
        state.location,
      );

      const riskActionItems = locationDataMissing
        ? [
            ...assessedRiskActionItems.filter((item) => (
              item.type !== '위치'
              && item.type !== '안전구역'
            )),
            {
              type: '위치',
              title: '위치 정보가 수신되지 않았습니다.',
              description: '기기의 위치 권한과 연동 상태를 확인해주세요.',
            },
          ]
        : assessedRiskActionItems;

      const seniorUnreadAlerts = unreadAlerts.filter(
        (alert) => (
          String(getAlertSeniorId(alert))
          === String(senior.id)
        ),
      );

      return {
        senior,
        state,
        riskActionItems,
        seniorUnreadAlerts,

        needsAttention: (
          riskActionItems.length > 0
          || seniorUnreadAlerts.length > 0
        ),
      };
    })
  ), [
    seniors,
    seniorStates,
    unreadAlerts,
  ]);


  const attentionSeniorCount = useMemo(() => (
    seniorSummaries.filter((item) => (
      item.needsAttention
    )).length
  ), [seniorSummaries]);


  const locationSetupNeededCount = useMemo(() => (
    seniorSummaries.filter((item) => (
      hasNoLocationData(item.state.location)
    )).length
  ), [seniorSummaries]);


  const recalledProducts = useMemo(() => (
    registeredProducts.filter(isRecalledProduct)
  ), [registeredProducts]);


  const pendingRecallProducts = useMemo(() => (
    recalledProducts.filter(isRecallPending)
  ), [recalledProducts]);


  const completedRecallProducts = useMemo(() => (
    recalledProducts.filter(isRecallActionCompleted)
  ), [recalledProducts]);


  const unknownUseRecallProducts = useMemo(() => (
    pendingRecallProducts.filter((product) => {
      const status = getCurrentUseStatus(product);

      return (
        !status
        || status === 'UNKNOWN'
        || status === 'UNCONFIRMED'
      );
    })
  ), [pendingRecallProducts]);


  const inUseRecallProducts = useMemo(() => (
    pendingRecallProducts.filter((product) => (
      getCurrentUseStatus(product) === 'IN_USE'
    ))
  ), [pendingRecallProducts]);


  const recallRiskSeniorCount = useMemo(() => (
    seniorSummaries.filter((item) => (
      item.state.risk?.recallRisk === true
      || item.state.risk?.recallUsageUnknown === true
    )).length
  ), [seniorSummaries]);


  const recallPendingCount = (
    registeredProducts.length > 0
      ? pendingRecallProducts.length
      : recallRiskSeniorCount
  );


  const lifeSafetySeniorCount = useMemo(() => (
    seniorSummaries.filter((item) => (
      item.state.risk?.safetyRisk === true
      || item.state.risk?.safetyInspectionOverdue === true
    )).length
  ), [seniorSummaries]);


  const recallChartData = useMemo(() => {
    const categoryCounts = new Map(
      RECALL_CATEGORY_ORDER.map((category) => (
        [category, 0]
      )),
    );

    let collectedCount = 0;

    recalledProducts.forEach((product) => {
      const category = getRecallCategory(product);

      categoryCounts.set(
        category,
        (categoryCounts.get(category) ?? 0) + 1,
      );

      collectedCount += 1;
    });

    if (collectedCount === 0) {
      alerts
        .filter(isRecallAlert)
        .forEach((alert) => {
          const category = getRecallCategoryFromText([
            getAlertTitle(alert),
            getAlertMessage(alert),
          ].join(' '));

          categoryCounts.set(
            category,
            (categoryCounts.get(category) ?? 0) + 1,
          );

          collectedCount += 1;
        });
    }

    return RECALL_CATEGORY_ORDER.map((category) => ({
      category,
      count: categoryCounts.get(category) ?? 0,
    }));
  }, [
    alerts,
    recalledProducts,
  ]);


  const totalRecallCategoryCount = useMemo(() => (
    recallChartData.reduce(
      (total, item) => total + item.count,
      0,
    )
  ), [recallChartData]);


  const hasRecallCategoryData = (
    totalRecallCategoryCount > 0
  );


  const maxRecallCategoryCount = useMemo(() => (
    Math.max(
      ...recallChartData.map((item) => item.count),
      1,
    )
  ), [recallChartData]);


  const priorityItems = useMemo(() => {
    const alertItems = unreadAlerts.map(
      (alert, index) => {
        const seniorId = getAlertSeniorId(alert);

        const senior = seniors.find((item) => (
          String(item.id) === String(seniorId)
        ));

        return {
          id: `alert-${createAlertKey(alert, index)}`,
          seniorId,

          seniorName: (
            senior?.name
            ?? alert?.seniorName
            ?? alert?.senior?.name
            ?? '담당 어르신'
          ),

          type: getPriorityTypeLabel(
            getAlertType(alert),
          ),

          title: getAlertTitle(alert),
          description: getAlertMessage(alert),
          time: getTimestamp(alert),
        };
      },
    );

    const riskItems = [];

    seniorSummaries.forEach((summary) => {
      summary.riskActionItems.forEach(
        (riskItem, index) => {
          riskItems.push({
            id: [
              'risk',
              summary.senior.id,
              riskItem.type,
              index,
            ].join('-'),

            seniorId: summary.senior.id,
            seniorName: summary.senior.name,
            type: riskItem.type,
            title: riskItem.title,
            description: riskItem.description ?? '',
            time: summary.state.risk?.assessedAt,
          });
        },
      );
    });

    const uniqueMap = new Map();

    [
      ...alertItems,
      ...riskItems,
    ].forEach((item) => {
      const key = [
        item.seniorId,
        item.type,
        item.title,
      ].join('-');

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return [...uniqueMap.values()]
      .sort((first, second) => (
        new Date(second.time ?? 0).getTime()
        - new Date(first.time ?? 0).getTime()
      ))
      .slice(0, 5);
  }, [
    seniors,
    seniorSummaries,
    unreadAlerts,
  ]);


  const runRagQuestion = async (question) => {
    const trimmedQuestion = String(
      question ?? '',
    ).trim();

    if (!trimmedQuestion || ragLoading) {
      return;
    }

    setRagQuestion(trimmedQuestion);
    setRagLoading(true);
    setRagError('');
    setRagAnswer('');
    setRagSources([]);

    try {
      const result = await askGuardianRag(
        trimmedQuestion,
      );

      setRagAnswer(result.answer);
      setRagSources(result.sources);
    } catch (requestError) {
      setRagError(
        requestError.message
        || '답변을 불러오지 못했습니다.',
      );
    } finally {
      setRagLoading(false);
    }
  };


  const handleRagSubmit = (event) => {
    event.preventDefault();

    runRagQuestion(ragQuestion);
  };


  const handlePriorityAction = (item) => {
    const action = getPriorityAction(item);

    navigate(action.path);
  };


  const handleProductClick = (product) => {
    const seniorId = getProductSeniorId(product);

    setRecallModalOpen(false);

    navigate(
      seniorId
        ? `/guardian/safety?seniorId=${seniorId}`
        : '/guardian/safety',
    );
  };


  const handleSafetyPageClick = () => {
    setRecallModalOpen(false);

    navigate('/guardian/safety');
  };


  const renderRecallChart = (variant = 'home') => (
    <div
      className={[
        'guardian-recall-chart',
        `guardian-recall-chart--${variant}`,
      ].join(' ')}
    >
      <div className="guardian-recall-chart__title">
        <div>
          <strong>
            리콜 제품 종류
          </strong>
        </div>

        <span>
          총 {totalRecallCategoryCount}건
        </span>
      </div>

      <div
        className="guardian-recall-chart__list"
        role="img"
        aria-label={`제품 종류별 리콜 건수, 총 ${totalRecallCategoryCount}건`}
      >
        {recallChartData.map((item) => {
          const width = (
            item.count
            / maxRecallCategoryCount
          ) * 100;

          return (
            <div
              key={item.category}
              className={[
                'guardian-recall-chart__row',
                item.count === 0
                  ? 'guardian-recall-chart__row--empty'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="guardian-recall-chart__label">
                {item.category}
              </span>

              <div
                className="guardian-recall-chart__track"
                role="progressbar"
                aria-label={`${item.category} ${item.count}건`}
                aria-valuemin="0"
                aria-valuemax={maxRecallCategoryCount}
                aria-valuenow={item.count}
              >
                <span
                  className="guardian-recall-chart__bar"
                  style={{
                    width: item.count === 0
                      ? '0%'
                      : `${Math.max(width, 8)}%`,
                  }}
                />
              </div>

              <strong>
                {item.count}건
              </strong>
            </div>
          );
        })}
      </div>

      {!hasRecallCategoryData && (
        <p className="guardian-recall-chart__simple-empty">
          현재 집계된 리콜 제품이 없습니다.
        </p>
      )}
    </div>
  );


  return (
    <GuardianLayout activeMenu="home">
      <main className="guardian-dashboard">
        <section className="guardian-dashboard__heading">
          <h1>홈</h1>
        </section>

        {error && (
          <div className="guardian-dashboard__error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="guardian-dashboard__state">
            담당 어르신의 상태를 불러오는 중입니다.
          </div>
        ) : seniors.length === 0 ? (
          <div className="guardian-dashboard__state">
            연결된 담당 어르신이 없습니다.
          </div>
        ) : (
          <>
            <section className="guardian-dashboard-summary">
              <article className="guardian-dashboard-summary__card">
                <span>확인 필요</span>

                <strong>
                  {attentionSeniorCount}명
                </strong>

                <small>
                  실제 상태 확인이나 조치가 필요한 어르신
                </small>
              </article>

              <article className="guardian-dashboard-summary__card">
                <span>리콜 확인 필요</span>

                <strong>
                  {recallPendingCount}건
                </strong>

                <small>
                  사용 여부 또는 조치 완료 확인 필요
                </small>
              </article>

              <article className="guardian-dashboard-summary__card">
                <span>위치 연동 필요</span>

                <strong>
                  {locationSetupNeededCount}명
                </strong>

                <small>
                  위치 정보가 아직 수신되지 않은 어르신
                </small>
              </article>
            </section>

            <section className="guardian-dashboard-middle">
              <article className="guardian-dashboard-panel guardian-priority-panel">
                <div className="guardian-dashboard-panel__heading">
                  <div>
                    <h2>우선 확인</h2>
                  </div>

                  <span>
                    {priorityItems.length}건
                  </span>
                </div>

                {priorityItems.length === 0 ? (
                  <div className="guardian-dashboard-panel__empty">
                    <strong>
                      현재 우선 확인할 항목이 없습니다.
                    </strong>

                    <p>
                      새로운 위험이나 조치 요청이 발생하면 이곳에 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="guardian-priority-list">
                    {priorityItems.map((item) => {
                      const action = getPriorityAction(
                        item,
                      );
                      const isLocationMissing = (
                        item.type === '위치'
                        && item.title === '위치 정보가 수신되지 않았습니다.'
                      );

                      return (
                        <div
                          key={item.id}
                          className="guardian-priority-item"
                        >
                          <div className="guardian-priority-item__copy">
                            {!isLocationMissing && (
                              <div className="guardian-priority-item__labels">
                                <span>
                                  {item.type}
                                </span>

                                <strong>
                                  {item.seniorName}
                                </strong>
                              </div>
                            )}

                            <h3>
                              {isLocationMissing
                                ? `${item.seniorName} 님의 ${item.title}`
                                : item.title}
                            </h3>

                            {item.description && (
                              <p>
                                {item.description}
                              </p>
                            )}

                            {!isLocationMissing && (
                              <small>
                                {formatDateTime(item.time)}
                              </small>
                            )}
                          </div>

                          {!isLocationMissing && (
                            <button
                              type="button"
                              onClick={() => (
                                handlePriorityAction(item)
                              )}
                            >
                              {action.label}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="guardian-dashboard-panel guardian-recall-panel">
                <div className="guardian-dashboard-panel__heading">
                  <div>
                    <h2>리콜·생활안전 현황</h2>
                  </div>

                  <button
                    type="button"
                    className="guardian-panel-link-button"
                    onClick={() => setRecallModalOpen(true)}
                  >
                    전체 보기
                  </button>
                </div>

                {renderRecallChart('home')}
              </article>
            </section>

            <section className="guardian-rag-panel">
              <div className="guardian-rag-panel__intro">
                <span className="guardian-rag-panel__eyebrow">
                  복지·안전 도우미
                </span>

                <h2>
                  복지제도와 생활안전 정보를 질문해 보세요.
                </h2>

                <p>
                  에너지바우처, 전기·가스요금 감면,
                  리콜 제품과 기상특보 대응 방법을
                  근거 문서와 함께 안내합니다.
                </p>
              </div>

              <div className="guardian-rag-panel__body">
                <form
                  className="guardian-rag-form"
                  onSubmit={handleRagSubmit}
                >
                  <div className="guardian-rag-form__input-row">
                    <input
                      id="guardian-rag-question"
                      type="text"
                      value={ragQuestion}
                      onChange={(event) => (
                        setRagQuestion(event.target.value)
                      )}
                      placeholder="예: 에너지바우처 신청 조건은 무엇인가요?"
                      maxLength={500}
                      disabled={ragLoading}
                    />

                    <button
                      type="submit"
                      disabled={
                        ragLoading
                        || !ragQuestion.trim()
                      }
                    >
                      {ragLoading
                        ? '답변 생성 중...'
                        : '질문하기'}
                    </button>
                  </div>
                </form>

                <div className="guardian-rag-suggestions">
                  <span>
                    추천 질문
                  </span>

                  <div>
                    {RECOMMENDED_QUESTIONS.map((question) => (
                      <button
                        type="button"
                        key={question}
                        onClick={() => runRagQuestion(question)}
                        disabled={ragLoading}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>

                {ragError && (
                  <div className="guardian-rag-error">
                    {ragError}
                  </div>
                )}

                {ragLoading && (
                  <div className="guardian-rag-loading">
                    관련 복지·안전 문서를 검색하고 있습니다.
                  </div>
                )}

                {ragAnswer && !ragLoading && (
                  <div className="guardian-rag-answer">
                    <div className="guardian-rag-answer__heading">
                      <span>
                        답변
                      </span>

                      <small>
                        공공데이터 및 관련 문서 기반
                      </small>
                    </div>

                    <p>
                      {ragAnswer}
                    </p>

                    {ragSources.length > 0 && (
                      <div className="guardian-rag-sources">
                        <strong>
                          근거 문서
                        </strong>

                        <div>
                          {ragSources.slice(0, 3).map((source) => (
                            source.url ? (
                              <a
                                key={source.id}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span>
                                  {source.title}
                                </span>

                                {source.description && (
                                  <small>
                                    {source.description}
                                  </small>
                                )}
                              </a>
                            ) : (
                              <div
                                key={source.id}
                                className="guardian-rag-source"
                              >
                                <span>
                                  {source.title}
                                </span>

                                {source.description && (
                                  <small>
                                    {source.description}
                                  </small>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {recallModalOpen && (
        <>
          <button
            type="button"
            className="guardian-recall-modal-overlay"
            onClick={() => setRecallModalOpen(false)}
            aria-label="리콜 현황 닫기"
          />

          <section
            className="guardian-recall-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-recall-modal-title"
          >
            <header className="guardian-recall-modal__header">
              <div>
                <h2 id="guardian-recall-modal-title">
                  리콜·생활안전 전체 현황
                </h2>

                <p>
                  등록 제품의 사용 여부와 리콜 조치 상태를 확인합니다.
                </p>
              </div>

              <button
                type="button"
                className="guardian-recall-modal__close"
                onClick={() => setRecallModalOpen(false)}
                aria-label="모달 닫기"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="guardian-recall-modal__content">
              <section className="guardian-recall-modal-summary">
                <article>
                  <span>사용 중</span>

                  <strong>
                    {inUseRecallProducts.length}건
                  </strong>
                </article>

                <article>
                  <span>사용 여부 미확인</span>

                  <strong>
                    {unknownUseRecallProducts.length}건
                  </strong>
                </article>

                <article>
                  <span>조치 완료</span>

                  <strong>
                    {completedRecallProducts.length}건
                  </strong>
                </article>

                <article>
                  <span>생활안전 확인</span>

                  <strong>
                    {lifeSafetySeniorCount}명
                  </strong>
                </article>
              </section>

              {recallLoadError && (
                <div className="guardian-recall-warning">
                  등록 제품 API 응답이 없어 알림·위험도 기준으로 일부 집계했습니다.
                </div>
              )}

              <section className="guardian-recall-modal__section">
                {renderRecallChart('modal')}
              </section>

              <section className="guardian-recall-modal__section">
                <div className="guardian-recall-modal__section-heading">
                  <div>
                    <h3>확인 필요 제품</h3>

                    <p>
                      사용 여부 또는 후속 조치 확인이 필요한 제품입니다.
                    </p>
                  </div>

                  <span>
                    {pendingRecallProducts.length}건
                  </span>
                </div>

                {pendingRecallProducts.length === 0 ? (
                  <div className="guardian-recall-product-empty">
                    현재 상세 확인이 필요한 등록 제품이 없습니다.
                  </div>
                ) : (
                  <div className="guardian-recall-product-list">
                    {pendingRecallProducts.map((product, index) => {
                      const productId = (
                        product?.id
                        ?? product?.registeredProductId
                        ?? [
                          getProductSeniorId(product),
                          getProductName(product),
                          index,
                        ].join('-')
                      );

                      return (
                        <article
                          key={productId}
                          className="guardian-recall-product-item"
                        >
                          <div className="guardian-recall-product-item__copy">
                            <div className="guardian-recall-product-item__labels">
                              <span>
                                {getProductStatusLabel(product)}
                              </span>

                              <strong>
                                {getSeniorNameByProduct(product, seniors)} 어르신
                              </strong>
                            </div>

                            <h4>
                              {getProductName(product)}
                            </h4>

                            <p>
                              {getProductModel(product)
                                || '모델명 미확인'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleProductClick(product)}
                          >
                            확인하기
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <footer className="guardian-recall-modal__footer">
              <button
                type="button"
                className="guardian-recall-modal__cancel"
                onClick={() => setRecallModalOpen(false)}
              >
                닫기
              </button>

              <button
                type="button"
                className="guardian-recall-modal__primary"
                onClick={handleSafetyPageClick}
              >
                제품·생활안전 관리로 이동
              </button>
            </footer>
          </section>
        </>
      )}
    </GuardianLayout>
  );
}
