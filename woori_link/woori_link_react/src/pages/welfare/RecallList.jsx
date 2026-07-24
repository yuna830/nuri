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

function cleanRecallText(value) {
  if (!value) return ''

  return String(value)
    .replace(/\s+[-–—•·▪▫■□◆◇▶▷※○◯〇oO]\s+/g, '\n')
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^\s*[-–—•·▪▫■□◆◇▶▷※○◯〇oO]+\s*/g, '')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
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
      currentUseStatus: product.currentUseStatus === 'NOT_OWNED'
        ? 'UNKNOWN'
        : product.currentUseStatus || 'UNKNOWN',
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
  }

  function workflowPayload(extra = {}) {
    const draft = { ...form, ...extra }
    const shouldStampGuardianContact = draft.guardianContactStatus === 'COMPLETED' && !draft.guardianContactedAt
    return {
      ...draft,
      guardianContactedAt: shouldStampGuardianContact ? new Date().toISOString() : draft.guardianContactedAt,
    }
  }

  async function handleActionSave(event) {
    event.preventDefault()

    if (!form.followUpType) {
      alert('진행할 조치를 선택해주세요.')
      return
    }

    if (!form.nextActionDate) {
      alert('조치 예정일을 입력해주세요.')
      return
    }

    try {
      await updateRecallWorkflow(
        selected.id,
        workflowPayload({
          followUpProgressStatus: 'PLANNED',
          nextActionDate: form.nextActionDate,
          finalResult: null,
          welfareWorkerId: getUserId(),
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
  const followUpSaveDisabled =
    !form.followUpType || !form.nextActionDate


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
                    const recipient = notice.guardianId ? '보호자' : '어르신'
                    const unread = notice.status === 'UNREAD'
                    return (
                      <li key={notice.id}>
                        <span>{recipient} · {unread ? '미확인' : '확인됨'}</span>
                        <strong>{notice.title || '복지사 알림'}</strong>
                        <p>{notice.message}</p>
                        {unread && (
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
        <div
          className="recall-modal-overlay"
          onClick={() => setSelected(null)}
        >
          <form
            className="recall-modal"
            onSubmit={handleActionSave}
            onClick={event => event.stopPropagation()}
          >
            <div className="recall-modal-header">
              <div>
                <h2>
                  {valueOrFallback(
                    selected.seniorName,
                    '이름 미확인',
                  )}님
                </h2>

                <p>
                  {valueOrFallback(
                    officialRecallProductName(selected),
                  )}
                  {' · '}
                  {valueOrFallback(selected.modelNumber)}
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
                onClick={() => setSelected(null)}
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
                  <span>현재 사용 상태</span>
                  <strong>
                    {USE_STATUS_LABEL[
                      selected.currentUseStatus || 'UNKNOWN'
                    ] || '미확인'}
                  </strong>
                </div>

                <div className="recall-overview__item">
                  <span>현재 관리 상태</span>
                  <strong>{currentStage(selected)}</strong>
                </div>
              </section>

              <section className="recall-official-info">
                <div className="recall-section-header">
                  <div>
                    <span>공식 리콜 정보</span>
                    <strong>
                      {recallDecisionLabel(selected)}
                    </strong>
                  </div>

                  <div className="recall-section-actions">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() =>
                        openNoticeComposer(selected)
                      }
                    >
                      안내 작성
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      disabled={!recallContact(selected)}
                      onClick={copyRecallContact}
                    >
                      문의처 복사
                    </button>
                  </div>
                </div>

                <dl className="recall-official-info__list">
                  <div>
                    <dt>위험·결함 내용</dt>
                    <dd className="recall-clean-text">
                      {valueOrFallback(
                        cleanRecallText(recallHazard(selected)),
                        '상세 위험 정보가 없습니다.',
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>소비자 조치 안내</dt>
                    <dd className="recall-clean-text">
                      {valueOrFallback(
                        cleanRecallText(recallConsumerAction(selected)),
                        '조치 안내 정보가 없습니다.',
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>제조사 문의처</dt>
                    <dd>
                      {valueOrFallback(
                        recallContact(selected),
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
                              href={selected.sourceUrl}
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
                    복지사가 앞으로 진행할 업무를
                    기록합니다.
                  </span>
                </div>

                <div className="recall-form-grid">
                  <label>
                    진행할 조치
                    <select
                      value={form.followUpType ?? ''}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          followUpType:
                            event.target.value,
                        }))
                      }
                    >
                      <option value="">선택</option>

                      {[
                        '어르신 안내',
                        '보호자 안내',
                        '제조사 문의',
                        '사용 중단 재확인',
                        '제조사 문의·조치 안내',
                        '수리 또는 환불 확인',
                        '방문 확인',
                        '관련 기관 연계',
                        '기타',
                      ].map(value => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    조치 예정일
                    <input
                      type="date"
                      value={form.nextActionDate ?? ''}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          nextActionDate:
                            event.target.value,
                        }))
                      }
                    />
                  </label>

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
                      placeholder="연락, 방문, 제조사 안내 등 앞으로 진행할 내용을 기록하세요."
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="recall-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setSelected(null)}
              >
                닫기
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={followUpSaveDisabled}
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