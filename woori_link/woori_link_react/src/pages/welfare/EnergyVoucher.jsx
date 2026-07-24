import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import '../../css/welfare/EnergyVoucher.css';

import {
  getElectricityDiscountDetail,
  getEnergySupportProfile,
  getEnergySupportCandidates,
  getEnergyVoucherDetail,
  getGasDiscountDetail,
  updateEnergySupportCase,
} from '../../api/energySupportApi';
import EnergySupportDetailCard from './energy-support/EnergySupportDetailCard';

import {
  getUserId,
} from '../../utils/auth';


const PAGE_SIZE = 7;


const STATUS_LABEL = {
  CONFIRMATION_NEEDED: '미확인',
  CONTACT_SCHEDULED: '연락 예정',
  CONSULTED: '상담 완료',
  DOCUMENTS_PREPARING: '서류 준비',
  APPLICATION_SUPPORTING: '신청 지원 중',
  APPLICATION_COMPLETED: '신청 완료',
  RESULT_CONFIRMED: '결과 확인',
  ALREADY_APPLIED: '이미 신청함',
  NOT_ELIGIBLE: '자격 미충족',
  DECLINED: '신청 의사 없음',
  UNREACHABLE: '연락 불가',
  ON_HOLD: '확인 보류',
};


const STATUS_OPTIONS = [
  'CONFIRMATION_NEEDED',
  'CONTACT_SCHEDULED',
  'CONSULTED',
  'DOCUMENTS_PREPARING',
  'APPLICATION_SUPPORTING',
  'APPLICATION_COMPLETED',
  'RESULT_CONFIRMED',
  'ALREADY_APPLIED',
  'NOT_ELIGIBLE',
  'DECLINED',
  'UNREACHABLE',
  'ON_HOLD',
].map((value) => [
  value,
  STATUS_LABEL[value],
]);


const NEXT_ACTION_REQUIRED_STATUSES = [
  'CONTACT_SCHEDULED',
  'CONSULTED',
  'DOCUMENTS_PREPARING',
  'APPLICATION_SUPPORTING',
  'UNREACHABLE',
];


const NEXT_ACTION_DISABLED_STATUSES = [
  'APPLICATION_COMPLETED',
  'RESULT_CONFIRMED',
  'NOT_ELIGIBLE',
  'DECLINED',
];


const INITIAL_FORM = {
  existingApplicationStatus: 'UNKNOWN',
  applicationIntent: 'UNKNOWN',
  declineReason: '',
  status: 'CONFIRMATION_NEEDED',
  contactMethod: '',
  nextActionDate: '',
  note: '',
};


function getEligibilityLevel(item) {
  return item?.eligibilityLevel
    ?? 'CONFIRMATION_NEEDED';
}


function getSystemJudgment(item) {
  const level =
    getEligibilityLevel(item);

  if (level === 'HIGH') {
    return '높음';
  }

  if (level === 'LOW') {
    return '낮음';
  }

  return '확인 필요';
}


function getCurrentStage(item) {
  if (
    !item?.existingApplicationStatus
    || item.existingApplicationStatus === 'UNKNOWN'
  ) {
    return '기존 신청 여부 확인';
  }

  return (
    STATUS_LABEL[item.status]
    || '미확인'
  );
}

function getMissingSummary(item) {
  const missing = Array.isArray(item?.missingInformation)
    ? item.missingInformation.filter(
      (value) => value && value !== '없음',
    )
    : [];

  if (missing.length === 0) {
    return '확인 완료';
  }

  return `${missing.length}개 항목`;
}

function getMissingType(item) {
  const missing = Array.isArray(item?.missingInformation)
    ? item.missingInformation
    : [];
  if (missing.length === 0) return 'complete';
  if (missing[0] === '기존 신청 여부') return 'worker';
  return 'guardian';
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getNextActionView(value) {
  if (!value) return { text: '미지정', tone: 'empty' };

  const target = parseLocalDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);

  if (days === 0) return { text: '오늘', tone: 'today' };
  if (days < 0) return { text: `${Math.abs(days)}일 지연`, tone: 'overdue' };
  if (days <= 7) return { text: `D-${days}`, tone: 'upcoming' };
  return { text: value.replaceAll('-', '.'), tone: 'normal' };
}

