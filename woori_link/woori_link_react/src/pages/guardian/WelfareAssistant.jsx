import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import GuardianLayout from './GuardianLayout.jsx';
import AiDecisionNotice from '../../components/common/AiDecisionNotice.jsx';

import {
  askGuardianRag,
} from '../../api/guardianHomeApi.js';

import {
  getSeniorsByGuardian,
} from '../../api/guardianApi.js';

import '../../css/guardian/WelfareAssistant.css';


const BENEFIT_DEFINITIONS = [
  {
    id: 'energy-voucher',
    icon: '₩',
    title: '에너지바우처',
    aliases: [
      '에너지바우처',
      '에너지 바우처',
    ],
    defaultQuestion:
      '이 어르신의 에너지바우처 신청 가능성과 추가 확인 항목을 알려주세요.',
  },
  {
    id: 'electricity-discount',
    icon: '⚡',
    title: '전기요금 복지할인',
    aliases: [
      '전기요금 복지할인',
      '전기요금 할인',
      '전기요금 감면',
      '전기 요금',
    ],
    defaultQuestion:
      '이 어르신의 전기요금 복지할인 신청 가능성과 필요한 서류를 알려주세요.',
  },
  {
    id: 'gas-discount',
    icon: '♨',
    title: '도시가스요금 경감',
    aliases: [
      '도시가스요금 경감',
      '도시가스 경감',
      '가스요금 경감',
      '도시가스',
    ],
    defaultQuestion:
      '이 어르신의 도시가스요금 경감 가능성과 필요한 서류를 알려주세요.',
  },
];


const GENERAL_SUGGESTIONS = [
  {
    icon: '₩',
    title: '에너지바우처',
    question:
      '에너지바우처 신청 대상과 필요한 서류를 알려주세요.',
  },
  {
    icon: '⚡',
    title: '전기요금',
    question:
      '전기요금 복지할인 대상과 신청 방법을 알려주세요.',
  },
  {
    icon: '♨',
    title: '도시가스',
    question:
      '도시가스요금 경감 대상과 신청 서류를 알려주세요.',
  },
  {
    icon: '!',
    title: '리콜 대응',
    question:
      '리콜 제품을 발견하면 어떻게 조치해야 하나요?',
  },
];


const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text:
    '복지제도, 요금감면, 제품 리콜과 생활안전 정보를 공식 문서에 근거해 안내해 드립니다. 궁금한 내용을 입력해 주세요.',
  sources: [],
};


const STATUS_META = {
  CONDITIONS_CONFIRMED: {
    label: '우선 검토 가능',
    className: 'confirmed',
  },

  REVIEW_POSSIBLE: {
    label: '조건 확인 필요',
    className: 'review',
  },

  INFORMATION_MISSING: {
    label: '추가 정보 필요',
    className: 'missing',
  },

  LOW_PRIORITY: {
    label: '가능성 낮음',
    className: 'low',
  },

  APPLIED: {
    label: '신청 완료',
    className: 'applied',
  },
};


function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}


function normalizeText(value) {
  return String(value ?? '')
    .replaceAll(' ', '')
    .toLowerCase();
}

function getOverviewColumnTemplate(
  completedCount,
  requiredCount,
) {
  const completed = Number(completedCount) || 0;
  const required = Number(requiredCount) || 0;

  // 두 카드 모두 3명 이하라면 정확히 반반
  if (
    completed <= 3
    && required <= 3
  ) {
    return 'minmax(0, 1fr) minmax(0, 1fr)';
  }

  const getWeight = (count) => {
    if (count <= 3) {
      return 1;
    }

    // 4명부터 인원수에 따라 점진적으로 넓어짐
    return Math.min(
      1 + ((count - 3) * 0.35),
      2,
    );
  };

  const completedWeight = getWeight(completed);
  const requiredWeight = getWeight(required);

  return `
    minmax(0, ${completedWeight}fr)
    minmax(0, ${requiredWeight}fr)
  `;
}

