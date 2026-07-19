import { useEffect, useState } from 'react'
import { getProductsBySenior, getRecalledProducts, getRecalledProductsByWelfareWorker, updateRecallWorkflow } from '../../api/recallApi'
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

function removeGuideNotes(note) {
  return String(note || '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('어르신 안내:')
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

function currentStage(product) {
  const useStatus = product.currentUseStatus || 'UNKNOWN'
  const actionStatus = product.actionStatus || 'CONFIRMATION_NEEDED'

  if (product.finalResult || actionStatus === 'COMPLETED') return product.finalResult === 'NOT_RECALLED' ? '등록 공고 일치 없음' : '조치 완료'
  if (actionStatus === 'NOT_RECALLED' || product.recallDecisionStatus === 'NO_MATCH_FOUND') return '등록 공고 일치 없음'
  if (
    useStatus === 'UNKNOWN' &&
    !product.followUpType &&
    !['STOP_GUIDANCE_COMPLETED', 'RECALL_GUIDANCE_COMPLETED', 'RECALL_IN_PROGRESS'].includes(actionStatus)
  ) return '사용 여부 확인'
  return '후속 조치'
}

function stageTone(product) {
  if (product.finalResult || product.actionStatus === 'COMPLETED') return 'done'
  if (product.actionStatus === 'NOT_RECALLED' || product.recallDecisionStatus === 'NO_MATCH_FOUND') return 'excluded'
  if ((product.currentUseStatus || 'UNKNOWN') === 'UNKNOWN' && !product.followUpType) return 'check'
  return 'action'
}

const SUMMARY_FILTERS = [
  { key: 'ALL', label: '전체', tone: 'all' },
  { key: 'CHECK', label: '확인 필요', tone: 'check', stages: ['사용 여부 확인'] },
  { key: 'ACTION', label: '조치 진행', tone: 'action', stages: ['후속 조치'] },
  { key: 'DONE', label: '완료', tone: 'done', stages: ['조치 완료', '등록 공고 일치 없음'] },
]

const DETAIL_STAGES = ['사용 여부 확인', '후속 조치', '조치 완료', '등록 공고 일치 없음']

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
  const [detailStage, setDetailStage] = useState('ALL')
  const [step, setStep] = useState(1)
  const [showOriginal, setShowOriginal] = useState(false)
  const [useStatusSelected, setUseStatusSelected] = useState(false)
  const [showStopGuidance, setShowStopGuidance] = useState(false)
  const [showRecallDetails, setShowRecallDetails] = useState(false)
  const [followUpEditing, setFollowUpEditing] = useState(true)
  const [completionOnly, setCompletionOnly] = useState(false)
  const [guidanceForm, setGuidanceForm] = useState({ method: '', target: '', memo: '' })

  useEffect(() => { load() }, [])

  function setFollowUpFromGuide(type) {
    const contact = recallContact(selected)
    const line = contact
      ? `${type}: 리콜 문의처(${contact}) 기준으로 안내/확인했습니다.`
      : `${type}: 리콜 안내 내용을 기준으로 안내/확인했습니다.`
    setStep(2)
    setFollowUpEditing(true)
    setCompletionOnly(false)
    setForm(previous => ({
      ...previous,
      followUpType: type,
      note: [removeGuideNotes(previous.note), line].filter(Boolean).join('\n'),
    }))
  }

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

  async function load() {
    const welfareWorkerId = getUserId()
    if (!welfareWorkerId) {
      const response = await getRecalledProducts().catch(() => ({ data: [] }))
      setProducts(Array.isArray(response.data) ? response.data : [])
      return
    }

    const response = await getRecalledProductsByWelfareWorker(welfareWorkerId).catch(() => null)
    if (Array.isArray(response?.data) && response.data.length > 0) {
      setProducts(response.data)
      return
    }

    const seniorsResponse = await getSeniorsByWelfareWorker(welfareWorkerId).catch(() => ({ data: [] }))
    const seniors = Array.isArray(seniorsResponse.data) ? seniorsResponse.data : []
    const productResponses = await Promise.all(
      seniors.map(senior => getProductsBySenior(senior.id).catch(() => ({ data: [] })))
    )
    const recalledProducts = productResponses
      .flatMap(result => Array.isArray(result.data) ? result.data : [])
      .filter(product => product.recallDecisionStatus === 'RECALL_CONFIRMED' || (!product.recallDecisionStatus && product.recallStatus === 'RECALLED'))
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
      followUpType: product.followUpType || '',
      nextActionDate: product.nextActionDate || '',
      followUpProgressStatus: product.followUpProgressStatus || 'PLANNED',
      note: product.note || '',
      finalResult: product.finalResult || '',
      createAction: false,
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

  async function completeStopGuidance() {
    if (!guidanceForm.method) return alert('안내 방법을 선택해주세요.')
    if (!guidanceForm.target) return alert('상담 대상을 선택해주세요.')
    const completedAt = new Date().toISOString()
    const worker = getUser()
    const guidanceData = {
      ...form,
      stopGuidanceCompleted: true,
      stopGuidanceCompletedAt: completedAt,
      stopGuidanceMethod: guidanceForm.method,
      stopGuidanceTarget: guidanceForm.target,
      stopGuidanceWorkerId: getUserId(),
      stopGuidanceMemo: guidanceForm.memo,
      nextActionDate: form.nextActionDate || null,
      finalResult: form.finalResult || null,
      welfareWorkerId: getUserId(),
    }
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
    if (step === 1 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 1 && form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted) return alert('사용 중단 안내를 먼저 완료해주세요.')
    if (step === 2 && !form.followUpType) return alert('후속 조치 유형을 선택해주세요.')
    if (step === 2 && completionOnly && !form.finalResult) return alert('조치 완료 결과를 선택해주세요.')
    if (step === 2 && !form.finalResult && !form.nextActionDate) return alert('다음 조치일을 입력하거나 조치 완료 결과를 선택해주세요.')
    try {
      await updateRecallWorkflow(selected.id, {
        ...form,
        followUpProgressStatus: form.finalResult ? 'COMPLETED' : (form.followUpProgressStatus || 'PLANNED'),
        nextActionDate: form.finalResult ? null : (form.nextActionDate || null),
        finalResult: form.finalResult || null,
        welfareWorkerId: getUserId(),
      })
      await load()
      setSelected(null)
    } catch (error) {
      alertWorkflowSaveError(error)
    }
  }

  async function goNext() {
    if (step === 1 && !form.contactMethod) return alert('확인 방법을 먼저 선택해주세요.')
    if (step === 1 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 1 && form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted) return alert('사용 중단 안내를 먼저 완료해주세요.')
    if (step === 1) {
      try {
        await updateRecallWorkflow(selected.id, {
          ...form,
          nextActionDate: form.nextActionDate || null,
          finalResult: form.finalResult || null,
          welfareWorkerId: getUserId(),
        })
        setSelected(previous => ({ ...previous, ...form }))
        await load()
      } catch (error) {
        alertWorkflowSaveError(error)
        return
      }
    }
    setStep(previous => Math.min(2, previous + 1))
  }

  const selectedTab = SUMMARY_FILTERS.find(tab => tab.key === activeTab)
  const summaryFilteredProducts = activeTab === 'ALL'
    ? products
    : products.filter(product => selectedTab.stages.includes(currentStage(product)))
  const filteredProducts = detailStage === 'ALL'
    ? summaryFilteredProducts
    : summaryFilteredProducts.filter(product => currentStage(product) === detailStage)

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
    (completionOnly && !form.finalResult) ||
    (!form.finalResult && !form.nextActionDate)
  )
  const followUpSaveLabel = form.finalResult
    ? '조치 완료 저장'
    : completionOnly
      ? '조치 완료 저장'
    : (form.createAction ? '달력 등록 및 저장' : '후속 조치 저장')
  const hasSavedFollowUp = Boolean(form.followUpType || form.finalResult || form.nextActionDate || form.note)

  return (
    <div>
      <div className="recall-page-header">
        <div>
          <h1 className="page-title">리콜 제품 확인 대상</h1>
          <p className="recall-page-description">어르신이 등록한 제품과 리콜 정보를 대조하고, 실제 사용 여부와 후속 조치를 관리합니다.</p>
        </div>
        {lastCheckedDate && <span className="recall-last-checked">마지막 확인: {lastCheckedDate}</span>}
      </div>

      <div className="recall-summary-cards" role="tablist" aria-label="리콜 처리 상태 요약">
        {SUMMARY_FILTERS.map(tab => (
          <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key}
            className={[`tone-${tab.tone}`, activeTab === tab.key ? 'active' : ''].filter(Boolean).join(' ')} onClick={() => { setActiveTab(tab.key); setDetailStage('ALL') }}>
            <span>{tab.label}</span><strong>{tabCount(tab)}</strong>
          </button>
        ))}
      </div>

      <div className="card recall-card">
        <div className="recall-table-toolbar">
          <label htmlFor="recallDetailStage">세부 단계</label>
          <select id="recallDetailStage" value={detailStage} onChange={event => setDetailStage(event.target.value)}>
            <option value="ALL">세부 단계 전체</option>
            {DETAIL_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="recall-empty-state">
            <strong>{products.length === 0 ? '현재 확인이 필요한 리콜 제품이 없습니다.' : '해당 단계의 제품이 없습니다.'}</strong>
            <p>어르신이 등록한 제품은 최신 리콜 정보와 자동으로 비교됩니다.</p>
            <p>새로운 리콜 대상이 확인되면 이 목록에 표시됩니다.</p>
          </div>
        ) : (
          <table className="data-table recall-table">
            <thead>
              <tr>
                <th>어르신</th><th>등록 제품</th><th>현재 단계</th><th>다음 조치일</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const stage = currentStage(product)
                const tone = stageTone(product)
                const hazard = product.hazardType ?? product.recallHazardType
                return (
                  <tr
                    key={product.id}
                    className={`recall-row tone-${tone}`}
                    tabIndex={0}
                    onClick={() => openModal(product)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openModal(product)
                      }
                    }}
                  >
                    <td className="font-bold">{valueOrFallback(product.seniorName, '미확인')}</td>
                    <td>
                      <strong className="recall-product-name">{valueOrFallback(product.productName)}</strong>
                      <span className="recall-product-model">{valueOrFallback(product.modelNumber)} · {valueOrFallback(product.manufacturer)}</span>
                      {hazard && (
                        <small className="recall-hazard-warning">주의: {hazard}</small>
                      )}
                    </td>
                    <td><span className={`recall-state-badge tone-${tone}`}>{stage}</span></td>
                    <td>{formatDate(product.nextActionDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="recall-modal-overlay" onClick={() => setSelected(null)}>
          <form className="recall-modal" onSubmit={handleActionSave} onClick={event => event.stopPropagation()}>
            <div className="recall-modal-header">
              <div>
                <h2>{valueOrFallback(selected.seniorName, '어르신 미확인')} 어르신</h2>
                <p>{valueOrFallback(selected.productName)} · {valueOrFallback(selected.modelNumber)} <span>{currentStage({ ...selected, ...form })}</span></p>
              </div>
              <button type="button" className="recall-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="recall-stepper">
              {[1, 2].map(number => <div key={number} className={step === number ? 'active' : step > number ? 'done' : ''}><b>{step > number ? '✓' : number}</b><span>{['사용 여부 확인', '후속 조치'][number - 1]}</span></div>)}
            </div>

            <div className="recall-modal-body">
              <section className="recall-action-guide">
                <div className="recall-action-guide__header">
                  <div>
                    <span>리콜 조치 안내</span>
                    <strong>{recallContact(selected) || '문의처 정보 없음'}</strong>
                    {!recallContact(selected) && <small>상세 안내 원문 또는 출처에서 문의처를 확인하세요.</small>}
                  </div>
                  <div className="recall-action-guide__tools">
                    <button type="button" onClick={copyRecallContact} disabled={!recallContact(selected)}>문의처 복사</button>
                    {recallContactHref(selected) && <a href={`tel:${recallContactHref(selected)}`}>전화 걸기</a>}
                  </div>
                </div>
                <button type="button" className={`recall-action-guide__toggle ${showRecallDetails ? 'open' : ''}`} onClick={() => setShowRecallDetails(value => !value)}>
                  {showRecallDetails ? '상세 안내 접기' : '상세 안내 보기'}
                </button>
                {showRecallDetails && (
                  <dl>
                    <div>
                      <dt>소비자 조치</dt>
                      <dd>{recallConsumerAction(selected)}</dd>
                    </div>
                    <div>
                      <dt>위험/결함</dt>
                      <dd>{valueOrFallback(recallHazard(selected), '상세 위험 정보가 없습니다. 사용 여부 확인 후 제조사 문의처로 조치 방법을 확인하세요.')}</dd>
                    </div>
                    {(selected.sourceName || selected.sourceUrl) && (
                      <div>
                        <dt>출처</dt>
                        <dd>
                          {selected.sourceUrl
                            ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceName || '리콜 상세 보기'}</a>
                            : selected.sourceName}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="recall-action-guide__quick">
                  <button type="button" onClick={() => setFollowUpFromGuide('어르신 안내')}>어르신 안내 기록</button>
                  <button type="button" onClick={() => setFollowUpFromGuide('보호자 안내')}>보호자 안내 기록</button>
                  <button type="button" onClick={() => setFollowUpFromGuide('제조사 문의')}>제조사 문의 기록</button>
                </div>
              </section>

              {false && <>
                <div className="recall-compare-grid">
                  <section><h3>등록 제품</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(selected.productName)}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.manufacturer)}</dd></div><div><dt>모델명</dt><dd>{valueOrFallback(selected.modelNumber)}</dd></div><div><dt>등록 방식</dt><dd>{valueOrFallback(selected.registrationSource ?? selected.ocrInfo ?? selected.ocrText)}</dd></div></dl></section>
                  <section><h3>리콜 대상 정보</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(selected.recallProductName ?? selected.productName)}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.recallManufacturer ?? selected.manufacturer)}</dd></div><div><dt>대상 모델</dt><dd>{valueOrFallback(selected.recallModelNumber ?? selected.modelNumber)}</dd></div><div><dt>위해 유형</dt><dd>{valueOrFallback(selected.hazardType ?? selected.recallHazardType)}</dd></div></dl></section>
                </div>
                <div className="recall-key-guidance"><div><strong>즉시 조치</strong><p>{valueOrFallback(selected.immediateAction, '제품 사용을 중단하고 전원 플러그를 분리하도록 안내합니다.')}</p></div><div><strong>조치 방법</strong><p>{valueOrFallback(selected.remedy ?? selected.actionMethod, '제조사 고객센터 또는 공식 안내 페이지에서 수리·교환·환불 방법을 확인합니다.')}</p></div><div><strong>문의처</strong><p>{valueOrFallback(selected.contactNumber)}</p></div><button type="button" onClick={() => setShowOriginal(value => !value)}>리콜 상세 원문 {showOriginal ? '닫기' : '보기'}</button>{showOriginal && <pre>{valueOrFallback(selected.recallReason)}</pre>}</div>
                <div className="recall-api-match-note">
                  <strong>제품안전정보센터 리콜 목록에서 조회된 제품입니다.</strong>
                  <p>리콜 여부는 API 조회 결과로 처리하고, 복지사는 실제 보유·사용 여부와 후속 조치만 확인합니다.</p>
                </div>
              </>}

              {step === 1 && <>
                <div className="recall-usage-layout">
                <fieldset className="recall-choice-group"><legend>확인 방법</legend>{['전화','보호자 연락','방문','기타'].map(value => <button key={value} type="button" className={form.contactMethod === value ? 'active' : ''} onClick={() => setForm(previous => ({ ...previous, contactMethod: value }))}>{value}</button>)}</fieldset>
                <fieldset className="recall-choice-group vertical" disabled={!form.contactMethod}><legend>제품 사용 상태 {!form.contactMethod && <small>확인 방법을 먼저 선택해주세요.</small>}</legend>{[['IN_USE','현재 사용 중'],['NOT_IN_USE','보유 중이나 사용하지 않음'],['STOPPED','사용 중단 완료'],['UNKNOWN','확인하지 못함']].map(([value,label]) => <button key={value} type="button" disabled={!form.contactMethod} className={useStatusSelected && form.currentUseStatus === value ? 'active' : ''} onClick={() => { setUseStatusSelected(true); setForm(previous => ({ ...previous, currentUseStatus: value, finalResult: '' })) }}>{label}</button>)}</fieldset>
                </div>
                {form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted && <aside className="recall-stop-warning"><strong>사용 중단 안내가 필요합니다.</strong><ul><li>즉시 전원을 끄고 플러그를 분리하도록 안내</li><li>제조사 문의처와 조치 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul><button type="button" className="recall-stop-guidance-btn" onClick={() => setShowStopGuidance(true)}>사용 중단 안내하기</button></aside>}
                {form.currentUseStatus === 'IN_USE' && form.stopGuidanceCompleted && <aside className="recall-guidance-complete"><strong>사용 중단 안내 완료</strong><p>{formatGuidanceDate(form.stopGuidanceCompletedAt)} · {valueOrFallback(form.stopGuidanceMethod)} · {valueOrFallback(form.stopGuidanceTarget)}</p><p>담당자: {valueOrFallback(form.stopGuidanceWorkerName)}</p><button type="button" onClick={() => setShowStopGuidance(true)}>안내 내용 보기</button></aside>}
                {form.currentUseStatus === 'UNKNOWN' && <div className="recall-form-grid"><label>다음 연락일<input type="date" value={form.nextActionDate ?? ''} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label></div>}
              </>}

              {step === 2 && !followUpEditing && hasSavedFollowUp && (
                <section className="recall-followup-summary">
                  <div className="recall-followup-summary__header">
                    <strong>{form.finalResult ? '조치 완료 기록' : '저장된 후속 조치'}</strong>
                    <span>{form.finalResult ? finalResultLabel(form.finalResult) : valueOrFallback(form.followUpType)}</span>
                  </div>
                  <dl>
                    <div><dt>후속 조치</dt><dd>{valueOrFallback(form.followUpType)}</dd></div>
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
                  <fieldset className="recall-choice-group recall-completion-group"><legend>완료 결과 <small>실제 조치가 끝난 결과만 선택하세요.</small></legend>{FINAL_RESULT_OPTIONS.map(([value,label]) => <button key={value} type="button" className={form.finalResult === value ? 'active' : ''} onClick={() => setForm(previous => previous.finalResult === value ? ({ ...previous, finalResult: '' }) : ({ ...previous, finalResult: value, followUpProgressStatus: 'COMPLETED', nextActionDate: '', createAction: false }))}>{label}</button>)}</fieldset>
                  <label className="recall-completion-note">완료 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="완료 처리 내용이나 확인 사항을 기록하세요" /></label>
                </div>
              )}

              {step === 2 && followUpEditing && !completionOnly && <div className="recall-form-grid">
                <label>후속 조치 유형<select value={form.followUpType ?? ''} onChange={event => setForm(previous => ({ ...previous, followUpType: event.target.value, guardianContactStatus: ['보호자 연락', '보호자 안내'].includes(event.target.value) ? previous.guardianContactStatus : 'UNKNOWN' }))}><option value="">선택</option>{['어르신 안내','보호자 안내','제조사 문의','사용 중단 재확인','제조사 문의·조치 안내','수리 또는 환불 확인','보호자 연락','방문 확인','기타'].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>다음 조치일<input type="date" value={form.nextActionDate ?? ''} disabled={Boolean(form.finalResult)} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label>
                {['보호자 연락', '보호자 안내'].includes(form.followUpType) && <label>보호자 연락 상태<select value={form.guardianContactStatus ?? 'UNKNOWN'} onChange={event => setForm(previous => ({ ...previous, guardianContactStatus: event.target.value }))}><option value="UNKNOWN">미확인</option><option value="SCHEDULED">연락 예정</option><option value="COMPLETED">연락 완료</option><option value="UNREACHABLE">연락 불가</option></select></label>}
                <label className="recall-note-field">담당자 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="확인 및 후속 조치 내용을 기록하세요" /></label>
                <fieldset className="recall-choice-group recall-completion-group"><legend>조치 완료 처리 <small>실제 조치가 끝났을 때 선택하세요.</small></legend>{FINAL_RESULT_OPTIONS.map(([value,label]) => <button key={value} type="button" className={form.finalResult === value ? 'active' : ''} onClick={() => setForm(previous => previous.finalResult === value ? ({ ...previous, finalResult: '' }) : ({ ...previous, finalResult: value, followUpProgressStatus: 'COMPLETED', nextActionDate: '', createAction: false }))}>{label}</button>)}</fieldset>
                <label className="recall-action-check"><input type="checkbox" checked={form.createAction} disabled={Boolean(form.finalResult)} onChange={event => setForm(previous => ({ ...previous, createAction: event.target.checked }))} />달력에 등록</label>
              </div>}
            </div>

            <div className="recall-modal-actions">
              {step > 1 && <button type="button" className="btn-outline" onClick={() => setStep(value => value - 1)}>이전</button>}
              {step < 2 && <button type="button" className="btn-primary" disabled={!form.contactMethod || !useStatusSelected || (form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted)} onClick={goNext}>다음 단계: 후속 조치</button>}
              {step === 2 && followUpEditing && <button type="submit" className="btn-primary" disabled={followUpSaveDisabled}>{followUpSaveLabel}</button>}
            </div>
          </form>
          {showStopGuidance && <div className="recall-guidance-overlay" role="dialog" aria-modal="true" aria-label="사용 중단 안내" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setShowStopGuidance(false) }}>
            <div className="recall-guidance-dialog" onClick={event => event.stopPropagation()}>
              <div className="recall-guidance-header"><div><h3>사용 중단 안내</h3><p>실제 안내 후 완료 처리해주세요.</p></div><button type="button" aria-label="닫기" onClick={() => setShowStopGuidance(false)}>×</button></div>
              <div className="recall-guidance-body">
                <ul className="recall-guidance-checklist"><li>즉시 전원을 끄도록 안내</li><li>플러그를 분리하도록 안내</li><li>제품을 다시 사용하지 않도록 안내</li><li>제조사 문의처와 조치 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul>
                <fieldset className="recall-choice-group"><legend>상담 대상</legend>{[['어르신 본인','어르신'],['보호자','보호자']].map(([value,label]) => <button key={value} type="button" className={guidanceForm.target === value ? 'active' : ''} onClick={() => setGuidanceForm(previous => ({ ...previous, target: value }))}>{label}</button>)}</fieldset>
                <fieldset className="recall-choice-group"><legend>안내 방법</legend>{['전화','방문','보호자 연락'].map(value => <button key={value} type="button" className={guidanceForm.method === value ? 'active' : ''} onClick={() => setGuidanceForm(previous => ({ ...previous, method: value }))}>{value}</button>)}</fieldset>
                <label className="recall-guidance-memo">메모<textarea value={guidanceForm.memo ?? ''} onChange={event => setGuidanceForm(previous => ({ ...previous, memo: event.target.value }))} placeholder="안내 내용이나 특이사항을 기록하세요" /></label>
              </div>
              <div className="recall-guidance-actions"><button type="button" className="btn-outline" onClick={() => setShowStopGuidance(false)}>취소</button><button type="button" className="btn-primary" onClick={completeStopGuidance}>안내 완료</button></div>
            </div>
          </div>}
        </div>
      )}
    </div>
  )
}
