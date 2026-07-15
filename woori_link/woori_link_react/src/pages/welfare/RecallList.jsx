import { useEffect, useState } from 'react'
import { getRecalledProducts, updateRecallWorkflow } from '../../api/recallApi'
import '../../css/welfare/RecallList.css'
import { getUser, getUserId } from '../../utils/auth'

const USE_STATUS_LABEL = {
  UNKNOWN: '미확인',
  IN_USE: '현재 사용 중',
  NOT_IN_USE: '보유 중이나 사용하지 않음',
  STOPPED: '사용 중단 완료',
  NOT_OWNED: '보유하지 않음',
  INVALID_REGISTRATION: '잘못 등록됨',
}

const ACTION_STATUS_LABEL = {
  CONFIRMATION_NEEDED: '확인 필요',
  CONTACT_SCHEDULED: '연락 예정',
  STOP_GUIDANCE_COMPLETED: '사용 중단 안내 완료',
  RECALL_GUIDANCE_COMPLETED: '회수·교환 안내 완료',
  RECALL_IN_PROGRESS: '회수·교환 진행 중',
  COMPLETED: '조치 완료',
  UNREACHABLE: '연락 불가',
  NOT_RECALLED: '리콜 대상 아님',
}

function valueOrFallback(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : value
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

function modelMatchLabel(product) {
  const value = product.modelMatchStatus ?? product.modelMatched ?? product.modelNumberMatched ?? product.modelMatch
  if (value === 'MATCHED') return '일치'
  if (value === 'NEEDS_REVIEW') return '부분 일치'
  if (value === 'NOT_MATCHED') return '불일치'
  if (value === 'PARTIAL' || value === 'PARTIAL_MATCH') return '부분 일치'
  if (value === true) return '일치'
  if (value === false) return '불일치'
  return '미확인'
}

function currentStage(product) {
  const match = modelMatchLabel(product)
  const useStatus = product.currentUseStatus || 'UNKNOWN'
  const actionStatus = product.actionStatus || 'CONFIRMATION_NEEDED'

  if (product.finalResult || actionStatus === 'COMPLETED') return product.finalResult === 'NOT_RECALLED' ? '리콜 대상 아님' : '조치 완료'
  if (actionStatus === 'NOT_RECALLED' || match === '불일치') return '리콜 대상 아님'
  if (['RECALL_GUIDANCE_COMPLETED', 'RECALL_IN_PROGRESS'].includes(actionStatus)) return '회수·교환 진행'
  if (product.followUpType && product.followUpProgressStatus !== 'COMPLETED') return '회수·교환 진행'
  if (useStatus === 'IN_USE' && product.stopGuidanceCompleted) return '사용 중단 확인 필요'
  if (useStatus === 'IN_USE' || actionStatus === 'STOP_GUIDANCE_COMPLETED') return '사용 중단 필요'
  if (match === '미확인') return '제품 대조 필요'
  if (useStatus === 'UNKNOWN') return '사용 여부 확인'
  return '회수·교환 진행'
}

function manageButtonLabel(stage) {
  if (stage === '제품 대조 필요') return '제품 대조'
  if (stage === '사용 여부 확인') return '사용 확인'
  if (stage === '사용 중단 필요') return '조치 시작'
  if (stage === '사용 중단 확인 필요') return '조치 계속'
  if (stage === '회수·교환 진행') return '조치 관리'
  return '결과 보기'
}

const SUMMARY_FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'CHECK', label: '확인 필요', stages: ['제품 대조 필요', '사용 여부 확인'] },
  { key: 'ACTION', label: '조치 진행', stages: ['사용 중단 필요', '사용 중단 확인 필요', '회수·교환 진행'] },
  { key: 'DONE', label: '완료', stages: ['조치 완료', '리콜 대상 아님'] },
]

