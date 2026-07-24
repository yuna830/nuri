import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import GuardianLayout from './GuardianLayout.jsx';
import ProductRegistrationModal from './ProductRegistrationModal.jsx';

import {
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import {
  deleteProduct,
  getProductsBySenior,
  registerProduct,
  sendRecallNotification,
} from '../../api/recallApi.js';

import {
  createAction,
  getActionsBySenior,
} from '../../api/actionApi.js';

import {
  analyzeProductLabel,
  confirmProductLabelAnalysis,
  productDocumentAiEnabled,
} from '../../api/documentAiApi.js';

import '../../css/guardian/Safety.css';


const USE_LABEL = {
  IN_USE: '사용 중',
  STOPPED: '사용 중지',
  DISPOSED: '폐기 완료',
  NOT_IN_USE: '사용 중지',
  NOT_OWNED: '폐기 완료',
  UNKNOWN: '확인 필요',
};


const CHECKS = [
  {
    type: 'ELECTRIC_CHECK',
    label: '전기설비 안전',

    description:
      '전기설비 이상 징후와 전문기관 점검 지원 여부를 확인합니다.',

    questions: [
      '차단기가 반복해서 내려갑니다.',
      '콘센트나 전선에 손상·그을림이 있습니다.',
      '타는 냄새가 나거나 과열되는 부분이 있습니다.',
      '전기설비가 오래되어 안전한지 잘 모르겠습니다.',
    ],

    supportTitle:
      '전기설비 점검 지원',

    supportDescription:
      '취약가구에 해당하거나 전기설비 이상이 있는 경우 전문기관의 방문 점검과 응급조치 지원 여부를 확인할 수 있습니다.',

    requestLabel:
      '전기설비 지원 확인 요청',
  },

  {
    type: 'GAS_CHECK',
    label: '가스시설 안전',

    description:
      '가스시설의 이상 징후와 시설 개선 지원 여부를 확인합니다.',

    questions: [
      '평소와 다른 가스 냄새가 납니다.',
      '가스 배관이나 연결부에 손상이 보입니다.',
      '가스레인지 불꽃 상태가 평소와 다릅니다.',
      '가스시설이 오래되어 안전한지 잘 모르겠습니다.',
    ],

    supportTitle:
      '가스시설 점검·개선 지원',

    supportDescription:
      '지역과 대상 조건에 따라 노후 배관, 밸브, 가스 연결부 점검과 시설 개선 지원 여부를 확인할 수 있습니다.',

    requestLabel:
      '가스시설 지원 확인 요청',
  },

  {
    type: 'FIRE_CHECK',
    label: '화재예방 환경',

    description:
      '주택 화재 위험과 방문 안전점검·소방시설 지원 여부를 확인합니다.',

    questions: [
      '소화기가 없거나 사용 가능한 상태인지 모르겠습니다.',
      '화재감지기 설치 여부를 모르겠습니다.',
      '멀티탭이나 콘센트를 여러 개 연결해 사용하고 있습니다.',
      '대피 통로 주변에 물건이 쌓여 있습니다.',
      '응급안전안심서비스 이용 여부를 확인하고 싶습니다.',
    ],

    supportTitle:
      '화재예방 안전 지원',

    supportDescription:
      '지역에 따라 소방서 방문 안전점검, 소화기·화재감지기 보급, 응급안전안심서비스 지원 여부를 확인할 수 있습니다.',

    requestLabel:
      '화재예방 지원 확인 요청',
  },

  {
    type: 'HEATING_CHECK',
    label: '난방·주거환경',

    description:
      '난방 취약 문제와 에너지효율 개선 지원 여부를 확인합니다.',

    questions: [
      '난방이 제대로 되지 않습니다.',
      '보일러나 난방기기가 오래되었습니다.',
      '창문이나 벽에서 찬바람이 심하게 들어옵니다.',
      '난방비 부담으로 난방을 충분히 사용하지 못합니다.',
      '전기장판이나 난방기기의 전선이 손상되었습니다.',
    ],

    supportTitle:
      '난방·에너지효율 개선 지원',

    supportDescription:
      '대상 조건에 따라 보일러, 단열, 창호, 바닥과 냉난방 환경 개선 지원 여부를 확인할 수 있습니다.',

    requestLabel:
      '난방환경 지원 확인 요청',
  },

  {
    type: 'FALL_CHECK',
    label: '낙상예방 주거환경',

    description:
      '낙상 위험 징후와 주거환경 개선 지원 여부를 확인합니다.',

    questions: [
      '최근 6개월 안에 넘어진 적이 있습니다.',
      '걸을 때 벽이나 가구를 잡아야 합니다.',
      '화장실 바닥이 미끄럽다고 느낍니다.',
      '집 안에 높은 문턱이나 단차가 있습니다.',
      '밤에 화장실로 가는 길이 어둡습니다.',
      '집 안에 이동을 방해하는 물건이 있습니다.',
    ],

    supportTitle:
      '낙상예방 주거환경 지원',

    supportDescription:
      '지역과 대상 조건에 따라 안전손잡이, 미끄럼 방지, 문턱 개선, 조명과 이동환경 개선 지원 여부를 확인할 수 있습니다.',

    requestLabel:
      '주거환경 지원 확인 요청',
  },
];


const CHECK_STATUS = {
  PENDING: '점검 필요',
  IN_PROGRESS: '조치 중',
  COMPLETED: '정상',
  CANCELLED: '조치 완료',
};


const emptyForm = {
  seniorId: '',
  productType: '',
  productName: '',
  brandName: '',
  manufacturer: '',
  modelNumber: '',
  barcode: '',
  certificationNumber: '',
  serialNumber: '',
  manufacturingDate: '',
  currentUseStatus: 'IN_USE',
};


const RECALL_LABEL = {
  RECALL_CONFIRMED: '공식 리콜 일치',
  NO_MATCH_FOUND: '등록 공고 일치 없음',
  REVIEW_REQUIRED: '추가 확인 필요',
};


const MISSING_LABEL = {
  MODEL_NUMBER:
    '제품의 모델번호가 등록되지 않았습니다.',

  BARCODE:
    '제품의 바코드가 등록되지 않았습니다.',

  CERTIFICATION_NUMBER:
    '제품의 인증번호가 등록되지 않았습니다.',

  MANUFACTURING_DATE:
    '제품 라벨의 제조일자를 확인해 주세요.',

  SERIAL_NUMBER:
    '제품의 일련번호를 확인해 주세요.',

  LOT_NUMBER:
    '제품의 제조 로트를 확인해 주세요.',

  ADDITIONAL_SCOPE_CONDITION:
    '공식 공고의 추가 대상 조건을 확인해 주세요.',

  MANUFACTURER_OR_BRAND_CONFIRMATION:
    '제품의 브랜드 또는 제조사를 확인해 주세요.',
};


const ACTION_UI = {
  IMMEDIATE_STOP: {
    status: '즉시 사용 중지',
    button: '리콜 제품 안내',
    fallback: '즉시 사용을 중지해 주세요.',
  },

  REPAIR_OR_COLLECTION: {
    status: '수선 필요',
    button: '리콜 제품 안내',
    fallback:
      '구입처 또는 고객센터를 통해 수거·수선을 신청해 주세요.',
  },

  EXCHANGE_OR_REFUND: {
    status: '교환·환불 필요',
    button: '리콜 제품 안내',
    fallback:
      '판매처에 교환·환불을 문의해 주세요.',
  },

  PRODUCT_CHECK_REQUIRED: {
    status: '추가 확인 필요',
    button: '리콜 제품 안내',
    fallback:
      '모델번호와 제조기간을 확인해 주세요.',
  },

  GENERAL_GUIDANCE: {
    status: '공식 조치 확인 필요',
    button: '리콜 제품 안내',
    fallback:
      '공식 리콜 행동요령을 확인해 주세요.',
  },
};


const GUIDANCE_COPY = {
  IMMEDIATE_STOP: {
    title: '[제품 사용을 멈춰 주세요]',
    intro:
      '등록한 제품이 아래와 같은 이유로 리콜 대상이 되었습니다.',
    action:
      '지금부터 이 제품을 사용하지 마세요. 필요한 조치는 제가 확인해서 진행할게요.',
  },

  REPAIR_OR_COLLECTION: {
    title: '[제품 리콜 안내]',
    intro:
      '등록한 제품이 아래와 같은 이유로 리콜 대상이 되었습니다.',
    action:
      '지금부터 이 제품을 사용하지 마세요. 제가 업체에 수거나 수리를 신청할게요.',
  },

  EXCHANGE_OR_REFUND: {
    title: '[제품 리콜 안내]',
    intro:
      '등록한 제품이 아래와 같은 이유로 리콜 대상이 되었습니다.',
    action:
      '지금부터 이 제품을 사용하지 마세요. 제가 구입한 곳에 교환이나 환불을 신청할게요.',
  },

  PRODUCT_CHECK_REQUIRED: {
    title: '[제품 정보를 확인해 주세요]',
    intro:
      '등록한 제품이 리콜 대상인지 확인하려면 제품 정보가 더 필요합니다.',
    action:
      '제품을 버리지 말고 보관해 주세요. 제가 모델번호와 만든 날짜를 확인할게요.',
  },

  GENERAL_GUIDANCE: {
    title: '[제품 리콜 안내]',
    intro:
      '등록한 제품이 안전 문제로 리콜 대상이 되었습니다.',
    action:
      '지금부터 이 제품을 사용하지 마세요. 제가 필요한 신청을 진행할게요.',
  },
};


function asArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}


