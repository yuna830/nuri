import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import '../../css/welfare/Dashboard.css';

import {
  getSeniorsByWelfareWorker,
} from '../../api/seniorApi';

import {
  assessAll,
  getHighRisk,
} from '../../api/riskApi';

import {
  createAction,
  deleteAction,
  getActionsByWelfareWorker,
  updateAction,
} from '../../api/actionApi';

import {
  getProductsBySenior,
  getRecalledProductsByWelfareWorker,
} from '../../api/recallApi';

import {
  getEnergySupportCandidates,
  getEnergySupportConsultation,
  getEnergySupportConsultationRequests,
  proposeEnergySupportConsultationSchedule,
} from '../../api/energySupportApi';

import {
  getUserId,
} from '../../utils/auth';

import {
  filterProductsByRecallRequests,
} from '../../utils/recallRequestFilter';


const TERMINAL_STATUSES = [
  'COMPLETED',
  'CANCELLED',
];


const ACTIVE_CONSULTATION_SCHEDULE_STATUSES = [
  'PROPOSED',
  'CONFIRMED',
  'CHANGE_REQUESTED',
];


const EMPTY_SCHEDULE_FORM = {
  seniorId: '',
  dueDate: '',
  visitTime: '',
  note: '',
};


const EMPTY_CONSULTATION_FORM = {
  consultationDate: '',
  availableStartTime: '',
  availableEndTime: '',
  consultationMethod: 'PHONE',
  message: '',
};


const TYPE_LABEL = {
  RECALL: '리콜 조치',
  VOUCHER: '에너지바우처',
  ELECTRICITY_DISCOUNT: '전기요금 할인',
  GAS_CHECK: '가스 점검',
  ELECTRIC_CHECK: '전기 점검',
  VISIT: '방문 일정',
  SOS: '긴급 확인',
  OTHER: '복지 상담',
};


const timeNotePattern =
  /^\[방문시간:(\d{2}:\d{2})]\s*(.*)$/;


function dateOnly(value) {
  return value
    ? String(value).slice(0, 10)
    : '';
}


function todayString() {
  const now =
    new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1,
    ).padStart(2, '0'),
    String(
      now.getDate(),
    ).padStart(2, '0'),
  ].join('-');
}


function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}


function getErrorMessage(
  error,
  fallbackMessage,
) {
  return (
    error
      ?.response
      ?.data
      ?.message
    || error
      ?.response
      ?.data
      ?.error
    || error?.message
    || fallbackMessage
  );
}


function dueLabel(
  action,
  today,
) {
  const due =
    dateOnly(
      action.dueDate,
    );

  if (!due) {
    return '예정일 미지정';
  }

  const days =
    Math.round(
      (
        new Date(`${today}T00:00:00`)
        - new Date(`${due}T00:00:00`)
      )
      / 86400000,
    );

  if (days > 0) {
    return `${days}일 지남`;
  }

  if (days === 0) {
    return '오늘까지';
  }

  return `${Math.abs(days)}일 후`;
}


function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 20h9" />

      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}


function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3 6h18" />

      <path d="M8 6V4h8v2" />

      <path d="M19 6l-1 14H6L5 6" />

      <path d="M10 11v5" />

      <path d="M14 11v5" />
    </svg>
  );
}


function noteParts(note) {
  const match =
    String(
      note || '',
    ).match(
      timeNotePattern,
    );

  return {
    time:
      match?.[1]
      || '',

    text:
      match
        ? match[2]
        : note || '',
  };
}


function scheduleTime(action) {
  return (
    action.visitTime
    || noteParts(
      action.note,
    ).time
    || ''
  );
}


function scheduleNote(action) {
  return (
    noteParts(
      action.note,
    ).text
    || '방문 일정'
  );
}


function buildScheduleNote(
  note,
  time,
) {
  const cleanNote =
    noteParts(
      note,
    ).text
    || '방문 일정';

  return time
    ? `[방문시간:${time}] ${cleanNote}`
    : cleanNote;
}


function getConsultationTimeLabel(
  consultation,
) {
  const start =
    consultation
      ?.availableStartTime
    || '-';

  const end =
    consultation
      ?.availableEndTime
    || '-';

  return `${start}~${end}`;
}


function getConsultationStatusLabel(
  status,
) {
  switch (status) {
    case 'PROPOSED':
      return '보호자 응답 대기';

    case 'CONFIRMED':
      return '일정 확정';

    case 'CHANGE_REQUESTED':
      return '일정 변경 요청';

    case 'COMPLETED':
      return '상담 완료';

    case 'CANCELLED':
      return '취소';

    default:
      return '상담 조율 중';
  }
}


