import { useEffect, useState } from 'react'
import { getProductsBySenior, getRecalledProducts, getRecalledProductsByWelfareWorker, updateRecallWorkflow } from '../../api/recallApi'
import { cancelWelfareNotification, createSeniorNotification, getWelfareNotifications } from '../../api/notificationApi'
import '../../css/welfare/RecallList.css'
import { getUser, getUserId } from '../../utils/auth'
import { getSeniorsByWelfareWorker } from '../../api/seniorApi'

const USE_STATUS_LABEL = {
  UNKNOWN: '미확인',
  IN_USE: '현재 사용 중',
  NOT_IN_USE: '보유 중이나 사용하지 않음',
  STOPPED: '사용 중단 완료',
  NOT_OWNED: '확인 필요',
  INVALID_REGISTRATION: '잘못 등록됨',
}

const ACTION_STATUS_LABEL = {
  CONFIRMATION_NEEDED: '확인 필요',
  CONTACT_SCHEDULED: '연락 예정',
  STOP_GUIDANCE_COMPLETED: '사용 중단 안내 완료',
  RECALL_GUIDANCE_COMPLETED: '제조사 조치 안내 완료',
  RECALL_IN_PROGRESS: '제조사 조치 안내 중',
  COMPLETED: '조치 완료',
  UNREACHABLE: '연락 불가',
  NOT_RECALLED: '등록 공고 일치 없음',
}

const GUARDIAN_CONTACT_STATUS_LABEL = {
  UNKNOWN: '미확인',
  SCHEDULED: '연락 예정',
  COMPLETED: '연락 완료',
  UNREACHABLE: '연락 불가',
}

const GUARDIAN_CONTACT_METHODS = ['전화', '방문', '기타']

function valueOrFallback(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : value
}

function officialRecallProductName(product) {
  return product?.matchedRecallNotice?.productName
    || product?.recallProductName
    || product?.productName
}

function extractRecallContact(text) {
  if (!text) return ''
  const contactPattern = /(?:\+?\d[\d\s().-]{5,}\d)/
  const contactLine = String(text)
    .split(/\r?\n/)
    .find(line => /문의처|연락처|전화|tel/i.test(line) && contactPattern.test(line))
  if (!contactLine) return ''
  const contact = contactLine
    .replace(/.*?(문의처|연락처|전화|tel)\s*[:：]?\s*/i, '')
    .trim()
  return contact.match(contactPattern)?.[0]?.trim() || ''
}

function recallContact(product) {
  return product.inquiryTel ||
    product.contactNumber ||
    product.matchedRecallNotice?.inquiryTel ||
    extractRecallContact(product.recallReason) ||
    extractRecallContact(product.decisionReason) ||
    ''
}

function recallContactHref(product) {
  return recallContact(product).replace(/[^\d+]/g, '')
}

function recallConsumerAction(product) {
  return product.consumerAction || product.matchedRecallNotice?.consumerAction || '사용 여부를 확인한 뒤 필요 시 사용 중단을 안내하고 제조사 문의처로 조치 방법을 확인하세요.'
}