function buildWelfareProfile(senior) {
  if (!senior) {
    return null;
  }

  const benefitStatuses = [
    senior.livelihoodBenefit && '생계급여',
    senior.medicalBenefit && '의료급여',
    senior.housingBenefit && '주거급여',
    senior.educationBenefit && '교육급여',
  ].filter(Boolean);

  const currentBenefits = [
    ...benefitStatuses,

    senior.energyVoucherApplied
    && '에너지바우처 신청',

    senior.electricityDiscountApplied
    && '전기요금 복지할인 신청',

    senior.gasDiscountApplied
    && '도시가스요금 경감 신청',
  ].filter(Boolean);

  return {
    name: senior.name ?? null,

    age: senior.age ?? null,

    gender: senior.gender ?? null,

    address: [
      senior.address,
      senior.detailAddress,
    ].filter(Boolean).join(' ') || null,

    region: senior.address ?? null,

    incomeLevel: (
      senior.incomeLevel
        && senior.incomeLevel !== 'NONE'
        ? senior.incomeLevel
        : null
    ),

    householdType:
      senior.householdType ?? null,

    livingAlone:
      senior.livingAlone ?? null,

    basicLivelihoodStatus: (
      benefitStatuses.length > 0
        ? benefitStatuses.join(', ')
        : null
    ),

    disabilityStatus: (
      senior.disabilityGrade
      ?? (
        senior.disabledHouseholdMember
          ? '장애 세대원 있음'
          : null
      )
    ),

    longTermCareGrade: (
      senior.longTermCare
        ? '장기요양 해당'
        : null
    ),

    currentBenefits,

    welfareMemo:
      senior.energyVoucherReason ?? null,
  };
}


function findBenefitDefinition(serviceName) {
  const normalizedServiceName = normalizeText(
    serviceName,
  );

  return BENEFIT_DEFINITIONS.find((benefit) => (
    benefit.aliases.some((alias) => (
      normalizedServiceName.includes(
        normalizeText(alias),
      )
    ))
  ));
}


function getStatusMeta(status) {
  return (
    STATUS_META[status]
    ?? {
      label: '확인 필요',
      className: 'missing',
    }
  );
}


function findCandidateByBenefit(
  assessment,
  benefit,
) {
  const candidates = (
    assessment?.candidates
    ?? []
  );

  return candidates.find((candidate) => {
    const definition = findBenefitDefinition(
      candidate.serviceName,
    );

    return definition?.id === benefit.id;
  });
}


function createFallbackCandidate(
  benefit,
  selectedSenior,
) {
  const appliedMap = {
    'energy-voucher':
      selectedSenior?.energyVoucherApplied,

    'electricity-discount':
      selectedSenior?.electricityDiscountApplied,

    'gas-discount':
      selectedSenior?.gasDiscountApplied,
  };

  if (appliedMap[benefit.id]) {
    return {
      serviceId: benefit.id,
      serviceName: benefit.title,
      status: 'APPLIED',
      statusLabel: '신청 완료',
      matchedConditions: [
        '등록 정보에서 신청 상태가 확인됩니다.',
      ],
      missingConditions: [],
      conflictingConditions: [],
      decisionReason:
        '현재 등록 정보상 이미 신청한 혜택으로 표시되어 있습니다.',
      applicationGuide:
        '적용 여부와 최근 고지서 반영 상태를 확인해 주세요.',
    };
  }

  return {
    serviceId: benefit.id,
    serviceName: benefit.title,
    status: 'INFORMATION_MISSING',
    statusLabel: '추가 정보 필요',
    matchedConditions: [],
    missingConditions: [
      '현재 등록된 정보만으로는 신청 가능성을 판단하기 어렵습니다.',
    ],
    conflictingConditions: [],
    decisionReason:
      '어르신 정보를 바탕으로 혜택 검토를 진행할 수 있습니다.',
    applicationGuide:
      '카드를 선택해 확인된 조건과 추가 확인 정보를 확인해 주세요.',
  };
}