function getRecentActivityView(item) {
  const latest = Array.isArray(item?.history)
    ? item.history[0]
    : null;
  if (!latest?.createdAt) return '기록 없음';

  const createdAt = new Date(latest.createdAt);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const createdStart = new Date(
    createdAt.getFullYear(),
    createdAt.getMonth(),
    createdAt.getDate(),
  );
  const days = Math.round((todayStart - createdStart) / 86400000);

  if (days === 0) {
    return `오늘 ${String(createdAt.getHours()).padStart(2, '0')}:${String(
      createdAt.getMinutes(),
    ).padStart(2, '0')}`;
  }
  if (days === 1) return '어제';
  return `${String(createdAt.getMonth() + 1).padStart(2, '0')}.${String(
    createdAt.getDate(),
  ).padStart(2, '0')}`;
}


function getSupportTypeLabel(type) {
  switch (type) {
    case 'VOUCHER':
      return '에너지바우처';

    case 'ELECTRICITY':
      return '전기요금 할인';

    case 'GAS':
      return '도시가스요금 경감';

    default:
      return '에너지복지';
  }
}


function getRequestErrorMessage(
  error,
  fallbackMessage,
) {
  const responseData =
    error?.response?.data;

  if (
    typeof responseData === 'string'
    && responseData.trim()
  ) {
    return responseData;
  }

  if (
    typeof responseData?.message === 'string'
    && responseData.message.trim()
  ) {
    return responseData.message;
  }

  if (
    typeof responseData?.error === 'string'
    && responseData.error.trim()
  ) {
    return responseData.error;
  }

  return fallbackMessage;
}


function getUpdatedByRoleLabel(role) {
  switch (role) {
    case 'SENIOR':
      return '사용자';

    case 'GUARDIAN':
      return '보호자';

    case 'WELFARE_WORKER':
      return '복지사';

    case 'SYSTEM':
      return '시스템';

    default:
      return '입력 주체 미확인';
  }
}

function normalizeCandidateResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.content)) {
    return response.data.content;
  }

  if (Array.isArray(response?.content)) {
    return response.content;
  }

  return [];
}


