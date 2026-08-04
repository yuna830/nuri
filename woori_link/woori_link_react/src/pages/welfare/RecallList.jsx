import { useEffect, useState } from 'react'
import {
  getProductsBySenior,
  getRecalledProducts,
  getRecalledProductsByWelfareWorker,
  updateRecallWorkflow,
} from '../../api/recallApi'
import {
  cancelWelfareNotification,
  createSeniorNotification,
  getWelfareNotifications,
} from '../../api/notificationApi'
import '../../css/welfare/RecallList.css'
import { getUser, getUserId } from '../../utils/auth'
import { getSeniorsByWelfareWorker } from '../../api/seniorApi'

const USE_STATUS_LABEL = {
  UNKNOWN: '미확인',
  IN_USE: '현재 사용 중',
  NOT_IN_USE: '보유 중이나 사용하지 않음',
  STOPPED: '사용 중단 완료',
  DISPOSED: '폐기 완료',
  NOT_OWNED: '제품 미보유',
  INVALID_REGISTRATION: '잘못 등록됨',
}

const FOLLOW_UP_STATUS_LABELS = {
  RECEIVED: '접수됨',
  ASSIGNED: '담당자 배정',
  CONTACTING: '연락 중',
  CONFIRMED: '확인 완료',
  SCHEDULED: '일정 확정',
  REFERRED: '기관 연계',
  COMPLETED: '조치 완료',
  GUARDIAN_NOTIFIED: '보호자 안내 완료',
}

const FOLLOW_UP_OUTCOME_LABELS = {
  NONE: '해당 없음',
  UNREACHABLE: '연락 불가',
  DECLINED: '조치 거부',
  NOT_OWNED: '제품 미보유',
  NOT_RECALLED: '리콜 대상 아님',
}

const FINAL_RESULT_LABELS = {
  USE_STOPPED: '사용 중단',
  RECOVERED: '제품 회수',
  EXCHANGED: '제품 교환',
  REPAIRED: '수리 완료',
  REFUNDED: '환불 완료',
  NOT_OWNED: '제품 미보유',
  NOT_RECALLED: '리콜 대상 아님',
  UNREACHABLE: '연락 불가',
  DECLINED: '조치 거부',
}

const FOLLOW_UP_TYPE_OPTIONS = [
  '어르신 안내',
  '보호자 안내',
  '제조사 문의',
  '사용 중단 재확인',
  '제조사 문의·조치 안내',
  '수리 또는 환불 확인',
  '방문 확인',
  '관련 기관 연계',
  '기타',
]

const ALLOWED_STATUS_TRANSITIONS = {
  RECEIVED: ['RECEIVED', 'ASSIGNED'],
  ASSIGNED: ['ASSIGNED', 'CONTACTING'],
  CONTACTING: ['CONTACTING', 'CONFIRMED', 'SCHEDULED'],
  CONFIRMED: [
    'CONFIRMED',
    'SCHEDULED',
    'REFERRED',
    'COMPLETED',
  ],
  SCHEDULED: [
    'SCHEDULED',
    'CONFIRMED',
    'REFERRED',
    'COMPLETED',
  ],
  REFERRED: ['REFERRED', 'COMPLETED'],
  COMPLETED: ['COMPLETED', 'GUARDIAN_NOTIFIED'],
  GUARDIAN_NOTIFIED: ['GUARDIAN_NOTIFIED'],
}

const SUMMARY_FILTERS = [
  {
    key: 'ALL',
    label: '전체 대상',
    tone: 'all',
  },
  {
    key: 'CHECK',
    label: '사용 확인 필요',
    tone: 'check',
    stages: [
      '접수됨',
      '담당자 배정',
      '연락 중',
      '사용 여부 확인',
      '사용 중단 필요',
      '즉시 사용 중지',
      '추가 확인 필요',
    ],
  },
  {
    key: 'ACTION',
    label: '후속 조치 중',
    tone: 'action',
    stages: [
      '확인 완료',
      '일정 확정',
      '기관 연계',
      '후속 조치',
      '수선·회수 필요',
      '교환·환불 필요',
    ],
  },
  {
    key: 'DONE',
    label: '처리 완료',
    tone: 'done',
    stages: [
      '조치 완료',
      '보호자 안내 완료',
      '관리 제외',
    ],
  },
]

function valueOrFallback(value, fallback = '-') {
  return value === null ||
    value === undefined ||
    value === ''
    ? fallback
    : value
}

function officialRecallProductName(product) {
  return (
    product?.matchedRecallNotice?.productName ||
    product?.recallProductName ||
    product?.productName
  )
}

function extractRecallContact(text) {
  if (!text) {
    return ''
  }

  const contactPattern =
    /(?:\+?\d[\d\s().-]{5,}\d)/

  const contactLine = String(text)
    .split(/\r?\n/)
    .find(
      line =>
        /문의처|연락처|전화|tel/i.test(line) &&
        contactPattern.test(line),
    )

  if (!contactLine) {
    return ''
  }

  const contact = contactLine
    .replace(
      /.*?(문의처|연락처|전화|tel)\s*[:：]?\s*/i,
      '',
    )
    .trim()

  return (
    contact.match(contactPattern)?.[0]?.trim() ||
    ''
  )
}

function recallContact(product) {
  return (
    product.inquiryTel ||
    product.contactNumber ||
    product.matchedRecallNotice?.inquiryTel ||
    extractRecallContact(product.recallReason) ||
    extractRecallContact(product.decisionReason) ||
    ''
  )
}

function recallConsumerAction(product) {
  return (
    product.consumerAction ||
    product.matchedRecallNotice?.consumerAction ||
    '사용 여부를 확인한 뒤 필요 시 사용 중단을 안내하고 제조사 문의처로 조치 방법을 확인하세요.'
  )
}

function recallHazard(product) {
  return (
    product.hazardDescription ||
    product.defectDescription ||
    product.matchedRecallNotice
      ?.hazardDescription ||
    product.matchedRecallNotice
      ?.defectDescription ||
    product.recallReason ||
    ''
  )
}

function recallDecisionLabel(product) {
  switch (product.recallDecisionStatus) {
    case 'RECALL_CONFIRMED':
      return '공식 리콜 일치'

    case 'REVIEW_REQUIRED':
      return '추가 확인 필요'

    case 'NO_MATCH_FOUND':
      return '공고 일치 없음'

    default:
      return product.recallStatus === 'RECALLED'
        ? '리콜 대상'
        : '판정 미확인'
  }
}