const DETAIL_STAGES = ['제품 대조 필요', '사용 여부 확인', '사용 중단 필요', '사용 중단 확인 필요', '회수·교환 진행', '조치 완료', '리콜 대상 아님']

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
  const [guidanceForm, setGuidanceForm] = useState({ method: '', target: '', memo: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const response = await getRecalledProducts().catch(() => ({ data: [] }))
    setProducts(Array.isArray(response.data) ? response.data : [])
  }

  function openModal(product) {
    setSelected(product)
    setForm({
      modelMatchStatus: product.modelMatchStatus || 'UNKNOWN',
      currentUseStatus: product.currentUseStatus || 'UNKNOWN',
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
    setStep(product.modelMatchStatus === 'MATCHED' ? (product.currentUseStatus === 'UNKNOWN' ? 2 : 3) : 1)
    setShowOriginal(false)
    setUseStatusSelected(product.currentUseStatus && product.currentUseStatus !== 'UNKNOWN')
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
  }

  async function handleActionSave(event) {
    event.preventDefault()
    if (step === 1 && form.modelMatchStatus === 'UNKNOWN') return alert('리콜 일치 여부를 선택해주세요.')
    if (step === 1 && form.modelMatchStatus === 'NEEDS_REVIEW' && (!form.nextActionDate || !form.note.trim())) return alert('다음 확인일과 확인 메모를 입력해주세요.')
    if (step === 2 && !form.contactMethod) return alert('확인 방법을 먼저 선택해주세요.')
    if (step === 2 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 3 && !form.followUpType) return alert('후속 조치 유형을 선택해주세요.')
    if (step === 3 && !form.nextActionDate) return alert('다음 조치일을 입력해주세요.')
    await updateRecallWorkflow(selected.id, {
      ...form,
      followUpProgressStatus: form.followUpProgressStatus || 'PLANNED',
      nextActionDate: form.nextActionDate || null,
      finalResult: form.finalResult || null,
      welfareWorkerId: getUserId(),
    })
    await load()
    setSelected(null)
  }

  async function goNext() {
    if (step === 1) {
      if (form.modelMatchStatus === 'UNKNOWN') return alert('리콜 일치 여부를 선택해주세요.')
      if (form.modelMatchStatus === 'NOT_MATCHED') {
        setForm(previous => ({ ...previous, finalResult: 'NOT_RECALLED' }))
        return
      }
    }
    if (step === 2 && !form.contactMethod) return alert('확인 방법을 먼저 선택해주세요.')
    if (step === 2 && !useStatusSelected) return alert('제품 사용 상태를 선택해주세요.')
    if (step === 2 && form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted) return alert('사용 중단 안내를 먼저 완료해주세요.')
    if (step === 2) {
      await updateRecallWorkflow(selected.id, {
        ...form,
        nextActionDate: form.nextActionDate || null,
        finalResult: form.finalResult || null,
        welfareWorkerId: getUserId(),
      })
      setSelected(previous => ({ ...previous, ...form }))
      await load()
    }
    setStep(previous => Math.min(3, previous + 1))
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
  const followUpSaveDisabled = step === 3 && (
    !form.followUpType ||
    !form.nextActionDate
  )

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
            className={activeTab === tab.key ? 'active' : ''} onClick={() => { setActiveTab(tab.key); setDetailStage('ALL') }}>
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
                <th>어르신</th><th>등록 제품</th><th>리콜 일치 여부</th><th>현재 단계</th><th>다음 조치일</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const matchLabel = modelMatchLabel(product)
                const stage = currentStage(product)
                const hazard = product.hazardType ?? product.recallHazardType
                return (
                  <tr key={product.id}>
                    <td className="font-bold">{valueOrFallback(product.seniorName, '미확인')}</td>
                    <td>
                      <strong className="recall-product-name">{valueOrFallback(product.productName)}</strong>
                      <span className="recall-product-model">{valueOrFallback(product.modelNumber)} · {valueOrFallback(product.manufacturer)}</span>
                      {['일치', '부분 일치'].includes(matchLabel) && hazard && (
                        <small className="recall-hazard-warning">주의: {hazard}</small>
                      )}
                    </td>
                    <td><span className="recall-match-badge">{matchLabel}</span></td>
                    <td><span className="recall-state-badge">{stage}</span></td>
                    <td>{formatDate(product.nextActionDate)}</td>
                    <td>
                      <button className="btn-primary recall-manage-btn" onClick={() => openModal(product)}>
                        {manageButtonLabel(stage)}
                      </button>
                    </td>
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
              {[1, 2, 3].map(number => <div key={number} className={step === number ? 'active' : step > number ? 'done' : ''}><b>{step > number ? '✓' : number}</b><span>{['제품 대조', '사용 여부 확인', '후속 조치'][number - 1]}</span></div>)}
            </div>

            <div className="recall-modal-body">
              {step === 1 && <>
                <div className="recall-compare-grid">
                  <section><h3>등록 제품</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(selected.productName)}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.manufacturer)}</dd></div><div><dt>모델명</dt><dd>{valueOrFallback(selected.modelNumber)}</dd></div><div><dt>등록 방식</dt><dd>{valueOrFallback(selected.registrationSource ?? selected.ocrInfo ?? selected.ocrText)}</dd></div></dl></section>
                  <section><h3>리콜 대상 정보</h3><dl><div><dt>제품명</dt><dd>{valueOrFallback(selected.recallProductName ?? selected.productName)}</dd></div><div><dt>제조사</dt><dd>{valueOrFallback(selected.recallManufacturer ?? selected.manufacturer)}</dd></div><div><dt>대상 모델</dt><dd>{valueOrFallback(selected.recallModelNumber ?? selected.modelNumber)}</dd></div><div><dt>위해 유형</dt><dd>{valueOrFallback(selected.hazardType ?? selected.recallHazardType)}</dd></div></dl></section>
                </div>
                <div className="recall-key-guidance"><div><strong>즉시 조치</strong><p>{valueOrFallback(selected.immediateAction, '제품 사용을 중단하고 전원 플러그를 분리하도록 안내합니다.')}</p></div><div><strong>조치 방법</strong><p>{valueOrFallback(selected.remedy ?? selected.actionMethod, '제조사 고객센터를 통해 수리·교환·환불 여부를 확인합니다.')}</p></div><div><strong>문의처</strong><p>{valueOrFallback(selected.contactNumber)}</p></div><button type="button" onClick={() => setShowOriginal(value => !value)}>리콜 상세 원문 {showOriginal ? '닫기' : '보기'}</button>{showOriginal && <pre>{valueOrFallback(selected.recallReason)}</pre>}</div>
                <fieldset className="recall-choice-group"><legend>리콜 일치 여부</legend>{[['MATCHED','일치'],['NEEDS_REVIEW','추가 확인 필요'],['NOT_MATCHED','불일치']].map(([value,label]) => <button key={value} type="button" className={form.modelMatchStatus === value ? 'active' : ''} onClick={() => setForm(previous => ({ ...previous, modelMatchStatus: value, finalResult: value === 'NOT_MATCHED' ? 'NOT_RECALLED' : '' }))}>{label}</button>)}</fieldset>
                {form.modelMatchStatus === 'NEEDS_REVIEW' && <div className="recall-form-grid"><label>다음 확인일<input type="date" value={form.nextActionDate ?? ''} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label><label>확인 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} /></label></div>}
              </>}

              {step === 2 && <>
                <div className="recall-usage-layout">
                <fieldset className="recall-choice-group"><legend>확인 방법</legend>{['전화','보호자 연락','방문','기타'].map(value => <button key={value} type="button" className={form.contactMethod === value ? 'active' : ''} onClick={() => setForm(previous => ({ ...previous, contactMethod: value }))}>{value}</button>)}</fieldset>
                <fieldset className="recall-choice-group vertical" disabled={!form.contactMethod}><legend>제품 사용 상태 {!form.contactMethod && <small>확인 방법을 먼저 선택해주세요.</small>}</legend>{[['IN_USE','현재 사용 중'],['NOT_IN_USE','보유 중이나 사용하지 않음'],['STOPPED','사용 중단 완료'],['NOT_OWNED','보유하지 않음'],['UNKNOWN','확인하지 못함']].map(([value,label]) => <button key={value} type="button" disabled={!form.contactMethod} className={useStatusSelected && form.currentUseStatus === value ? 'active' : ''} onClick={() => { setUseStatusSelected(true); setForm(previous => ({ ...previous, currentUseStatus: value, finalResult: value === 'NOT_OWNED' ? 'NOT_OWNED' : '' })) }}>{label}</button>)}</fieldset>
                </div>
                {form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted && <aside className="recall-stop-warning"><strong>사용 중단 안내가 필요합니다.</strong><ul><li>즉시 전원을 끄고 플러그를 분리하도록 안내</li><li>제조사 회수·교환 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul><button type="button" className="recall-stop-guidance-btn" onClick={() => setShowStopGuidance(true)}>사용 중단 안내하기</button></aside>}
                {form.currentUseStatus === 'IN_USE' && form.stopGuidanceCompleted && <aside className="recall-guidance-complete"><strong>사용 중단 안내 완료</strong><p>{formatGuidanceDate(form.stopGuidanceCompletedAt)} · {valueOrFallback(form.stopGuidanceMethod)} · {valueOrFallback(form.stopGuidanceTarget)}</p><p>담당자: {valueOrFallback(form.stopGuidanceWorkerName)}</p><button type="button" onClick={() => setShowStopGuidance(true)}>안내 내용 보기</button></aside>}
                {form.currentUseStatus === 'UNKNOWN' && <div className="recall-form-grid"><label>다음 연락일<input type="date" value={form.nextActionDate ?? ''} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label></div>}
              </>}

              {step === 3 && <div className="recall-form-grid">
                <label>후속 조치 유형<select value={form.followUpType ?? ''} onChange={event => setForm(previous => ({ ...previous, followUpType: event.target.value, guardianContactStatus: event.target.value === '보호자 연락' ? previous.guardianContactStatus : 'UNKNOWN' }))}><option value="">선택</option>{['사용 중단 재확인','제조사 회수·교환 안내','수리 또는 환불 확인','보호자 연락','방문 확인','기타'].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>다음 조치일<input type="date" value={form.nextActionDate ?? ''} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} /></label>
                {form.followUpType === '보호자 연락' && <label>보호자 연락 상태<select value={form.guardianContactStatus ?? 'UNKNOWN'} onChange={event => setForm(previous => ({ ...previous, guardianContactStatus: event.target.value }))}><option value="UNKNOWN">미확인</option><option value="SCHEDULED">연락 예정</option><option value="COMPLETED">연락 완료</option><option value="UNREACHABLE">연락 불가</option></select></label>}
                <label className="recall-note-field">담당자 메모<textarea value={form.note ?? ''} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="확인 및 후속 조치 내용을 기록하세요" /></label>
                <label className="recall-action-check"><input type="checkbox" checked={form.createAction} onChange={event => setForm(previous => ({ ...previous, createAction: event.target.checked }))} />조치 관리에 후속 업무 등록</label>
              </div>}
            </div>

            <div className="recall-modal-actions">
              {step > 1 && <button type="button" className="btn-outline" onClick={() => setStep(value => value - 1)}>이전</button>}
              {step < 3 && form.modelMatchStatus !== 'NOT_MATCHED' && <button type="button" className="btn-primary" disabled={step === 2 && (!form.contactMethod || !useStatusSelected || (form.currentUseStatus === 'IN_USE' && !form.stopGuidanceCompleted))} onClick={goNext}>{step === 2 && form.stopGuidanceCompleted ? '다음 단계: 후속 조치' : '다음 단계'}</button>}
              {(step === 3 || form.modelMatchStatus === 'NOT_MATCHED' || form.modelMatchStatus === 'NEEDS_REVIEW') && <button type="submit" className="btn-primary" disabled={followUpSaveDisabled}>{step === 3 ? (form.createAction ? '조치 등록 및 저장' : '후속 조치 저장') : form.finalResult ? '조치 완료 처리' : '저장'}</button>}
            </div>
          </form>
          {showStopGuidance && <div className="recall-guidance-overlay" role="dialog" aria-modal="true" aria-label="사용 중단 안내" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setShowStopGuidance(false) }}>
            <div className="recall-guidance-dialog" onClick={event => event.stopPropagation()}>
              <div className="recall-guidance-header"><div><h3>사용 중단 안내</h3><p>실제 안내 후 완료 처리해주세요.</p></div><button type="button" aria-label="닫기" onClick={() => setShowStopGuidance(false)}>×</button></div>
              <div className="recall-guidance-body">
                <ul className="recall-guidance-checklist"><li>즉시 전원을 끄도록 안내</li><li>플러그를 분리하도록 안내</li><li>제품을 다시 사용하지 않도록 안내</li><li>제조사 회수·교환 방법 안내</li><li>필요하면 보호자에게 위험 사실 전달</li></ul>
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