function cleanOfficialText(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .split(/\r?\n/)
    .map((line) => (
      line
        .replace(
          /^\s*(?:[-•●○◦ㆍ·ㅇ]|[oO](?=[가-힣]))\s*/,
          '',
        )
        .trim()
    ))
    .filter(Boolean)
    .join('\n');
}

function compactConsumerAction(
  value,
  inquiryTel,
) {
  const text =
    cleanOfficialText(value);

  if (!text) {
    return '';
  }

  const lines =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const result = [];

  if (
    lines.some((line) => (
      /사용.*중지|사용을 중지/.test(line)
    ))
  ) {
    result.push(
      '제품 사용을 즉시 중지해 주세요.',
    );
  }

  const returnLine =
    lines.find((line) => (
      /반납|회수|수거|교환|환불|수선/.test(line)
    ));

  if (returnLine) {
    if (/택배.*반납|택배 반납/.test(returnLine)) {
      result.push(
        '홈페이지 또는 앱의 안내에 따라 택배로 반납해 주세요.',
      );
    } else if (/수거|회수/.test(returnLine)) {
      result.push(
        '판매처나 고객센터에 제품 수거를 신청해 주세요.',
      );
    } else if (/교환|환불/.test(returnLine)) {
      result.push(
        '판매처에 교환 또는 환불을 신청해 주세요.',
      );
    } else if (/수선|수리/.test(returnLine)) {
      result.push(
        '판매처나 고객센터에 수선을 신청해 주세요.',
      );
    } else {
      result.push(returnLine);
    }
  }

  if (result.length === 0) {
    return text;
  }

  return result.join('\n');
}

function formatDate(value) {
  if (!value) {
    return '조회 기록 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '조회 기록 없음';
  }

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('.');
}


function matchedEvidence(product) {
  const fields =
    asArray(product.matchedFields);

  const evidence = [];

  if (
    fields.includes('MODEL_NUMBER')
    && product.modelNumber
  ) {
    evidence.push(
      `모델번호 ${product.modelNumber}`,
    );
  }

  if (
    (
      fields.includes(
        'MANUFACTURER_OR_BRAND',
      )
      || fields.includes('BRAND_NAME')
    )
    && product.brandName
  ) {
    evidence.push(
      `브랜드 ${product.brandName}`,
    );
  }

  if (
    fields.includes('BARCODE')
    && product.barcode
  ) {
    evidence.push(
      `바코드 ${product.barcode}`,
    );
  }

  if (
    fields.includes(
      'CERTIFICATION_NUMBER',
    )
    && product.certificationNumber
  ) {
    evidence.push(
      `인증·신고번호 ${product.certificationNumber}`,
    );
  }

  return evidence;
}


function actionUi(product) {
  return (
    ACTION_UI[
    product.matchedRecallNotice?.actionType
    ]
    || ACTION_UI.GENERAL_GUIDANCE
  );
}


function displayProductName(product) {
  const name = (
    product.matchedRecallNotice?.productName
    || product.productName
    || '제품명 확인 필요'
  );

  return name
    .replace(
      /\s*\(([^)]*)\)/g,
      (
        full,
        content,
      ) => (
        /[A-Za-z]/.test(content)
          && !/[가-힣]/.test(content)
          ? ''
          : full
      ),
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}


function currentUseGuidance(product) {
  if (
    [
      'STOPPED',
      'NOT_IN_USE',
    ].includes(
      product.currentUseStatus,
    )
  ) {
    return (
      '지금 사용하지 않고 있다면 '
      + '그대로 사용하지 말아 주세요.'
    );
  }

  if (
    [
      'DISPOSED',
      'NOT_OWNED',
    ].includes(
      product.currentUseStatus,
    )
  ) {
    return (
      '이미 버렸거나 가지고 있지 않다면 '
      + '저에게 알려 주세요.'
    );
  }

  return '';
}


function seniorFriendlyHazard(value) {
  const text =
    cleanOfficialText(value);

  if (!text) {
    return '';
  }

  if (
    /장식.*걸려.*넘어|걸려.*넘어.*장식/.test(
      text,
    )
  ) {
    return (
      '제품의 장식에 발이 걸려 '
      + '넘어질 수 있습니다.'
    );
  }

  if (/감전/.test(text)) {
    return (
      '전기에 감전되어 '
      + '다칠 수 있습니다.'
    );
  }

  if (
    /화재|불이 날/.test(text)
  ) {
    return (
      '제품에서 불이 날 수 있습니다.'
    );
  }

  if (/질식/.test(text)) {
    return (
      '숨을 쉬기 어려워지는 '
      + '사고가 생길 수 있습니다.'
    );
  }

  return text
    .replace(
      /부상을 입을 수 (?:있음|있습니다)/g,
      '다칠 수 있습니다',
    )
    .replace(
      /상해를 입을 수 (?:있음|있습니다)/g,
      '다칠 수 있습니다',
    )
    .replace(
      /소비자/g,
      '사용하는 사람',
    )
    .replace(
      /악세사리|액세서리/g,
      '장식',
    );
}


function buildGuidanceMessage(product) {
  const productName =
    displayProductName(product);

  const hazard =
    seniorFriendlyHazard(
      product.hazardDescription,
    );

  const action =
    compactRecallAction(product);

  return [
    '[리콜 제품 안내]',
    '',
    `${product.seniorName} 님이 등록한 제품이 리콜 대상에 해당합니다.`,
    '',
    `제품명: ${productName}`,
    hazard
      ? `위험 내용: ${hazard}`
      : '',
    '',
    action,
    '',
    product.inquiryTel
      ? `문의처: ${product.inquiryTel}`
      : '',
  ]
    .filter((line, index, array) => {
      if (line !== '') {
        return true;
      }

      return (
        index > 0
        && index < array.length - 1
        && array[index - 1] !== ''
      );
    })
    .join('\n');
}