function recallDecisionTone(product) {
  switch (product.recallDecisionStatus) {
    case 'RECALL_CONFIRMED':
      return 'confirmed'

    case 'REVIEW_REQUIRED':
      return 'review'

    case 'NO_MATCH_FOUND':
      return 'excluded'

    default:
      return 'unknown'
  }
}

function cleanRecallText(value) {
  if (!value) {
    return ''
  }

  return String(value)
    .replace(/\r/g, '')
    .replace(
      /(^|\n|\s)[-–—•·▪▫■□◆◇▶▷※○◯〇oO]\s*/g,
      '$1',
    )
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return String(value).slice(0, 10)
}

function formatCheckedDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('.')
}

function recallActionType(product) {
  return (
    product.actionType ||
    product.matchedRecallNotice?.actionType ||
    'GENERAL_GUIDANCE'
  )
}

function registrationSourceLabel(value) {
  switch (value) {
    case 'GUARDIAN':
    case 'GUARDIAN_WEB':
      return '보호자'

    case 'WELFARE_WORKER':
    case 'WELFARE_WEB':
      return '복지사'

    case 'SENIOR':
    case 'SENIOR_APP':
    case 'BARCODE_SCAN':
    case 'KC_INPUT':
    case 'MANUAL':
      return '사용자'

    default:
      return '등록자 미확인'
  }
}

function isCompletedStatus(product) {
  return (
    product.followUpStatus === 'COMPLETED' ||
    product.followUpStatus ===
      'GUARDIAN_NOTIFIED' ||
    product.actionStatus === 'COMPLETED'
  )
}

function recallUrgency(product) {
  if (isCompletedStatus(product)) {
    return 90
  }

  if (
    product.recallDecisionStatus ===
      'NO_MATCH_FOUND' ||
    product.followUpOutcome === 'NOT_RECALLED'
  ) {
    return 100
  }

  switch (recallActionType(product)) {
    case 'IMMEDIATE_STOP':
      return 0

    case 'PRODUCT_CHECK_REQUIRED':
      return 10

    case 'EXCHANGE':
    case 'REFUND':
    case 'EXCHANGE_OR_REFUND':
      return 20

    case 'REPAIR':
    case 'COLLECTION':
    case 'REPAIR_OR_COLLECTION':
      return 30

    default:
      return 40
  }
}

function currentStage(product) {
  const followUpStatus =
    product.followUpStatus || 'RECEIVED'

  const useStatus =
    product.currentUseStatus || 'UNKNOWN'

  if (
    followUpStatus === 'GUARDIAN_NOTIFIED'
  ) {
    return '보호자 안내 완료'
  }

  if (
    followUpStatus === 'COMPLETED' ||
    product.actionStatus === 'COMPLETED'
  ) {
    return '조치 완료'
  }

  if (
    product.followUpOutcome === 'NOT_RECALLED' ||
    product.followUpOutcome === 'NOT_OWNED' ||
    product.recallDecisionStatus ===
      'NO_MATCH_FOUND'
  ) {
    return '관리 제외'
  }

  if (followUpStatus === 'REFERRED') {
    return '기관 연계'
  }

  if (followUpStatus === 'SCHEDULED') {
    return '일정 확정'
  }

  if (followUpStatus === 'CONFIRMED') {
    return '확인 완료'
  }

  if (followUpStatus === 'CONTACTING') {
    return '연락 중'
  }

  if (followUpStatus === 'ASSIGNED') {
    return '담당자 배정'
  }

  const actionType = recallActionType(product)

  if (actionType === 'IMMEDIATE_STOP') {
    return '즉시 사용 중지'
  }

  if (
    actionType === 'REPAIR' ||
    actionType === 'COLLECTION' ||
    actionType === 'REPAIR_OR_COLLECTION'
  ) {
    return '수선·회수 필요'
  }

  if (
    actionType === 'EXCHANGE' ||
    actionType === 'REFUND' ||
    actionType === 'EXCHANGE_OR_REFUND'
  ) {
    return '교환·환불 필요'
  }

  if (actionType === 'PRODUCT_CHECK_REQUIRED') {
    return '추가 확인 필요'
  }

  if (
    useStatus === 'UNKNOWN' ||
    useStatus === 'NOT_OWNED'
  ) {
    return '사용 여부 확인'
  }

  if (
    useStatus === 'IN_USE' &&
    !product.stopGuidanceCompleted
  ) {
    return '사용 중단 필요'
  }

  if (followUpStatus === 'RECEIVED') {
    return '접수됨'
  }

  return '후속 조치'
}

function stageTone(product) {
  const stage = currentStage(product)

  if (
    stage === '조치 완료' ||
    stage === '보호자 안내 완료'
  ) {
    return 'done'
  }

  if (stage === '관리 제외') {
    return 'excluded'
  }

  if (
    stage === '접수됨' ||
    stage === '담당자 배정' ||
    stage === '연락 중' ||
    stage === '사용 여부 확인' ||
    stage === '추가 확인 필요'
  ) {
    return 'check'
  }

  if (
    stage === '사용 중단 필요' ||
    stage === '즉시 사용 중지'
  ) {
    return 'danger'
  }

  return 'action'
}

function alertWorkflowSaveError(error) {
  console.error(
    'Failed to save recall workflow',
    error,
  )

  const message =
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message

  alert(
    `저장에 실패했습니다. 잠시 후 다시 시도해주세요.${
      message ? `\n\n${message}` : ''
    }`,
  )
}

