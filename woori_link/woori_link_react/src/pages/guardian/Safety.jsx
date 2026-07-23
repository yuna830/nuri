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
  updateActionStatus,
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
    label: '전기 안전',
  },
  {
    type: 'GAS_CHECK',
    label: '가스 안전',
  },
  {
    type: 'FIRE_CHECK',
    label: '화재·소방',
  },
  {
    type: 'HEATING_CHECK',
    label: '난방기기',
  },
  {
    type: 'FALL_CHECK',
    label: '욕실·낙상 위험',
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
    status: '즉시 사용 중지 필요',
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
  const copy = (
    GUIDANCE_COPY[
    product.matchedRecallNotice?.actionType
    ]
    || GUIDANCE_COPY.GENERAL_GUIDANCE
  );

  const handled = [
    'DISPOSED',
    'NOT_OWNED',
  ].includes(
    product.currentUseStatus,
  );

  return [
    copy.title,

    '',

    (
      `${product.seniorName} 님, `
      + copy.intro
    ),

    '',

    (
      `제품명: ${displayProductName(product)}`
    ),

    seniorFriendlyHazard(
      product.hazardDescription,
    ),

    '',

    handled
      ? currentUseGuidance(product)
      : copy.action,

    !handled
    && currentUseGuidance(product),

    product.inquiryTel
      ? `문의처: ${product.inquiryTel}`
      : '',
  ]
    .filter(Boolean)
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
    checkResult,
    setCheckResult,
  ] = useState('NORMAL');

  const [
    checkNote,
    setCheckNote,
  ] = useState('');

  const [
    checkSaving,
    setCheckSaving,
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
                      seniorName:
                        senior.name,
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


  const hiddenProductCount =
    Math.max(
      visibleProducts.length - 3,
      0,
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


  const totalCheckCount =
    selectedId === 'ALL'
      ? seniors.length
      * CHECKS.length
      : CHECKS.length;


  const completedCheckCount =
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
              === 'COMPLETED'
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
          === 'COMPLETED'
        ),
      ).length;


  const requiredCheckCount =
    Math.max(
      totalCheckCount
      - completedCheckCount,
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
    if (
      selectedId === 'ALL'
    ) {
      setCheckOverviewTarget(
        check,
      );

      return;
    }

    setCheckDetail({
      check,
      record,
    });

    setCheckResult(
      record?.status
        === 'IN_PROGRESS'
        ? 'NEEDS_ACTION'
        : 'NORMAL',
    );

    setCheckNote(
      record?.note
      || '',
    );

    setError('');
  }


  async function saveCheckResult() {
    if (
      !checkDetail
      || selectedId === 'ALL'
      || checkSaving
    ) {
      return;
    }

    setCheckSaving(true);
    setError('');

    const status =
      checkResult
        === 'NEEDS_ACTION'
        ? 'IN_PROGRESS'
        : 'COMPLETED';

    const note =
      checkNote.trim()
      || (
        checkResult
          === 'NEEDS_ACTION'
          ? '조치가 필요합니다.'
          : '이상 없음'
      );

    try {
      if (
        checkDetail.record
      ) {
        await updateActionStatus(
          checkDetail.record.id,
          status,
          note,
        );
      } else {
        await createAction({
          seniorId:
            Number(
              selectedId,
            ),

          actionType:
            checkDetail.check.type,

          actionSubject:
            'GUARDIAN',

          status,
          note,
        });
      }

      setCheckDetail(null);
      setCheckNote('');
      setCheckResult('NORMAL');

      await load();
    } catch (saveError) {
      setError(
        saveError
          .response
          ?.data
          ?.message
        || '생활안전 점검 결과를 저장하지 못했습니다.',
      );
    } finally {
      setCheckSaving(false);
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

      setGuidanceError(
        sendError
          .response
          ?.data
          ?.message
        || sendError
          .response
          ?.data
          ?.detail
        || (
          status === 401
            ? (
              '로그인 정보가 만료되었습니다. '
              + '다시 로그인해 주세요.'
            )
            : status === 403
              ? (
                '앱 알림 발송 권한을 '
                + '확인하지 못했습니다.'
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
                    : `+ ${hiddenProductCount}개 더보기`}
                </button>
              )}
            </>
          )}
        </section>

        <section className="guardian-safety-section guardian-check-area">
          <div className="guardian-safety-section__heading guardian-check-heading">
            <div>
              <h2>
                생활안전 점검
              </h2>

              <p>
                {selectedId === 'ALL'
                  ? (
                    '어르신별 전기·가스·화재 안전 점검 현황을 확인하세요.'
                  )
                  : (
                    `${selectedSenior?.name || ''} 님의 최근 생활안전 점검 상태를 확인하세요.`
                  )}
              </p>
            </div>

            <div className="guardian-check-summary">
              <span>
                점검 완료
                {' '}
                {completedCheckCount}
                개
              </span>

              <span>
                확인 필요
                {' '}
                {requiredCheckCount}
                개
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

                const completedPeopleCount =
                  overviewRows.filter(
                    (item) => (
                      item.record?.status
                      === 'COMPLETED'
                    ),
                  ).length;

                const requiredPeopleCount =
                  Math.max(
                    overviewRows.length
                    - completedPeopleCount,
                    0,
                  );

                const statusLabel =
                  selectedId === 'ALL'
                    ? (
                      requiredPeopleCount > 0
                        ? `확인 필요 ${requiredPeopleCount}명`
                        : '전체 점검 완료'
                    )
                    : (
                      record
                        ? (
                          CHECK_STATUS[
                          record.status
                          ]
                          || '점검 필요'
                        )
                        : '미점검'
                    );

                const statusDescription =
                  selectedId === 'ALL'
                    ? (
                      `점검 완료 ${completedPeopleCount}명`
                    )
                    : (
                      record
                        ? formatDate(
                          record.updatedAt
                          || record.createdAt,
                        )
                        : '점검 기록 없음'
                    );

                const statusClass =
                  selectedId === 'ALL'
                    ? (
                      requiredPeopleCount > 0
                        ? 'unchecked'
                        : 'completed'
                    )
                    : (
                      record
                        ? String(
                          record.status
                          ?? '',
                        ).toLowerCase()
                        : 'unchecked'
                    );

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
                    {cleanOfficialText(
                      detail.consumerAction,
                    ) || action.fallback}
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
            onMouseDown={
              (event) => {
                if (
                  event.target
                  === event.currentTarget
                ) {
                  closeGuidance();
                }
              }
            }
          >
            <section
              className={[
                'guardian-safety-modal',
                'guidance-preview-modal',
              ].join(' ')}
            >
              <header>
                <h2>
                  리콜 안내 보내기
                </h2>

                <button
                  type="button"
                  disabled={
                    guidanceSending
                  }
                  onClick={
                    closeGuidance
                  }
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
                    onClick={
                      closeGuidance
                    }
                  >
                    확인
                  </button>
                </section>
              ) : (
                <>
                  <h3>
                    {displayProductName(
                      guidanceTarget,
                    )}
                  </h3>

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
                        guidanceChannel
                          === 'APP_PUSH'
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
                      disabled={
                        guidanceSending
                      }
                      aria-pressed={
                        guidanceChannel
                        === 'APP_PUSH'
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
                          님 앱으로 전송
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
                      value={
                        guidanceMessage
                      }
                      onChange={
                        (event) => {
                          setGuidanceMessage(
                            event.target.value,
                          );
                        }
                      }
                      disabled={
                        guidanceSending
                      }
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
                      onClick={
                        closeGuidance
                      }
                      disabled={
                        guidanceSending
                      }
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      className="submit"
                      onClick={
                        sendGuidance
                      }
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
            onMouseDown={
              (event) => {
                if (
                  event.target
                  === event.currentTarget
                  && !checkSaving
                ) {
                  setCheckDetail(null);
                }
              }
            }
          >
            <section className="guardian-safety-modal guardian-check-modal">
              <header>
                <div>
                  <h2>
                    {checkDetail.check.label}
                  </h2>

                  <p>
                    {selectedSenior?.name}
                    {' '}
                    님
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    checkSaving
                  }
                  onClick={() => {
                    setCheckDetail(null);
                  }}
                >
                  ×
                </button>
              </header>

              {checkDetail.record && (
                <div className="guardian-check-current-record">
                  <span>
                    최근 점검
                  </span>

                  <strong>
                    {CHECK_STATUS[
                      checkDetail
                        .record
                        .status
                    ] || '점검 필요'}
                  </strong>

                  <small>
                    {formatDate(
                      checkDetail
                        .record
                        .updatedAt
                      || checkDetail
                        .record
                        .createdAt,
                    )}
                  </small>
                </div>
              )}

              <fieldset className="guardian-check-result-picker">
                <legend>
                  점검 결과
                </legend>

                <div>
                  <button
                    type="button"
                    className={
                      checkResult
                        === 'NORMAL'
                        ? 'selected normal'
                        : ''
                    }
                    onClick={() => {
                      setCheckResult(
                        'NORMAL',
                      );
                    }}
                    disabled={
                      checkSaving
                    }
                  >
                    <strong>
                      양호
                    </strong>

                    <span>
                      위험하거나 수리가 필요한 부분이 없습니다.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      checkResult
                        === 'NEEDS_ACTION'
                        ? 'selected danger'
                        : ''
                    }
                    onClick={() => {
                      setCheckResult(
                        'NEEDS_ACTION',
                      );
                    }}
                    disabled={
                      checkSaving
                    }
                  >
                    <strong>
                      조치 필요
                    </strong>

                    <span>
                      수리, 교체 또는 추가 확인이 필요합니다.
                    </span>
                  </button>
                </div>
              </fieldset>

              <label className="guardian-check-note">
                점검 내용 및 특이사항

                <textarea
                  value={
                    checkNote
                  }
                  onChange={
                    (event) => {
                      setCheckNote(
                        event.target.value,
                      );
                    }
                  }
                  placeholder={
                    checkResult
                      === 'NEEDS_ACTION'
                      ? '발견한 문제와 필요한 조치를 입력해 주세요.'
                      : '점검한 내용이 있다면 입력해 주세요.'
                  }
                  disabled={
                    checkSaving
                  }
                />
              </label>

              <div className="guardian-check-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCheckDetail(null);
                  }}
                  disabled={
                    checkSaving
                  }
                >
                  취소
                </button>

                <button
                  type="button"
                  className="submit"
                  onClick={
                    saveCheckResult
                  }
                  disabled={
                    checkSaving
                  }
                >
                  {checkSaving
                    ? '저장 중...'
                    : checkDetail.record
                      ? '점검 기록 수정'
                      : '점검 결과 저장'}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </GuardianLayout>
  );
}