export default function Dashboard() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const welfareWorkerId =
    getUserId();

  const today =
    todayString();

  const initialDate =
    new Date(
      `${today}T00:00:00`,
    );


  const [
    seniors,
    setSeniors,
  ] = useState([]);

  const [
    highRisk,
    setHighRisk,
  ] = useState([]);

  const [
    actions,
    setActions,
  ] = useState([]);

  const [
    recalled,
    setRecalled,
  ] = useState([]);

  const [
    consultationModalOpen,
    setConsultationModalOpen,
  ] = useState(false);

  const [
    energyCandidates,
    setEnergyCandidates,
  ] = useState([]);

  const [
    consultations,
    setConsultations,
  ] = useState([]);

  const [
    assessing,
    setAssessing,
  ] = useState(false);


  const [
    calendarYear,
    setCalendarYear,
  ] = useState(
    initialDate.getFullYear(),
  );

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    initialDate.getMonth() + 1,
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(today);

  const [
    openScheduleDate,
    setOpenScheduleDate,
  ] = useState(null);


  const [
    scheduleModal,
    setScheduleModal,
  ] = useState(null);

  const [
    scheduleForm,
    setScheduleForm,
  ] = useState({
    ...EMPTY_SCHEDULE_FORM,
    dueDate: today,
  });


  const [
    consultationModal,
    setConsultationModal,
  ] = useState(null);

  const [
    consultationForm,
    setConsultationForm,
  ] = useState({
    ...EMPTY_CONSULTATION_FORM,
    consultationDate: today,
  });

  const [
    consultationLoading,
    setConsultationLoading,
  ] = useState(false);

  const [
    consultationSaving,
    setConsultationSaving,
  ] = useState(false);

  const [
    consultationError,
    setConsultationError,
  ] = useState('');


  async function loadDashboardData() {
    if (!welfareWorkerId) {
      return;
    }

    const [
      seniorResult,
      actionResult,
      riskResult,
      energyResults,
      consultationResult,
    ] = await Promise.all([
      getSeniorsByWelfareWorker(
        welfareWorkerId,
      ).catch(() => ({
        data: [],
      })),

      getActionsByWelfareWorker(
        welfareWorkerId,
      ).catch(() => ({
        data: [],
      })),

      getHighRisk()
        .catch(() => ({
          data: [],
        })),

      Promise.all(
        [
          'VOUCHER',
          'ELECTRICITY',
          'GAS',
        ].map(
          async (type) => {
            try {
              const result =
                await getEnergySupportCandidates(
                  welfareWorkerId,
                  type,
                  'ACTIVE',
                );

              return normalizeArray(
                result,
              ).map(
                (item) => ({
                  ...item,

                  supportType:
                    item.supportType
                    || type,
                }),
              );
            } catch {
              return [];
            }
          },
        ),
      ),

      getEnergySupportConsultationRequests()
        .catch(() => []),
    ]);

    const loadedSeniors =
      normalizeArray(
        seniorResult,
      );

    const loadedActions =
      normalizeArray(
        actionResult,
      );

    setSeniors(
      loadedSeniors,
    );

    setActions(
      loadedActions,
    );

    setHighRisk(
      normalizeArray(
        riskResult,
      ),
    );

    setEnergyCandidates(
      energyResults.flat(),
    );

    setConsultations(
      normalizeArray(
        consultationResult,
      ),
    );

    const recalledResult =
      await getRecalledProductsByWelfareWorker(
        welfareWorkerId,
      ).catch(() => ({
        data: [],
      }));

    const recalledProducts =
      normalizeArray(
        recalledResult,
      );

    if (
      recalledProducts.length > 0
    ) {
      setRecalled(
        filterProductsByRecallRequests(
          recalledProducts,
          loadedActions,
        ),
      );

      return;
    }

    const productResults =
      await Promise.all(
        loadedSeniors.map(
          (senior) => (
            getProductsBySenior(
              senior.id,
            ).catch(() => ({
              data: [],
            }))
          ),
        ),
      );

    const products =
      productResults
        .flatMap(
          (result) => (
            normalizeArray(
              result,
            )
          ),
        )
        .filter(
          (product) => (
            product
              .recallDecisionStatus
            === 'RECALL_CONFIRMED'
            || (
              !product
                .recallDecisionStatus
              && product
                .recallStatus
              === 'RECALLED'
            )
          ),
        );

    setRecalled(
      filterProductsByRecallRequests(
        products,
        loadedActions,
      ),
    );
  }


  useEffect(() => {
    loadDashboardData();
  }, [welfareWorkerId]);


  useEffect(() => {
    if (!openScheduleDate) {
      return undefined;
    }

    function closePopoverOnOutsideClick(
      event,
    ) {
      if (
        event.target.closest(
          '.calendar-popover',
        )
        || event.target.closest(
          '.mini-calendar-cell > button',
        )
      ) {
        return;
      }

      setOpenScheduleDate(
        null,
      );
    }

    document.addEventListener(
      'mousedown',
      closePopoverOnOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        closePopoverOnOutsideClick,
      );
    };
  }, [openScheduleDate]);


  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        location.search,
      );

    const shouldOpen =
      searchParams.get(
        'openConsultation',
      ) === 'true';

    const requestId =
      searchParams.get(
        'consultationRequestId',
      );

    if (
      !shouldOpen
      || !requestId
    ) {
      return undefined;
    }

    let cancelled = false;

    /*
     * API 조회가 끝나기 전부터
     * 모달을 먼저 열어 둔다.
     */
    setConsultationModalOpen(true);
    setConsultationLoading(true);
    setConsultationError('');
    setConsultationModal(null);

    async function openConsultationFromAlert() {
      try {
        const consultation =
          await getEnergySupportConsultation(
            requestId,
          );

        if (cancelled) {
          return;
        }

        const proposedDate =
          consultation?.consultationDate
          || today;

        setConsultationModal({
          request: consultation,
        });

        setConsultationForm({
          consultationDate:
            proposedDate,

          availableStartTime:
            consultation?.availableStartTime
            || '',

          availableEndTime:
            consultation?.availableEndTime
            || '',

          consultationMethod:
            consultation?.consultationMethod
            || 'PHONE',

          message:
            consultation?.scheduleMessage
            || '에너지복지 필수 정보 확인을 위한 상담입니다.',
        });

        const selectedDateValue =
          new Date(
            `${proposedDate}T00:00:00`,
          );

        setSelectedDate(
          proposedDate,
        );

        setCalendarYear(
          selectedDateValue.getFullYear(),
        );

        setCalendarMonth(
          selectedDateValue.getMonth() + 1,
        );

        /*
         * 쿼리 파라미터만 제거한다.
         * 모달 상태는 유지된다.
         */
        navigate(
          '/welfare',
          {
            replace: true,
          },
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          '상담 요청 단건 조회 실패:',
          error,
        );

        setConsultationError(
          getErrorMessage(
            error,
            '상담 요청 정보를 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (!cancelled) {
          setConsultationLoading(false);
        }
      }
    }

    openConsultationFromAlert();

    return () => {
      cancelled = true;
    };
  }, [
    location.search,
    navigate,
    today,
  ]);


  const seniorById =
    useMemo(
      () => (
        new Map(
          seniors.map(
            (senior) => [
              Number(senior.id),
              senior,
            ],
          ),
        )
      ),
      [seniors],
    );


  const assignedIds =
    useMemo(
      () => (
        new Set(
          seniors.map(
            (senior) => (
              Number(
                senior.id,
              )
            ),
          ),
        )
      ),
      [seniors],
    );


  const assignedHighRisk =
    useMemo(
      () => (
        highRisk
          .filter(
            (item) => (
              assignedIds.has(
                Number(
                  item.seniorId,
                ),
              )
              && Number(
                item.totalScore
                || 0,
              ) >= 30
            ),
          )
          .sort(
            (first, second) => (
              Number(
                second.totalScore
                || 0,
              )
              - Number(
                first.totalScore
                || 0,
              )
            ),
          )
      ),
      [
        assignedIds,
        highRisk,
      ],
    );


  const activeActions =
    actions.filter(
      (action) => (
        !TERMINAL_STATUSES.includes(
          action.status,
        )
      ),
    );


  const todayVisits =
    activeActions.filter(
      (action) => (
        action.actionType
        === 'VISIT'
        && dateOnly(
          action.dueDate,
        ) === today
      ),
    );


  const todayContacts =
    activeActions.filter(
      (action) => (
        action.actionType
        !== 'VISIT'
        && dateOnly(
          action.dueDate,
        ) === today
      ),
    );


  const overdueActions =
    activeActions
      .filter(
        (action) => (
          action.dueDate
          && dateOnly(
            action.dueDate,
          ) < today
        ),
      )
      .sort(
        (first, second) => (
          dateOnly(
            first.dueDate,
          ).localeCompare(
            dateOnly(
              second.dueDate,
            ),
          )
        ),
      );


  const newCandidates =
    energyCandidates.filter(
      (candidate) => (
        !candidate.status
        || candidate.status
        === 'CONFIRMATION_NEEDED'
      ),
    );


  const visitActions =
    actions.filter(
      (action) => (
        action.actionType
        === 'VISIT'
        && action.dueDate
      ),
    );


  const scheduledConsultations =
    consultations.filter(
      (consultation) => (
        consultation.consultationDate
        && ACTIVE_CONSULTATION_SCHEDULE_STATUSES
          .includes(
            consultation.scheduleStatus,
          )
      ),
    );


  const selectedVisits =
    visitActions
      .filter(
        (action) => (
          dateOnly(
            action.dueDate,
          ) === selectedDate
        ),
      )
      .sort(
        (first, second) => {
          const timeCompare =
            (
              scheduleTime(first)
              || '23:59'
            ).localeCompare(
              scheduleTime(second)
              || '23:59',
            );

          if (timeCompare !== 0) {
            return timeCompare;
          }

          return (
            Number(
              second.id
              || 0,
            )
            - Number(
              first.id
              || 0,
            )
          );
        },
      );


  const selectedConsultations =
    scheduledConsultations
      .filter(
        (consultation) => (
          dateOnly(
            consultation
              .consultationDate,
          ) === selectedDate
        ),
      )
      .sort(
        (first, second) => (
          (
            first
              .availableStartTime
            || '23:59'
          ).localeCompare(
            second
              .availableStartTime
            || '23:59',
          )
        ),
      );


  const firstWeekday =
    new Date(
      calendarYear,
      calendarMonth - 1,
      1,
    ).getDay();


  const daysInMonth =
    new Date(
      calendarYear,
      calendarMonth,
      0,
    ).getDate();


  const calendarCells = [
    ...Array.from(
      {
        length:
          firstWeekday,
      },
      () => null,
    ),

    ...Array.from(
      {
        length:
          daysInMonth,
      },
      (
        _,
        index,
      ) => index + 1,
    ),
  ];


  function seniorName(item) {
    return (
      item.seniorName
      || seniorById.get(
        Number(
          item.seniorId,
        ),
      )?.name
      || '대상자'
    );
  }


  function goToAction(action) {
    if (
      action.actionType
      === 'VISIT'
    ) {
      const date =
        dateOnly(
          action.dueDate,
        )
        || today;

      const next =
        new Date(
          `${date}T00:00:00`,
        );

      setCalendarYear(
        next.getFullYear(),
      );

      setCalendarMonth(
        next.getMonth() + 1,
      );

      setSelectedDate(
        date,
      );

      setOpenScheduleDate(
        date,
      );

      return;
    }

    if (
      action.actionType
      === 'RECALL'
    ) {
      navigate(
        '/welfare/recalled',
      );

      return;
    }

    if (
      [
        'VOUCHER',
        'ELECTRICITY_DISCOUNT',
      ].includes(
        action.actionType,
      )
    ) {
      navigate(
        '/welfare/energy-voucher',
      );

      return;
    }

    if (action.seniorId) {
      navigate(
        `/welfare/seniors/${action.seniorId}`,
      );
    }
  }


  async function handleAssessAll() {
    setAssessing(
      true,
    );

    try {
      await assessAll();

      const response =
        await getHighRisk();

      setHighRisk(
        normalizeArray(
          response,
        ),
      );
    } finally {
      setAssessing(
        false,
      );
    }
  }


  const workItems = [
    [
      '오늘 방문',
      todayVisits.length,
      () => {
        setSelectedDate(
          today,
        );

        setOpenScheduleDate(
          today,
        );

        const current =
          new Date(
            `${today}T00:00:00`,
          );

        setCalendarYear(
          current.getFullYear(),
        );

        setCalendarMonth(
          current.getMonth() + 1,
        );
      },
    ],

    [
      '오늘 연락',
      todayContacts.length,
      () => {
        navigate(
          '/welfare/energy-voucher',
        );
      },
    ],

    [
      '기한 지난 업무',
      overdueActions.length,
      () => {
        if (
          overdueActions[0]
        ) {
          goToAction(
            overdueActions[0],
          );
        }
      },
    ],

    [
      '신규 확인 업무',
      newCandidates.length,
      () => {
        navigate(
          '/welfare/energy-voucher',
        );
      },
    ],
  ];


  function changeCalendarMonth(
    offset,
  ) {
    const next =
      new Date(
        calendarYear,
        calendarMonth - 1 + offset,
        1,
      );

    setCalendarYear(
      next.getFullYear(),
    );

    setCalendarMonth(
      next.getMonth() + 1,
    );

    setSelectedDate(
      [
        next.getFullYear(),
        String(
          next.getMonth() + 1,
        ).padStart(2, '0'),
        '01',
      ].join('-'),
    );

    setOpenScheduleDate(
      null,
    );
  }


  function calendarDate(day) {
    return [
      calendarYear,
      String(
        calendarMonth,
      ).padStart(2, '0'),
      String(day)
        .padStart(2, '0'),
    ].join('-');
  }


  function calendarTone(day) {
    const date =
      calendarDate(day);

    const visits =
      visitActions.filter(
        (action) => (
          dateOnly(
            action.dueDate,
          ) === date
        ),
      );

    const consultationExists =
      scheduledConsultations.some(
        (consultation) => (
          dateOnly(
            consultation
              .consultationDate,
          ) === date
        ),
      );

    if (consultationExists) {
      return 'consultation';
    }

    if (
      visits.some(
        (action) => (
          !TERMINAL_STATUSES.includes(
            action.status,
          )
          && date < today
        ),
      )
    ) {
      return 'overdue';
    }

    return visits.length > 0
      ? 'scheduled'
      : '';
  }


  function openCreateSchedule(
    date = selectedDate,
  ) {
    setScheduleForm({
      ...EMPTY_SCHEDULE_FORM,
      dueDate: date,
    });

    setScheduleModal({
      mode: 'create',
    });
  }


  function openEditSchedule(action) {
    setScheduleForm({
      seniorId:
        action.seniorId
          ? String(
            action.seniorId,
          )
          : '',

      dueDate:
        dateOnly(
          action.dueDate,
        )
        || selectedDate,

      visitTime:
        scheduleTime(
          action,
        ),

      note:
        scheduleNote(
          action,
        ),
    });

    setScheduleModal({
      mode: 'edit',
      action,
    });
  }


  function closeScheduleModal() {
    setScheduleModal(
      null,
    );

    setScheduleForm({
      ...EMPTY_SCHEDULE_FORM,
      dueDate:
        selectedDate,
    });
  }


  async function handleScheduleSubmit(
    event,
  ) {
    event.preventDefault();

    const payload = {
      welfareWorkerId,

      seniorId:
        Number(
          scheduleForm.seniorId,
        ),

      actionType:
        'VISIT',

      actionSubject:
        'WELFARE_WORKER',

      status:
        scheduleModal
          ?.action
          ?.status
        || 'PENDING',

      dueDate:
        scheduleForm.dueDate,

      visitTime:
        scheduleForm.visitTime,

      note:
        buildScheduleNote(
          scheduleForm.note,
          scheduleForm.visitTime,
        ),
    };

    if (
      scheduleModal?.mode
      === 'edit'
    ) {
      try {
        await updateAction(
          scheduleModal.action.id,
          payload,
        );
      } catch {
        await createAction(
          payload,
        );

        await deleteAction(
          scheduleModal.action.id,
        );
      }
    } else {
      await createAction(
        payload,
      );
    }

    setSelectedDate(
      scheduleForm.dueDate,
    );

    setOpenScheduleDate(
      scheduleForm.dueDate,
    );

    closeScheduleModal();

    await loadDashboardData();
  }


  async function handleScheduleDelete(
    action,
  ) {
    const confirmed =
      window.confirm(
        `${seniorName(action)}님의 방문 일정을 삭제할까요?`,
      );

    if (!confirmed) {
      return;
    }

    await deleteAction(
      action.id,
    );

    await loadDashboardData();
  }


  function closeConsultationModal() {
    setConsultationModalOpen(
      false,
    );

    setConsultationModal(
      null,
    );

    setConsultationLoading(
      false,
    );

    setConsultationError(
      '',
    );

    setConsultationForm({
      ...EMPTY_CONSULTATION_FORM,
      consultationDate:
        today,
    });
  }


  async function handleConsultationSubmit(
    event,
  ) {
    event.preventDefault();

    if (
      !consultationModal
        ?.request
        ?.id
    ) {
      return;
    }

    if (
      !consultationForm
        .consultationDate
    ) {
      setConsultationError(
        '상담 예정일을 선택해 주세요.',
      );

      return;
    }

    if (
      !consultationForm
        .availableStartTime
      || !consultationForm
        .availableEndTime
    ) {
      setConsultationError(
        '상담 가능 시작 시간과 종료 시간을 입력해 주세요.',
      );

      return;
    }

    if (
      consultationForm
        .availableEndTime
      <= consultationForm
        .availableStartTime
    ) {
      setConsultationError(
        '종료 시간은 시작 시간보다 늦어야 합니다.',
      );

      return;
    }

    setConsultationSaving(
      true,
    );

    setConsultationError(
      '',
    );

    try {
      const saved =
        await proposeEnergySupportConsultationSchedule(
          consultationModal
            .request
            .id,

          {
            consultationDate:
              consultationForm
                .consultationDate,

            availableStartTime:
              consultationForm
                .availableStartTime,

            availableEndTime:
              consultationForm
                .availableEndTime,

            consultationMethod:
              consultationForm
                .consultationMethod,

            message:
              consultationForm
                .message
                .trim()
              || null,
          },
        );

      const savedDate =
        saved
          ?.consultationDate
        || consultationForm
          .consultationDate;

      const nextDate =
        new Date(
          `${savedDate}T00:00:00`,
        );

      setSelectedDate(
        savedDate,
      );

      setCalendarYear(
        nextDate.getFullYear(),
      );

      setCalendarMonth(
        nextDate.getMonth() + 1,
      );

      setOpenScheduleDate(
        savedDate,
      );

      closeConsultationModal();

      await loadDashboardData();
    } catch (error) {
      setConsultationError(
        getErrorMessage(
          error,
          '보호자에게 상담 일정을 보내지 못했습니다.',
        ),
      );
    } finally {
      setConsultationSaving(
        false,
      );
    }
  }


  return (
    <div className="welfare-dashboard">
      <div className="dashboard-heading">
        <div>
          <h1 className="page-title">
            대시보드
          </h1>
        </div>
      </div>

      <div className="dashboard-stats">
        {[
          [
            '전체 대상자',
            seniors.length,
            '/welfare/seniors',
            'normal',
          ],
          [
            '우선 확인 후보',
            assignedHighRisk.length,
            '/welfare/seniors',
            'danger',
          ],
          [
            '에너지복지 미처리 건',
            energyCandidates.length,
            '/welfare/energy-voucher',
            'warning',
          ],
          [
            '리콜 조치 요청',
            recalled.length,
            '/welfare/recalled',
            'danger',
          ],
        ].map(
          ([
            label,
            value,
            path,
            tone,
          ]) => (
            <button
              key={label}
              type="button"
              className={
                `stat-card ${tone}`
              }
              onClick={() => {
                navigate(path);
              }}
            >
              <span className="label">
                {label}
              </span>

              <strong className="value">
                {value}
              </strong>
            </button>
          ),
        )}
      </div>

      <section className="dashboard-panel dashboard-workspace">
        <div className="dashboard-work-column">
          <h2>
            오늘의 업무
          </h2>

          <div className="today-work-list">
            {workItems.map(
              ([
                label,
                count,
                onClick,
              ]) => (
                <button
                  type="button"
                  key={label}
                  onClick={onClick}
                >
                  <span>
                    {label}
                  </span>

                  <strong>
                    {count}건
                  </strong>

                  <b>
                    ›
                  </b>
                </button>
              ),
            )}
          </div>
        </div>

        <div className="dashboard-calendar-column">
          <div className="mini-calendar-heading">
            <h2>
              {calendarYear}년 {calendarMonth}월 방문·상담 일정
            </h2>

            <div>
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => {
                  changeCalendarMonth(
                    -1,
                  );
                }}
              >
                ‹
              </button>

              <button
                type="button"
                aria-label="다음 달"
                onClick={() => {
                  changeCalendarMonth(
                    1,
                  );
                }}
              >
                ›
              </button>
            </div>
          </div>

          <div className="mini-calendar">
            <div className="mini-calendar-weekdays">
              {[
                '일',
                '월',
                '화',
                '수',
                '목',
                '금',
                '토',
              ].map(
                (day) => (
                  <span key={day}>
                    {day}
                  </span>
                ),
              )}
            </div>

            <div className="mini-calendar-days">
              {calendarCells.map(
                (
                  day,
                  index,
                ) => (
                  day ? (
                    <div
                      className="mini-calendar-cell"
                      key={day}
                    >
                      <button
                        type="button"
                        className={[
                          calendarDate(day)
                            === today
                            ? 'today'
                            : '',

                          calendarDate(day)
                            === selectedDate
                            ? 'selected'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => {
                          const date =
                            calendarDate(day);

                          setSelectedDate(
                            date,
                          );

                          setOpenScheduleDate(
                            (previous) => (
                              previous
                                === date
                                ? null
                                : date
                            ),
                          );
                        }}
                      >
                        <span>
                          {day}
                        </span>

                        {calendarTone(day) && (
                          <i
                            className={
                              calendarTone(day)
                            }
                          />
                        )}
                      </button>

                      {openScheduleDate
                        === calendarDate(day)
                        && (
                          <div className="calendar-popover">
                            <div className="calendar-popover__heading">
                              <strong>
                                {calendarMonth}월 {day}일 일정
                              </strong>

                              <button
                                type="button"
                                onClick={() => {
                                  openCreateSchedule(
                                    calendarDate(day),
                                  );
                                }}
                              >
                                방문 추가
                              </button>
                            </div>

                            {selectedVisits.length
                              === 0
                              && selectedConsultations.length
                              === 0 ? (
                              <p>
                                등록된 일정이 없습니다.
                              </p>
                            ) : (
                              <>
                                {selectedConsultations.map(
                                  (consultation) => (
                                    <article
                                      className="calendar-popover__item calendar-popover__item--consultation"
                                      key={
                                        `consultation-${consultation.id}`
                                      }
                                    >
                                      <div>
                                        <b>
                                          {getConsultationTimeLabel(
                                            consultation,
                                          )}
                                        </b>

                                        <span>
                                          {consultation
                                            .guardianDisplayName
                                            || `${consultation.seniorName || '대상자'} 님 보호자`}
                                          {' · '}
                                          {getConsultationStatusLabel(
                                            consultation.scheduleStatus,
                                          )}
                                        </span>
                                      </div>
                                    </article>
                                  ),
                                )}

                                {selectedVisits.map(
                                  (action) => (
                                    <article
                                      className="calendar-popover__item"
                                      key={action.id}
                                    >
                                      <div>
                                        <b>
                                          {scheduleTime(action)
                                            || '-'}
                                        </b>

                                        <span>
                                          {seniorName(action)}
                                          {' · '}
                                          {scheduleNote(action)}
                                        </span>
                                      </div>

                                      <div className="calendar-popover__actions">
                                        <button
                                          type="button"
                                          aria-label="일정 수정"
                                          title="수정"
                                          onClick={() => {
                                            openEditSchedule(
                                              action,
                                            );
                                          }}
                                        >
                                          <PencilIcon />
                                        </button>

                                        <button
                                          type="button"
                                          className="danger"
                                          aria-label="일정 삭제"
                                          title="삭제"
                                          onClick={() => {
                                            handleScheduleDelete(
                                              action,
                                            );
                                          }}
                                        >
                                          <TrashIcon />
                                        </button>
                                      </div>
                                    </article>
                                  ),
                                )}
                              </>
                            )}
                          </div>
                        )}
                    </div>
                  ) : (
                    <span
                      key={
                        `empty-${index}`
                      }
                    />
                  )
                ),
              )}
            </div>
          </div>

          <div className="calendar-legend">
            <span>
              <i className="scheduled" />
              방문 예정
            </span>

            <span>
              <i className="overdue" />
              기한 초과
            </span>

            <span>
              <i className="consultation" />
              상담 예정
            </span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-management">
        <div className="dashboard-priority-column">
          <div className="dashboard-panel-heading">
            <h2>
              우선 확인 대상자
            </h2>

            <button
              type="button"
              onClick={
                handleAssessAll
              }
              disabled={
                assessing
              }
            >
              {assessing
                ? '산정 중'
                : '다시 산정'}
            </button>
          </div>

          {assignedHighRisk.length
            === 0 ? (
            <div className="dashboard-empty">
              우선 확인 대상자가 없습니다.
            </div>
          ) : (
            <div className="dashboard-list">
              {assignedHighRisk
                .slice(
                  0,
                  5,
                )
                .map(
                  (item) => {
                    const related =
                      activeActions.find(
                        (action) => (
                          Number(
                            action.seniorId,
                          )
                          === Number(
                            item.seniorId,
                          )
                        ),
                      );

                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="priority-person-row"
                        onClick={() => {
                          navigate(
                            `/welfare/seniors/${item.seniorId}`,
                          );
                        }}
                      >
                        <div>
                          <strong>
                            {item.seniorName} · {item.seniorAge}세
                          </strong>

                          <small>
                            {String(
                              item.riskReason
                              || '-',
                            ).replaceAll(
                              ' + ',
                              ' · ',
                            )}
                          </small>
                        </div>

                        <span>
                          {related
                            ? TYPE_LABEL[
                            related.actionType
                            ] || '조치 예정'
                            : '확인 필요'}
                        </span>
                      </button>
                    );
                  },
                )}
            </div>
          )}
        </div>

        <div className="dashboard-overdue-column">
          <h2>
            기한 지난 업무
          </h2>

          {overdueActions.length
            === 0 ? (
            <div className="dashboard-empty">
              현재 지연된 조치가 없습니다.
            </div>
          ) : (
            <div className="dashboard-list">
              {overdueActions
                .slice(
                  0,
                  5,
                )
                .map(
                  (action) => (
                    <button
                      type="button"
                      key={action.id}
                      className="overdue-row"
                      onClick={() => {
                        goToAction(
                          action,
                        );
                      }}
                    >
                      <span>
                        {TYPE_LABEL[
                          action.actionType
                        ] || '후속 조치'}
                      </span>

                      <div>
                        <strong>
                          {seniorName(action)}
                        </strong>

                        <small>
                          {action.note
                            || '조치 내용 확인 필요'}
                        </small>
                      </div>

                      <b>
                        {dueLabel(
                          action,
                          today,
                        )}
                      </b>
                    </button>
                  ),
                )}
            </div>
          )}
        </div>
      </section>

      {scheduleModal && (
        <div
          className="modal-overlay"
          onClick={
            closeScheduleModal
          }
        >
          <div
            className="modal dashboard-schedule-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2>
              {scheduleModal.mode
                === 'edit'
                ? '방문 일정 수정'
                : '방문 일정 추가'}
            </h2>

            <form
              onSubmit={
                handleScheduleSubmit
              }
            >
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="schedule-senior"
                >
                  대상자
                </label>

                <select
                  id="schedule-senior"
                  className="form-input"
                  value={
                    scheduleForm.seniorId
                  }
                  onChange={(event) => {
                    setScheduleForm(
                      (previous) => ({
                        ...previous,
                        seniorId:
                          event.target.value,
                      }),
                    );
                  }}
                  required
                >
                  <option value="">
                    대상자를 선택하세요
                  </option>

                  {seniors.map(
                    (senior) => (
                      <option
                        key={senior.id}
                        value={senior.id}
                      >
                        {senior.name}
                        {senior.age
                          ? ` · ${senior.age}세`
                          : ''}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="dashboard-schedule-modal__row">
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="schedule-date"
                  >
                    방문일
                  </label>

                  <input
                    id="schedule-date"
                    className="form-input"
                    type="date"
                    value={
                      scheduleForm.dueDate
                    }
                    onChange={(event) => {
                      setScheduleForm(
                        (previous) => ({
                          ...previous,
                          dueDate:
                            event.target.value,
                        }),
                      );
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="schedule-time"
                  >
                    방문 시간
                  </label>

                  <input
                    id="schedule-time"
                    className="form-input"
                    type="time"
                    value={
                      scheduleForm.visitTime
                    }
                    onChange={(event) => {
                      setScheduleForm(
                        (previous) => ({
                          ...previous,
                          visitTime:
                            event.target.value,
                        }),
                      );
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="schedule-note"
                >
                  메모
                </label>

                <input
                  id="schedule-note"
                  className="form-input"
                  value={
                    scheduleForm.note
                  }
                  onChange={(event) => {
                    setScheduleForm(
                      (previous) => ({
                        ...previous,
                        note:
                          event.target.value,
                      }),
                    );
                  }}
                  placeholder="방문 목적이나 확인할 내용을 입력하세요"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={
                    closeScheduleModal
                  }
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                >
                  {scheduleModal.mode
                    === 'edit'
                    ? '저장'
                    : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {consultationModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (
              !consultationSaving
            ) {
              closeConsultationModal();
            }
          }}
        >
          <div
            className="modal dashboard-consultation-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2>
              상담 일정 추가
            </h2>

            {consultationLoading ? (
              <div className="dashboard-consultation-modal__state">
                상담 요청 정보를 불러오는 중입니다.
              </div>
            ) : consultationError ? (
              <>
                <div className="dashboard-consultation-modal__error">
                  {consultationError}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={
                      closeConsultationModal
                    }
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : consultationModal?.request ? (
              <form
                onSubmit={
                  handleConsultationSubmit
                }
              >
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="consultation-guardian"
                  >
                    대상 보호자
                  </label>

                  <input
                    id="consultation-guardian"
                    className="form-input dashboard-consultation-modal__readonly"
                    type="text"
                    value={
                      consultationModal
                        .request
                        .guardianDisplayName
                      || `${consultationModal
                        .request
                        .seniorName
                      || '대상자'
                      } 님 보호자`
                    }
                    readOnly
                  />
                </div>

                <div className="dashboard-schedule-modal__row">
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="consultation-date"
                    >
                      상담 예정일
                    </label>

                    <input
                      id="consultation-date"
                      className="form-input"
                      type="date"
                      min={today}
                      value={
                        consultationForm
                          .consultationDate
                      }
                      onChange={(event) => {
                        setConsultationForm(
                          (previous) => ({
                            ...previous,
                            consultationDate:
                              event.target.value,
                          }),
                        );
                      }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="consultation-method"
                    >
                      상담 방식
                    </label>

                    <select
                      id="consultation-method"
                      className="form-input"
                      value={
                        consultationForm
                          .consultationMethod
                      }
                      onChange={(event) => {
                        setConsultationForm(
                          (previous) => ({
                            ...previous,
                            consultationMethod:
                              event.target.value,
                          }),
                        );
                      }}
                    >
                      <option value="PHONE">
                        전화 상담
                      </option>

                      <option value="VISIT">
                        방문 상담
                      </option>
                    </select>
                  </div>
                </div>

                <div className="dashboard-schedule-modal__row">
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="consultation-start-time"
                    >
                      상담 가능 시작 시간
                    </label>

                    <input
                      id="consultation-start-time"
                      className="form-input"
                      type="time"
                      value={
                        consultationForm
                          .availableStartTime
                      }
                      onChange={(event) => {
                        setConsultationForm(
                          (previous) => ({
                            ...previous,
                            availableStartTime:
                              event.target.value,
                          }),
                        );
                      }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="consultation-end-time"
                    >
                      상담 가능 종료 시간
                    </label>

                    <input
                      id="consultation-end-time"
                      className="form-input"
                      type="time"
                      value={
                        consultationForm
                          .availableEndTime
                      }
                      onChange={(event) => {
                        setConsultationForm(
                          (previous) => ({
                            ...previous,
                            availableEndTime:
                              event.target.value,
                          }),
                        );
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="consultation-message"
                  >
                    전달 메모
                  </label>

                  <textarea
                    id="consultation-message"
                    className="form-input dashboard-consultation-modal__textarea"
                    value={
                      consultationForm.message
                    }
                    onChange={(event) => {
                      setConsultationForm(
                        (previous) => ({
                          ...previous,
                          message:
                            event.target.value,
                        }),
                      );
                    }}
                    placeholder="보호자에게 전달할 상담 내용을 입력하세요."
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={
                      closeConsultationModal
                    }
                    disabled={
                      consultationSaving
                    }
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      consultationSaving
                    }
                  >
                    {consultationSaving
                      ? '전송 중...'
                      : '보호자에게 요청'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="dashboard-consultation-modal__error">
                  상담 요청 정보가 없습니다.
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={
                      closeConsultationModal
                    }
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}