export default function RecallList() {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [activeTab, setActiveTab] =
    useState('ALL')
  const [
    selectedSeniorId,
    setSelectedSeniorId,
  ] = useState('ALL')
  const [seniors, setSeniors] = useState([])
  const [noticeOpen, setNoticeOpen] =
    useState(false)
  const [noticeTab, setNoticeTab] =
    useState('compose')
  const [noticeForm, setNoticeForm] =
    useState({
      seniorId: '',
      recipient: 'BOTH',
      title: '리콜 제품 안내',
      message: '',
    })
  const [sentNotices, setSentNotices] =
    useState([])
  const [noticeSaving, setNoticeSaving] =
    useState(false)
  const [
    noticeCancellingId,
    setNoticeCancellingId,
  ] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function copyRecallContact() {
    const contact = recallContact(selected)

    if (!contact) {
      alert('등록된 문의처가 없습니다.')
      return
    }

    try {
      await navigator.clipboard.writeText(
        contact,
      )
      alert('문의처를 복사했습니다.')
    } catch {
      alert(`문의처: ${contact}`)
    }
  }

  function openNoticeComposer(product = null) {
    setNoticeForm({
      seniorId: product?.seniorId
        ? String(product.seniorId)
        : '',
      recipient:
        product && !product.guardianId
          ? 'SENIOR'
          : 'BOTH',
      title: '리콜 제품 안내',
      message: product
        ? `${valueOrFallback(
            officialRecallProductName(product),
            '등록 제품',
          )} 리콜 확인이 필요합니다. 제품 사용을 잠시 중단하고 복지사의 안내를 확인해 주세요.`
        : '',
    })

    setNoticeTab('compose')
    setNoticeOpen(true)
    loadSentNotices()
  }

  async function loadSentNotices() {
    const response =
      await getWelfareNotifications().catch(
        () => ({ data: [] }),
      )

    setSentNotices(
      Array.isArray(response.data)
        ? response.data
        : [],
    )
  }

  async function load() {
    const welfareWorkerId = getUserId()

    if (!welfareWorkerId) {
      const response =
        await getRecalledProducts().catch(
          () => ({ data: [] }),
        )

      setProducts(
        Array.isArray(response.data)
          ? response.data
          : [],
      )
      return
    }

    const seniorsResponse =
      await getSeniorsByWelfareWorker(
        welfareWorkerId,
      ).catch(() => ({ data: [] }))

    const assignedSeniors = Array.isArray(
      seniorsResponse.data,
    )
      ? seniorsResponse.data
      : []

    setSeniors(assignedSeniors)

    const seniorMap = new Map(
      assignedSeniors.map(senior => [
        String(senior.id),
        senior,
      ]),
    )

    const enrichProduct = product => {
      const senior = seniorMap.get(
        String(product.seniorId),
      )

      if (!senior) {
        return product
      }

      return {
        ...product,
        seniorName:
          product.seniorName || senior.name,
        guardianId:
          product.guardianId ??
          senior.guardianId,
      }
    }

    const response =
      await getRecalledProductsByWelfareWorker(
        welfareWorkerId,
      ).catch(() => null)

    if (
      Array.isArray(response?.data) &&
      response.data.length > 0
    ) {
      setProducts(
        response.data.map(enrichProduct),
      )
      return
    }

    const productResponses =
      await Promise.all(
        assignedSeniors.map(senior =>
          getProductsBySenior(
            senior.id,
          ).catch(() => ({ data: [] })),
        ),
      )

    const recalledProducts =
      productResponses
        .flatMap(result =>
          Array.isArray(result.data)
            ? result.data
            : [],
        )
        .filter(
          product =>
            product.recallDecisionStatus ===
              'RECALL_CONFIRMED' ||
            (!product.recallDecisionStatus &&
              product.recallStatus ===
                'RECALLED'),
        )
        .map(enrichProduct)

    setProducts(recalledProducts)
  }

  function openModal(product) {
    const followUpStatus =
      product.followUpStatus || 'RECEIVED'

    setSelected(product)

    setForm({
      modelMatchStatus:
        product.modelMatchStatus || 'MATCHED',

      currentUseStatus:
        product.currentUseStatus ===
        'NOT_OWNED'
          ? 'UNKNOWN'
          : product.currentUseStatus ||
            'UNKNOWN',

      stopGuidanceCompleted:
        product.stopGuidanceCompleted || false,

      stopGuidanceCompletedAt:
        product.stopGuidanceCompletedAt ||
        null,

      stopGuidanceMethod:
        product.stopGuidanceMethod || '',

      stopGuidanceTarget:
        product.stopGuidanceTarget || '',

      stopGuidanceWorkerId:
        product.stopGuidanceWorkerId || null,

      stopGuidanceWorkerName:
        product.stopGuidanceWorkerName || '',

      stopGuidanceMemo:
        product.stopGuidanceMemo || '',

      guardianContactStatus:
        product.guardianContactStatus ||
        'UNKNOWN',

      guardianContactMethod:
        product.guardianContactMethod || '',

      guardianContactedAt:
        product.guardianContactedAt || null,

      guardianContactMemo:
        product.guardianContactMemo || '',

      followUpType:
        product.followUpType || '',

      nextActionDate:
        product.nextActionDate || '',

      followUpStatus,

      followUpOutcome:
        product.followUpOutcome || 'NONE',

      assignedWorkerId:
        product.assignedWorkerId || getUserId() || null,

      assignedAt:
        product.assignedAt || null,

      contactTarget:
        product.contactTarget || '',

      contactMethod:
        product.contactMethod || '',

      contactedAt:
        product.contactedAt || null,

      contactResult:
        product.contactResult || 'UNKNOWN',

      contactMemo:
        product.contactMemo || '',

      confirmedAt:
        product.confirmedAt || null,

      confirmationMemo:
        product.confirmationMemo || '',

      scheduledAt:
        product.scheduledAt
          ? String(product.scheduledAt).slice(0, 16)
          : '',

      scheduleType:
        product.scheduleType || '',

      schedulePlace:
        product.schedulePlace || '',

      scheduleMemo:
        product.scheduleMemo || '',

      referralAgency:
        product.referralAgency || '',

      referralContactName:
        product.referralContactName || '',

      referralContactPhone:
        product.referralContactPhone || '',

      referredAt:
        product.referredAt || null,

      referralMemo:
        product.referralMemo || '',

      completedAt:
        product.completedAt || null,

      completionMemo:
        product.completionMemo || '',

      guardianNotificationMethod:
        product.guardianNotificationMethod || '',

      guardianNotifiedAt:
        product.guardianNotifiedAt || null,

      guardianNotificationMemo:
        product.guardianNotificationMemo || '',

      note: product.note || '',

      finalResult:
        product.finalResult || '',
    })
  }

  function workflowPayload(extra = {}) {
    const draft = {
      ...form,
      ...extra,
    }

    const shouldStampGuardianContact =
      draft.guardianContactStatus ===
        'COMPLETED' &&
      !draft.guardianContactedAt

    return {
      ...draft,

      guardianContactedAt:
        shouldStampGuardianContact
          ? new Date().toISOString()
          : draft.guardianContactedAt,

      finalResult:
        draft.finalResult || null,

      followUpOutcome:
        draft.followUpOutcome || 'NONE',
    }
  }

  function validateWorkflow() {
    const status =
      form.followUpStatus || 'RECEIVED'

    if (!form.followUpType) {
      alert('진행할 조치를 선택해주세요.')
      return false
    }

    if (
      status !== 'COMPLETED' &&
      status !== 'GUARDIAN_NOTIFIED' &&
      !form.nextActionDate
    ) {
      alert('조치 예정일을 입력해주세요.')
      return false
    }

    if (
      status === 'CONTACTING' &&
      !form.contactTarget
    ) {
      alert('연락 대상을 선택해주세요.')
      return false
    }

    if (
      status === 'CONTACTING' &&
      !form.contactMethod
    ) {
      alert('연락 방법을 선택해주세요.')
      return false
    }

    if (
      status === 'CONTACTING' &&
      (!form.contactResult ||
        form.contactResult === 'UNKNOWN')
    ) {
      alert('연락 결과를 선택해주세요.')
      return false
    }

    if (
      status === 'CONFIRMED' &&
      (!form.currentUseStatus ||
        form.currentUseStatus === 'UNKNOWN')
    ) {
      alert('확인 완료 상태에서는 현재 사용 상태를 선택해주세요.')
      return false
    }

    if (
      status === 'SCHEDULED' &&
      !form.scheduledAt
    ) {
      alert('예약 일시를 입력해주세요.')
      return false
    }

    if (
      status === 'SCHEDULED' &&
      !form.scheduleType
    ) {
      alert('일정 유형을 선택해주세요.')
      return false
    }

    if (
      status === 'REFERRED' &&
      !form.referralAgency?.trim()
    ) {
      alert('연계 기관을 입력해주세요.')
      return false
    }

    if (
      status === 'COMPLETED' &&
      !form.finalResult
    ) {
      alert('조치 완료 상태에서는 최종 처리 결과를 선택해주세요.')
      return false
    }

    if (
      status === 'COMPLETED' &&
      !form.completionMemo?.trim()
    ) {
      alert('조치 완료 내용을 입력해주세요.')
      return false
    }

    if (
      status === 'GUARDIAN_NOTIFIED' &&
      !form.finalResult
    ) {
      alert('보호자 안내 완료 전 최종 처리 결과를 선택해주세요.')
      return false
    }

    if (
      status === 'GUARDIAN_NOTIFIED' &&
      !form.guardianNotificationMethod
    ) {
      alert('보호자 통보 방법을 선택해주세요.')
      return false
    }

    if (
      status === 'GUARDIAN_NOTIFIED' &&
      !form.guardianNotificationMemo?.trim()
    ) {
      alert('보호자에게 통보한 내용을 입력해주세요.')
      return false
    }

    if (
      status === 'GUARDIAN_NOTIFIED' &&
      selected.followUpStatus !== 'COMPLETED' &&
      selected.followUpStatus !==
        'GUARDIAN_NOTIFIED'
    ) {
      alert('보호자 안내 완료는 조치 완료 이후에 선택할 수 있습니다.')
      return false
    }

    if (
      form.followUpOutcome ===
        'UNREACHABLE' &&
      !form.note?.trim()
    ) {
      alert('연락 불가 사유를 담당자 메모에 입력해주세요.')
      return false
    }

    if (
      form.followUpOutcome === 'DECLINED' &&
      !form.note?.trim()
    ) {
      alert('조치 거부 사유를 담당자 메모에 입력해주세요.')
      return false
    }

    return true
  }

  async function handleActionSave(event) {
    event.preventDefault()

    if (!validateWorkflow()) {
      return
    }

    const currentStatus =
      selected.followUpStatus || 'RECEIVED'

    const nextStatus =
      form.followUpStatus || currentStatus

    const allowedStatuses =
      ALLOWED_STATUS_TRANSITIONS[
        currentStatus
      ] || [currentStatus]

    if (!allowedStatuses.includes(nextStatus)) {
      alert(
        `현재 상태에서는 '${FOLLOW_UP_STATUS_LABELS[nextStatus]}' 단계로 변경할 수 없습니다.`,
      )
      return
    }

    try {
      await updateRecallWorkflow(
        selected.id,
        workflowPayload({
          followUpStatus: nextStatus,
          followUpOutcome:
            form.followUpOutcome || 'NONE',
          nextActionDate:
            form.nextActionDate,
          welfareWorkerId: getUserId(),
          createAction: true,
        }),
      )

      await load()
      setSelected(null)
    } catch (error) {
      alertWorkflowSaveError(error)
    }
  }

  async function sendSeniorNotice(event) {
    event.preventDefault()

    if (!noticeForm.seniorId) {
      alert(
        '알림을 받을 어르신을 선택해주세요.',
      )
      return
    }

    if (!noticeForm.message.trim()) {
      alert('알림 내용을 입력해주세요.')
      return
    }

    if (
      !getUser('WELFARE_WORKER')?.token
    ) {
      alert(
        '복지사 로그인 정보가 확인되지 않습니다. 복지사로 다시 로그인해주세요.',
      )
      return
    }

    const target = noticeTargets.find(
      item =>
        item.id ===
        String(noticeForm.seniorId),
    )

    const notifySenior =
      noticeForm.recipient === 'SENIOR' ||
      noticeForm.recipient === 'BOTH'

    const notifyGuardian =
      noticeForm.recipient === 'GUARDIAN' ||
      noticeForm.recipient === 'BOTH'

    if (
      notifyGuardian &&
      !target?.guardianId
    ) {
      alert(
        '연결된 보호자가 없는 어르신입니다.',
      )
      return
    }

    setNoticeSaving(true)

    try {
      await createSeniorNotification(
        noticeForm.seniorId,
        {
          title:
            noticeForm.title.trim() ||
            '복지사 알림',
          message: noticeForm.message.trim(),
          notifySenior,
          notifyGuardian,
          welfareWorkerId: getUserId(
            'WELFARE_WORKER',
          ),
        },
      )

      setNoticeForm(previous => ({
        ...previous,
        message: '',
      }))

      await loadSentNotices()
      setNoticeTab('history')
      alert('알림을 저장했습니다.')
    } catch (error) {
      if (error.response?.status === 403) {
        alert(
          `알림 전송 권한이 없습니다.\n\n복지사 ID: ${
            getUserId('WELFARE_WORKER') ||
            '-'
          }\n대상 어르신 ID: ${
            noticeForm.seniorId
          }\n\n서버에서 이 어르신이 현재 복지사의 담당 대상이 아니라고 판단했습니다. 대상자 목록에서 담당 복지사 배정값을 확인해주세요.`,
        )
        return
      }

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message

      alert(
        `알림을 저장하지 못했습니다.${
          message ? `\n\n${message}` : ''
        }`,
      )
    } finally {
      setNoticeSaving(false)
    }
  }

  async function cancelSentNotice(alertId) {
    const confirmed = window.confirm(
      '아직 확인하지 않은 알림만 전송취소됩니다. 취소할까요?',
    )

    if (!confirmed) {
      return
    }

    setNoticeCancellingId(alertId)

    try {
      await cancelWelfareNotification(
        alertId,
      )
      await loadSentNotices()
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message

      alert(
        `전송취소에 실패했습니다.${
          message ? `\n\n${message}` : ''
        }`,
      )
    } finally {
      setNoticeCancellingId(null)
    }
  }

  const selectedTab =
    SUMMARY_FILTERS.find(
      tab => tab.key === activeTab,
    )

  const summaryFilteredProducts =
    activeTab === 'ALL'
      ? products
      : products.filter(product =>
          selectedTab.stages.includes(
            currentStage(product),
          ),
        )

  const seniorOptions = Array.from(
    products
      .reduce((map, product) => {
        const id = String(
          product.seniorId ?? '',
        )

        if (id && !map.has(id)) {
          map.set(id, {
            id,
            name: valueOrFallback(
              product.seniorName,
              '이름 미확인',
            ),
          })
        }

        return map
      }, new Map())
      .values(),
  ).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  )

  const filteredProducts =
    summaryFilteredProducts
      .filter(
        product =>
          selectedSeniorId === 'ALL' ||
          String(product.seniorId) ===
            selectedSeniorId,
      )
      .sort(
        (a, b) =>
          recallUrgency(a) -
            recallUrgency(b) ||
          String(
            a.seniorName ?? '',
          ).localeCompare(
            String(b.seniorName ?? ''),
            'ko',
          ) ||
          Number(a.id ?? 0) -
            Number(b.id ?? 0),
      )

  const noticeTargets = Array.from(
    [...seniors, ...products]
      .reduce((map, item) => {
        const id =
          item.seniorId ?? item.id

        if (id) {
          const previous = map.get(
            String(id),
          )

          map.set(String(id), {
            id: String(id),
            name:
              item.seniorName ||
              item.name ||
              '어르신 미확인',
            guardianId:
              item.guardianId ??
              previous?.guardianId ??
              null,
          })
        }

        return map
      }, new Map())
      .values(),
  )

  const selectedNoticeTarget =
    noticeTargets.find(
      target =>
        target.id ===
        String(noticeForm.seniorId),
    )

  const visibleSentNotices =
    sentNotices
      .filter(
        notice =>
          !noticeForm.seniorId ||
          String(notice.seniorId) ===
            String(noticeForm.seniorId),
      )
      .slice(0, 6)

  const tabCount = tab =>
    tab.key === 'ALL'
      ? products.length
      : products.filter(product =>
          tab.stages.includes(
            currentStage(product),
          ),
        ).length

  const lastCheckedAt = products
    .map(product => product.lastCheckedAt)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b) - new Date(a),
    )[0]

  const lastCheckedDate =
    formatCheckedDate(lastCheckedAt)

  const currentSavedStatus =
    selected?.followUpStatus || 'RECEIVED'

  const selectableStatuses =
    ALLOWED_STATUS_TRANSITIONS[
      currentSavedStatus
    ] || [currentSavedStatus]

  const followUpSaveDisabled =
    !form.followUpType ||
    ((form.followUpStatus !== 'COMPLETED' &&
      form.followUpStatus !== 'GUARDIAN_NOTIFIED') &&
      !form.nextActionDate)

  return (
    <div>
      <div className="recall-page-header">
        <div>
          <h1 className="page-title">
            리콜 제품 조치 관리
          </h1>

          <p className="recall-page-description">
            시스템에서 리콜 대상으로 확인된
            제품의 사용 여부와 보호자 확인,
            회수·교환 등 후속 조치를
            관리합니다.
          </p>
        </div>

        {lastCheckedDate && (
          <span className="recall-last-checked">
            리콜 정보 마지막 조회:{' '}
            {lastCheckedDate}
          </span>
        )}
      </div>

      <div
        className="recall-summary-cards"
        role="tablist"
        aria-label="리콜 처리 상태 요약"
      >
        {SUMMARY_FILTERS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={
              activeTab === tab.key
            }
            className={[
              `tone-${tab.tone}`,
              activeTab === tab.key
                ? 'active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              setActiveTab(tab.key)
              setSelectedSeniorId('ALL')
            }}
          >
            <span>{tab.label}</span>
            <strong>{tabCount(tab)}</strong>
          </button>
        ))}
      </div>

      <div className="card recall-card">
        {filteredProducts.length === 0 ? (
          <div className="recall-empty-state">
            <strong>
              {products.length === 0
                ? '현재 복지사가 조치할 리콜 제품이 없습니다.'
                : '선택한 단계에 해당하는 제품이 없습니다.'}
            </strong>

            <p>
              어르신 또는 보호자가 등록한
              제품은 공식 리콜 정보와 자동으로
              비교됩니다.
            </p>

            <p>
              사용 확인이나 후속 조치가 필요한
              제품만 이 화면에 표시됩니다.
            </p>
          </div>
        ) : (
          <table className="data-table recall-table">
            <thead>
              <tr>
                <th>
                  <label className="recall-senior-select">
                    <select
                      aria-label="대상자 선택"
                      value={selectedSeniorId}
                      onChange={event =>
                        setSelectedSeniorId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="ALL">
                        대상자
                      </option>

                      {seniorOptions.map(
                        senior => (
                          <option
                            value={senior.id}
                            key={senior.id}
                          >
                            {senior.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </th>

                <th>등록 제품</th>
                <th>자동 판정</th>
                <th>현재 업무</th>
                <th>등록자</th>
                <th>다음 조치일</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(
                product => {
                  const stage =
                    currentStage(product)

                  const tone =
                    stageTone(product)

                  const hazard =
                    product.hazardType ??
                    product.recallHazardType

                  return (
                    <tr
                      key={product.id}
                      className={`recall-row tone-${tone}`}
                      tabIndex={0}
                      onClick={() =>
                        openModal(product)
                      }
                      onKeyDown={event => {
                        if (
                          event.key ===
                            'Enter' ||
                          event.key === ' '
                        ) {
                          event.preventDefault()
                          openModal(product)
                        }
                      }}
                    >
                      <td className="font-bold">
                        {valueOrFallback(
                          product.seniorName,
                          '미확인',
                        )}
                      </td>

                      <td>
                        <strong className="recall-product-name">
                          {valueOrFallback(
                            officialRecallProductName(
                              product,
                            ),
                          )}
                        </strong>

                        <span className="recall-product-model">
                          {valueOrFallback(
                            product.modelNumber,
                          )}
                          {' · '}
                          {valueOrFallback(
                            product.manufacturer,
                          )}
                        </span>

                        {hazard && (
                          <small className="recall-hazard-warning">
                            주의: {hazard}
                          </small>
                        )}
                      </td>

                      <td>
                        <span
                          className={[
                            'recall-decision-badge',
                            `tone-${recallDecisionTone(
                              product,
                            )}`,
                          ].join(' ')}
                        >
                          {recallDecisionLabel(
                            product,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`recall-state-badge tone-${tone}`}
                        >
                          {stage}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            'recall-registration-source',
                            product.registrationSource ===
                            'GUARDIAN_WEB'
                              ? 'is-guardian'
                              : '',
                          ].join(' ')}
                        >
                          {registrationSourceLabel(
                            product.registrationSource,
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          product.nextActionDate,
                        )}
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        )}
      </div>

      {noticeTargets.length > 0 && (
        <button
          type="button"
          className="recall-notice-fab"
          aria-label="어르신 앱 알림 작성"
          onClick={() =>
            openNoticeComposer()
          }
        >
          ✉
        </button>
      )}

      {noticeOpen && (
        <div
          className="recall-notice-composer-overlay"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setNoticeOpen(false)
            }
          }}
        >
          <form
            className="recall-notice-composer"
            onSubmit={sendSeniorNotice}
          >
            <header>
              <div>
                <strong>
                  어르신 앱 알림
                </strong>
                <span>리콜 안내 기록</span>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() =>
                  setNoticeOpen(false)
                }
              >
                ×
              </button>
            </header>

            <div
              className="recall-notice-tabs"
              role="tablist"
              aria-label="알림 작성 및 전송 내역"
            >
              <button
                type="button"
                className={
                  noticeTab === 'compose'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setNoticeTab('compose')
                }
              >
                알림 작성
              </button>

              <button
                type="button"
                className={
                  noticeTab === 'history'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setNoticeTab('history')
                }
              >
                전송 내역
              </button>
            </div>

            {noticeTab === 'compose' && (
              <section className="recall-notice-pane">
                <label>
                  대상 어르신

                  <select
                    value={
                      noticeForm.seniorId
                    }
                    onChange={event => {
                      const seniorId =
                        event.target.value

                      const nextTarget =
                        noticeTargets.find(
                          target =>
                            target.id ===
                            String(seniorId),
                        )

                      setNoticeForm(
                        previous => ({
                          ...previous,
                          seniorId,
                          recipient:
                            nextTarget?.guardianId
                              ? previous.recipient
                              : 'SENIOR',
                        }),
                      )
                    }}
                  >
                    <option value="">
                      선택
                    </option>

                    {noticeTargets.map(
                      target => (
                        <option
                          key={target.id}
                          value={target.id}
                        >
                          {target.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {noticeForm.seniorId ? (
                  <>
                    <section className="recall-notice-target-summary">
                      <div>
                        <strong>
                          {selectedNoticeTarget
                            ?.name ||
                            '어르신 미확인'}
                        </strong>

                        <span>
                          {selectedNoticeTarget
                            ?.guardianId
                            ? '보호자 연결됨'
                            : '보호자 연결 없음'}
                        </span>
                      </div>
                    </section>

                    <fieldset className="recall-notice-recipient">
                      <legend>
                        수신 대상
                      </legend>

                      <button
                        type="button"
                        className={
                          noticeForm.recipient ===
                          'BOTH'
                            ? 'active'
                            : ''
                        }
                        disabled={
                          !selectedNoticeTarget
                            ?.guardianId
                        }
                        onClick={() =>
                          setNoticeForm(
                            previous => ({
                              ...previous,
                              recipient:
                                'BOTH',
                            }),
                          )
                        }
                      >
                        둘 다
                      </button>

                      <button
                        type="button"
                        className={
                          noticeForm.recipient ===
                          'SENIOR'
                            ? 'active'
                            : ''
                        }
                        onClick={() =>
                          setNoticeForm(
                            previous => ({
                              ...previous,
                              recipient:
                                'SENIOR',
                            }),
                          )
                        }
                      >
                        어르신
                      </button>

                      <button
                        type="button"
                        className={
                          noticeForm.recipient ===
                          'GUARDIAN'
                            ? 'active'
                            : ''
                        }
                        disabled={
                          !selectedNoticeTarget
                            ?.guardianId
                        }
                        onClick={() =>
                          setNoticeForm(
                            previous => ({
                              ...previous,
                              recipient:
                                'GUARDIAN',
                            }),
                          )
                        }
                      >
                        보호자
                      </button>

                      {!selectedNoticeTarget?.guardianId && (
                        <small>
                          연결된 보호자가 없어
                          어르신 알림만 보낼 수
                          있습니다.
                        </small>
                      )}
                    </fieldset>

                    <label>
                      제목

                      <input
                        value={
                          noticeForm.title
                        }
                        maxLength={120}
                        onChange={event =>
                          setNoticeForm(
                            previous => ({
                              ...previous,
                              title:
                                event.target
                                  .value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label>
                      내용

                      <textarea
                        value={
                          noticeForm.message
                        }
                        maxLength={1000}
                        onChange={event =>
                          setNoticeForm(
                            previous => ({
                              ...previous,
                              message:
                                event.target
                                  .value,
                            }),
                          )
                        }
                        placeholder="어르신 앱 알림함에 남길 내용을 직접 입력하세요."
                      />
                    </label>

                    <div className="recall-notice-composer__footer">
                      <span>
                        {
                          noticeForm.message
                            .length
                        }
                        /1000
                      </span>

                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={
                          noticeSaving
                        }
                      >
                        {noticeSaving
                          ? '저장 중...'
                          : '전달'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="recall-notice-target-empty">
                    대상 어르신을 선택하면
                    수신 대상과 작성란이
                    표시됩니다.
                  </div>
                )}
              </section>
            )}

            {noticeTab === 'history' && (
              <section className="recall-notice-history">
                <div>
                  <strong>
                    최근 전송
                  </strong>

                  <button
                    type="button"
                    onClick={
                      loadSentNotices
                    }
                  >
                    새로고침
                  </button>
                </div>

                {visibleSentNotices.length ===
                0 ? (
                  <p>
                    전송한 알림이 없습니다.
                  </p>
                ) : (
                  <ul>
                    {visibleSentNotices.map(
                      notice => {
                        const isConsultationRequest =
                          notice.type ===
                          'CONSULTATION_REQUEST'

                        const recipient =
                          isConsultationRequest
                            ? '상담 요청'
                            : notice.guardianId
                              ? '보호자'
                              : '어르신'

                        const unread =
                          notice.status ===
                          'UNREAD'

                        return (
                          <li
                            key={notice.id}
                          >
                            <span>
                              {recipient} ·{' '}
                              {unread
                                ? '미확인'
                                : '확인됨'}
                            </span>

                            <strong>
                              {notice.title ||
                                '복지사 알림'}
                            </strong>

                            <p>
                              {notice.message}
                            </p>

                            {unread &&
                              !isConsultationRequest && (
                                <button
                                  type="button"
                                  disabled={
                                    noticeCancellingId ===
                                    notice.id
                                  }
                                  onClick={() =>
                                    cancelSentNotice(
                                      notice.id,
                                    )
                                  }
                                >
                                  {noticeCancellingId ===
                                  notice.id
                                    ? '취소 중'
                                    : '전송취소'}
                                </button>
                              )}
                          </li>
                        )
                      },
                    )}
                  </ul>
                )}
              </section>
            )}
          </form>
        </div>
      )}

      {selected && (
        <div
          className="recall-modal-overlay"
          onClick={() => setSelected(null)}
        >
          <form
            className="recall-modal"
            onSubmit={handleActionSave}
            onClick={event =>
              event.stopPropagation()
            }
          >
            <div className="recall-modal-header">
              <div>
                <h2>
                  {valueOrFallback(
                    selected.seniorName,
                    '이름 미확인',
                  )}
                  님
                </h2>

                <p>
                  {valueOrFallback(
                    officialRecallProductName(
                      selected,
                    ),
                  )}
                  {' · '}
                  {valueOrFallback(
                    selected.modelNumber,
                  )}

                  <span>
                    {currentStage({
                      ...selected,
                      ...form,
                    })}
                  </span>
                </p>
              </div>

              <button
                type="button"
                className="recall-modal-close"
                aria-label="닫기"
                onClick={() =>
                  setSelected(null)
                }
              >
                ×
              </button>
            </div>

            <div className="recall-modal-body">
              <section className="recall-overview">
                <div className="recall-overview__item">
                  <span>등록자</span>

                  <strong>
                    {registrationSourceLabel(
                      selected.registrationSource,
                    )}
                  </strong>
                </div>

                <div className="recall-overview__item">
                  <span>
                    현재 사용 상태
                  </span>

                  <strong>
                    {USE_STATUS_LABEL[
                      selected.currentUseStatus ||
                        'UNKNOWN'
                    ] || '미확인'}
                  </strong>
                </div>

                <div className="recall-overview__item">
                  <span>
                    현재 관리 상태
                  </span>

                  <strong>
                    {currentStage({
                      ...selected,
                      ...form,
                    })}
                  </strong>
                </div>
              </section>

              <section className="recall-official-info">
                <div className="recall-section-header">
                  <div>
                    <span>
                      공식 리콜 정보
                    </span>

                    <strong>
                      {recallDecisionLabel(
                        selected,
                      )}
                    </strong>
                  </div>

                  <div className="recall-section-actions">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() =>
                        openNoticeComposer(
                          selected,
                        )
                      }
                    >
                      안내 작성
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      disabled={
                        !recallContact(
                          selected,
                        )
                      }
                      onClick={
                        copyRecallContact
                      }
                    >
                      문의처 복사
                    </button>
                  </div>
                </div>

                <dl className="recall-official-info__list">
                  <div>
                    <dt>
                      위험·결함 내용
                    </dt>

                    <dd className="recall-clean-text">
                      {valueOrFallback(
                        cleanRecallText(
                          recallHazard(
                            selected,
                          ),
                        ),
                        '상세 위험 정보가 없습니다.',
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      소비자 조치 안내
                    </dt>

                    <dd className="recall-clean-text">
                      {valueOrFallback(
                        cleanRecallText(
                          recallConsumerAction(
                            selected,
                          ),
                        ),
                        '조치 안내 정보가 없습니다.',
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      제조사 문의처
                    </dt>

                    <dd>
                      {valueOrFallback(
                        recallContact(
                          selected,
                        ),
                        '문의처 정보 없음',
                      )}
                    </dd>
                  </div>

                  {(selected.sourceName ||
                    selected.sourceUrl) && (
                    <div>
                      <dt>공식 출처</dt>

                      <dd>
                        {selected.sourceUrl ? (
                          <a
                            href={
                              selected.sourceUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {selected.sourceName ||
                              '공식 리콜 공고 보기'}
                          </a>
                        ) : (
                          selected.sourceName
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="recall-plan-section">
                <div className="recall-section-title">
                  <strong>조치 계획</strong>
                  <span>
                    현재 단계에서 필요한 업무 정보를 기록합니다.
                  </span>
                </div>

                <div className="recall-form-grid">
                  <label>
                    후속조치 상태

                    <select
                      value={form.followUpStatus ?? 'RECEIVED'}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          followUpStatus: event.target.value,
                        }))
                      }
                    >
                      {selectableStatuses.map(value => (
                        <option key={value} value={value}>
                          {FOLLOW_UP_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    진행할 조치

                    <select
                      value={form.followUpType ?? ''}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          followUpType: event.target.value,
                        }))
                      }
                    >
                      <option value="">선택</option>

                      {FOLLOW_UP_TYPE_OPTIONS.map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.followUpStatus === 'ASSIGNED' && (
                    <div className="recall-workflow-info recall-note-field">
                      <span>담당 복지사</span>
                      <strong>
                        현재 로그인한 복지사로 자동 배정됩니다.
                      </strong>
                    </div>
                  )}

                  {form.followUpStatus === 'CONTACTING' && (
                    <>
                      <label>
                        연락 대상
                        <select
                          value={form.contactTarget ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              contactTarget: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          <option value="SENIOR">어르신</option>
                          <option value="GUARDIAN">보호자</option>
                          <option value="BOTH">어르신 및 보호자</option>
                        </select>
                      </label>

                      <label>
                        연락 방법
                        <select
                          value={form.contactMethod ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              contactMethod: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          <option value="PHONE">전화</option>
                          <option value="MESSAGE">문자</option>
                          <option value="VISIT">방문</option>
                          <option value="APP_NOTIFICATION">앱 알림</option>
                        </select>
                      </label>

                      <label>
                        연락 결과
                        <select
                          value={form.contactResult ?? 'UNKNOWN'}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              contactResult: event.target.value,
                            }))
                          }
                        >
                          <option value="UNKNOWN">선택</option>
                          <option value="CONFIRMED">확인 완료</option>
                          <option value="CALLBACK_REQUIRED">재연락 필요</option>
                          <option value="UNREACHABLE">연락 불가</option>
                          <option value="DECLINED">조치 거부</option>
                          <option value="NOT_OWNED">제품 미보유</option>
                        </select>
                      </label>

                      <label className="recall-note-field">
                        연락 메모
                        <textarea
                          value={form.contactMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              contactMemo: event.target.value,
                            }))
                          }
                          placeholder="연락 내용이나 재연락 사유를 입력하세요."
                        />
                      </label>
                    </>
                  )}

                  {form.followUpStatus === 'CONFIRMED' && (
                    <>
                      <label>
                        현재 사용 상태
                        <select
                          value={form.currentUseStatus ?? 'UNKNOWN'}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              currentUseStatus: event.target.value,
                            }))
                          }
                        >
                          <option value="UNKNOWN">선택</option>
                          <option value="IN_USE">현재 사용 중</option>
                          <option value="NOT_IN_USE">보유 중이나 미사용</option>
                          <option value="STOPPED">사용 중단 완료</option>
                          <option value="DISPOSED">폐기 완료</option>
                          <option value="NOT_OWNED">제품 미보유</option>
                        </select>
                      </label>

                      <label className="recall-note-field">
                        확인 내용
                        <textarea
                          value={form.confirmationMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              confirmationMemo: event.target.value,
                            }))
                          }
                          placeholder="제품 보유 여부와 현재 사용 상태를 기록하세요."
                        />
                      </label>
                    </>
                  )}

                  {form.followUpStatus === 'SCHEDULED' && (
                    <>
                      <label>
                        예약 일시
                        <input
                          type="datetime-local"
                          value={form.scheduledAt ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              scheduledAt: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        일정 유형
                        <select
                          value={form.scheduleType ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              scheduleType: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          <option value="PHONE_CONSULTATION">전화 상담</option>
                          <option value="HOME_VISIT">가정 방문</option>
                          <option value="AGENCY_VISIT">기관 방문</option>
                          <option value="MANUFACTURER_CONTACT">제조사 문의</option>
                        </select>
                      </label>

                      <label>
                        장소
                        <input
                          value={form.schedulePlace ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              schedulePlace: event.target.value,
                            }))
                          }
                          placeholder="방문 장소 또는 기관명"
                        />
                      </label>

                      <label className="recall-note-field">
                        일정 메모
                        <textarea
                          value={form.scheduleMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              scheduleMemo: event.target.value,
                            }))
                          }
                          placeholder="예약 또는 방문 관련 내용을 입력하세요."
                        />
                      </label>
                    </>
                  )}

                  {form.followUpStatus === 'REFERRED' && (
                    <>
                      <label>
                        연계 기관
                        <input
                          value={form.referralAgency ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              referralAgency: event.target.value,
                            }))
                          }
                          placeholder="제조사, 수리센터, 행정기관 등"
                        />
                      </label>

                      <label>
                        기관 담당자
                        <input
                          value={form.referralContactName ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              referralContactName: event.target.value,
                            }))
                          }
                          placeholder="담당자명"
                        />
                      </label>

                      <label>
                        기관 연락처
                        <input
                          value={form.referralContactPhone ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              referralContactPhone: event.target.value,
                            }))
                          }
                          placeholder="전화번호"
                        />
                      </label>

                      <label className="recall-note-field">
                        연계 내용
                        <textarea
                          value={form.referralMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              referralMemo: event.target.value,
                            }))
                          }
                          placeholder="기관에 요청한 내용과 안내받은 사항을 입력하세요."
                        />
                      </label>
                    </>
                  )}

                  {form.followUpStatus === 'COMPLETED' && (
                    <>
                      <label>
                        최종 처리 결과
                        <select
                          value={form.finalResult ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              finalResult: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          {Object.entries(FINAL_RESULT_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="recall-note-field">
                        완료 내용
                        <textarea
                          value={form.completionMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              completionMemo: event.target.value,
                            }))
                          }
                          placeholder="어떤 조치가 어떻게 완료되었는지 입력하세요."
                        />
                      </label>
                    </>
                  )}

                  {form.followUpStatus === 'GUARDIAN_NOTIFIED' && (
                    <>
                      <label>
                        최종 처리 결과
                        <select
                          value={form.finalResult ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              finalResult: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          {Object.entries(FINAL_RESULT_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        보호자 통보 방법
                        <select
                          value={form.guardianNotificationMethod ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              guardianNotificationMethod: event.target.value,
                            }))
                          }
                        >
                          <option value="">선택</option>
                          <option value="PHONE">전화</option>
                          <option value="MESSAGE">문자</option>
                          <option value="APP_NOTIFICATION">앱 알림</option>
                          <option value="IN_PERSON">대면 안내</option>
                        </select>
                      </label>

                      <label className="recall-note-field">
                        보호자 통보 내용
                        <textarea
                          value={form.guardianNotificationMemo ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              guardianNotificationMemo: event.target.value,
                            }))
                          }
                          placeholder="보호자에게 전달한 최종 결과를 입력하세요."
                        />
                      </label>
                    </>
                  )}

                  <label>
                    처리 예외
                    <select
                      value={form.followUpOutcome ?? 'NONE'}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          followUpOutcome: event.target.value,
                        }))
                      }
                    >
                      {Object.entries(FOLLOW_UP_OUTCOME_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  {form.followUpStatus !== 'COMPLETED' &&
                    form.followUpStatus !== 'GUARDIAN_NOTIFIED' && (
                      <label>
                        조치 예정일
                        <input
                          type="date"
                          value={form.nextActionDate ?? ''}
                          onChange={event =>
                            setForm(previous => ({
                              ...previous,
                              nextActionDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                  <label className="recall-note-field">
                    담당자 메모
                    <textarea
                      value={form.note ?? ''}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          note: event.target.value,
                        }))
                      }
                      placeholder="후속 조치 전반에 대한 메모를 입력하세요."
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="recall-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  setSelected(null)
                }
              >
                닫기
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  followUpSaveDisabled
                }
              >
                조치 계획 저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}