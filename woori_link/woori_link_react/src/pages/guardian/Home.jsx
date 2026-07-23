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
  getGuardianTodayCheckInSummary,
  getGuardianUrgentSummary,
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


const ACTIVE_ALERT_STATUSES = [
  'UNREAD',
  'ACKNOWLEDGED',
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


function isActiveAlert(alert) {
  return ACTIVE_ALERT_STATUSES.includes(
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

function isSameLocalDate(value, targetDate = new Date()) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === targetDate.getFullYear()
    && date.getMonth() === targetDate.getMonth()
    && date.getDate() === targetDate.getDate()
  );
}


function isCheckInAlert(alert) {
  const type = getAlertType(alert);

  const text = normalizeText([
    getAlertTitle(alert),
    getAlertMessage(alert),
  ].join(' '));

  return (
    type.includes('CHECK_IN')
    || type.includes('CHECKIN')
    || type.includes('NO_RESPONSE')
    || type.includes('AI_CHECK')
    || text.includes('안부')
    || text.includes('미응답')
    || text.includes('응답하지')
  );
}

function getPriorityTypeLabel(type) {
  const normalizedType = normalizeText(type);

  if (
    normalizedType.includes('FALL')
    || normalizedType.includes('SOS')
    || normalizedType.includes('EMERGENCY')
  ) {
    return '긴급';
  }

  if (
    normalizedType.includes('CHECK_IN')
    || normalizedType.includes('CHECKIN')
    || normalizedType.includes('CHECK')
    || normalizedType.includes('NO_RESPONSE')
    || normalizedType.includes('AI')
  ) {
    return '안부';
  }

  if (
    normalizedType.includes('GEOFENCE')
    || normalizedType.includes('ZONE')
    || normalizedType.includes('SAFETY_RADIUS')
  ) {
    return '안전구역';
  }

  if (normalizedType.includes('LOCATION')) {
    return '위치';
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
    || normalizedType.includes('FIRE')
    || normalizedType.includes('SMOKE')
    || normalizedType.includes('SAFETY')
  ) {
    return '생활안전';
  }

  return '상태';
}

function getPriorityText(item) {
  return normalizeText([
    item?.type,
    item?.rawType,
    item?.title,
    item?.description,
  ].join(' '));
}

function getPriorityTypeClass(item) {
  if (item?.type === '긴급') {
    return 'urgent';
  }

  if (item?.type === '안부') {
    return 'check-in';
  }

  if (
    item?.type === '위치'
    || item?.type === '안전구역'
  ) {
    return 'location';
  }

  if (item?.type === '리콜') {
    return 'recall';
  }

  if (item?.type === '생활안전') {
    return 'safety';
  }

  if (item?.type === '기상') {
    return 'weather';
  }

  return 'default';
}

function getWeatherTargetNames(targets) {
  const names = targets
    .map((item) => item.seniorName)
    .filter(Boolean);

  if (names.length === 0) {
    return '연결된 어르신';
  }

  if (names.length === 1) {
    return `${names[0]} 님`;
  }

  if (names.length === 2) {
    return `${names[0]} 님, ${names[1]} 님`;
  }

  return `${names[0]} 님 외 ${names.length - 1}명`;
}


function getWeatherAlertTitle(targets) {
  const alertNames = [
    ...new Set(
      targets
        .map((item) => item.alertName)
        .filter(Boolean),
    ),
  ];

  if (alertNames.length === 1) {
    return `${alertNames[0]} 발효 중`;
  }

  return '심각한 기상특보 발효 중';
}

function getPriorityScore(item) {
  const text = getPriorityText(item);

  /*
   * 1순위: 즉시 확인이 필요한 긴급 사건
   */
  if (
    item?.type === '긴급'
    || text.includes('FALL_SUSPECTED')
    || text.includes('FALL_DETECTED')
    || text.includes('SOS')
    || text.includes('EMERGENCY')
    || text.includes('낙상')
    || text.includes('긴급 호출')
  ) {
    return 600;
  }

  /*
   * 2순위: 전기·가스·화재·연기 등 생활안전 위험
   */
  if (
    item?.type === '생활안전'
    || text.includes('GAS')
    || text.includes('FIRE')
    || text.includes('SMOKE')
    || text.includes('가스 냄새')
    || text.includes('가스 누출')
    || text.includes('타는 냄새')
    || text.includes('화재')
    || text.includes('연기')
  ) {
    return 500;
  }

  /*
   * 3순위: 심각한 기상 위험
   */
  if (
    item?.type === '기상'
    || text.includes('WEATHER')
    || text.includes('기상특보')
    || text.includes('폭염경보')
    || text.includes('한파경보')
  ) {
    return 400;
  }

  /*
   * 4순위: 안부 미응답
   */
  if (
    item?.type === '안부'
    || text.includes('CHECK_IN_MISSED')
    || text.includes('NO_RESPONSE')
    || text.includes('안부')
    || text.includes('미응답')
  ) {
    return 300;
  }

  /*
   * 5순위: 미조치 리콜
   */
  if (
    item?.type === '리콜'
    || text.includes('RECALL')
    || text.includes('리콜')
  ) {
    return 200;
  }

  /*
   * 6순위: 안전구역 이탈
   */
  if (
    item?.type === '안전구역'
    || text.includes('SAFETY_RADIUS_EXIT')
    || text.includes('안전구역')
  ) {
    return 150;
  }

  /*
   * 7순위: 실제 위치 이상
   */
  if (
    item?.type === '위치'
    && !text.includes('위치 정보가 수신되지 않았습니다')
  ) {
    return 100;
  }

  /*
   * 최하위: 위치 미수신·권한 미설정 등 연동 문제
   */
  if (
    item?.type === '위치'
    || text.includes('위치 정보가 수신되지 않았습니다')
  ) {
    return 10;
  }

  return 50;
}


function getPriorityTimeValue(value) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

function getPriorityDisplayTitle(item) {
  const seniorName = item?.seniorName ?? '담당 어르신';

  const rawType = normalizeText(item?.rawType);

  const text = normalizeText([
    item?.title,
    item?.description,
  ].join(' '));

  if (
    rawType.includes('FALL_SUSPECTED')
    || text.includes('낙상 의심')
  ) {
    return `${seniorName} 님의 낙상 의심`;
  }

  if (
    rawType.includes('FALL_DETECTED')
    || text.includes('낙상 감지')
  ) {
    return `${seniorName} 님의 낙상 감지`;
  }

  if (
    rawType.includes('SOS')
    || text.includes('SOS')
  ) {
    return `${seniorName} 님의 SOS 호출`;
  }

  if (
    rawType.includes('CHECK_IN_MISSED')
    || text.includes('안부 미응답')
    || text.includes('미응답')
  ) {
    return `${seniorName} 님이 안부 미응답`;
  }

  if (
    item?.type === '위치'
    && text.includes('위치 정보가 수신되지 않았습니다')
  ) {
    return `${seniorName} 님의 위치 정보 미수신`;
  }

  if (
    item?.type === '위치'
    || text.includes('위치 이상')
  ) {
    return `${seniorName} 님의 위치 이상`;
  }

  if (
    item?.type === '안전구역'
    || rawType.includes('SAFETY_RADIUS_EXIT')
  ) {
    return `${seniorName} 님의 안전구역 이탈`;
  }

  if (item?.type === '리콜') {
    return `${seniorName} 님의 리콜 조치 필요`;
  }

  if (item?.type === '생활안전') {
    return `${seniorName} 님의 생활안전 확인 필요`;
  }

  if (item?.type === '기상') {
    return `${seniorName} 님의 기상 위험 확인 필요`;
  }

  return `${seniorName} 님의 ${item?.title ?? '상태 확인 필요'}`;
}

function getPriorityStatusLabel(item) {
  const status = normalizeText(
    item?.alertStatus,
  );

  if (status === 'UNREAD') {
    return '신규';
  }

  if (status === 'ACKNOWLEDGED') {
    return '확인 중';
  }

  if (item?.source === 'risk') {
    return '확인 필요';
  }

  return '';
}


function getPriorityStatusClass(item) {
  const status = normalizeText(
    item?.alertStatus,
  );

  if (status === 'UNREAD') {
    return 'new';
  }

  if (status === 'ACKNOWLEDGED') {
    return 'checking';
  }

  if (item?.source === 'risk') {
    return 'required';
  }

  return '';
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

  /*
   * 전기를 사용하거나 난방·공기 환경과 관련된 제품
   */
  if (
    text.includes('가습기')
    || text.includes('제습기')
    || text.includes('공기청정기')
    || text.includes('선풍기')
    || text.includes('서큘레이터')
    || text.includes('에어컨')
    || text.includes('전기요')
    || text.includes('전기매트')
    || text.includes('전기장판')
    || text.includes('히터')
    || text.includes('난로')
    || text.includes('온풍기')
    || text.includes('전기히터')
    || text.includes('전기난로')
    || text.includes('HUMIDIFIER')
    || text.includes('DEHUMIDIFIER')
    || text.includes('AIR PURIFIER')
    || text.includes('FAN')
    || text.includes('HEATER')
    || text.includes('HEATING')
  ) {
    return '전기·난방제품';
  }

  /*
   * 직류전원장치, 어댑터, 배터리 및 충전 제품
   */
  if (
    text.includes('직류전원장치')
    || text.includes('직류 전원장치')
    || text.includes('전원장치')
    || text.includes('전원공급장치')
    || text.includes('전원 공급 장치')
    || text.includes('AC/DC')
    || text.includes('POWER SUPPLY')
    || text.includes('배터리')
    || text.includes('보조배터리')
    || text.includes('충전기')
    || text.includes('충전장치')
    || text.includes('어댑터')
    || text.includes('전지')
    || text.includes('BATTERY')
    || text.includes('CHARGER')
    || text.includes('ADAPTER')
  ) {
    return '배터리·충전기';
  }

  /*
   * 주방용품과 일반 생활용품
   *
   * 현재 홈 차트에는 의류·신발 카테고리가 없으므로
   * 신발과 섬유제품도 생활용품으로 집계한다.
   */
  if (
    text.includes('밥솥')
    || text.includes('전기포트')
    || text.includes('주전자')
    || text.includes('프라이팬')
    || text.includes('냄비')
    || text.includes('믹서기')
    || text.includes('블렌더')
    || text.includes('토스터')
    || text.includes('전자레인지')
    || text.includes('조리')
    || text.includes('주방')
    || text.includes('생활용품')

    || text.includes('신발')
    || text.includes('운동화')
    || text.includes('구두')
    || text.includes('샌들')
    || text.includes('슬리퍼')
    || text.includes('부츠')
    || text.includes('아동용 섬유제품')
    || text.includes('유아용 섬유제품')
    || text.includes('섬유제품')
    || text.includes('의류')

    /*
     * 현재 등록된 휠라 제품의 제품명에
     * '신발'이라는 단어가 없어서 임시로 제품명도 처리한다.
     */
    || text.includes('휠라 꾸미 라이트')
    || text.includes('메가리자몽')

    || text.includes('KITCHEN')
    || text.includes('COOKER')
    || text.includes('BLENDER')
    || text.includes('TOASTER')
    || text.includes('SHOES')
    || text.includes('SNEAKERS')
    || text.includes('SANDAL')
    || text.includes('SLIPPER')
    || text.includes('FOOTWEAR')
  ) {
    return '주방·생활용품';
  }

  /*
   * 의료 및 건강 관련 제품
   */
  if (
    text.includes('의료')
    || text.includes('혈압')
    || text.includes('혈압계')
    || text.includes('체온계')
    || text.includes('안마')
    || text.includes('마사지')
    || text.includes('건강')
    || text.includes('보행기')
    || text.includes('휠체어')
    || text.includes('의료기기')
    || text.includes('MEDICAL')
    || text.includes('HEALTH')
    || text.includes('MASSAGER')
  ) {
    return '의료·건강용품';
  }

  /*
   * 현재 별도 어린이제품 카테고리가 없으므로
   * 일반 생활용품으로 포함한다.
   */
  if (
    text.includes('완구')
    || text.includes('장난감')
    || text.includes('어린이제품')
    || text.includes('유아용품')
    || text.includes('TOY')
    || text.includes('CHILDREN')
    || text.includes('KIDS')
  ) {
    return '주방·생활용품';
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

  const [todayCheckInSummary, setTodayCheckInSummary] = useState({
    seniorCountWithMissed: 0,
    requestCount: 0,
    respondedCount: 0,
    missedCount: 0,
  });

  const [urgentSummary, setUrgentSummary] = useState({
    totalCount: 0,
    fallCount: 0,
    sosCount: 0,
    lifeSafetyCount: 0,
    severeWeatherCount: 0,
    consecutiveMissedCheckInCount: 0,
  });
  const [weatherTargetIndex, setWeatherTargetIndex] = useState(0);

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
          checkInSummaryResult,
          urgentSummaryResult,
        ] = await Promise.allSettled([
          getSeniorsByGuardian(),
          getGuardianAlerts(),
          getGuardianTodayCheckInSummary(),
          getGuardianUrgentSummary(),
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

        if (checkInSummaryResult.status === 'fulfilled') {
          const checkInData = (
            checkInSummaryResult.value.data
            ?? {}
          );

          setTodayCheckInSummary({
            seniorCountWithMissed: Number(
              checkInData.seniorCountWithMissed ?? 0,
            ),
            requestCount: Number(
              checkInData.requestCount ?? 0,
            ),
            respondedCount: Number(
              checkInData.respondedCount ?? 0,
            ),
            missedCount: Number(
              checkInData.missedCount ?? 0,
            ),
          });
        } else {
          setTodayCheckInSummary({
            seniorCountWithMissed: 0,
            requestCount: 0,
            respondedCount: 0,
            missedCount: 0,
          });
        }

        if (urgentSummaryResult.status === 'fulfilled') {
          const urgentData = (
            urgentSummaryResult.value.data
            ?? {}
          );

          setUrgentSummary({
            totalCount: Number(
              urgentData.totalCount ?? 0,
            ),
            fallCount: Number(
              urgentData.fallCount ?? 0,
            ),
            sosCount: Number(
              urgentData.sosCount ?? 0,
            ),
            lifeSafetyCount: Number(
              urgentData.lifeSafetyCount ?? 0,
            ),
            severeWeatherCount: Number(
              urgentData.severeWeatherCount ?? 0,
            ),
            consecutiveMissedCheckInCount: Number(
              urgentData.consecutiveMissedCheckInCount ?? 0,
            ),
          });
        } else {
          setUrgentSummary({
            totalCount: 0,
            fallCount: 0,
            sosCount: 0,
            lifeSafetyCount: 0,
            severeWeatherCount: 0,
            consecutiveMissedCheckInCount: 0,
          });
        }

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


  const activeAlerts = useMemo(() => (
    alerts.filter(isActiveAlert)
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

      const seniorActiveAlerts = activeAlerts.filter(
        (alert) => (
          String(getAlertSeniorId(alert))
          === String(senior.id)
        ),
      );

      return {
        senior,
        state,
        riskActionItems,
        seniorActiveAlerts,

        needsAttention: (
          riskActionItems.length > 0
          || seniorActiveAlerts.length > 0
        ),
      };
    })
  ), [
    seniors,
    seniorStates,
    activeAlerts,
  ]);

  const severeWeatherTargets = useMemo(() => (
    seniorSummaries
      .filter((summary) => (
        summary.state.risk?.weatherRisk === true
      ))
      .map((summary) => {
        const risk = summary.state.risk ?? {};

        return {
          seniorId: summary.senior.id,
          seniorName: summary.senior.name,

          alertName: (
            risk.weatherAlertName
            ?? risk.weatherWarningName
            ?? risk.weatherType
            ?? '심각한 기상특보'
          ),

          description: (
            risk.weatherDescription
            ?? risk.weatherMessage
            ?? ''
          ),

          issuedAt: (
            risk.weatherIssuedAt
            ?? risk.assessedAt
            ?? null
          ),
        };
      })
  ), [seniorSummaries]);

  // const severeWeatherTargets = useMemo(() => (
  //   [
  //     {
  //       seniorId: 1,
  //       seniorName: '최숙희',
  //       alertName: '폭염경보',
  //       description: '서울특별시 동작구 폭염경보',
  //       issuedAt: new Date().toISOString(),
  //     },
  //     {
  //       seniorId: 2,
  //       seniorName: '박철수',
  //       alertName: '폭염경보',
  //       description: '서울특별시 관악구 폭염경보',
  //       issuedAt: new Date().toISOString(),
  //     },
  //     {
  //       seniorId: 3,
  //       seniorName: '임성호',
  //       alertName: '호우경보',
  //       description: '서울특별시 강남구 호우경보',
  //       issuedAt: new Date().toISOString(),
  //     },
  //   ]
  // ), []);

  const currentWeatherTarget = (
    severeWeatherTargets[weatherTargetIndex]
    ?? severeWeatherTargets[0]
    ?? null
  );

  useEffect(() => {
    if (severeWeatherTargets.length === 0) {
      setWeatherTargetIndex(0);
      return;
    }

    if (weatherTargetIndex >= severeWeatherTargets.length) {
      setWeatherTargetIndex(0);
    }
  }, [
    severeWeatherTargets,
    weatherTargetIndex,
  ]);

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
    const alertItems = activeAlerts.map(
      (alert, index) => {
        const seniorId = getAlertSeniorId(alert);

        const senior = seniors.find((item) => (
          String(item.id) === String(seniorId)
        ));

        const rawType = getAlertType(alert);

        return {
          id: `alert-${createAlertKey(alert, index)}`,
          seniorId,

          seniorName: (
            senior?.name
            ?? alert?.seniorName
            ?? alert?.senior?.name
            ?? '담당 어르신'
          ),

          type: getPriorityTypeLabel(rawType),
          rawType,

          title: getAlertTitle(alert),
          description: getAlertMessage(alert),
          time: getTimestamp(alert),

          source: 'alert',
          alertStatus: normalizeText(alert?.status),
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
            rawType: '',

            title: riskItem.title,
            description: riskItem.description ?? '',
            time: summary.state.risk?.assessedAt,

            source: 'risk',
            alertStatus: '',
          });
        },
      );
    });

    const uniqueMap = new Map();

    [
      ...alertItems,
      ...riskItems,
    ].forEach((item) => {
      /*
       * 동일한 어르신에게 같은 유형과 같은 제목으로
       * 생성된 항목은 한 번만 표시한다.
       */
      const key = [
        item.seniorId ?? 'unknown',
        item.type,
        normalizeText(item.title),
      ].join('-');

      const existingItem = uniqueMap.get(key);

      if (!existingItem) {
        uniqueMap.set(key, item);
        return;
      }

      /*
       * 중복 항목이면 더 최근 데이터를 남긴다.
       */
      const existingTime = getPriorityTimeValue(
        existingItem.time,
      );

      const currentTime = getPriorityTimeValue(
        item.time,
      );

      if (currentTime > existingTime) {
        uniqueMap.set(key, item);
      }
    });

    return [...uniqueMap.values()]
      .sort((first, second) => {
        const priorityDifference = (
          getPriorityScore(second)
          - getPriorityScore(first)
        );

        /*
         * 위험 등급이 다르면 위험도가 높은 항목을 먼저 표시한다.
         */
        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        /*
         * 같은 위험 등급이면 최신 발생 항목을 먼저 표시한다.
         */
        return (
          getPriorityTimeValue(second.time)
          - getPriorityTimeValue(first.time)
        );
      })
  }, [
    seniors,
    seniorSummaries,
    activeAlerts,
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

  const handleNextWeatherTarget = () => {
    if (severeWeatherTargets.length <= 1) {
      return;
    }

    setWeatherTargetIndex((currentIndex) => (
      (currentIndex + 1)
      % severeWeatherTargets.length
    ));
  };


  const renderRecallChart = (variant = 'home') => (
    <div
      className={[
        'guardian-recall-chart',
        `guardian-recall-chart--${variant}`,
      ].join(' ')}
    >

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
                <span>
                  오늘 안부 미응답
                </span>

                <strong>
                  {todayCheckInSummary.seniorCountWithMissed}명
                </strong>

                <small>
                  오늘 요청 {todayCheckInSummary.requestCount}건 · 응답 {todayCheckInSummary.respondedCount}건 · 미응답 {todayCheckInSummary.missedCount}건
                </small>
              </article>

              <article className="guardian-dashboard-summary__card">
                <span>
                  리콜 조치 필요
                </span>

                <strong>
                  {recallPendingCount}건
                </strong>

                <small>
                  사용 중지 또는 조치 완료 확인이 필요한 제품
                </small>
              </article>

              <article className="guardian-dashboard-summary__card">
                <span>
                  긴급 확인
                </span>

                <strong>
                  {urgentSummary.totalCount}건
                </strong>

                <small>
                  {urgentSummary.totalCount > 0
                    ? [
                      urgentSummary.fallCount > 0
                        ? `낙상 ${urgentSummary.fallCount}건`
                        : null,

                      urgentSummary.sosCount > 0
                        ? `SOS ${urgentSummary.sosCount}건`
                        : null,

                      urgentSummary.lifeSafetyCount > 0
                        ? `생활안전 ${urgentSummary.lifeSafetyCount}건`
                        : null,

                      urgentSummary.severeWeatherCount > 0
                        ? `기상특보 ${urgentSummary.severeWeatherCount}건`
                        : null,

                      urgentSummary.consecutiveMissedCheckInCount > 0
                        ? `연속 미응답 ${urgentSummary.consecutiveMissedCheckInCount}건`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    : '현재 즉시 확인이 필요한 위험이 없습니다.'}
                </small>
              </article>
            </section>

            {currentWeatherTarget && (
              <section
                className="guardian-weather-alert"
                role="alert"
              >
                <div
                  className="guardian-weather-alert__icon"
                  aria-hidden="true"
                >
                  !
                </div>

                <div className="guardian-weather-alert__copy">
                  <strong>
                    {currentWeatherTarget.alertName
                      ?? '심각한 기상특보'} 발효 중
                  </strong>

                  <p>
                    {currentWeatherTarget.seniorName} 님의 최근 위치 지역에
                    {' '}
                    {currentWeatherTarget.alertName
                      ?? '심각한 기상특보'}가 발효되었습니다.
                    {' '}
                    안부와 실내 안전 상태를 확인해 주세요.
                  </p>
                </div>

                <div className="guardian-weather-alert__navigation">
                  <span>
                    {severeWeatherTargets.length === 1
                      ? '1명'
                      : `${weatherTargetIndex + 1}/${severeWeatherTargets.length}`}
                  </span>

                  {severeWeatherTargets.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNextWeatherTarget}
                      aria-label="다음 기상특보 대상 어르신 보기"
                    >
                      &gt;
                    </button>
                  )}
                </div>
              </section>
            )}

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
                    {priorityItems.map((item) => (
                      <div
                        key={item.id}
                        className="guardian-priority-item"
                      >
                        <div className="guardian-priority-item__copy">
                          <span
                            className={[
                              'guardian-priority-item__indicator',
                              `guardian-priority-item__indicator--${getPriorityTypeClass(item)}`,
                            ].join(' ')}
                            aria-hidden="true"
                          />

                          <h3>
                            {getPriorityDisplayTitle(item)}
                          </h3>
                        </div>

                        {item.time && (
                          <time
                            className="guardian-priority-item__time"
                            dateTime={item.time}
                          >
                            {formatDateTime(item.time)}
                          </time>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="guardian-dashboard-panel guardian-recall-panel">
                <div className="guardian-dashboard-panel__heading">
                  <div>
                    <h2>리콜 발생 제품 유형</h2>
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
                                {getSeniorNameByProduct(product, seniors)} 님
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