function productColorState(product) {
  if (
    product.actionStatus === 'COMPLETED'
    || product.followUpProgressStatus
    === 'COMPLETED'
    || product.finalResult
  ) {
    return 'completed';
  }

  if (
    product.recallDecisionStatus
    === 'REVIEW_REQUIRED'
    || product.matchedRecallNotice?.actionType
    === 'PRODUCT_CHECK_REQUIRED'
  ) {
    return 'review';
  }

  if (
    product.matchedRecallNotice?.actionType
    === 'IMMEDIATE_STOP'
  ) {
    return 'urgent';
  }

  if (
    [
      'REPAIR',
      'COLLECTION',
      'REPAIR_OR_COLLECTION',
      'EXCHANGE',
      'REFUND',
      'EXCHANGE_OR_REFUND',
    ].includes(
      product.matchedRecallNotice?.actionType,
    )
  ) {
    return 'follow-up';
  }

  return 'neutral';
}


function productStatusLabel(
  product,
  confirmed,
  action,
  colorState,
) {
  if (
    product.recallCheckStatus
    === 'FAILED'
  ) {
    return '조회 실패';
  }

  if (
    colorState === 'completed'
  ) {
    return '조치 완료';
  }

  if (
    colorState === 'review'
  ) {
    return '추가 확인 필요';
  }

  return confirmed
    ? action.status
    : (
      RECALL_LABEL[
      product.recallDecisionStatus
      ]
      || '확인 필요'
    );
}


function compactActionMessage(product) {
  const type =
    product.matchedRecallNotice?.actionType;

  if (type === 'IMMEDIATE_STOP') {
    return (
      '안전을 위해 즉시 '
      + '사용을 중지해 주세요.'
    );
  }

  if (
    type === 'REPAIR_OR_COLLECTION'
  ) {
    return (
      '구입처 또는 고객센터에 '
      + '수거·수선을 신청해 주세요.'
    );
  }

  if (
    type === 'EXCHANGE_OR_REFUND'
  ) {
    return (
      '판매처에 교환·환불을 '
      + '문의해 주세요.'
    );
  }

  if (
    type === 'PRODUCT_CHECK_REQUIRED'
  ) {
    return (
      '모델번호와 제조기간을 '
      + '추가로 확인해 주세요.'
    );
  }

  return (
    '공식 리콜 조치 내용을 '
    + '확인해 주세요.'
  );
}

function summarizeOfficialAction(value) {
  if (!value) {
    return '';
  }

  const text =
    cleanOfficialText(value);

  if (
    /택배.*반납|택배 반납/.test(text)
  ) {
    return (
      '공식 안내에 따라 제품을 택배로 반납해 주세요.'
    );
  }

  if (
    /수거|회수/.test(text)
  ) {
    return (
      '판매처나 고객센터에 제품 수거를 신청해 주세요.'
    );
  }

  if (
    /수선|수리/.test(text)
  ) {
    return (
      '판매처나 고객센터에 수선 또는 수리를 신청해 주세요.'
    );
  }

  if (
    /교환.*환불|환불.*교환/.test(text)
  ) {
    return (
      '판매처에 교환 또는 환불을 신청해 주세요.'
    );
  }

  if (/교환/.test(text)) {
    return (
      '판매처에 제품 교환을 신청해 주세요.'
    );
  }

  if (/환불/.test(text)) {
    return (
      '판매처에 환불을 신청해 주세요.'
    );
  }

  if (/폐기/.test(text)) {
    return (
      '공식 안내에 따라 제품을 폐기해 주세요.'
    );
  }

  return (
    '공식 안내에서 후속 조치 방법을 확인해 주세요.'
  );
}

function compactRecallAction(product) {
  const type =
    product.matchedRecallNotice?.actionType;

  const officialAction =
    product.consumerAction;

  switch (type) {
    case 'IMMEDIATE_STOP':
      return (
        '제품 사용을 즉시 중지해 주세요.\n'
        + (
          summarizeOfficialAction(
            officialAction,
          )
          || '공식 안내에서 후속 조치 방법을 확인해 주세요.'
        )
      );

    case 'REPAIR_OR_COLLECTION':
      return (
        '제품 사용을 중지해 주세요.\n'
        + '판매처나 고객센터에 수거 또는 수선을 신청해 주세요.'
      );

    case 'EXCHANGE_OR_REFUND':
      return (
        '제품 사용을 중지해 주세요.\n'
        + '판매처에 교환 또는 환불을 신청해 주세요.'
      );

    case 'PRODUCT_CHECK_REQUIRED':
      return (
        '제품을 사용하지 말고 보관해 주세요.\n'
        + '모델번호와 제조일자를 추가로 확인해 주세요.'
      );

    default:
      return (
        summarizeOfficialAction(
          officialAction,
        )
        || '공식 리콜 조치 내용을 확인해 주세요.'
      );
  }
}