function normalizeBenefitCards(
  assessment,
  selectedSenior,
) {
  return BENEFIT_DEFINITIONS.map((benefit) => {
    const candidate = findCandidateByBenefit(
      assessment,
      benefit,
    );

    const normalizedCandidate = (
      candidate
      ?? createFallbackCandidate(
        benefit,
        selectedSenior,
      )
    );

    return {
      ...benefit,
      ...normalizedCandidate,

      serviceId: (
        normalizedCandidate.serviceId
        ?? benefit.id
      ),

      serviceName: (
        normalizedCandidate.serviceName
        ?? benefit.title
      ),
    };
  });
}


function SourceList({
  sources,
  compact = false,
}) {
  const [
    sourceOpen,
    setSourceOpen,
  ] = useState(false);

  if (!sources?.length) {
    return null;
  }

  const visibleSources = compact
    ? sources.slice(0, 4)
    : sources.slice(0, 4);

  return (
    <div
      className={[
        'welfare-chat__sources',
        compact
          ? 'welfare-chat__sources--compact'
          : '',
      ].filter(Boolean).join(' ')}
    >
      {compact ? (
        <>
          <div className="welfare-benefit-detail__source-header">
            <span>근거 문서</span>

            <button
              type="button"
              className="welfare-benefit-detail__source-button"
              onClick={() => {
                setSourceOpen(
                  (current) => !current,
                );
              }}
              aria-expanded={sourceOpen}
            >
              {sourceOpen
                ? '접기'
                : `근거 문서 ${sources.length}건 보기`}
            </button>
          </div>

          {sourceOpen && (
            <div className="welfare-benefit-detail__source-list">
              {visibleSources.map(
                (source, index) => {
                  const label = (
                    source.title
                    || `근거 문서 ${index + 1}`
                  )
                    .replace(/\.md$/i, '')
                    .replaceAll('_', ' ')
                    .replace(/^["']|["']$/g, '');

                  const meta = [
                    source.authority,

                    source.effectiveYear
                      ? `${source.effectiveYear}년`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  const sourceContent = (
                    <>
                      <strong>{label}</strong>

                      {meta && (
                        <small>{meta}</small>
                      )}
                    </>
                  );

                  if (source.url) {
                    return (
                      <a
                        key={source.id || index}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sourceContent}
                      </a>
                    );
                  }

                  return (
                    <span key={source.id || index}>
                      {sourceContent}
                    </span>
                  );
                },
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <strong>근거 문서</strong>

          {visibleSources.map(
            (source, index) => {
              const label = (
                source.title
                || `근거 문서 ${index + 1}`
              )
                .replace(/\.md$/i, '')
                .replaceAll('_', ' ')
                .replace(/^["']|["']$/g, '');

              const meta = [
                source.authority,

                source.effectiveYear
                  ? `${source.effectiveYear}년`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              const sourceContent = (
                <>
                  <span>{label}</span>

                  {meta && (
                    <small>{meta}</small>
                  )}
                </>
              );

              if (source.url) {
                return (
                  <a
                    key={source.id || index}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sourceContent}
                  </a>
                );
              }

              return (
                <span key={source.id || index}>
                  {sourceContent}
                </span>
              );
            },
          )}
        </>
      )}
    </div>
  );
}

function BenefitSummaryCard({
  benefit,
  selected,
  loading,
  onClick,
}) {
  const statusMeta = getStatusMeta(
    benefit.status,
  );

  const matchedCount = (
    benefit.matchedConditions?.length
    ?? 0
  );

  const missingCount = (
    benefit.missingConditions?.length
    ?? 0
  );

  return (
    <button
      type="button"
      className={[
        'welfare-benefit-card',
        selected
          ? 'welfare-benefit-card--selected'
          : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={loading}
    >
      <div className="welfare-benefit-card__top">
        <span className="welfare-benefit-card__icon">
          {benefit.icon}
        </span>

        <span
          className={[
            'welfare-benefit-status',
            `welfare-benefit-status--${statusMeta.className}`,
          ].join(' ')}
        >
          {benefit.statusLabel
            || statusMeta.label}
        </span>
      </div>

      <strong>
        {benefit.title}
      </strong>

      <small>
        {matchedCount > 0
          ? `확인된 조건 ${matchedCount}개`
          : '확인된 조건 없음'}

        {' · '}

        {missingCount > 0
          ? `추가 확인 ${missingCount}개`
          : '추가 확인 없음'}
      </small>
    </button>
  );
}


function ConditionList({
  title,
  items,
  type,
  emptyText,
}) {
  return (
    <section
      className={[
        'welfare-benefit-detail__condition',
        `welfare-benefit-detail__condition--${type}`,
      ].join(' ')}
    >
      <header>
        <span />

        <strong>{title}</strong>
      </header>

      {items?.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${type}-${index}-${item}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}


function BenefitDetail({
  benefit,
  seniorName,
  sources,
}) {
  if (!benefit) {
    return null;
  }

  const statusMeta = getStatusMeta(
    benefit.status,
  );

  return (
    <article className="welfare-benefit-detail">
      <header className="welfare-benefit-detail__header">
        <div>
          <span className="welfare-benefit-detail__icon">
            {benefit.icon}
          </span>

          <div>
            <small>
              {seniorName} 님 혜택 검토
            </small>

            <h3>{benefit.title}</h3>
          </div>
        </div>

        <span
          className={[
            'welfare-benefit-status',
            `welfare-benefit-status--${statusMeta.className}`,
          ].join(' ')}
        >
          {benefit.statusLabel
            || statusMeta.label}
        </span>
      </header>

      <div className="welfare-benefit-detail__conditions">
        <ConditionList
          title="현재 확인된 조건"
          type="matched"
          items={benefit.matchedConditions}
          emptyText="현재 등록 정보에서 확인된 조건이 없습니다."
        />

        <ConditionList
          title="추가 확인 필요"
          type="missing"
          items={benefit.missingConditions}
          emptyText="추가로 확인할 조건이 없습니다."
        />
      </div>

      {!!benefit.conflictingConditions?.length && (
        <ConditionList
          title="현재 정보와 맞지 않는 조건"
          type="conflict"
          items={benefit.conflictingConditions}
          emptyText=""
        />
      )}

      <div className="welfare-benefit-detail__guide">
        <strong>신청 및 확인 안내</strong>

        <p>
          {benefit.applicationGuide
            || '정확한 대상 여부와 신청 방법은 행정복지센터 또는 담당 기관에서 확인해 주세요.'}
        </p>
      </div>

      <SourceList
        sources={sources}
        compact
      />
    </article>
  );
}


export default function WelfareAssistant() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [seniors, setSeniors] = useState([]);

  const [
    seniorLoading,
    setSeniorLoading,
  ] = useState(true);

  const [
    messages,
    setMessages,
  ] = useState([INITIAL_MESSAGE]);

  const [
    question,
    setQuestion,
  ] = useState('');

  const [
    chatLoading,
    setChatLoading,
  ] = useState(false);

  const [
    benefitLoading,
    setBenefitLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    benefitError,
    setBenefitError,
  ] = useState('');

  const [
    benefitAssessment,
    setBenefitAssessment,
  ] = useState(null);

  const [
    benefitSources,
    setBenefitSources,
  ] = useState([]);

  const [
    selectedBenefitId,
    setSelectedBenefitId,
  ] = useState(
    BENEFIT_DEFINITIONS[0].id,
  );

  const [
    selectedOverviewBenefitId,
    setSelectedOverviewBenefitId,
  ] = useState('energy-voucher');

  const endRef = useRef(null);

  const composerRef = useRef(null);

  const benefitRequestIdRef = useRef(0);

  const selectedSeniorId = (
    searchParams.get('seniorId')
    || ''
  );

  const selectedSenior = useMemo(
    () => (
      seniors.find((senior) => (
        String(senior.id)
        === selectedSeniorId
      ))
      || null
    ),
    [
      seniors,
      selectedSeniorId,
    ],
  );

  const benefitCards = useMemo(
    () => normalizeBenefitCards(
      benefitAssessment,
      selectedSenior,
    ),
    [
      benefitAssessment,
      selectedSenior,
    ],
  );

  const selectedBenefit = useMemo(
    () => (
      benefitCards.find((benefit) => (
        benefit.id === selectedBenefitId
      ))
      || benefitCards[0]
      || null
    ),
    [
      benefitCards,
      selectedBenefitId,
    ],
  );

  const overallBenefitStatus = useMemo(() => {
    const createBenefitOverview = ({
      id,
      icon,
      title,
      description,
      appliedField,
    }) => {
      const appliedSeniors = seniors.filter(
        (senior) => senior?.[appliedField] === true,
      );

      const reviewSeniors = seniors.filter(
        (senior) => senior?.[appliedField] !== true,
      );

      return {
        id,
        icon,
        title,
        description,
        appliedField,
        appliedCount: appliedSeniors.length,
        reviewCount: reviewSeniors.length,
        appliedSeniors,
        reviewSeniors,
      };
    };

    return [
      createBenefitOverview({
        id: 'energy-voucher',
        icon: '₩',
        title: '에너지바우처',
        description: '소득·가구 기준 확인',
        appliedField: 'energyVoucherApplied',
      }),

      createBenefitOverview({
        id: 'electricity-discount',
        icon: '⚡',
        title: '전기요금 복지할인',
        description: '복지 자격·계약 정보 확인',
        appliedField: 'electricityDiscountApplied',
      }),

      createBenefitOverview({
        id: 'gas-discount',
        icon: '♨',
        title: '도시가스요금 경감',
        description: '복지 자격·계약 정보 확인',
        appliedField: 'gasDiscountApplied',
      }),
    ];
  }, [seniors]);

  const selectedOverviewBenefit = useMemo(
    () => (
      overallBenefitStatus.find(
        (benefit) => (
          benefit.id === selectedOverviewBenefitId
        ),
      )
      || overallBenefitStatus[0]
      || null
    ),
    [
      overallBenefitStatus,
      selectedOverviewBenefitId,
    ],
  );

  useEffect(() => {
    let active = true;

    getSeniorsByGuardian()
      .then((response) => {
        if (!active) {
          return;
        }

        setSeniors(
          asArray(response.data),
        );
      })
      .catch(() => {
        if (active) {
          setSeniors([]);
        }
      })
      .finally(() => {
        if (active) {
          setSeniorLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [
    messages,
    chatLoading,
  ]);


  useEffect(() => {
    const loadBenefits = async () => {
      if (!selectedSenior) {
        setBenefitAssessment(null);
        setBenefitSources([]);
        setBenefitError('');
        return;
      }

      const requestId = (
        benefitRequestIdRef.current + 1
      );

      benefitRequestIdRef.current = requestId;

      setBenefitLoading(true);
      setBenefitError('');
      setBenefitAssessment(null);
      setBenefitSources([]);

      try {
        const profile = buildWelfareProfile(
          selectedSenior,
        );

        const result = await askGuardianRag(
          `${selectedSenior.name} 님이 신청 가능성을 검토할 수 있는 에너지바우처, 전기요금 복지할인, 도시가스요금 경감 혜택을 각각 확인해 주세요. 확인된 조건, 추가 확인이 필요한 조건, 신청 방법을 구분해서 알려주세요.`,
          [],
          profile,
          'recommend',
        );

        if (
          benefitRequestIdRef.current
          !== requestId
        ) {
          return;
        }

        setBenefitAssessment(
          result.assessment,
        );

        setBenefitSources(
          result.sources ?? [],
        );

        setSelectedBenefitId(
          BENEFIT_DEFINITIONS[0].id,
        );
      } catch (requestError) {
        if (
          benefitRequestIdRef.current
          !== requestId
        ) {
          return;
        }

        setBenefitError(
          requestError.message
          || '혜택 정보를 불러오지 못했습니다.',
        );
      } finally {
        if (
          benefitRequestIdRef.current
          === requestId
        ) {
          setBenefitLoading(false);
        }
      }
    };

    loadBenefits();
  }, [selectedSenior]);


  const submitQuestion = async (value) => {
    const text = String(value || '').trim();

    if (
      !text
      || chatLoading
    ) {
      return;
    }

    const previousHistory = messages
      .filter((message) => (
        message.id !== 'welcome'
      ))
      .map((message) => ({
        role: message.role,
        text: message.text,
      }))
      .slice(-8);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      sources: [],
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setQuestion('');
    setError('');
    setChatLoading(true);

    try {
      const profile = buildWelfareProfile(
        selectedSenior,
      );

      const result = await askGuardianRag(
        text,
        previousHistory,
        profile,
        'qa',
      );

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result.answer,
          sources: result.sources ?? [],
        },
      ]);
    } catch (requestError) {
      setError(
        requestError.message
        || '답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setChatLoading(false);
    }
  };


  const handleSubmit = (event) => {
    event.preventDefault();

    submitQuestion(question);
  };


  const selectSenior = (event) => {
    const seniorId = event.target.value;

    setSearchParams(
      seniorId
        ? { seniorId }
        : {},
    );

    setMessages([INITIAL_MESSAGE]);
    setQuestion('');
    setError('');
    setBenefitError('');

    setSelectedBenefitId(
      BENEFIT_DEFINITIONS[0].id,
    );
  };

  const resetConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setQuestion('');
    setError('');
  };


  return (
    <GuardianLayout activeMenu="welfare">
      <main className="welfare-assistant-page">
        <header className="welfare-assistant-page__header">
          <div>
            <h1>복지·안전 도우미</h1>
          </div>

          <div className="welfare-assistant-page__actions">
            <label>
              <span>상담 대상</span>

              <select
                value={selectedSeniorId}
                onChange={selectSenior}
                disabled={seniorLoading}
              >
                <option value="">
                  일반 정보 보기
                </option>

                {seniors.map((senior) => (
                  <option
                    value={senior.id}
                    key={senior.id}
                  >
                    {senior.name} 님
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={resetConversation}
            >
              새 대화
            </button>
          </div>
        </header>


        <div className="welfare-main-layout">
          <div className="welfare-main-layout__benefits">
            {selectedSenior ? (
              <section className="welfare-benefits">
                <header className="welfare-benefits__header">
                  <div>
                    <h2>
                      {selectedSenior.name} 님이 확인할 수 있는 혜택
                    </h2>
                  </div>

                  <div className="welfare-benefits__profile">
                    <b>
                      {selectedSenior.name?.slice(0, 1)
                        || '어'}
                    </b>

                    <span>
                      <strong>
                        {selectedSenior.name} 님
                      </strong>

                      <small>
                        {selectedSenior.age
                          ? `만 ${selectedSenior.age}세`
                          : '나이 미입력'}

                        {' · '}

                        {selectedSenior.livingAlone === true
                          ? '독거'
                          : (
                            selectedSenior.householdType
                            || '가구 형태 미입력'
                          )}
                      </small>
                    </span>
                  </div>
                </header>


                {benefitLoading && (
                  <div className="welfare-benefits__loading">
                    <span className="welfare-benefits__spinner" />

                    <div>
                      <strong>
                        등록 정보를 확인하고 있습니다.
                      </strong>

                      <p>
                        공식 문서와 어르신 정보를 비교해
                        신청 가능성을 검토합니다.
                      </p>
                    </div>
                  </div>
                )}


                {!benefitLoading && benefitError && (
                  <div className="welfare-benefits__error">
                    {benefitError}
                  </div>
                )}


                {!benefitLoading && (
                  <>
                    <div className="welfare-benefit-grid">
                      {benefitCards.map((benefit) => (
                        <BenefitSummaryCard
                          key={benefit.id}
                          benefit={benefit}
                          selected={
                            selectedBenefit?.id
                            === benefit.id
                          }
                          loading={benefitLoading}
                          onClick={() => {
                            setSelectedBenefitId(
                              benefit.id,
                            );
                          }}
                        />
                      ))}
                    </div>

                    <BenefitDetail
                      benefit={selectedBenefit}
                      seniorName={selectedSenior.name}
                      sources={benefitSources}
                    />
                  </>
                )}

                <AiDecisionNotice
                  type="welfare"
                  className="welfare-benefits__notice"
                />
              </section>
            ) : (
              <section className="welfare-benefits welfare-benefits--overview">
                <header className="welfare-benefits__header">
                  <div>
                    <h2>
                      전체 어르신 복지 혜택 현황
                    </h2>
                  </div>

                  <span className="welfare-overview-count">
                    총 {seniors.length}명
                  </span>
                </header>

                <div className="welfare-overview-grid">
                  {overallBenefitStatus.map((benefit) => {
                    const selected = (
                      selectedOverviewBenefit?.id
                      === benefit.id
                    );

                    return (
                      <button
                        type="button"
                        className={[
                          'welfare-overview-card',
                          selected
                            ? 'welfare-overview-card--selected'
                            : '',
                        ].filter(Boolean).join(' ')}
                        key={benefit.id}
                        onClick={() => {
                          setSelectedOverviewBenefitId(
                            benefit.id,
                          );
                        }}
                      >
                        <header className="welfare-overview-card__header">
                          <span className="welfare-overview-card__icon">
                            {benefit.icon}
                          </span>

                          <div>
                            <strong>
                              {benefit.title}
                            </strong>

                            <p>
                              {benefit.description}
                            </p>
                          </div>
                        </header>

                        <div className="welfare-overview-card__status">
                          <div className="welfare-overview-card__status-row">
                            <span>신청 완료</span>

                            <strong className="completed">
                              {benefit.appliedCount}명
                            </strong>
                          </div>

                          <div className="welfare-overview-card__status-row">
                            <span>확인 필요</span>

                            <strong className="required">
                              {benefit.reviewCount}명
                            </strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedOverviewBenefit && (
                  <section className="welfare-overview-detail">
                    <header className="welfare-overview-detail__header">
                      <div>
                        <span className="welfare-overview-detail__icon">
                          {selectedOverviewBenefit.icon}
                        </span>

                        <div>
                          <small>혜택별 대상자 현황</small>

                          <h3>
                            {selectedOverviewBenefit.title}
                          </h3>
                        </div>
                      </div>

                      <span>
                        총 {seniors.length}명
                      </span>
                    </header>

                    <div
                      className="welfare-overview-detail__columns"
                      style={{
                        gridTemplateColumns:
                          getOverviewColumnTemplate(
                            selectedOverviewBenefit.appliedCount,
                            selectedOverviewBenefit.reviewCount,
                          ),
                      }}
                    >
                      <section className="welfare-overview-status-row welfare-overview-status-row--completed">
                        <div className="welfare-overview-status-row__label">
                          <span />

                          <strong>신청 완료</strong>

                          <b>
                            {selectedOverviewBenefit.appliedCount}명
                          </b>
                        </div>

                        <div className="welfare-overview-status-row__names">
                          {selectedOverviewBenefit.appliedSeniors.length > 0 ? (
                            selectedOverviewBenefit.appliedSeniors.map(
                              (senior) => (
                                <button
                                  type="button"
                                  key={senior.id}
                                  onClick={() => {
                                    setSearchParams({
                                      seniorId: senior.id,
                                    });
                                  }}
                                >
                                  {senior.name} 님
                                </button>
                              ),
                            )
                          ) : (
                            <span className="welfare-overview-status-row__empty">
                              신청 완료한 어르신 없음
                            </span>
                          )}
                        </div>
                      </section>

                      <section className="welfare-overview-status-row welfare-overview-status-row--required">
                        <div className="welfare-overview-status-row__label">
                          <span />

                          <strong>확인 필요</strong>

                          <b>
                            {selectedOverviewBenefit.reviewCount}명
                          </b>
                        </div>

                        <div className="welfare-overview-status-row__names">
                          {selectedOverviewBenefit.reviewSeniors.length > 0 ? (
                            selectedOverviewBenefit.reviewSeniors.map(
                              (senior) => (
                                <button
                                  type="button"
                                  key={senior.id}
                                  onClick={() => {
                                    setSearchParams({
                                      seniorId: senior.id,
                                    });
                                  }}
                                >
                                  {senior.name} 님
                                </button>
                              ),
                            )
                          ) : (
                            <span className="welfare-overview-status-row__empty">
                              확인 필요한 어르신 없음
                            </span>
                          )}
                        </div>
                      </section>
                    </div>

                    <p className="welfare-overview-selection-guide">
                      이름을 선택하면 해당 어르신의 맞춤 혜택과 추가 확인 항목을 볼 수 있습니다.
                    </p>
                  </section>
                )}

                <AiDecisionNotice
                  type="welfare"
                  className="welfare-benefits__notice"
                />
              </section>
            )}
          </div>


          <section className="welfare-chat-section">
            <header className="welfare-chat-section__header">
              <div>
                <h2>
                  궁금한 내용을 물어보세요.
                </h2>
              </div>

              {selectedSenior && (
                <span className="welfare-chat-section__subject">
                  {selectedSenior.name} 님 기준
                </span>
              )}
            </header>


            <div className="welfare-chat-layout">
              <div className="welfare-chat-quick-questions">
                {GENERAL_SUGGESTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.title}
                    onClick={() => {
                      submitQuestion(item.question);
                    }}
                    disabled={chatLoading}
                    title={item.question}
                  >
                    <b>{item.icon}</b>
                    {item.title}
                  </button>
                ))}
              </div>


              <div className="welfare-chat">
                <div
                  className="welfare-chat__messages"
                  aria-live="polite"
                >
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={[
                        'welfare-chat__message',
                        `welfare-chat__message--${message.role}`,
                      ].join(' ')}
                    >
                      {message.role === 'assistant' && (
                        <span className="welfare-chat__avatar">
                          W
                        </span>
                      )}

                      <div>
                        <p>{message.text}</p>

                        <SourceList
                          sources={message.sources}
                        />
                      </div>
                    </article>
                  ))}


                  {chatLoading && (
                    <article className="welfare-chat__message welfare-chat__message--assistant">
                      <span className="welfare-chat__avatar">
                        W
                      </span>

                      <div className="welfare-chat__typing">
                        <i />
                        <i />
                        <i />

                        <span>
                          관련 문서를 확인하고 있습니다.
                        </span>
                      </div>
                    </article>
                  )}

                  <div ref={endRef} />
                </div>


                {error && (
                  <div className="welfare-chat__error">
                    {error}
                  </div>
                )}


                <form
                  className="welfare-chat__composer"
                  onSubmit={handleSubmit}
                >
                  <textarea
                    ref={composerRef}
                    value={question}
                    onChange={(event) => {
                      setQuestion(
                        event.target.value,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter'
                        && !event.shiftKey
                      ) {
                        event.preventDefault();

                        submitQuestion(question);
                      }
                    }}
                    placeholder="궁금한 복지·안전 정보를 입력해 주세요."
                    maxLength={500}
                    rows={1}
                    disabled={chatLoading}
                  />

                  <button
                    type="submit"
                    disabled={
                      chatLoading
                      || !question.trim()
                    }
                    aria-label="질문 보내기"
                  >
                    →
                  </button>
                </form>

              </div>
            </div>
          </section>
        </div>
      </main>
    </GuardianLayout>
  );
}