function recallHazard(product) {
  return product.hazardDescription || product.defectDescription || product.matchedRecallNotice?.hazardDescription || product.matchedRecallNotice?.defectDescription || product.recallReason || ''
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

function removeGuideNotes(note) {
  return String(note || '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('님 안내:')
      && !line.trim().startsWith('보호자 안내:')
      && !line.trim().startsWith('제조사 문의:'))
    .join('\n')
    .trim()
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

function formatCheckedDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatGuidanceDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function recallActionType(product) {
  return product.actionType
    || product.matchedRecallNotice?.actionType
    || 'GENERAL_GUIDANCE'
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

function recallUrgency(product) {
  if (
    product.finalResult
    || product.actionStatus === 'COMPLETED'
  ) {
    return 90
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
  const useStatus =
    product.currentUseStatus || 'UNKNOWN'

  const actionStatus =
    product.actionStatus || 'CONFIRMATION_NEEDED'

  if (
    product.finalResult ||
    actionStatus === 'COMPLETED'
  ) {
    return '조치 완료'
  }

  if (
    actionStatus === 'NOT_RECALLED' ||
    product.recallDecisionStatus === 'NO_MATCH_FOUND'
  ) {
    return '관리 제외'
  }

  const actionType = recallActionType(product)

  if (actionType === 'IMMEDIATE_STOP') {
    return '즉시 사용 중지'
  }

  if (
    actionType === 'REPAIR'
    || actionType === 'COLLECTION'
    || actionType === 'REPAIR_OR_COLLECTION'
  ) {
    return '수선·회수 필요'
  }

  if (
    actionType === 'EXCHANGE'
    || actionType === 'REFUND'
    || actionType === 'EXCHANGE_OR_REFUND'
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

  return '후속 조치'
}

function stageTone(product) {
  const stage = currentStage(product)

  if (stage === '조치 완료') {
    return 'done'
  }

  if (stage === '관리 제외') {
    return 'excluded'
  }

  if (stage === '사용 여부 확인') {
    return 'check'
  }

  if (stage === '사용 중단 필요') {
    return 'danger'
  }

  if (stage === '즉시 사용 중지') {
    return 'danger'
  }

  if (
    stage === '수선·회수 필요'
    || stage === '교환·환불 필요'
  ) {
    return 'action'
  }

  return 'action'
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
      '관리 제외',
    ],
  },
]

const FINAL_RESULT_OPTIONS = [
  ['USE_STOPPED', '사용 중단 완료'],
  ['REPAIRED', '수리 완료'],
  ['EXCHANGED', '교환 완료'],
  ['REFUNDED', '환불 완료'],
  ['RECOVERED', '회수 완료'],
  ['DECLINED', '조치 거부/불가'],
]

function finalResultLabel(value) {
  return FINAL_RESULT_OPTIONS.find(([optionValue]) => optionValue === value)?.[1] || valueOrFallback(value)
}

function alertWorkflowSaveError(error) {
  console.error('Failed to save recall workflow', error)
  const message = error.response?.data?.message || error.response?.data?.error || error.message
  alert(`저장에 실패했습니다. 잠시 후 다시 시도해주세요.${message ? `\n\n${message}` : ''}`)
}

export default function RecallList() {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [activeTab, setActiveTab] = useState('ALL')
  const [selectedSeniorId, setSelectedSeniorId] = useState('ALL')
  const [step, setStep] = useState(1)
  const [showOriginal, setShowOriginal] = useState(false)
  const [useStatusSelected, setUseStatusSelected] = useState(false)
  const [showStopGuidance, setShowStopGuidance] = useState(false)
  const [showRecallDetails, setShowRecallDetails] = useState(false)
  const [followUpEditing, setFollowUpEditing] = useState(true)
  const [completionOnly, setCompletionOnly] = useState(false)
  const [guidanceForm, setGuidanceForm] = useState({ method: '', target: '', memo: '' })
  const [seniors, setSeniors] = useState([])
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [noticeTab, setNoticeTab] = useState('compose')
  const [noticeForm, setNoticeForm] = useState({ seniorId: '', recipient: 'BOTH', title: '리콜 제품 안내', message: '' })
  const [sentNotices, setSentNotices] = useState([])
  const [noticeSaving, setNoticeSaving] = useState(false)
  const [noticeCancellingId, setNoticeCancellingId] = useState(null)

  useEffect(() => { load() }, [])

  async function copyRecallContact() {
    const contact = recallContact(selected)
    if (!contact) return alert('등록된 문의처가 없습니다.')
    try {
      await navigator.clipboard.writeText(contact)
      alert('문의처를 복사했습니다.')
    } catch {
      alert(`문의처: ${contact}`)
    }
  }

  function openNoticeComposer(product = null) {
    setNoticeForm({
      seniorId: product?.seniorId ? String(product.seniorId) : '',
      recipient: product && !product.guardianId ? 'SENIOR' : 'BOTH',
      title: '리콜 제품 안내',
      message: product
        ? `${valueOrFallback(officialRecallProductName(product), '등록 제품')} 리콜 확인이 필요합니다. 제품 사용을 잠시 중단하고 복지사의 안내를 확인해 주세요.`
        : '',
    })
    setNoticeTab('compose')
    setNoticeOpen(true)
    loadSentNotices()
  }

  async function loadSentNotices() {
    const response = await getWelfareNotifications().catch(() => ({ data: [] }))
    setSentNotices(Array.isArray(response.data) ? response.data : [])
  }

  async function load() {
    const welfareWorkerId = getUserId()
    if (!welfareWorkerId) {
      const response = await getRecalledProducts().catch(() => ({ data: [] }))
      setProducts(Array.isArray(response.data) ? response.data : [])
      return
    }

    const seniorsResponse = await getSeniorsByWelfareWorker(welfareWorkerId).catch(() => ({ data: [] }))
    const assignedSeniors = Array.isArray(seniorsResponse.data) ? seniorsResponse.data : []
    setSeniors(assignedSeniors)
    const seniorMap = new Map(assignedSeniors.map(senior => [String(senior.id), senior]))
    const enrichProduct = product => {
      const senior = seniorMap.get(String(product.seniorId))
      return senior ? {
        ...product,
        seniorName: product.seniorName || senior.name,
        guardianId: product.guardianId ?? senior.guardianId,
      } : product
    }
    const response = await getRecalledProductsByWelfareWorker(welfareWorkerId).catch(() => null)
    if (Array.isArray(response?.data) && response.data.length > 0) {
      setProducts(response.data.map(enrichProduct))
      return
    }

    const productResponses = await Promise.all(
      assignedSeniors.map(senior => getProductsBySenior(senior.id).catch(() => ({ data: [] })))
    )
    const recalledProducts = productResponses
      .flatMap(result => Array.isArray(result.data) ? result.data : [])
      .filter(product => product.recallDecisionStatus === 'RECALL_CONFIRMED' || (!product.recallDecisionStatus && product.recallStatus === 'RECALLED'))
      .map(enrichProduct)
    setProducts(recalledProducts)
  }

  function openModal(product) {
    setSelected(product)
    setForm({
      modelMatchStatus: product.modelMatchStatus || 'MATCHED',
      currentUseStatus: product.currentUseStatus === 'NOT_OWNED' ? 'UNKNOWN' : product.currentUseStatus || 'UNKNOWN',
      contactMethod: product.contactMethod || '',
      stopGuidanceCompleted: product.stopGuidanceCompleted || false,
      stopGuidanceCompletedAt: product.stopGuidanceCompletedAt || null,
      stopGuidanceMethod: product.stopGuidanceMethod || '',
      stopGuidanceTarget: product.stopGuidanceTarget || '',
      stopGuidanceWorkerId: product.stopGuidanceWorkerId || null,
      stopGuidanceWorkerName: product.stopGuidanceWorkerName || '',
      stopGuidanceMemo: product.stopGuidanceMemo || '',
      guardianContactStatus: product.guardianContactStatus || 'UNKNOWN',
      guardianContactMethod: product.guardianContactMethod || '',
      guardianContactedAt: product.guardianContactedAt || null,
      guardianContactMemo: product.guardianContactMemo || '',
      followUpType: product.followUpType || '',
      nextActionDate: product.nextActionDate || '',
      followUpProgressStatus: product.followUpProgressStatus || 'PLANNED',
      note: product.note || '',
      finalResult: product.finalResult || '',
    })
    setStep(!product.currentUseStatus || ['UNKNOWN', 'NOT_OWNED'].includes(product.currentUseStatus) ? 1 : 2)
    setFollowUpEditing(!(product.followUpType || product.finalResult || product.followUpProgressStatus === 'COMPLETED'))
    setCompletionOnly(false)
    setShowOriginal(false)
    setShowRecallDetails(false)
    setUseStatusSelected(product.currentUseStatus && !['UNKNOWN', 'NOT_OWNED'].includes(product.currentUseStatus))
    setShowStopGuidance(false)
    setGuidanceForm({
      method: product.stopGuidanceMethod || product.contactMethod || '',
      target: product.stopGuidanceTarget || '',
      memo: product.stopGuidanceMemo || '',
    })
  }

  function workflowPayload(extra = {}) {
    const draft = { ...form, ...extra }
    const shouldStampGuardianContact = draft.guardianContactStatus === 'COMPLETED' && !draft.guardianContactedAt
    return {
      ...draft,
      guardianContactedAt: shouldStampGuardianContact ? new Date().toISOString() : draft.guardianContactedAt,
    }
  }

  function hasGuardianContactWork(draft = form) {
    return draft.contactMethod === '보호자 연락' || ['보호자 연락', '보호자 안내'].includes(draft.followUpType)
  }

  function needsGuardianContactForStep() {
    return step === 1
      ? form.contactMethod === '보호자 연락'
      : ['보호자 연락', '보호자 안내'].includes(form.followUpType)
  }

  function updateGuardianContactStatus(value) {
    setForm(previous => ({
      ...previous,
      guardianContactStatus: value,
      guardianContactedAt: value === 'COMPLETED' ? (previous.guardianContactedAt || new Date().toISOString()) : null,
    }))
  }

  function updateContactMethod(value) {
    setForm(previous => {
      const shouldKeepGuardianContact = value === '보호자 연락' || ['보호자 연락', '보호자 안내'].includes(previous.followUpType)
      return {
        ...previous,
        contactMethod: value,
        guardianContactStatus: shouldKeepGuardianContact ? previous.guardianContactStatus : 'UNKNOWN',
        guardianContactMethod: shouldKeepGuardianContact ? previous.guardianContactMethod : '',
        guardianContactedAt: shouldKeepGuardianContact ? previous.guardianContactedAt : null,
        guardianContactMemo: shouldKeepGuardianContact ? previous.guardianContactMemo : '',
      }
    })
  }

  function validateGuardianContact() {
    if (!needsGuardianContactForStep()) return false
    if (form.guardianContactStatus === 'UNKNOWN') {
      alert('보호자 연락 상태를 선택해주세요.')
      return true
    }
    if (form.guardianContactStatus === 'SCHEDULED' && !form.nextActionDate) {
      alert('보호자 다음 연락일을 입력해주세요.')
      return true
    }
    return false
  }

  function renderGuardianContactPanel() {
    return (
      <section className="recall-guardian-contact-panel">
        <div className="recall-guardian-contact-panel__header">
          <strong>보호자 연락 기록</strong>
          <span>{GUARDIAN_CONTACT_STATUS_LABEL[form.guardianContactStatus] || '미확인'}</span>
        </div>
        <fieldset className="recall-choice-group recall-guardian-status-group">
          <legend>연락 상태 <small>보호자에게 리콜 위험과 필요한 조치를 안내했는지 기록하세요.</small></legend>
          {Object.entries(GUARDIAN_CONTACT_STATUS_LABEL).map(([value, label]) => (
            <button key={value} type="button" className={form.guardianContactStatus === value ? 'active' : ''} onClick={() => updateGuardianContactStatus(value)}>{label}</button>
          ))}
        </fieldset>
        <div className="recall-guardian-contact-fields">
          <label>실제 연락 수단<select value={form.guardianContactMethod ?? ''} onChange={event => setForm(previous => ({ ...previous, guardianContactMethod: event.target.value }))}><option value="">선택</option>{GUARDIAN_CONTACT_METHODS.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>연락 메모<textarea value={form.guardianContactMemo ?? ''} onChange={event => setForm(previous => ({ ...previous, guardianContactMemo: event.target.value }))} placeholder="통화 내용, 연락 실패 사유, 보호자 요청사항을 기록하세요." /></label>
        </div>
        {form.guardianContactedAt && <p className="recall-guardian-contact-time">연락 완료 시각: {formatGuidanceDate(form.guardianContactedAt)}</p>}
      </section>
    )
  }

  async function completeStopGuidance() {
    if (!guidanceForm.method) return alert('안내 방법을 선택해주세요.')
    if (!guidanceForm.target) return alert('상담 대상을 선택해주세요.')
    const completedAt = new Date().toISOString()
    const worker = getUser()
    const guidanceData = workflowPayload({
      stopGuidanceCompleted: true,
      stopGuidanceCompletedAt: completedAt,
      stopGuidanceMethod: guidanceForm.method,
      stopGuidanceTarget: guidanceForm.target,
      stopGuidanceWorkerId: getUserId(),
      stopGuidanceMemo: guidanceForm.memo,
      nextActionDate: form.nextActionDate || null,
      finalResult: form.finalResult || null,
      welfareWorkerId: getUserId(),
    })
    try {
      await updateRecallWorkflow(selected.id, guidanceData)
      setForm(previous => ({
        ...previous,
        stopGuidanceCompleted: true,
        stopGuidanceCompletedAt: completedAt,
        stopGuidanceMethod: guidanceForm.method,
        stopGuidanceTarget: guidanceForm.target,
        stopGuidanceWorkerId: getUserId(),
        stopGuidanceMemo: guidanceForm.memo,
        stopGuidanceWorkerName: worker?.name || '',
      }))
      setSelected(previous => ({
        ...previous,
        ...guidanceData,
        stopGuidanceWorkerName: worker?.name || '',
      }))
      setShowStopGuidance(false)
      await load()
    } catch (error) {
      alertWorkflowSaveError(error)
    }
  }

  async function handleActionSave(event) {
    event.preventDefault()
    if (step === 1 && !form.contactMethod) return alert('확인 방법을 먼저 선택해주세요.')
    if (step === 1 && validateGuardianContact()) return
    if (step === 1 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 1 && form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted) return alert('사용 중단 안내를 먼저 완료해주세요.')
    if (step === 2 && !form.followUpType) return alert('후속 조치 유형을 선택해주세요.')
    if (step === 2 && validateGuardianContact()) return
    if (step === 2 && completionOnly && !form.finalResult) return alert('조치 완료 결과를 선택해주세요.')
    if (step === 2 && !form.finalResult && !form.nextActionDate) return alert('다음 조치일을 입력하거나 조치 완료 결과를 선택해주세요.')
    try {
      await updateRecallWorkflow(selected.id, workflowPayload({
        followUpProgressStatus: form.finalResult ? 'COMPLETED' : (form.followUpProgressStatus || 'PLANNED'),
        nextActionDate: form.finalResult ? null : (form.nextActionDate || null),
        finalResult: form.finalResult || null,
        welfareWorkerId: getUserId(),
      }))
      await load()
      setSelected(null)
    } catch (error) {
      alertWorkflowSaveError(error)
    }
  }

  async function goNext() {
    if (step === 1 && !form.contactMethod) return alert('확인 방법을 먼저 선택해주세요.')
    if (step === 1 && validateGuardianContact()) return
    if (step === 1 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 1 && form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted) return alert('사용 중단 안내를 먼저 완료해주세요.')
    if (step === 1) {
      try {
        await updateRecallWorkflow(selected.id, workflowPayload({
          nextActionDate: form.nextActionDate || null,
          finalResult: form.finalResult || null,
          welfareWorkerId: getUserId(),
        }))
        setSelected(previous => ({ ...previous, ...form }))
        await load()
      } catch (error) {
        alertWorkflowSaveError(error)
        return
      }
    }
    setStep(previous => Math.min(2, previous + 1))
  }

  async function sendSeniorNotice(event) {
    event.preventDefault()
    if (!noticeForm.seniorId) return alert('알림을 받을 어르신을 선택해주세요.')
    if (!noticeForm.message.trim()) return alert('알림 내용을 입력해주세요.')
    if (!getUser('WELFARE_WORKER')?.token) return alert('복지사 로그인 정보가 확인되지 않습니다. 복지사로 다시 로그인해주세요.')
    const target = noticeTargets.find(item => item.id === String(noticeForm.seniorId))
    const notifySenior = noticeForm.recipient === 'SENIOR' || noticeForm.recipient === 'BOTH'
    const notifyGuardian = noticeForm.recipient === 'GUARDIAN' || noticeForm.recipient === 'BOTH'
    if (notifyGuardian && !target?.guardianId) return alert('연결된 보호자가 없는 어르신입니다.')
    setNoticeSaving(true)
    try {
      await createSeniorNotification(noticeForm.seniorId, {
        title: noticeForm.title.trim() || '복지사 알림',
        message: noticeForm.message.trim(),
        notifySenior,
        notifyGuardian,
        welfareWorkerId: getUserId('WELFARE_WORKER'),
      })
      setNoticeForm(previous => ({ ...previous, message: '' }))
      await loadSentNotices()
      setNoticeTab('history')
      alert('알림을 저장했습니다.')
    } catch (error) {
      if (error.response?.status === 403) {
        alert(`알림 전송 권한이 없습니다.\n\n복지사 ID: ${getUserId('WELFARE_WORKER') || '-'}\n대상 어르신 ID: ${noticeForm.seniorId}\n\n서버에서 이 어르신이 현재 복지사의 담당 대상이 아니라고 판단했습니다. 대상자 목록에서 담당 복지사 배정값을 확인해주세요.`)
        return
      }
      const message = error.response?.data?.message || error.response?.data?.error || error.message
      alert(`알림을 저장하지 못했습니다.${message ? `\n\n${message}` : ''}`)
    } finally {
      setNoticeSaving(false)
    }
  }

  async function cancelSentNotice(alertId) {
    if (!window.confirm('아직 확인하지 않은 알림만 전송취소됩니다. 취소할까요?')) return
    setNoticeCancellingId(alertId)
    try {
      await cancelWelfareNotification(alertId)
      await loadSentNotices()
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.error || error.message
      alert(`전송취소에 실패했습니다.${message ? `\n\n${message}` : ''}`)
    } finally {
      setNoticeCancellingId(null)
    }
  }

  const selectedTab = SUMMARY_FILTERS.find(tab => tab.key === activeTab)
  const summaryFilteredProducts = activeTab === 'ALL'
    ? products
    : products.filter(product => selectedTab.stages.includes(currentStage(product)))
  const seniorOptions = Array.from(
    products.reduce((map, product) => {
      const id = String(product.seniorId ?? '')
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
    }, new Map()).values(),
  ).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  )
  const filteredProducts = summaryFilteredProducts
    .filter(product =>
      selectedSeniorId === 'ALL'
      || String(product.seniorId) === selectedSeniorId,
    )
    .sort((a, b) =>
      recallUrgency(a) - recallUrgency(b)
      || String(a.seniorName ?? '').localeCompare(
        String(b.seniorName ?? ''),
        'ko',
      )
      || Number(a.id ?? 0) - Number(b.id ?? 0),
    )
  const noticeTargets = Array.from(
    [...seniors, ...products].reduce((map, item) => {
      const id = item.seniorId ?? item.id
      if (id) map.set(String(id), {
        id: String(id),
        name: item.seniorName || item.name || '어르신 미확인',
        guardianId: item.guardianId ?? map.get(String(id))?.guardianId ?? null,
      })
      return map
    }, new Map()).values()
  )
  const selectedNoticeTarget = noticeTargets.find(target => target.id === String(noticeForm.seniorId))
  const visibleSentNotices = sentNotices
    .filter(notice => !noticeForm.seniorId || String(notice.seniorId) === String(noticeForm.seniorId))
    .slice(0, 6)

  const tabCount = tab => tab.key === 'ALL'
    ? products.length
    : products.filter(product => tab.stages.includes(currentStage(product))).length
  const lastCheckedAt = products
    .map(product => product.lastCheckedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0]
  const lastCheckedDate = formatCheckedDate(lastCheckedAt)
  const followUpSaveDisabled = step === 2 && (
    !form.followUpType ||
    (needsGuardianContactForStep() && form.guardianContactStatus === 'UNKNOWN') ||
    (needsGuardianContactForStep() && form.guardianContactStatus === 'SCHEDULED' && !form.nextActionDate) ||
    (completionOnly && !form.finalResult) ||
    (!form.finalResult && !form.nextActionDate)
  )
  const followUpSaveLabel = form.finalResult
    ? '조치 완료 저장'
    : completionOnly
      ? '조치 완료 저장'
      : '후속 조치 저장'
  const hasSavedFollowUp = Boolean(form.followUpType || form.finalResult || form.nextActionDate || form.note || form.guardianContactStatus !== 'UNKNOWN')
  const usageNextDisabled = !form.contactMethod ||
    !useStatusSelected ||
    (form.contactMethod === '보호자 연락' && form.guardianContactStatus === 'UNKNOWN') ||
    (form.contactMethod === '보호자 연락' && form.guardianContactStatus === 'SCHEDULED' && !form.nextActionDate) ||
    (form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted)
  const canSelectUseStatus = Boolean(form.contactMethod) &&
    (form.contactMethod !== '보호자 연락' || form.guardianContactStatus !== 'UNKNOWN')

  return (
    <div>
      <div className="recall-page-header">
        <div>
          <h1 className="page-title">
            리콜 제품 조치 관리
          </h1>

          <p className="recall-page-description">
            시스템에서 리콜 대상으로 확인된 제품의 사용 여부와
            보호자 확인, 회수·교환 등 후속 조치를 관리합니다.
          </p>
        </div>

        {lastCheckedDate && (
          <span className="recall-last-checked">
            리콜 정보 마지막 조회: {lastCheckedDate}
          </span>
        )}
      </div>

      <div className="recall-summary-cards" role="tablist" aria-label="리콜 처리 상태 요약">
        {SUMMARY_FILTERS.map(tab => (
          <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key}
            className={[`tone-${tab.tone}`, activeTab === tab.key ? 'active' : ''].filter(Boolean).join(' ')} onClick={() => {
              setActiveTab(tab.key)
              setSelectedSeniorId('ALL')
            }}>
            <span>{tab.label}</span><strong>{tabCount(tab)}</strong>
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
              어르신 또는 보호자가 등록한 제품은
              공식 리콜 정보와 자동으로 비교됩니다.
            </p>

            <p>
              사용 확인이나 후속 조치가 필요한 제품만
              이 화면에 표시됩니다.
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
                      onChange={(event) =>
                        setSelectedSeniorId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="ALL">
                        대상자
                      </option>

                      {seniorOptions.map((senior) => (
                        <option
                          value={senior.id}
                          key={senior.id}
                        >
                          {senior.name}
                        </option>
                      ))}
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
              {filteredProducts.map((product) => {
                const stage =
                  currentStage(product)

                const tone =
                  stageTone(product)

                const hazard =
                  product.hazardType
                  ?? product.recallHazardType

                return (
                  <tr
                    key={product.id}
                    className={`recall-row tone-${tone}`}
                    tabIndex={0}
                    onClick={() => openModal(product)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' ||
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
                          officialRecallProductName(product),
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
                          `tone-${recallDecisionTone(product)}`,
                        ].join(' ')}
                      >
                        {recallDecisionLabel(product)}
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
                          product.registrationSource === 'GUARDIAN_WEB'
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
              })}
            </tbody>
          </table>
        )}
      </div>

      {noticeTargets.length > 0 && (
        <button
          type="button"
          className="recall-notice-fab"
          aria-label="어르신 앱 알림 작성"
          onClick={() => openNoticeComposer()}
        >
          ✉
        </button>
      )}

      {noticeOpen && (
        <div className="recall-notice-composer-overlay" onMouseDown={event => event.target === event.currentTarget && setNoticeOpen(false)}>
          <form className="recall-notice-composer" onSubmit={sendSeniorNotice}>
            <header>
              <div>
                <strong>어르신 앱 알림</strong>
                <span>리콜 안내 기록</span>
              </div>
              <button type="button" aria-label="닫기" onClick={() => setNoticeOpen(false)}>×</button>
            </header>
            <div className="recall-notice-tabs" role="tablist" aria-label="알림 작성 및 전송 내역">
              <button type="button" className={noticeTab === 'compose' ? 'active' : ''} onClick={() => setNoticeTab('compose')}>알림 작성</button>
              <button type="button" className={noticeTab === 'history' ? 'active' : ''} onClick={() => setNoticeTab('history')}>전송 내역</button>
            </div>
            {noticeTab === 'compose' && (
              <section className="recall-notice-pane">
                <label>
                  대상 어르신
                  <select value={noticeForm.seniorId} onChange={event => {
                    const seniorId = event.target.value
                    const nextTarget = noticeTargets.find(target => target.id === String(seniorId))
                    setNoticeForm(previous => ({
                      ...previous,
                      seniorId,
                      recipient: nextTarget?.guardianId ? previous.recipient : 'SENIOR',
                    }))
                  }}>
                    <option value="">선택</option>
                    {noticeTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
                  </select>
                </label>
                {noticeForm.seniorId ? (
                  <>
                    <section className="recall-notice-target-summary">
                      <div>
                        <strong>{selectedNoticeTarget?.name || '어르신 미확인'}</strong>
                        <span>{selectedNoticeTarget?.guardianId ? '보호자 연결됨' : '보호자 연결 없음'}</span>
                      </div>
                    </section>
                    <fieldset className="recall-notice-recipient">
                      <legend>수신 대상</legend>
                      <button type="button" className={noticeForm.recipient === 'BOTH' ? 'active' : ''} disabled={!selectedNoticeTarget?.guardianId} onClick={() => setNoticeForm(previous => ({ ...previous, recipient: 'BOTH' }))}>둘 다</button>
                      <button type="button" className={noticeForm.recipient === 'SENIOR' ? 'active' : ''} onClick={() => setNoticeForm(previous => ({ ...previous, recipient: 'SENIOR' }))}>어르신</button>
                      <button type="button" className={noticeForm.recipient === 'GUARDIAN' ? 'active' : ''} disabled={!selectedNoticeTarget?.guardianId} onClick={() => setNoticeForm(previous => ({ ...previous, recipient: 'GUARDIAN' }))}>보호자</button>
                      {!selectedNoticeTarget?.guardianId && <small>연결된 보호자가 없어 어르신 알림만 보낼 수 있습니다.</small>}
                    </fieldset>
                    <label>
                      제목
                      <input value={noticeForm.title} maxLength={120} onChange={event => setNoticeForm(previous => ({ ...previous, title: event.target.value }))} />
                    </label>
                    <label>
                      내용
                      <textarea value={noticeForm.message} maxLength={1000} onChange={event => setNoticeForm(previous => ({ ...previous, message: event.target.value }))} placeholder="어르신 앱 알림함에 남길 내용을 직접 입력하세요." />
                    </label>
                    <div className="recall-notice-composer__footer">
                      <span>{noticeForm.message.length}/1000</span>
                      <button type="submit" className="btn-primary" disabled={noticeSaving}>{noticeSaving ? '저장 중...' : '전달'}</button>
                    </div>
                  </>
                ) : (
                  <div className="recall-notice-target-empty">대상 어르신을 선택하면 수신 대상과 작성란이 표시됩니다.</div>
                )}
              </section>
            )}
            {noticeTab === 'history' && <section className="recall-notice-history">
              <div>
                <strong>최근 전송</strong>
                <button type="button" onClick={loadSentNotices}>새로고침</button>
              </div>
              {visibleSentNotices.length === 0 ? (
                <p>전송한 알림이 없습니다.</p>
              ) : (
                <ul>
                  {visibleSentNotices.map(notice => {
                    const isConsultationRequest = notice.type === 'CONSULTATION_REQUEST'
                    const recipient = isConsultationRequest
                      ? '상담 요청'
                      : notice.guardianId ? '보호자' : '어르신'
                    const unread = notice.status === 'UNREAD'
                    return (
                      <li key={notice.id}>
                        <span>{recipient} · {unread ? '미확인' : '확인됨'}</span>
                        <strong>{notice.title || '복지사 알림'}</strong>
                        <p>{notice.message}</p>
                        {unread && !isConsultationRequest && (
                          <button type="button" disabled={noticeCancellingId === notice.id} onClick={() => cancelSentNotice(notice.id)}>
                            {noticeCancellingId === notice.id ? '취소 중' : '전송취소'}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>}
          </form>
        </div>
      )}

      {selected && (
        <div className="recall-modal-overlay" onClick={() => setSelected(null)}>
          <form className="recall-modal" onSubmit={handleActionSave} onClick={event => event.stopPropagation()}>
            <div className="recall-modal-header">
              <div>
                <h2>{valueOrFallback(selected.seniorName, '이름 미확인')}님</h2>
                <p>{valueOrFallback(officialRecallProductName(selected))} · {valueOrFallback(selected.modelNumber)} <span>{currentStage({ ...selected, ...form })}</span></p>
              </div>
              <button type="button" className="recall-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="recall-stepper">
              <div className="done">
                <b>✓</b>
                <span>자동 판정 완료</span>
              </div>

              <div className={step === 1 ? 'active' : 'done'}>
                <b>{step > 1 ? '✓' : '1'}</b>
                <span>사용 여부 확인</span>
              </div>

              <div className={step === 2 ? 'active' : ''}>
                <b>2</b>
                <span>조치 완료 관리</span>
              </div>
            </div>

            <div className="recall-modal-body">
              <section className="recall-action-guide">
                <div className="recall-action-guide__header">
                  <div>
                    <span>
                      시스템 자동 판정 결과
                    </span>

                    <strong>
                      {recallDecisionLabel(selected)}
                    </strong>

                    <small>
                      리콜 여부는 공식 API 조회 결과입니다.
                      복지사는 실제 보유·사용 여부와 후속 조치 완료 여부를 확인합니다.
                    </small>
                  </div>

                  <div className="recall-action-guide__tools">
                    <button
                      type="button"
                      className="recall-detail-notice-button"
                      aria-label="알림 작성"
                      onClick={() =>
                        openNoticeComposer(selected)
                      }
                    >
                      ✉
                    </button>

                    <button
                      type="button"
                      disabled={!recallContact(selected)}
                      onClick={copyRecallContact}
                    >
                      문의처 복사
                    </button>
                  </div>
                </div>
                {showRecallDetails && (
                  <dl>
                    <div>
                      <dt>제품 판정</dt>
                      <dd>
                        {recallDecisionLabel(selected)}
                      </dd>
                    </div>

                    <div>
                      <dt>소비자 조치</dt>
                      <dd>
                        {recallConsumerAction(selected)}
                      </dd>
                    </div>

                    <div>
                      <dt>위험·결함</dt>
                      <dd>
                        {valueOrFallback(
                          recallHazard(selected),
                          '상세 위험 정보가 없습니다.',
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>제조사 문의</dt>
                      <dd>
                        {valueOrFallback(
                          recallContact(selected),
                          '문의처 정보 없음',
                        )}
                      </dd>
                    </div>

                    {(selected.sourceName || selected.sourceUrl) && (
                      <div>
                        <dt>출처</dt>
                        <dd>
                          {selected.sourceUrl ? (
                            <a
                              href={selected.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {selected.sourceName
                                || '공식 리콜 공고 보기'}
                            </a>
                          ) : (
                            selected.sourceName
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </section>

              {false && <>
                <div className="recall-compare-grid">
                  <section><h3>등록 제품</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(selected.productName)}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.manufacturer)}</dd></div><div><dt>모델명</dt><dd>{valueOrFallback(selected.modelNumber)}</dd></div><div><dt>등록 방식</dt><dd>{valueOrFallback(selected.registrationSource ?? selected.ocrInfo ?? selected.ocrText)}</dd></div></dl></section>
                  <section><h3>리콜 대상 정보</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(officialRecallProductName(selected))}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.recallManufacturer ?? selected.manufacturer)}</dd></div><div><dt>대상 모델</dt><dd>{valueOrFallback(selected.recallModelNumber ?? selected.modelNumber)}</dd></div><div><dt>위해 유형</dt><dd>{valueOrFallback(selected.hazardType ?? selected.recallHazardType)}</dd></div></dl></section>
                </div>
                <div className="recall-key-guidance"><div><strong>즉시 조치</strong><p>{valueOrFallback(selected.immediateAction, '제품 사용을 중단하고 전원 플러그를 분리하도록 안내합니다.')}</p></div><div><strong>조치 방법</strong><p>{valueOrFallback(selected.remedy ?? selected.actionMethod, '제조사 고객센터 또는 공식 안내 페이지에서 수리·교환·환불 방법을 확인합니다.')}</p></div><div><strong>문의처</strong><p>{valueOrFallback(selected.contactNumber)}</p></div><button type="button" onClick={() => setShowOriginal(value => !value)}>리콜 상세 원문 {showOriginal ? '닫기' : '보기'}</button>{showOriginal && <pre>{valueOrFallback(selected.recallReason)}</pre>}</div>
                <div className="recall-api-match-note">
                  <strong>제품안전정보센터 리콜 목록에서 조회된 제품입니다.</strong>
                  <p>리콜 여부는 API 조회 결과로 처리하고, 복지사는 실제 보유·사용 여부와 후속 조치만 확인합니다.</p>
                </div>
              </>}

              <div className="recall-workflow-note">
                <strong>{step === 1 ? '현재 업무: 사용 여부 확인' : '현재 업무: 후속 조치 기록'}</strong>
                <p>{step === 1 ? '어르신이 실제로 제품을 보유하고 사용하는지 먼저 확인합니다.' : '확인한 내용을 바탕으로 제조사 문의, 방문, 수리·환불 등 다음 조치를 기록합니다.'}</p>
              </div>

              {step === 1 && <>
                <div className="recall-usage-layout">
                  <fieldset className="recall-choice-group"><legend>확인 방법</legend>{['전화', '보호자 연락', '방문', '기타'].map(value => <button key={value} type="button" className={form.contactMethod === value ? 'active' : ''} onClick={() => updateContactMethod(value)}>{value}</button>)}</fieldset>
                </div>
                {form.contactMethod === '보호자 연락' && renderGuardianContactPanel()}
                <fieldset className="recall-choice-group vertical recall-use-status-group" disabled={!canSelectUseStatus}><legend>제품 사용 상태 {!form.contactMethod && <small>확인 방법을 먼저 선택해주세요.</small>}{form.contactMethod === '보호자 연락' && form.guardianContactStatus === 'UNKNOWN' && <small>보호자 연락 상태를 먼저 기록해주세요.</small>}</legend>{[['IN_USE', '현재 사용 중'], ['NOT_IN_USE', '보유 중이나 사용하지 않음'], ['STOPPED', '사용 중단 완료'], ['UNKNOWN', '확인하지 못함']].map(([value, label]) => <button key={value} type="button" disabled={!canSelectUseStatus} className={useStatusSelected && form.currentUseStatus === value ? 'active' : ''} onClick={() => { setUseStatusSelected(true); setForm(previous => ({ ...previous, currentUseStatus: value, finalResult: '' })) }}>{label}</button>)}</fieldset>
                {form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted && <aside className="recall-stop-warning"><strong>사용 중단 안내 기록이 필요합니다.</strong><ul><li>즉시 전원을 끄고 플러그를 분리하도록 안내</li><li>제조사 문의처와 조치 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul><button type="button" className="recall-stop-guidance-btn" onClick={() => setShowStopGuidance(true)}>사용 중단 안내 기록</button></aside>}
                {form.currentUseStatus === 'IN_USE' && form.stopGuidanceCompleted && <aside className="recall-guidance-complete"><strong>사용 중단 안내 기록 완료</strong><p>{formatGuidanceDate(form.stopGuidanceCompletedAt)} · {valueOrFallback(form.stopGuidanceMethod)} · {valueOrFallback(form.stopGuidanceTarget)}</p><p>담당자: {valueOrFallback(form.stopGuidanceWorkerName)}</p><button type="button" onClick={() => setShowStopGuidance(true)}>안내 기록 보기</button></aside>}
                {(form.currentUseStatus === 'UNKNOWN' || form.guardianContactStatus === 'SCHEDULED') && <div className="recall-form-grid"><label>{form.guardianContactStatus === 'SCHEDULED' ? '보호자 다음 연락일' : '다음 연락일'}<input type="date" value={form.nextActionDate ?? ''} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label></div>}
              </>}

              {step === 2 && !followUpEditing && hasSavedFollowUp && (
                <section className="recall-followup-summary">
                  <div className="recall-followup-summary__header">
                    <strong>{form.finalResult ? '조치 완료 기록' : '저장된 후속 조치'}</strong>
                    <span>{form.finalResult ? finalResultLabel(form.finalResult) : valueOrFallback(form.followUpType)}</span>
                  </div>
                  <dl>
                    <div><dt>후속 조치</dt><dd>{valueOrFallback(form.followUpType)}</dd></div>
                    <div><dt>보호자 연락</dt><dd>{GUARDIAN_CONTACT_STATUS_LABEL[form.guardianContactStatus] || '미확인'}{form.guardianContactMethod ? ` · ${form.guardianContactMethod}` : ''}</dd></div>
                    {form.guardianContactedAt && <div><dt>연락 완료</dt><dd>{formatGuidanceDate(form.guardianContactedAt)}</dd></div>}
                    <div><dt>다음 조치일</dt><dd>{form.finalResult ? '-' : formatDate(form.nextActionDate)}</dd></div>
                    <div><dt>완료 결과</dt><dd>{form.finalResult ? finalResultLabel(form.finalResult) : '진행 중'}</dd></div>
                    <div><dt>담당자 메모</dt><dd>{valueOrFallback(form.note)}</dd></div>
                  </dl>
                  <div className="recall-followup-summary__actions">
                    <button type="button" className="btn-outline" onClick={() => { setCompletionOnly(false); setFollowUpEditing(true) }}>수정</button>
                    {!form.finalResult && <button type="button" className="btn-primary" onClick={() => { setCompletionOnly(true); setFollowUpEditing(true) }}>조치 완료 처리</button>}
                  </div>
                </section>
              )}

              {step === 2 && followUpEditing && completionOnly && (
                <div className="recall-completion-panel">
                  <div className="recall-completion-panel__header">
                    <strong>조치 완료 처리</strong>
                    <span>{valueOrFallback(form.followUpType)}</span>
                  </div>
                  <fieldset className="recall-choice-group recall-completion-group"><legend>완료 결과 <small>실제 조치가 끝난 결과만 선택하세요.</small></legend>{FINAL_RESULT_OPTIONS.map(([value, label]) => <button key={value} type="button" className={form.finalResult === value ? 'active' : ''} onClick={() => setForm(previous => previous.finalResult === value ? ({ ...previous, finalResult: '' }) : ({ ...previous, finalResult: value, followUpProgressStatus: 'COMPLETED', nextActionDate: '' }))}>{label}</button>)}</fieldset>
                  <label className="recall-completion-note">완료 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="완료 처리 내용이나 확인 사항을 기록하세요" /></label>
                </div>
              )}

              {step === 2 && followUpEditing && !completionOnly && <div className="recall-form-grid">
                <label>후속 조치 유형<select value={form.followUpType ?? ''} onChange={event => {
                  const isGuardianFollowUp = ['보호자 연락', '보호자 안내'].includes(event.target.value)
                  setForm(previous => ({
                    ...previous,
                    followUpType: event.target.value,
                    guardianContactStatus: isGuardianFollowUp ? previous.guardianContactStatus : 'UNKNOWN',
                    guardianContactMethod: isGuardianFollowUp ? previous.guardianContactMethod : '',
                    guardianContactedAt: isGuardianFollowUp ? previous.guardianContactedAt : null,
                    guardianContactMemo: isGuardianFollowUp ? previous.guardianContactMemo : '',
                  }))
                }}><option value="">선택</option>{['어르신 안내', '보호자 안내', '제조사 문의', '사용 중단 재확인', '제조사 문의·조치 안내', '수리 또는 환불 확인', '보호자 연락', '방문 확인', '기타'].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>다음 조치일<input type="date" value={form.nextActionDate ?? ''} disabled={Boolean(form.finalResult)} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label>
                {['보호자 연락', '보호자 안내'].includes(form.followUpType) && renderGuardianContactPanel()}
                <label className="recall-note-field">담당자 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="확인 및 후속 조치 내용을 기록하세요" /></label>
                <fieldset className="recall-choice-group recall-completion-group"><legend>조치 완료 처리 <small>실제 조치가 끝났을 때 선택하세요.</small></legend>{FINAL_RESULT_OPTIONS.map(([value, label]) => <button key={value} type="button" className={form.finalResult === value ? 'active' : ''} onClick={() => setForm(previous => previous.finalResult === value ? ({ ...previous, finalResult: '' }) : ({ ...previous, finalResult: value, followUpProgressStatus: 'COMPLETED', nextActionDate: '' }))}>{label}</button>)}</fieldset>
              </div>}
            </div>

            <div className="recall-modal-actions">
              {step > 1 && <button type="button" className="btn-outline" onClick={() => setStep(value => value - 1)}>이전</button>}
              {step < 2 && <button type="button" className="btn-primary" disabled={usageNextDisabled} onClick={goNext}>다음 단계: 후속 조치</button>}
              {step === 2 && followUpEditing && <button type="submit" className="btn-primary" disabled={followUpSaveDisabled}>{followUpSaveLabel}</button>}
            </div>
          </form>
          {showStopGuidance && <div className="recall-guidance-overlay" role="dialog" aria-modal="true" aria-label="사용 중단 안내" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setShowStopGuidance(false) }}>
            <div className="recall-guidance-dialog" onClick={event => event.stopPropagation()}>
              <div className="recall-guidance-header"><div><h3>사용 중단 안내 기록</h3><p>실제로 안내한 뒤 기록을 저장해주세요.</p></div><button type="button" aria-label="닫기" onClick={() => setShowStopGuidance(false)}>×</button></div>
              <div className="recall-guidance-body">
                <ul className="recall-guidance-checklist"><li>즉시 전원을 끄도록 안내</li><li>플러그를 분리하도록 안내</li><li>제품을 다시 사용하지 않도록 안내</li><li>제조사 문의처와 조치 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul>
                <fieldset className="recall-choice-group"><legend>상담 대상</legend>{[['님 본인', '님'], ['보호자', '보호자']].map(([value, label]) => <button key={value} type="button" className={guidanceForm.target === value ? 'active' : ''} onClick={() => setGuidanceForm(previous => ({ ...previous, target: value }))}>{label}</button>)}</fieldset>
                <fieldset className="recall-choice-group"><legend>안내 방법</legend>{['전화', '방문', '보호자 연락'].map(value => <button key={value} type="button" className={guidanceForm.method === value ? 'active' : ''} onClick={() => setGuidanceForm(previous => ({ ...previous, method: value }))}>{value}</button>)}</fieldset>
                <label className="recall-guidance-memo">메모<textarea value={guidanceForm.memo ?? ''} onChange={event => setGuidanceForm(previous => ({ ...previous, memo: event.target.value }))} placeholder="안내 내용이나 특이사항을 기록하세요" /></label>
              </div>
              <div className="recall-guidance-actions"><button type="button" className="btn-outline" onClick={() => setShowStopGuidance(false)}>취소</button><button type="button" className="btn-primary" onClick={completeStopGuidance}>안내 기록 저장</button></div>
            </div>
          </div>}
        </div>
      )}
    </div>
  )
}