export default function Safety() {
  const [
    params,
    setParams,
  ] = useSearchParams();

  const [
    seniors,
    setSeniors,
  ] = useState([]);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    actions,
    setActions,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    registrationFlowOpen,
    setRegistrationFlowOpen,
  ] = useState(false);

  const [
    showAllProducts,
    setShowAllProducts,
  ] = useState(false);

  const [
    detail,
    setDetail,
  ] = useState(null);

  const [
    guidanceTarget,
    setGuidanceTarget,
  ] = useState(null);

  const [
    guidanceMessage,
    setGuidanceMessage,
  ] = useState('');

  const [
    guidanceChannel,
    setGuidanceChannel,
  ] = useState('APP_PUSH');

  const [
    guidanceSending,
    setGuidanceSending,
  ] = useState(false);

  const [
    guidanceSent,
    setGuidanceSent,
  ] = useState(false);

  const [
    guidanceError,
    setGuidanceError,
  ] = useState('');

  const [
    checkDetail,
    setCheckDetail,
  ] = useState(null);

  const [
    checkOverviewTarget,
    setCheckOverviewTarget,
  ] = useState(null);

  const [
    supportAnswers,
    setSupportAnswers,
  ] = useState([]);

  const [
    supportRequesting,
    setSupportRequesting,
  ] = useState(false);

  const [
    supportRequestError,
    setSupportRequestError,
  ] = useState('');

  const [
    checkRequesting,
    setCheckRequesting,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(emptyForm);

  const [
    registrationMethod,
    setRegistrationMethod,
  ] = useState('MANUAL');

  const [
    labelImage,
    setLabelImage,
  ] = useState(null);

  const [
    analysis,
    setAnalysis,
  ] = useState(null);

  const [
    analyzing,
    setAnalyzing,
  ] = useState(false);

  const [
    registering,
    setRegistering,
  ] = useState(false);


  const selectedId =
    params.get('seniorId')
    || 'ALL';


  const load = useCallback(
    async () => {
      setLoading(true);
      setError('');

      try {
        const seniorResponse =
          await getSeniorsByGuardian();

        const seniorList =
          asArray(
            seniorResponse.data,
          );

        setSeniors(
          seniorList,
        );

        const results =
          await Promise.all(
            seniorList.map(
              async (senior) => {
                const [
                  productResult,
                  actionResult,
                ] = await Promise.all([
                  getProductsBySenior(
                    senior.id,
                  ).catch(
                    () => ({
                      data: [],
                    }),
                  ),

                  getActionsBySenior(
                    senior.id,
                  ).catch(
                    () => ({
                      data: [],
                    }),
                  ),
                ]);

                return {
                  products: asArray(
                    productResult.data,
                  ).map(
                    (item) => ({
                      ...item,

                      seniorId:
                        item.seniorId
                        ?? senior.id,

                      seniorName:
                        item.seniorName
                        ?? senior.name,
                    }),
                  ),

                  actions: asArray(
                    actionResult.data,
                  ).map(
                    (item) => ({
                      ...item,

                      seniorId:
                        item.seniorId
                        ?? senior.id,

                      seniorName:
                        item.seniorName
                        ?? senior.name,
                    }),
                  ),
                };
              },
            ),
          );

        setProducts(
          results.flatMap(
            (item) => item.products,
          ),
        );

        setActions(
          results.flatMap(
            (item) => item.actions,
          ),
        );
      } catch (loadError) {
        setError(
          loadError.response?.data?.message
          || '제품·생활안전 정보를 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );


  useEffect(
    () => {
      load();
    },
    [
      load,
    ],
  );

  useEffect(
    () => {
      setShowAllProducts(false);
    },
    [
      selectedId,
    ],
  );

  const visibleProducts =
    useMemo(
      () => {
        const filteredProducts = (
          selectedId === 'ALL'
            ? products
            : products.filter(
              (product) => (
                String(
                  product.seniorId,
                )
                === String(
                  selectedId,
                )
              ),
            )
        );

        const priorityMap = {
          urgent: 0,
          review: 1,
          'follow-up': 2,
          neutral: 3,
          completed: 4,
        };

        return [
          ...filteredProducts,
        ].sort(
          (
            first,
            second,
          ) => {
            const firstState =
              productColorState(first);

            const secondState =
              productColorState(second);

            const priorityDifference = (
              (
                priorityMap[
                firstState
                ]
                ?? 99
              )
              - (
                priorityMap[
                secondState
                ]
                ?? 99
              )
            );

            if (
              priorityDifference !== 0
            ) {
              return priorityDifference;
            }

            const firstDate =
              new Date(
                first.updatedAt
                ?? first.createdAt
                ?? 0,
              ).getTime();

            const secondDate =
              new Date(
                second.updatedAt
                ?? second.createdAt
                ?? 0,
              ).getTime();

            return (
              secondDate
              - firstDate
            );
          },
        );
      },
      [
        products,
        selectedId,
      ],
    );

  const displayedProducts =
    useMemo(
      () => (
        showAllProducts
          ? visibleProducts
          : visibleProducts.slice(0, 3)
      ),
      [
        showAllProducts,
        visibleProducts,
      ],
    );


  const visibleActions =
    useMemo(
      () => (
        selectedId === 'ALL'
          ? actions
          : actions.filter(
            (action) => (
              String(
                action.seniorId,
              )
              === String(
                selectedId,
              )
            ),
          )
      ),
      [
        actions,
        selectedId,
      ],
    );


  const latestChecks =
    useMemo(
      () => (
        Object.fromEntries(
          CHECKS.map(
            (check) => {
              const records =
                visibleActions
                  .filter(
                    (action) => (
                      action.actionType
                      === check.type
                    ),
                  )
                  .sort(
                    (
                      first,
                      second,
                    ) => (
                      new Date(
                        second.updatedAt
                        ?? second.createdAt,
                      )
                      - new Date(
                        first.updatedAt
                        ?? first.createdAt,
                      )
                    ),
                  );

              return [
                check.type,
                records[0] ?? null,
              ];
            },
          ),
        )
      ),
      [
        visibleActions,
      ],
    );


  const allCheckOverview =
    useMemo(
      () => (
        Object.fromEntries(
          CHECKS.map(
            (check) => {
              const rows =
                seniors.map(
                  (senior) => {
                    const records =
                      actions
                        .filter(
                          (action) => (
                            String(
                              action.seniorId,
                            )
                            === String(
                              senior.id,
                            )
                            && action.actionType
                            === check.type
                          ),
                        )
                        .sort(
                          (
                            first,
                            second,
                          ) => (
                            new Date(
                              second.updatedAt
                              ?? second.createdAt
                              ?? 0,
                            )
                            - new Date(
                              first.updatedAt
                              ?? first.createdAt
                              ?? 0,
                            )
                          ),
                        );

                    return {
                      senior,
                      record:
                        records[0]
                        ?? null,
                    };
                  },
                );

              return [
                check.type,
                rows,
              ];
            },
          ),
        )
      ),
      [
        actions,
        seniors,
      ],
    );

  const selectedSenior =
    useMemo(
      () => (
        seniors.find(
          (senior) => (
            String(
              senior.id,
            )
            === String(
              selectedId,
            )
          ),
        )
        ?? null
      ),
      [
        seniors,
        selectedId,
      ],
    );

  const recalledCount =
    visibleProducts.filter(
      (product) => (
        product.recallDecisionStatus
        === 'RECALL_CONFIRMED'
        || (
          !product.recallDecisionStatus
          && product.recallStatus
          === 'RECALLED'
        )
      ),
    ).length;


  const reviewCount =
    visibleProducts.filter(
      (product) => (
        product.recallDecisionStatus
        === 'REVIEW_REQUIRED'
      ),
    ).length;


  const totalSupportCount =
    selectedId === 'ALL'
      ? seniors.length
      * CHECKS.length
      : CHECKS.length;


  const supportProgressCount =
    selectedId === 'ALL'
      ? CHECKS.reduce(
        (
          total,
          check,
        ) => (
          total
          + (
            allCheckOverview[
            check.type
            ]
            ?? []
          ).filter(
            (item) => (
              item.record?.status
              === 'IN_PROGRESS'
            ),
          ).length
        ),
        0,
      )
      : CHECKS.filter(
        (check) => (
          latestChecks[
            check.type
          ]?.status
          === 'IN_PROGRESS'
        ),
      ).length;


  const supportCompletedCount =
    selectedId === 'ALL'
      ? CHECKS.reduce(
        (
          total,
          check,
        ) => (
          total
          + (
            allCheckOverview[
            check.type
            ]
            ?? []
          ).filter(
            (item) => (
              [
                'COMPLETED',
                'CANCELLED',
              ].includes(
                item.record?.status,
              )
            ),
          ).length
        ),
        0,
      )
      : CHECKS.filter(
        (check) => (
          [
            'COMPLETED',
            'CANCELLED',
          ].includes(
            latestChecks[
              check.type
            ]?.status,
          )
        ),
      ).length;


  const supportNeedCount =
    Math.max(
      totalSupportCount
      - supportProgressCount
      - supportCompletedCount,
      0,
    );

  async function submitProduct(
    event,
  ) {
    event.preventDefault();

    if (registering) {
      return;
    }

    setRegistering(true);
    setError('');

    try {
      const response =
        await registerProduct({
          seniorId:
            Number(
              form.seniorId,
            ),

          productName:
            form.productName
              .trim()
            || null,

          brandName:
            form.brandName
              .trim()
            || null,

          manufacturer:
            form.manufacturer
              .trim(),

          modelNumber:
            form.modelNumber
              .trim(),

          barcode:
            form.barcode
              .trim()
            || null,

          certificationNumber:
            form.certificationNumber
              .trim()
            || null,

          serialNumber:
            form.serialNumber
              .trim()
            || null,

          recallStatus:
            'UNKNOWN',

          currentUseStatus:
            form.currentUseStatus,

          registrationSource:
            'GUARDIAN_WEB',
        });

      if (
        analysis?.analysisId
      ) {
        await confirmProductLabelAnalysis(
          analysis.analysisId,

          {
            productName:
              form.productName,

            brandName:
              form.brandName,

            manufacturer:
              form.manufacturer,

            modelNumber:
              form.modelNumber,

            barcode:
              form.barcode,

            certificationNumber:
              form.certificationNumber,

            serialNumber:
              form.serialNumber,

            importer:
              analysis?.fields
                ?.importer
                ?.value
              || '',

            manufacturingDate:
              form.manufacturingDate,
          },

          response.data?.id,
        ).catch(
          () => { },
        );
      }

      setRegistrationFlowOpen(
        false,
      );

      setForm(
        emptyForm,
      );

      await load();
    } catch (registerError) {
      setError(
        registerError
          .response
          ?.data
          ?.message
        || (
          '제품 등록 권한을 확인할 수 없습니다. '
          + '다시 로그인해 주세요.'
        ),
      );
    } finally {
      setRegistering(false);
    }
  }


  async function analyzeLabel() {
    if (
      !form.seniorId
      || !labelImage
    ) {
      setError(
        '대상 님과 제품 라벨 사진을 선택해 주세요.',
      );

      return;
    }

    setAnalyzing(true);
    setError('');

    try {
      const response =
        await analyzeProductLabel({
          image:
            labelImage,

          seniorId:
            form.seniorId,
        });

      const result =
        response.data;

      setAnalysis(
        result,
      );

      setForm(
        (current) => ({
          ...current,

          productName:
            result.fields
              ?.productName
              ?.value
            || current.productName,

          brandName:
            result.fields
              ?.brandName
              ?.value
            || current.brandName,

          manufacturer:
            result.fields
              ?.manufacturer
              ?.value
            || current.manufacturer,

          modelNumber:
            result.fields
              ?.modelNumber
              ?.value
            || current.modelNumber,

          barcode:
            result.fields
              ?.barcode
              ?.value
            || '',

          certificationNumber:
            result.fields
              ?.certificationNumber
              ?.value
            || '',

          serialNumber:
            result.fields
              ?.serialNumber
              ?.value
            || '',

          manufacturingDate:
            result.fields
              ?.manufacturingDate
              ?.value
            || '',
        }),
      );
    } catch (analysisError) {
      setError(
        analysisError
          .response
          ?.data
          ?.detail
        || (
          '모델명이나 인증번호가 보이도록 '
          + '라벨을 더 가까이 촬영해 주세요.'
        ),
      );
    } finally {
      setAnalyzing(false);
    }
  }


  function openRegistration() {
    setError('');

    setForm({
      ...emptyForm,

      seniorId:
        selectedId === 'ALL'
          ? seniors[0]?.id
          || ''
          : selectedId,
    });

    setRegistrationMethod(
      productDocumentAiEnabled
        ? 'PHOTO'
        : 'MANUAL',
    );

    setLabelImage(null);
    setAnalysis(null);
    setRegistrationFlowOpen(true);
  }


  function openCheckDetail(
    check,
    record,
  ) {
    if (selectedId === 'ALL') {
      setCheckOverviewTarget(
        check,
      );

      return;
    }

    setCheckDetail({
      check,
      record,
    });

    setSupportAnswers([]);
    setSupportRequestError('');
    setError('');
  }

  function toggleSupportAnswer(
    answer,
  ) {
    setSupportAnswers(
      (current) => (
        current.includes(answer)
          ? current.filter(
            (item) => item !== answer,
          )
          : [
            ...current,
            answer,
          ]
      ),
    );
  }

  async function requestSafetySupport() {
    if (
      !checkDetail
      || selectedId === 'ALL'
      || supportRequesting
    ) {
      return;
    }

    if (
      checkDetail.record?.status
      === 'IN_PROGRESS'
    ) {
      return;
    }

    setSupportRequesting(true);
    setSupportRequestError('');
    setError('');

    const selectedSigns =
      supportAnswers.length > 0
        ? supportAnswers
          .map(
            (answer) => `- ${answer}`,
          )
          .join('\n')
        : '- 위험 징후를 정확히 확인하기 어려움';

    const note = [
      '[생활안전 지원 확인 요청]',
      `분야: ${checkDetail.check.label}`,
      '',
      '확인된 위험 징후',
      selectedSigns,
      '',
      '요청 내용',
      (
        '담당 복지사가 지원 대상 여부와 '
        + '전문기관 연계 필요성을 확인해 주세요.'
      ),
    ].join('\n');

    try {
      await createAction({
        seniorId:
          Number(
            selectedId,
          ),

        actionType:
          checkDetail.check.type,

        actionSubject:
          'GUARDIAN',

        status:
          'IN_PROGRESS',

        note,
      });

      setCheckDetail(null);
      setSupportAnswers([]);

      await load();
    } catch (requestError) {
      const message =
        requestError
          .response
          ?.data
          ?.message
        || '생활안전 지원 확인을 요청하지 못했습니다.';

      setSupportRequestError(
        message,
      );
    } finally {
      setSupportRequesting(false);
    }
  }

  async function requestCheckToWorker() {
    if (
      !checkDetail
      || selectedId === 'ALL'
      || checkRequesting
    ) {
      return;
    }

    if (
      checkDetail.record?.status
      === 'IN_PROGRESS'
    ) {
      return;
    }

    setCheckRequesting(true);
    setError('');

    try {
      await createAction({
        seniorId:
          Number(
            selectedId,
          ),

        actionType:
          checkDetail.check.type,

        actionSubject:
          'GUARDIAN',

        status:
          'IN_PROGRESS',

        note:
          (
            '[복지사 점검 요청] '
            + `${checkDetail.check.label} 확인을 요청합니다.`
          ),
      });

      setCheckDetail(null);

      await load();
    } catch (requestError) {
      setError(
        requestError
          .response
          ?.data
          ?.message
        || '복지사에게 점검을 요청하지 못했습니다.',
      );
    } finally {
      setCheckRequesting(false);
    }
  }

  function openGuidance(
    product,
  ) {
    setDetail(null);

    setGuidanceTarget(
      product,
    );

    setGuidanceMessage(
      buildGuidanceMessage(
        product,
      ),
    );

    setGuidanceChannel(
      'APP_PUSH',
    );

    setGuidanceSending(false);
    setGuidanceSent(false);
    setGuidanceError('');
  }


  function closeGuidance() {
    if (guidanceSending) {
      return;
    }

    setGuidanceTarget(null);
    setGuidanceMessage('');
    setGuidanceChannel(
      'APP_PUSH',
    );
    setGuidanceSent(false);
    setGuidanceError('');
  }


  async function sendGuidance() {
    if (
      !guidanceTarget
      || !guidanceMessage.trim()
      || guidanceSending
      || guidanceChannel
      !== 'APP_PUSH'
    ) {
      return;
    }

    setGuidanceSending(true);
    setGuidanceError('');

    try {
      const response =
        await sendRecallNotification(
          guidanceTarget.id,
          {
            message:
              guidanceMessage.trim(),
          },
        );

      if (
        (
          response.data
            ?.successCount
          ?? 0
        ) < 1
      ) {
        setGuidanceError(
          '등록된 님 기기의 알림 토큰이 없습니다. '
          + '님 앱을 한 번 실행한 뒤 다시 보내 주세요.',
        );

        return;
      }

      setGuidanceSent(true);
    } catch (sendError) {
      const status =
        sendError.response?.status;

      const responseData =
        sendError.response?.data;

      console.error(
        '[리콜 앱 알림 발송 실패]',
        {
          status,
          responseData,
          productId:
            guidanceTarget?.id,
          seniorId:
            guidanceTarget?.seniorId,
        },
      );

      setGuidanceError(
        responseData?.message
        || responseData?.detail
        || (
          status === 401
            ? (
              '로그인 정보가 만료되었습니다. '
              + '다시 로그인해 주세요.'
            )
            : status === 403
              ? (
                '현재 보호자 계정과 대상 어르신의 '
                + '연결 관계를 확인하지 못했습니다.'
              )
              : (
                '리콜 안내를 보내지 못했습니다.'
              )
        ),
      );
    } finally {
      setGuidanceSending(false);
    }
  }


  return (
    <GuardianLayout activeMenu="safety">
      <main className="guardian-safety-page">
        <ProductRegistrationModal
          open={
            registrationFlowOpen
          }
          seniors={
            seniors
          }
          form={
            form
          }
          setForm={
            setForm
          }
          method={
            registrationMethod
          }
          setMethod={
            setRegistrationMethod
          }
          image={
            labelImage
          }
          setImage={
            setLabelImage
          }
          analysis={
            analysis
          }
          setAnalysis={
            setAnalysis
          }
          analyzing={
            analyzing
          }
          registering={
            registering
          }
          onAnalyze={
            analyzeLabel
          }
          onSubmit={
            submitProduct
          }
          onClose={() => {
            if (!registering) {
              setRegistrationFlowOpen(
                false,
              );
            }
          }}
          photoEnabled={
            productDocumentAiEnabled
          }
          registrationError={
            error
          }
        />


        <header className="guardian-safety-page__header">
          <div>
            <h1>제품·생활안전</h1>

            <p>
              등록 제품의 리콜 상태와 생활안전 점검 결과를 관리합니다.
            </p>
          </div>

          <div className="guardian-safety-page__header-seniors">
            {[
              {
                id: 'ALL',
                name: '전체',
              },
              ...seniors,
            ].map((senior) => (
              <button
                type="button"
                key={senior.id}
                className={
                  String(senior.id) === selectedId
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  setParams(
                    senior.id === 'ALL'
                      ? {}
                      : {
                        seniorId: senior.id,
                      },
                  );
                }}
              >
                {senior.name}
              </button>
            ))}
          </div>
        </header>

        <section className="guardian-safety-summary">
          <div>
            <span>
              등록 제품
            </span>

            <strong>
              {visibleProducts.length}
              개
            </strong>
          </div>

          <div
            className={
              recalledCount > 0
                ? 'danger'
                : ''
            }
          >
            <span>
              조치 필요
            </span>

            <strong>
              {recalledCount}
              개
            </strong>
          </div>

          <div
            className={
              reviewCount > 0
                ? 'warning'
                : ''
            }
          >
            <span>
              추가 확인
            </span>

            <strong>
              {reviewCount}
              개
            </strong>
          </div>
        </section>


        {error && (
          <p className="guardian-safety-page__error">
            {error}
          </p>
        )}


        <section className="guardian-safety-section guardian-products-section">
          <div className="guardian-safety-section__heading">
            <div>
              <h2>
                조치가 필요한 제품
              </h2>

              <p>
                위험도가 높은 제품부터 필요한 조치를 확인하세요.
              </p>
            </div>

            <button
              type="button"
              className="guardian-product-register-text"
              onClick={
                openRegistration
              }
            >
              + 제품 등록
            </button>
          </div>

          {loading ? (
            <div className="guardian-safety-empty">
              불러오는 중입니다.
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="guardian-safety-empty">
              등록된 제품이 없습니다.
            </div>
          ) : (
            <>
              <div className="guardian-product-grid">
                {displayedProducts.map(
                  (product) => {
                    const confirmed = (
                      product.recallDecisionStatus
                      === 'RECALL_CONFIRMED'
                      || (
                        !product.recallDecisionStatus
                        && product.recallStatus
                        === 'RECALLED'
                      )
                    );

                    const action =
                      actionUi(product);

                    const colorState =
                      productColorState(product);

                    const showGuidance = (
                      confirmed
                      || colorState === 'review'
                    );

                    return (
                      <article
                        className={[
                          'guardian-product-card',
                          'compact',
                          `state-${colorState}`,
                        ].join(' ')}
                        key={
                          product.id
                        }
                        onClick={() => {
                          setDetail(
                            product,
                          );
                        }}
                      >
                        <div className="guardian-product-card__top">
                          <div>
                            <h3>
                              {displayProductName(
                                product,
                              )}
                            </h3>

                            <p>
                              {product.seniorName}
                              {' '}
                              님
                            </p>
                          </div>

                          <b>
                            {productStatusLabel(
                              product,
                              confirmed,
                              action,
                              colorState,
                            )}
                          </b>
                        </div>

                        <div className="guardian-product-card__compact-meta">
                          <span>
                            {product.modelNumber
                              || '모델번호 확인 필요'}
                          </span>

                          <strong>
                            {USE_LABEL[
                              product.currentUseStatus
                            ] || '확인 필요'}
                          </strong>
                        </div>

                        {showGuidance && (
                          <p className="guardian-product-card__guidance">
                            {compactActionMessage(
                              product,
                            )}
                          </p>
                        )}
                      </article>
                    );
                  },
                )}
              </div>

              {visibleProducts.length > 3 && (
                <button
                  type="button"
                  className="guardian-product-more-button"
                  onClick={() => {
                    setShowAllProducts(
                      (current) => !current,
                    );
                  }}
                >
                  {showAllProducts
                    ? '접기'
                    : '전체 보기'}
                </button>
              )}
            </>
          )}
        </section>

        <section className="guardian-safety-section guardian-check-area">
          <div className="guardian-safety-section__heading guardian-check-heading">
            <div>
              <h2>
                생활안전 지원
              </h2>

              <p>
                {selectedId === 'ALL'
                  ? (
                    '어르신별 안전 위험과 공공 점검·지원 서비스 진행 상태를 확인하세요.'
                  )
                  : (
                    `${selectedSenior?.name || ''} 님의 안전 위험과 지원 요청 진행 상태를 확인하세요.`
                  )}
              </p>
            </div>

            <div className="guardian-check-summary">
              <span>
                지원 확인
                {' '}
                {supportNeedCount}
                건
              </span>

              <span>
                요청 진행
                {' '}
                {supportProgressCount}
                건
              </span>

              <span>
                처리 완료
                {' '}
                {supportCompletedCount}
                건
              </span>
            </div>
          </div>

          <div className="guardian-check-grid">
            {CHECKS.map(
              (check) => {
                const record =
                  latestChecks[
                  check.type
                  ];

                const overviewRows =
                  allCheckOverview[
                  check.type
                  ]
                  ?? [];

                const progressPeopleCount =
                  overviewRows.filter(
                    (item) => (
                      item.record?.status
                      === 'IN_PROGRESS'
                    ),
                  ).length;

                const completedPeopleCount =
                  overviewRows.filter(
                    (item) => (
                      [
                        'COMPLETED',
                        'CANCELLED',
                      ].includes(
                        item.record?.status,
                      )
                    ),
                  ).length;

                const supportNeedPeopleCount =
                  Math.max(
                    overviewRows.length
                    - progressPeopleCount
                    - completedPeopleCount,
                    0,
                  );

                let statusLabel;
                let statusDescription;
                let statusClass;

                if (selectedId === 'ALL') {
                  if (progressPeopleCount > 0) {
                    statusLabel =
                      `요청 진행 ${progressPeopleCount}명`;

                    statusDescription =
                      `지원 확인 ${supportNeedPeopleCount}명`;

                    statusClass =
                      'requested';
                  } else if (
                    supportNeedPeopleCount > 0
                  ) {
                    statusLabel =
                      `지원 확인 ${supportNeedPeopleCount}명`;

                    statusDescription =
                      '복지사 요청 가능';

                    statusClass =
                      'unchecked';
                  } else {
                    statusLabel =
                      '전체 처리 완료';

                    statusDescription =
                      `처리 완료 ${completedPeopleCount}명`;

                    statusClass =
                      'completed';
                  }
                } else if (!record) {
                  statusLabel =
                    '지원 여부 확인 필요';

                  statusDescription =
                    '복지사 요청 가능';

                  statusClass =
                    'unchecked';
                } else if (
                  record.status
                  === 'IN_PROGRESS'
                ) {
                  statusLabel =
                    '복지사 확인 요청';

                  statusDescription =
                    '요청 진행 중';

                  statusClass =
                    'requested';
                } else if (
                  [
                    'COMPLETED',
                    'CANCELLED',
                  ].includes(
                    record.status,
                  )
                ) {
                  statusLabel =
                    '처리 완료';

                  statusDescription =
                    formatDate(
                      record.updatedAt
                      || record.createdAt,
                    );

                  statusClass =
                    'completed';
                } else {
                  statusLabel =
                    '지원 확인 필요';

                  statusDescription =
                    '복지사 확인 필요';

                  statusClass =
                    'danger';
                }

                return (
                  <button
                    type="button"
                    key={check.type}
                    className={[
                      'guardian-check-card',
                      `status-${statusClass}`,
                    ].join(' ')}
                    onClick={() => {
                      openCheckDetail(
                        check,
                        record,
                      );
                    }}
                  >
                    <div className="guardian-check-card__header">
                      <span
                        className="guardian-check-card__dot"
                        aria-hidden="true"
                      />

                      <strong>
                        {check.label}
                      </strong>
                    </div>

                    <div className="guardian-check-card__status">
                      <b>
                        {statusLabel}
                      </b>

                      <span>
                        {statusDescription}
                      </span>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </section>


        {detail && (() => {
          const evidence =
            matchedEvidence(detail);

          const missing =
            asArray(detail.missingFields)
              .map(
                (field) => (
                  MISSING_LABEL[field]
                ),
              )
              .filter(Boolean);

          const confirmed = (
            detail.recallDecisionStatus
            === 'RECALL_CONFIRMED'
          );

          const action =
            actionUi(detail);

          const colorState =
            productColorState(detail);

          return (
            <div
              className="guardian-safety-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target
                  === event.currentTarget
                ) {
                  setDetail(null);
                }
              }}
            >
              <section
                className={[
                  'guardian-safety-modal',
                  'recall-detail-modal',
                  'recall-detail-modal--clean',
                  `state-${colorState}`,
                ].join(' ')}
              >
                <header className="recall-detail-header">
                  <div className="recall-detail-heading">
                    <h2>
                      {displayProductName(detail)}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="recall-detail-close"
                    aria-label="상세 정보 닫기"
                    onClick={() => {
                      setDetail(null);
                    }}
                  >
                    ×
                  </button>
                </header>

                <div className="recall-detail-summary">
                  <span>
                    <b>
                      {detail.seniorName} 님
                    </b>
                  </span>

                  <span>
                    모델번호
                    {' '}
                    <b>
                      {detail.modelNumber
                        || '확인 필요'}
                    </b>
                  </span>

                  <span>
                    사용 상태
                    {' '}
                    <b>
                      {USE_LABEL[
                        detail.currentUseStatus
                      ] || '확인 필요'}
                    </b>
                  </span>
                </div>

                {evidence.length > 0 && (
                  <section className="recall-match-summary">
                    <strong>
                      공식 공고 일치
                    </strong>

                    <div>
                      {evidence.map((item) => (
                        <span key={item}>
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {missing.length > 0 && (
                  <section className="recall-missing-summary">
                    <strong>
                      추가 확인이 필요합니다.
                    </strong>

                    <ul>
                      {missing.map((item) => (
                        <li key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="recall-primary-action">
                  <div className="recall-primary-action__heading">
                    <strong>
                      지금 해야 할 조치
                    </strong>
                  </div>

                  <p>
                    {compactRecallAction(detail)}
                  </p>

                  {detail.inquiryTel && (
                    <span className="recall-primary-action__contact">
                      문의처
                      {' '}
                      <b>
                        {detail.inquiryTel}
                      </b>
                    </span>
                  )}
                </section>

                {detail
                  .matchedRecallNotice
                  ?.imageUrls
                  ?.length > 0 && (
                    <section className="recall-photo-section">
                      <div className="recall-section-heading">
                        <strong>
                          공식 제품 사진
                        </strong>

                        <span>
                          제품 확인용
                        </span>
                      </div>

                      <div className="recall-images">
                        {detail
                          .matchedRecallNotice
                          .imageUrls
                          .map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt="공식 리콜 제품"
                            />
                          ))}
                      </div>
                    </section>
                  )}

                <section className="recall-description recall-description--clean">
                  <div>
                    <span className="recall-description__label">
                      제품 결함
                    </span>

                    <p>
                      {cleanOfficialText(
                        detail.defectDescription,
                      )
                        || '공식 공고에서 확인해 주세요.'}
                    </p>
                  </div>

                  <div>
                    <span className="recall-description__label">
                      위해 정보
                    </span>

                    <p>
                      {cleanOfficialText(
                        detail.hazardDescription,
                      )
                        || '공식 공고에서 확인해 주세요.'}
                    </p>
                  </div>
                </section>

                <dl className="recall-meta-list recall-meta-list--clean">
                  <div>
                    <dt>
                      공표일
                    </dt>

                    <dd>
                      {formatDate(
                        detail.publishDate,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      최근 리콜 조회
                    </dt>

                    <dd>
                      {formatDate(
                        detail.lastSuccessfulCheckedAt
                        || detail.lastCheckedAt,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      공식 출처
                    </dt>

                    <dd>
                      {detail.sourceUrl ? (
                        <a
                          href={detail.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          제품안전정보센터
                        </a>
                      ) : (
                        '-'
                      )}
                    </dd>
                  </div>
                </dl>

                {detail.stopGuidanceCompleted && (
                  <div className="recall-completion-notice">
                    <strong>
                      사용 중지 확인 완료
                    </strong>

                    <span>
                      {formatDate(
                        detail.stopGuidanceCompletedAt,
                      )}

                      {detail.stopGuidanceTarget && (
                        <>
                          {' · '}
                          보호자
                          {' '}
                          {detail.stopGuidanceTarget}
                        </>
                      )}
                    </span>
                  </div>
                )}

                {confirmed && (
                  <div className="recall-detail-footer">
                    <button
                      type="button"
                      className="recall-guidance-button"
                      onClick={() => {
                        openGuidance(detail);
                      }}
                    >
                      {action.button}
                    </button>
                  </div>
                )}
              </section>
            </div>
          );
        })()}

        {guidanceTarget && (
          <div
            className="guardian-safety-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                closeGuidance();
              }
            }}
          >
            <section
              className={[
                'guardian-safety-modal',
                'guidance-preview-modal',
              ].join(' ')}
            >
              <header className="guidance-preview-header">
                <h2>
                  {displayProductName(
                    guidanceTarget,
                  )}
                </h2>

                <button
                  type="button"
                  disabled={guidanceSending}
                  onClick={closeGuidance}
                  aria-label="리콜 안내 닫기"
                >
                  ×
                </button>
              </header>

              {guidanceSent ? (
                <section className="guidance-send-result">
                  <strong>
                    앱 알림을 보냈습니다.
                  </strong>

                  <p>
                    {guidanceTarget.seniorName}
                    {' '}
                    님의 앱으로 리콜 안내를 전송했습니다.
                  </p>

                  <button
                    type="button"
                    className="submit"
                    onClick={closeGuidance}
                  >
                    확인
                  </button>
                </section>
              ) : (
                <>
                  <p className="guidance-recipient">
                    안내 대상
                    {' · '}
                    {guidanceTarget.seniorName}
                    {' '}
                    님
                  </p>

                  <fieldset className="guidance-channel-picker">
                    <legend>
                      발송 방법
                    </legend>

                    <button
                      type="button"
                      className={[
                        'guidance-channel-option',
                        guidanceChannel === 'APP_PUSH'
                          ? 'selected'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setGuidanceChannel(
                          'APP_PUSH',
                        );
                      }}
                      disabled={guidanceSending}
                      aria-pressed={
                        guidanceChannel === 'APP_PUSH'
                      }
                    >
                      <span
                        className="guidance-channel-radio"
                        aria-hidden="true"
                      />

                      <span className="guidance-channel-copy">
                        <strong>
                          앱 알림
                        </strong>

                        <small>
                          어르신 앱으로 전송
                        </small>
                      </span>

                      <em>
                        연동됨
                      </em>
                    </button>

                    <button
                      type="button"
                      className={[
                        'guidance-channel-option',
                        'unavailable',
                      ].join(' ')}
                      disabled
                    >
                      <span
                        className="guidance-channel-radio"
                        aria-hidden="true"
                      />

                      <span className="guidance-channel-copy">
                        <strong>
                          카카오 알림톡
                        </strong>

                        <small>
                          카카오톡으로 전송
                        </small>
                      </span>

                      <em>
                        연동 준비 중
                      </em>
                    </button>
                  </fieldset>

                  <label className="guidance-editor">
                    안내 메시지

                    <textarea
                      value={guidanceMessage}
                      onChange={(event) => {
                        setGuidanceMessage(
                          event.target.value,
                        );
                      }}
                      disabled={guidanceSending}
                    />
                  </label>

                  {guidanceError && (
                    <p className="guidance-send-error">
                      {guidanceError}
                    </p>
                  )}

                  <div className="guidance-modal-actions">
                    <button
                      type="button"
                      onClick={closeGuidance}
                      disabled={guidanceSending}
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      className="submit"
                      onClick={sendGuidance}
                      disabled={
                        guidanceSending
                        || !guidanceMessage.trim()
                      }
                    >
                      {guidanceSending
                        ? '보내는 중...'
                        : '앱 알림 보내기'}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {checkOverviewTarget && (
          <div
            className="guardian-safety-modal-backdrop"
            onMouseDown={
              (event) => {
                if (
                  event.target
                  === event.currentTarget
                ) {
                  setCheckOverviewTarget(
                    null,
                  );
                }
              }
            }
          >
            <section className="guardian-safety-modal guardian-check-overview-modal">
              <header>
                <div>
                  <h2>
                    {checkOverviewTarget.label}
                    {' '}
                    점검 현황
                  </h2>

                  <p>
                    점검할 어르신을 선택해 주세요.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCheckOverviewTarget(
                      null,
                    );
                  }}
                >
                  ×
                </button>
              </header>

              <div className="guardian-check-overview-list">
                {(
                  allCheckOverview[
                  checkOverviewTarget.type
                  ]
                  ?? []
                ).map(
                  ({
                    senior,
                    record,
                  }) => {
                    const completed =
                      record?.status
                      === 'COMPLETED';

                    return (
                      <button
                        type="button"
                        key={
                          senior.id
                        }
                        onClick={() => {
                          setParams({
                            seniorId:
                              senior.id,
                          });

                          setCheckOverviewTarget(
                            null,
                          );
                        }}
                      >
                        <div>
                          <strong>
                            {senior.name}
                            {' '}
                            님
                          </strong>

                          <span>
                            {record
                              ? formatDate(
                                record.updatedAt
                                || record.createdAt,
                              )
                              : '점검 기록 없음'}
                          </span>
                        </div>

                        <b
                          className={
                            completed
                              ? 'completed'
                              : 'required'
                          }
                        >
                          {record
                            ? (
                              CHECK_STATUS[
                              record.status
                              ]
                              || '점검 필요'
                            )
                            : '미점검'}
                        </b>
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        )}

        {checkDetail && (
          <div
            className="guardian-safety-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target
                === event.currentTarget
                && !supportRequesting
              ) {
                setCheckDetail(null);
              }
            }}
          >
            <section className="guardian-safety-modal guardian-support-modal">
              <header className="guardian-support-modal__header">
                <div className="guardian-support-modal__title-row">
                  <h2>
                    {checkDetail.check.label}
                  </h2>

                  <span>
                    {selectedSenior?.name}
                    {' '}
                    님
                  </span>
                </div>

                <button
                  type="button"
                  disabled={supportRequesting}
                  aria-label="생활안전 지원 닫기"
                  onClick={() => {
                    setCheckDetail(null);
                  }}
                >
                  ×
                </button>
              </header>

              <section className="guardian-support-status">
                {!checkDetail.record ? (
                  <>
                    <strong>
                      지원 여부 확인 필요
                    </strong>

                    <p>
                      위험 징후를 선택하고 담당 복지사에게
                      지원 확인을 요청할 수 있습니다.
                    </p>
                  </>
                ) : checkDetail.record.status
                  === 'IN_PROGRESS' ? (
                  <>
                    <strong className="requested">
                      복지사 확인 요청 중
                    </strong>

                    <p>
                      담당 복지사가 지원 대상 여부와
                      기관 연계 필요성을 확인하고 있습니다.
                    </p>
                  </>
                ) : (
                  <>
                    <strong className="completed">
                      처리 완료
                    </strong>

                    <p>
                      최근 처리일
                      {' '}
                      {formatDate(
                        checkDetail.record.updatedAt
                        || checkDetail.record.createdAt,
                      )}
                    </p>
                  </>
                )}
              </section>

              <section className="guardian-support-question">
                <div className="guardian-support-question__heading">
                  <div>
                    <strong>
                      해당하는 내용이 있나요?
                    </strong>

                    <p>
                      전문적인 안전 판정이 아니라
                      눈에 보이는 징후나 불편사항만 선택해 주세요.
                    </p>
                  </div>

                  <span>
                    복수 선택 가능
                  </span>
                </div>

                <div className="guardian-support-question__list">
                  {checkDetail.check.questions.map(
                    (question) => {
                      const selected =
                        supportAnswers.includes(
                          question,
                        );

                      return (
                        <button
                          type="button"
                          key={question}
                          className={
                            selected
                              ? 'selected'
                              : ''
                          }
                          onClick={() => {
                            toggleSupportAnswer(
                              question,
                            );
                          }}
                          disabled={
                            supportRequesting
                            || checkDetail.record?.status
                            === 'IN_PROGRESS'
                          }
                        >
                          <span
                            className="guardian-support-checkbox"
                            aria-hidden="true"
                          >
                            {selected
                              ? '✓'
                              : ''}
                          </span>

                          <span>
                            {question}
                          </span>
                        </button>
                      );
                    },
                  )}

                  <button
                    type="button"
                    className={
                      supportAnswers.includes(
                        '잘 모르겠으며 현장 확인이 필요합니다.',
                      )
                        ? 'selected'
                        : ''
                    }
                    onClick={() => {
                      toggleSupportAnswer(
                        '잘 모르겠으며 현장 확인이 필요합니다.',
                      );
                    }}
                    disabled={
                      supportRequesting
                      || checkDetail.record?.status
                      === 'IN_PROGRESS'
                    }
                  >
                    <span
                      className="guardian-support-checkbox"
                      aria-hidden="true"
                    >
                      {supportAnswers.includes(
                        '잘 모르겠으며 현장 확인이 필요합니다.',
                      )
                        ? '✓'
                        : ''}
                    </span>

                    <span>
                      잘 모르겠으며 현장 확인이 필요합니다.
                    </span>
                  </button>
                </div>
              </section>

              <section className="guardian-support-program">
                <strong>
                  {checkDetail.check.supportTitle}
                </strong>

                <p>
                  {checkDetail.check.supportDescription}
                </p>

                <small>
                  지역, 예산과 대상 조건에 따라 지원 여부가 달라질 수 있습니다.
                </small>
              </section>

              {supportRequestError && (
                <p className="guardian-support-error">
                  {supportRequestError}
                </p>
              )}

              <div className="guardian-support-modal__actions">
                <button
                  type="button"
                  onClick={() => {
                    setCheckDetail(null);
                  }}
                  disabled={supportRequesting}
                >
                  닫기
                </button>

                <button
                  type="button"
                  className="submit"
                  onClick={requestSafetySupport}
                  disabled={
                    supportRequesting
                    || checkDetail.record?.status
                    === 'IN_PROGRESS'
                    || supportAnswers.length === 0
                  }
                >
                  {supportRequesting
                    ? '요청 중...'
                    : checkDetail.record?.status
                      === 'IN_PROGRESS'
                      ? '복지사 확인 요청 중'
                      : checkDetail.check.requestLabel}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </GuardianLayout>
  );
}