export default function EnergyVoucher() {
  const [
    tab,
    setTab,
  ] = useState('VOUCHER');

  const [
    voucherCases,
    setVoucherCases,
  ] = useState([]);

  const [
    electricCases,
    setElectricCases,
  ] = useState([]);

  const [
    gasCases,
    setGasCases,
  ] = useState([]);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    caseScope,
    setCaseScope,
  ] = useState('ACTIVE');

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [energyProfile, setEnergyProfile] = useState(null);
  const [energyProfileLoading, setEnergyProfileLoading] = useState(false);

  const [
    form,
    setForm,
  ] = useState(INITIAL_FORM);

  const [
    gasDetail,
    setGasDetail,
  ] = useState(null);

  const [
    electricityDetail,
    setElectricityDetail,
  ] = useState(null);

  const [
    voucherDetail,
    setVoucherDetail,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingGasDetail,
    setLoadingGasDetail,
  ] = useState(false);

  const [
    electricityDetailLoading,
    setElectricityDetailLoading,
  ] = useState(false);

  const [
    voucherDetailLoading,
    setVoucherDetailLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState({
    message: '',
    type: 'success',
  });

  const toastTimerRef =
    useRef(null);


  const closeToast =
    useCallback(() => {
      if (toastTimerRef.current) {
        window.clearTimeout(
          toastTimerRef.current,
        );

        toastTimerRef.current = null;
      }

      setToast({
        message: '',
        type: 'success',
      });
    }, []);


  const showToast =
    useCallback((
      message,
      type = 'success',
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(
          toastTimerRef.current,
        );
      }

      setToast({
        message,
        type,
      });

      toastTimerRef.current =
        window.setTimeout(() => {
          setToast({
            message: '',
            type: 'success',
          });

          toastTimerRef.current = null;
        }, 2500);
    }, []);

  const loadElectricityDetail =
    useCallback(async (seniorId) => {
      if (!seniorId) {
        setElectricityDetail(null);
        return;
      }

      try {
        setElectricityDetailLoading(true);
        const detail =
          await getElectricityDiscountDetail(
            seniorId,
          );
        setElectricityDetail(detail);
      } catch (error) {
        console.error(
          '전기요금 상세 조회 실패:',
          error,
        );
        setElectricityDetail(null);
      } finally {
        setElectricityDetailLoading(false);
      }
    }, []);

  const loadVoucherDetail =
    useCallback(async (seniorId) => {
      if (!seniorId) {
        setVoucherDetail(null);
        return;
      }
      try {
        setVoucherDetailLoading(true);
        setVoucherDetail(
          await getEnergyVoucherDetail(seniorId),
        );
      } catch (error) {
        console.error('에너지바우처 상세 조회 실패:', error);
        setVoucherDetail(null);
      } finally {
        setVoucherDetailLoading(false);
      }
    }, []);


  const loadCases =
    useCallback(async ({
      showError = true,
    } = {}) => {
      const welfareWorkerId =
        getUserId();

      if (!welfareWorkerId) {
        setVoucherCases([]);
        setElectricCases([]);
        setGasCases([]);

        if (showError) {
          showToast(
            '복지사 정보를 확인할 수 없습니다. 다시 로그인해 주세요.',
            'error',
          );
        }

        return false;
      }

      setLoading(true);

      try {
        const [
          voucherResponse,
          electricityResponse,
          gasResponse,
        ] = await Promise.all([
          getEnergySupportCandidates(
            welfareWorkerId,
            'VOUCHER',
            caseScope,
          ),

          getEnergySupportCandidates(
            welfareWorkerId,
            'ELECTRICITY',
            caseScope,
          ),

          getEnergySupportCandidates(
            welfareWorkerId,
            'GAS',
            caseScope,
          ),
        ]);

        setVoucherCases(
          normalizeCandidateResponse(voucherResponse),
        );

        setElectricCases(
          normalizeCandidateResponse(electricityResponse),
        );

        setGasCases(
          normalizeCandidateResponse(gasResponse),
        );

        return true;
      } catch (error) {
        console.error(
          '에너지복지 대상자 조회 실패:',
          error,
        );

        if (showError) {
          showToast(
            getRequestErrorMessage(
              error,
              '에너지복지 대상자를 불러오지 못했습니다.',
            ),
            'error',
          );
        }

        return false;
      } finally {
        setLoading(false);
      }
    }, [caseScope, showToast]);


  useEffect(() => {
    loadCases();
  }, [loadCases]);


  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(
          toastTimerRef.current,
        );
      }
    };
  }, []);


  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.key === 'Escape'
        && selected
        && !saving
      ) {
        setSelected(null);
        setForm(INITIAL_FORM);
        setGasDetail(null);
        setLoadingGasDetail(false);
        setElectricityDetail(null);
        setElectricityDetailLoading(false);
        setVoucherDetail(null);
        setVoucherDetailLoading(false);
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    selected,
    saving,
  ]);


  const list =
    tab === 'VOUCHER'
      ? voucherCases
      : tab === 'ELECTRICITY'
        ? electricCases
        : gasCases;

  const label =
    getSupportTypeLabel(tab);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        list.length / PAGE_SIZE,
      ),
    );

  const pagedList =
    list.slice(
      (currentPage - 1)
      * PAGE_SIZE,

      currentPage
      * PAGE_SIZE,
    );


  useEffect(() => {
    if (
      currentPage > totalPages
    ) {
      setCurrentPage(
        totalPages,
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);


  async function openCase(item) {
    setSelected(item);
    setGasDetail(null);
    setElectricityDetail(null);
    setVoucherDetail(null);
    setEnergyProfile(null);
    setEnergyProfileLoading(true);
    getEnergySupportProfile(item.seniorId)
      .then(setEnergyProfile)
      .catch((error) => {
        console.error('공통 에너지복지 정보 조회 실패:', error);
        setEnergyProfile(null);
      })
      .finally(() => setEnergyProfileLoading(false));

    setForm({
      existingApplicationStatus:
        item?.existingApplicationStatus
        || 'UNKNOWN',

      applicationIntent:
        item?.applicationIntent
        || 'UNKNOWN',

      declineReason:
        item?.declineReason
        || '',

      status:
        item?.status
        || 'CONFIRMATION_NEEDED',

      contactMethod:
        item?.contactMethod
        || '',

      nextActionDate:
        item?.nextActionDate
        || '',

      note:
        item?.note
        || '',
    });

    if (item?.supportType === 'ELECTRICITY') {
      await loadElectricityDetail(
        item.seniorId,
      );
      return;
    }

    if (item?.supportType === 'VOUCHER') {
      await loadVoucherDetail(item.seniorId);
      return;
    }

    if (item?.supportType !== 'GAS') {
      return;
    }

    setLoadingGasDetail(true);

    try {
      const response =
        await getGasDiscountDetail(
          item.seniorId,
        );

      setGasDetail(
        response?.data || null,
      );
    } catch (error) {
      console.error(
        '도시가스 상세 정보 조회 실패:',
        error,
      );

      showToast(
        getRequestErrorMessage(
          error,
          '도시가스 상세 정보를 불러오지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setLoadingGasDetail(false);
    }
  }


  function closeCase() {
    if (saving) {
      return;
    }

    setSelected(null);
    setForm(INITIAL_FORM);
    setGasDetail(null);
    setLoadingGasDetail(false);
    setElectricityDetail(null);
    setElectricityDetailLoading(false);
    setVoucherDetail(null);
    setVoucherDetailLoading(false);
    setEnergyProfile(null);
    setEnergyProfileLoading(false);
  }


  async function saveCase(event) {
    event.preventDefault();

    if (
      !selected
      || saving
    ) {
      return;
    }

    const requiresNextAction =
      NEXT_ACTION_REQUIRED_STATUSES
        .includes(form.status)
      || [
        'DISCUSS_WITH_GUARDIAN',
        'DECIDE_LATER',
      ].includes(
        form.applicationIntent,
      );

    if (
      requiresNextAction
      && !form.nextActionDate
    ) {
      showToast(
        '현재 지원 상태에서는 다음 조치일을 입력해야 합니다.',
        'error',
      );

      return;
    }

    if (
      form.applicationIntent
      === 'DOES_NOT_WANT'
      && !form.declineReason
    ) {
      showToast(
        '신청하지 않는 사유를 선택해 주세요.',
        'error',
      );

      return;
    }

    if (
      form.status === 'NOT_ELIGIBLE'
      && !form.note.trim()
    ) {
      showToast(
        '자격 미충족 사유를 메모에 입력해 주세요.',
        'error',
      );

      return;
    }

    if (
      [
        'APPLICATION_COMPLETED',
        'DECLINED',
      ].includes(form.status)
      && !form.note.trim()
    ) {
      showToast(
        form.status === 'APPLICATION_COMPLETED'
          ? '신청 완료 내용을 메모에 입력해 주세요.'
          : '신청하지 않는 사유를 메모에 입력해 주세요.',
        'error',
      );

      return;
    }

    setSaving(true);

    try {
      await updateEnergySupportCase(
        selected.seniorId,
        selected.supportType,
        {
          status:
            form.status,

          existingApplicationStatus:
            form.existingApplicationStatus,

          applicationIntent:
            form.applicationIntent,

          declineReason:
            form.declineReason
            || null,

          contactMethod:
            form.contactMethod
            || null,

          nextActionDate:
            form.nextActionDate
            || null,

          note:
            form.note.trim()
            || null,
        },
      );

      const refreshed =
        await loadCases({
          showError: false,
        });

      setSelected(null);
      setForm(INITIAL_FORM);
      setGasDetail(null);
      setElectricityDetail(null);
      setElectricityDetailLoading(false);
      setVoucherDetail(null);
      setVoucherDetailLoading(false);

      showToast(
        refreshed
          ? '지원 기록을 저장했습니다.'
          : '지원 기록은 저장했지만 목록을 다시 불러오지 못했습니다.',
        refreshed
          ? 'success'
          : 'error',
      );
    } catch (error) {
      console.error(
        '에너지복지 지원 기록 저장 실패:',
        error,
      );

      showToast(
        getRequestErrorMessage(
          error,
          '지원 기록을 저장하지 못했습니다.',
        ),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }


  function changeTab(nextTab) {
    setTab(nextTab);
    setCurrentPage(1);
    setSelected(null);
    setGasDetail(null);
    setElectricityDetail(null);
    setElectricityDetailLoading(false);
    setVoucherDetail(null);
    setVoucherDetailLoading(false);
  }


  function changeExistingApplicationStatus(
    value,
  ) {
    setForm((previous) => {
      const nextStatus =
        value === 'ALREADY_APPLIED'
          ? 'ALREADY_APPLIED'
          : previous.status === 'ALREADY_APPLIED'
            ? 'CONFIRMATION_NEEDED'
            : previous.status;

      return {
        ...previous,

        existingApplicationStatus:
          value,

        status:
          nextStatus,

        applicationIntent:
          value === 'NOT_APPLIED'
            ? previous.applicationIntent
            : 'UNKNOWN',

        declineReason:
          value === 'NOT_APPLIED'
            ? previous.declineReason
            : '',

        nextActionDate:
          value === 'ALREADY_APPLIED'
            ? ''
            : previous.nextActionDate,
      };
    });
  }


  function changeApplicationIntent(
    value,
  ) {
    setForm((previous) => ({
      ...previous,

      applicationIntent:
        value,

      declineReason:
        value === 'DOES_NOT_WANT'
          ? previous.declineReason
          : '',

      status:
        value === 'DOES_NOT_WANT'
          ? 'DECLINED'
          : previous.status === 'DECLINED'
            ? 'CONFIRMATION_NEEDED'
            : previous.status,

      nextActionDate:
        value === 'DOES_NOT_WANT'
          ? ''
          : previous.nextActionDate,
    }));
  }


  function changeStatus(value) {
    setForm((previous) => ({
      ...previous,

      status:
        value,

      nextActionDate:
        NEXT_ACTION_DISABLED_STATUSES
          .includes(value)
          ? ''
          : previous.nextActionDate,
    }));
  }


  const showFollowUpFields =
    form.existingApplicationStatus !== 'NOT_APPLIED'
    || [
      'WANTS_TO_APPLY',
      'DISCUSS_WITH_GUARDIAN',
      'DECIDE_LATER',
    ].includes(
      form.applicationIntent,
    );

  const showNoteField =
    showFollowUpFields
    || form.applicationIntent
    === 'DOES_NOT_WANT';

  const isAlreadyApplied =
    form.existingApplicationStatus
    === 'ALREADY_APPLIED';

  const nextActionRequired =
    !isAlreadyApplied
    && (
      NEXT_ACTION_REQUIRED_STATUSES
        .includes(form.status)
      || [
        'DISCUSS_WITH_GUARDIAN',
        'DECIDE_LATER',
      ].includes(
        form.applicationIntent,
      )
    );

  return (
    <div className="energy-support-page">
      {toast.message && (
        <div
          className={[
            'energy-toast',
            `energy-toast--${toast.type}`,
          ].join(' ')}
          role={
            toast.type === 'error'
              ? 'alert'
              : 'status'
          }
          aria-live={
            toast.type === 'error'
              ? 'assertive'
              : 'polite'
          }
        >
          <span
            className="energy-toast__icon"
            aria-hidden="true"
          >
            {toast.type === 'success'
              ? '✓'
              : '!'}
          </span>

          <p>
            {toast.message}
          </p>

          <button
            type="button"
            className="energy-toast__close"
            aria-label="알림 닫기"
            onClick={closeToast}
          >
            ×
          </button>
        </div>
      )}

      <h1 className="page-title">
        에너지복지 신청 확인 대상
      </h1>

      <div className="card energy-list-card">
        <div className="energy-filter-section">
          <div className="energy-filter-row">
            <div className="energy-filter-group energy-support-type-group">
              <div
                className="tab-bar"
                role="tablist"
                aria-label="에너지복지 지원 종류"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'VOUCHER'}
                  className={[
                    'tab-btn',
                    tab === 'VOUCHER'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    changeTab('VOUCHER');
                  }}
                >
                  <span>에너지바우처</span>
                  <strong>{voucherCases.length}</strong>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'ELECTRICITY'}
                  className={[
                    'tab-btn',
                    tab === 'ELECTRICITY'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    changeTab('ELECTRICITY');
                  }}
                >
                  <span>전기요금 할인</span>
                  <strong>{electricCases.length}</strong>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'GAS'}
                  className={[
                    'tab-btn',
                    tab === 'GAS'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    changeTab('GAS');
                  }}
                >
                  <span>도시가스요금 경감</span>
                  <strong>{gasCases.length}</strong>
                </button>
              </div>
            </div>

            <div className="energy-filter-group energy-case-scope-group">
              <div
                className="case-scope-bar"
                role="tablist"
                aria-label="처리 상태"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={caseScope === 'ACTIVE'}
                  className={
                    caseScope === 'ACTIVE'
                      ? 'active'
                      : ''
                  }
                  onClick={() => {
                    setCaseScope('ACTIVE');
                    setCurrentPage(1);
                  }}
                >
                  진행 중
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={caseScope === 'COMPLETED'}
                  className={
                    caseScope === 'COMPLETED'
                      ? 'active'
                      : ''
                  }
                  onClick={() => {
                    setCaseScope('COMPLETED');
                    setCurrentPage(1);
                  }}
                >
                  완료·보류
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && list.length === 0 ? (
          <div className="empty-state">
            대상자 목록을 불러오고 있습니다.
          </div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            {label}
            {' '}
            확인 대상자가 없습니다.
          </div>
        ) : (
          <>
            <table className="data-table support-table">
              <thead>
                <tr>
                  <th>대상자</th>
                  <th>신청 가능성</th>
                  <th>확인 필요</th>
                  <th>현재 단계</th>
                  <th>다음 조치일</th>
                  <th>최근 처리</th>
                </tr>
              </thead>

              <tbody>
                {pagedList.map((item) => {
                  const eligibilityLevel =
                    getEligibilityLevel(item);
                  const nextAction =
                    getNextActionView(item.nextActionDate);

                  return (
                    <tr
                      key={item.seniorId}
                      className="support-table-row"
                      tabIndex={0}
                      aria-label={`${item.seniorName} 지원 관리 열기`}
                      onClick={() => {
                        openCase(item);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter'
                          || event.key === ' '
                        ) {
                          event.preventDefault();
                          openCase(item);
                        }
                      }}
                    >
                      <td>
                        <div className="support-person">
                          <strong>
                            {item.seniorName}
                            ({item.seniorAge}세)
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span
                          className={[
                            'support-possibility',
                            `eligibility-${eligibilityLevel.toLowerCase()}`,
                          ].join(' ')}
                        >
                          {getSystemJudgment(
                            item,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            'missing-summary',
                            getMissingType(item),
                          ].join(' ')}
                        >
                          {getMissingSummary(item)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            'support-status',
                            `status-${(
                              item.status
                              || 'confirmation_needed'
                            ).toLowerCase()}`,
                          ].join(' ')}
                        >
                          {getCurrentStage(
                            item,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`support-next-action ${nextAction.tone}`}
                        >
                          {nextAction.text}
                        </span>
                      </td>

                      <td>
                        <div className="support-recent-activity">
                          <span>{getRecentActivityView(item)}</span>
                          <span aria-hidden="true">›</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="voucher-pagination">
                <button
                  type="button"
                  className="voucher-page-btn voucher-page-arrow"
                  disabled={
                    currentPage === 1
                  }
                  aria-label="이전 페이지"
                  onClick={() => {
                    setCurrentPage(
                      (page) => page - 1,
                    );
                  }}
                >
                  ‹
                </button>

                {Array.from(
                  {
                    length: totalPages,
                  },
                  (_, index) => index + 1,
                ).map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={[
                      'voucher-page-btn',
                      currentPage === page
                        ? 'active'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setCurrentPage(page);
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="voucher-page-btn voucher-page-arrow"
                  disabled={
                    currentPage === totalPages
                  }
                  aria-label="다음 페이지"
                  onClick={() => {
                    setCurrentPage(
                      (page) => page + 1,
                    );
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div
          className="support-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeCase();
            }
          }}
        >
          <form
            className="support-modal"
            onSubmit={saveCase}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="support-modal-header">
              <div>
                <h2>
                  {selected.seniorName}
                  {' · '}
                  {selected.seniorAge}
                  세
                </h2>

                <p>
                  {getSupportTypeLabel(
                    selected.supportType,
                  )}
                  {' '}
                  신청 지원
                </p>
              </div>

              <button
                type="button"
                className="support-modal-close"
                aria-label="닫기"
                disabled={saving}
                onClick={closeCase}
              >
                ×
              </button>
            </div>

            <div className="support-modal-scroll">
              <div className="support-modal-content support-modal-content--combined">
                <EnergySupportDetailCard
                  supportType={selected.supportType}
                  profile={energyProfile}
                  profileLoading={energyProfileLoading}
                  voucherDetail={voucherDetail}
                  electricityDetail={electricityDetail}
                  gasDetail={gasDetail}
                  loading={
                    selected.supportType === 'VOUCHER'
                      ? voucherDetailLoading
                      : selected.supportType === 'ELECTRICITY'
                        ? electricityDetailLoading
                        : loadingGasDetail
                  }
                  missingInformation={
                    selected.missingInformation ?? []
                  }
                />

                <section className="support-progress-section">
                  <div className="support-progress-header">
                    <h3>
                      지원 진행 기록
                    </h3>
                  </div>

                  <div className="support-form-grid">
                    <label className="support-primary-field">
                      기존 신청 여부

                      <select
                        value={
                          form.existingApplicationStatus
                        }
                        disabled={saving}
                        onChange={(event) => {
                          changeExistingApplicationStatus(
                            event.target.value,
                          );
                        }}
                      >
                        <option value="UNKNOWN">
                          미확인
                        </option>

                        <option value="NOT_APPLIED">
                          미신청
                        </option>

                        <option value="ALREADY_APPLIED">
                          이미 신청함
                        </option>
                      </select>
                    </label>

                    {form.existingApplicationStatus
                      === 'NOT_APPLIED' && (
                        <label>
                          신청 의사

                          <select
                            value={
                              form.applicationIntent
                            }
                            disabled={saving}
                            onChange={(event) => {
                              changeApplicationIntent(
                                event.target.value,
                              );
                            }}
                          >
                            <option value="UNKNOWN">
                              미확인
                            </option>

                            <option value="WANTS_TO_APPLY">
                              신청 희망
                            </option>

                            <option value="DOES_NOT_WANT">
                              신청하지 않음
                            </option>

                            <option value="DISCUSS_WITH_GUARDIAN">
                              보호자와 상의
                            </option>

                            <option value="DECIDE_LATER">
                              추후 결정
                            </option>
                          </select>
                        </label>
                      )}

                    {form.existingApplicationStatus
                      === 'NOT_APPLIED'
                      && form.applicationIntent
                      === 'WANTS_TO_APPLY' && (
                        <label>
                          지원 상태

                          <select
                            value={form.status}
                            disabled={saving}
                            onChange={(event) => {
                              changeStatus(
                                event.target.value,
                              );
                            }}
                          >
                            {STATUS_OPTIONS.map(
                              ([
                                value,
                                text,
                              ]) => (
                                <option
                                  key={value}
                                  value={value}
                                >
                                  {text}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}

                    {form.existingApplicationStatus
                      === 'NOT_APPLIED'
                      && form.applicationIntent
                      === 'DOES_NOT_WANT' && (
                        <label>
                          신청하지 않는 사유 *

                          <select
                            value={form.declineReason}
                            required
                            disabled={saving}
                            onChange={(event) => {
                              setForm(
                                (previous) => ({
                                  ...previous,
                                  declineReason:
                                    event.target.value,
                                }),
                              );
                            }}
                          >
                            <option value="">
                              선택
                            </option>

                            <option value="SELF_DECLINED">
                              본인 거절
                            </option>

                            <option value="FAMILY_DISCUSSION_REQUIRED">
                              가족과 상의 필요
                            </option>

                            <option value="USING_OTHER_SUPPORT">
                              이미 다른 지원 이용 중
                            </option>

                            <option value="OTHER">
                              기타
                            </option>
                          </select>
                        </label>
                      )}

                    {showFollowUpFields && (
                      <label>
                        상담 방법

                        <select
                          value={form.contactMethod}
                          disabled={saving}
                          onChange={(event) => {
                            setForm(
                              (previous) => ({
                                ...previous,
                                contactMethod:
                                  event.target.value,
                              }),
                            );
                          }}
                        >
                          <option value="">
                            상담 방법 선택
                          </option>

                          <option value="전화">
                            전화
                          </option>

                          <option value="방문">
                            방문
                          </option>

                          <option value="보호자 전달">
                            보호자 전달
                          </option>

                          <option value="문자">
                            문자
                          </option>

                          <option value="기타">
                            기타
                          </option>
                        </select>
                      </label>
                    )}

                    {showFollowUpFields
                      && !isAlreadyApplied && (
                        <label>
                          다음 조치일

                          {nextActionRequired
                            ? ' *'
                            : ''}

                          <input
                            type="date"
                            value={form.nextActionDate}
                            required={nextActionRequired}
                            disabled={
                              saving
                              || NEXT_ACTION_DISABLED_STATUSES
                                .includes(
                                  form.status,
                                )
                            }
                            onChange={(event) => {
                              setForm(
                                (previous) => ({
                                  ...previous,
                                  nextActionDate:
                                    event.target.value,
                                }),
                              );
                            }}
                          />
                        </label>
                      )}

                    {showNoteField && (
                      <label className="support-note-field">
                        상담 및 담당자 메모

                        {[
                          'NOT_ELIGIBLE',
                          'APPLICATION_COMPLETED',
                          'DECLINED',
                        ].includes(
                          form.status,
                        )
                          ? ' *'
                          : ''}

                        <textarea
                          value={form.note}
                          disabled={saving}
                          required={[
                            'NOT_ELIGIBLE',
                            'APPLICATION_COMPLETED',
                            'DECLINED',
                          ].includes(
                            form.status,
                          )}
                          placeholder={
                            form.status === 'NOT_ELIGIBLE'
                              ? '자격 미충족 사유를 입력하세요.'
                              : form.status === 'APPLICATION_COMPLETED'
                                ? '신청일 또는 완료 내용을 입력하세요.'
                                : '확인 내용, 신청 의사, 준비 서류 등을 기록하세요.'
                          }
                          onChange={(event) => {
                            setForm(
                              (previous) => ({
                                ...previous,
                                note:
                                  event.target.value,
                              }),
                            );
                          }}
                        />
                      </label>
                    )}
                  </div>
                </section>

                {selected.history?.length > 0 ? (
                  <section className="support-history">
                    <h3>
                      상담 및 조치 기록
                    </h3>

                    {selected.history.map(
                      (activity) => (
                        <div
                          className="support-history-item"
                          key={activity.id}
                        >
                          <div>
                            <strong>
                              {STATUS_LABEL[
                                activity.status
                              ]
                                || activity.status}
                            </strong>

                            <span>
                              {activity.createdAt
                                ?.replace(
                                  'T',
                                  ' ',
                                )
                                .slice(
                                  0,
                                  16,
                                )}
                            </span>
                          </div>

                          {activity.changeSummary && (
                            <p className="support-history-changes">
                              {activity.changeSummary}
                            </p>
                          )}

                          <p>
                            {activity.contactMethod
                              || '상담 방법 미입력'}

                            {' · 다음 조치일 '}

                            {activity.nextActionDate
                              || '-'}
                          </p>

                          {activity.updatedByRole && (
                            <small>
                              수정자: {getUpdatedByRoleLabel(
                                activity.updatedByRole,
                              )}
                              {activity.updatedById
                                ? ` #${activity.updatedById}`
                                : ''}
                            </small>
                          )}

                          {activity.note && (
                            <small>
                              {activity.note}
                            </small>
                          )}
                        </div>
                      ),
                    )}
                  </section>
                ) : (
                  <section className="support-history">
                    <h3>상담 및 조치 기록</h3>
                    <div className="support-history-empty">
                      저장된 상담 및 조치 이력이 없습니다.
                    </div>
                  </section>
                )}

                <div className="support-progress-actions">
                  <button
                    type="submit"
                    className="btn-primary support-progress-save-button"
                    disabled={
                      saving
                      || loadingGasDetail
                    }
                  >
                    {saving
                      ? '저장 중...'
                      : '지원 기록 저장'}
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
