import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorDetail.css'
import { getSeniorById, updateSeniorProfile } from '../../api/seniorApi'
import { getLatestRisk, assessRisk } from '../../api/riskApi'
import { getActionsBySenior, createAction } from '../../api/actionApi'
import { getProductsBySenior } from '../../api/recallApi'
import { getGuardians } from '../../api/guardianApi'
import { getUser } from '../../utils/auth'
import SeniorEditModal from './SeniorEditModal'

const HOUSEHOLD_LABEL = { SINGLE: '1인 가구', FAMILY: '가족 가구', COUPLE: '부부 가구', OTHER: '기타 가구' }
const LEVEL_MAP = { HIGH: { label: '우선 확인 후보', cls: 'high' }, MEDIUM: { label: '관심 필요', cls: 'medium' }, LOW: { label: '일반', cls: 'low' } }
const RISK_CRITERIA = [
  { group: 'A', label: '심각한 지역 기상위험', value: 'weatherRisk', score: 20 },
  { group: 'A', label: '사용 중인 미조치 리콜 제품', value: 'recallRisk', score: 30 },
  { group: 'A', label: '리콜 제품 사용 여부 미확인', value: 'recallUsageUnknown', score: 20 },
  { group: 'A', label: '전기·가스 점검 미완료', value: 'safetyInspectionNeeded', values: ['safetyRisk', 'safetyInspectionOverdue'], score: 25 },
  { group: 'B', label: '조치 요청 7일 이상 지연', value: 'overdueAction', score: 10 },
  { group: 'B', label: '예정 방문 지연', value: 'delayedVisit', score: 15 },
  { group: 'B', label: '동일 문제 반복', value: 'repeatedIssue', score: 10 },
  { group: 'A', label: 'AI 안부 연속 미응답', value: 'aiNoResponse', score: 30 },
  { group: 'A', label: '안전반경 이탈 미확인', value: 'locationAnomaly', score: 20 },
  { group: 'C', label: '독거 가구', value: 'livingAlone', score: 10 },
  { group: 'C', label: '보호자 미등록', value: 'guardianMissing', score: 10 },
  { group: 'C', label: '장기요양 대상', value: 'longTermCare', score: 10 },
  { group: 'C', label: '중증 장애', value: 'severeDisability', score: 10 },
  { group: 'C', label: '에너지바우처 대상 미신청', value: 'voucherUnapplied', score: 5 },
  { group: 'C', label: '전기·가스 할인 미신청', value: 'discountUnapplied', score: 5 },
]

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}

function formatPhone(value) {
  const digits = value?.replace(/\D/g, '')
  if (!digits) return '-'
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return value
}

function booleanLabel(value, trueLabel = '예', falseLabel = '아니오') {
  return value === true ? trueLabel : value === false ? falseLabel : '미확인'
}

function applicationLabel(value) {
  return value === true ? '신청 완료' : value === false ? '미신청' : '미확인'
}

function areaScore(risk, ...keys) {
  const key = keys.find(candidate => risk[candidate] !== null && risk[candidate] !== undefined)
  return key ? `${risk[key]}점` : '-'
}

function getScoredCriteria(risk) {
  if (!risk) return []

  const groupScores = {
    A: Number(risk.actualRiskScore ?? risk.riskScore ?? 0),
    B: Math.min(Number(risk.delayScore ?? 0), 40),
    C: Math.min(Number(risk.vulnerabilityScore ?? 0), 25),
  }

  return ['A', 'B', 'C'].flatMap(group => {
    const applied = RISK_CRITERIA.filter(criteria =>
      criteria.group === group &&
      (criteria.values ?? [criteria.value]).some(value => risk[value] === true)
    )
    let remaining = groupScores[group]

    return applied.map((criteria, index) => {
      const score = index === applied.length - 1
        ? remaining
        : Math.min(criteria.score, remaining)
      remaining = Math.max(0, remaining - score)
      return { ...criteria, appliedScore: score }
    })
  })
}

export default function SeniorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [senior, setSenior] = useState(null)
  const [risk, setRisk] = useState(null)
  const [actions, setActions] = useState([])
  const [products, setProducts] = useState([])
  const [note, setNote] = useState('')
  const [actionType, setActionType] = useState('OTHER')
  const [dueDate, setDueDate] = useState('')
  const [immediateRisk, setImmediateRisk] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [managementTab, setManagementTab] = useState('products')
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [toast, setToast] = useState('')
  const [guardians, setGuardians] = useState([])

  useEffect(() => {
    getSeniorById(id).then(r => setSenior(r.data)).catch(() => {})
    getLatestRisk(id).then(r => setRisk(r.data)).catch(() => {})
    getActionsBySenior(id).then(r => setActions(r.data)).catch(() => {})
    getProductsBySenior(id).then(r => setProducts(r.data)).catch(() => {})
    getGuardians().then(r => setGuardians(r.data)).catch(() => setGuardians([]))
  }, [id])

  async function handleAssess() {
    setAssessing(true)
    try { const r = await assessRisk(id); setRisk(r.data) }
    finally { setAssessing(false) }
  }

  async function handleProfileSave(data) {
    const updated = await updateSeniorProfile(id, data)
    setSenior(updated.data)
    setShowEditModal(false)
    try {
      const recalculated = await assessRisk(id)
      setRisk(recalculated.data)
      setToast('대상자 정보가 수정되었으며 확인 우선도가 재산정되었습니다.')
    } catch {
      setToast('대상자 정보는 저장되었지만 확인 우선도 재산정에 실패했습니다.')
    }
    window.setTimeout(() => setToast(''), 3500)
  }

  async function handleAction() {
    if (!note.trim()) return
    await createAction({ seniorId: Number(id), welfareWorkerId: 1, actionType, actionSubject: 'WELFARE_WORKER', note, dueDate: dueDate || null, immediateRisk })
    const r = await getActionsBySenior(id)
    setActions(r.data)
    setNote('')
    setDueDate('')
    setImmediateRisk(false)
    setShowActionModal(false)
  }

  if (!senior) return <div className="empty-state">불러오는 중...</div>

  const levelInfo = risk ? LEVEL_MAP[risk.level] : null
  const scoredCriteria = getScoredCriteria(risk)
  const guardianName = guardians.find(guardian => guardian.id === senior.guardianId)?.name

  return (
    <div>
      <div className="detail-title-row">
        <button
          type="button"
          className="detail-title-back"
          onClick={() => navigate('/welfare/seniors')}
          aria-label="대상자 목록으로 이동"
        >
          &lt;
        </button>
        <h1 className="page-title">{senior.name}</h1>
      </div>

      <div className="detail-grid">
        <div className="card detail-info-card">
          <div className="section-header"><span className="card-title" style={{ margin: 0 }}>기본 정보</span><button className="btn-outline detail-small-button" onClick={() => setShowEditModal(true)}>정보 수정</button></div>
          <div className="detail-info-grid">
            <div className="info-row"><span className="info-label">나이</span><span className="info-value">{senior.age !== null && senior.age !== undefined ? `${senior.age}세` : '-'}</span></div>
            <div className="info-row"><span className="info-label">연락처</span><span className="info-value">{formatPhone(senior.phone)}</span></div>
            <div className="info-row info-row-wide"><span className="info-label">주소</span><span className="info-value">{valueOrDash(senior.address)}</span></div>
            <div className="info-row"><span className="info-label">장애등급</span><span className="info-value">{valueOrDash(senior.disabilityGrade)}</span></div>
            <div className="info-row"><span className="info-label">독거여부</span><span className="info-value">{senior.livingAlone === true ? '독거' : senior.livingAlone === false ? '비독거' : '-'}</span></div>
            <div className="info-row"><span className="info-label">보호자 등록 여부</span><span className="info-value">{senior.guardianId ? '등록' : '미등록'}</span></div>
          </div>
          <div className="detail-last-updated">마지막 수정: {senior.updatedAt ? new Date(senior.updatedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '') : '-'} · {getUser()?.name || '-'} 복지사</div>
          <div className="detail-all-info">
            <section>
              <h3>인적 정보</h3>
              <div className="detail-info-grid">
                <div className="info-row"><span className="info-label">이름</span><span className="info-value">{valueOrDash(senior.name)}{senior.gender === 'MALE' ? ' (남성)' : senior.gender === 'FEMALE' ? ' (여성)' : ''}</span></div>
                <div className="info-row"><span className="info-label">생년월일</span><span className="info-value">{senior.birthDate?.replaceAll('-', '.') || '-'}</span></div>
                <div className="info-row"><span className="info-label">연락처</span><span className="info-value">{formatPhone(senior.phone)}</span></div>
                <div className="info-row"><span className="info-label">장애등급</span><span className="info-value">{valueOrDash(senior.disabilityGrade)}</span></div>
              </div>
            </section>
            <section>
              <h3>생활·돌봄 정보</h3>
              <div className="detail-info-grid">
                <div className="info-row"><span className="info-label">가구 형태</span><span className="info-value">{senior.householdType ? `${HOUSEHOLD_LABEL[senior.householdType] || senior.householdType}${senior.livingAlone != null ? ` (${senior.livingAlone ? '독거' : '비독거'})` : ''}` : senior.livingAlone != null ? booleanLabel(senior.livingAlone, '독거', '비독거') : '-'}</span></div>
                <div className="info-row"><span className="info-label">주거 형태</span><span className="info-value">{valueOrDash(senior.housingType)}</span></div>
                <div className="info-row"><span className="info-label">장기요양</span><span className="info-value">{booleanLabel(senior.longTermCare, '대상', '대상 아님')}</span></div>
                <div className="info-row"><span className="info-label">보호자</span><span className="info-value">{senior.guardianId ? (guardianName || '등록') : '미등록'}</span></div>
                <div className="info-row info-row-wide"><span className="info-label">주소</span><span className="info-value">{senior.address ? `${senior.address}${senior.detailAddress ? ` (${senior.detailAddress})` : ''}` : '-'}</span></div>
              </div>
            </section>
          </div>
        </div>

        <div className="card detail-welfare-card">
          <div className="card-title">복지 정보</div>
          <div className="detail-info-grid">
            <div className="info-row"><span className="info-label">생계급여</span><span className="info-value">{booleanLabel(senior.livelihoodBenefit)}</span></div>
            <div className="info-row"><span className="info-label">의료급여</span><span className="info-value">{booleanLabel(senior.medicalBenefit)}</span></div>
            <div className="info-row"><span className="info-label">주거급여</span><span className="info-value">{booleanLabel(senior.housingBenefit)}</span></div>
            <div className="info-row"><span className="info-label">교육급여</span><span className="info-value">{booleanLabel(senior.educationBenefit)}</span></div>
          </div>
          <div className="support-status-table">
            <div className="support-status-head"><span>지원 항목</span><span>자격</span><span>신청 상태</span></div>
            <div><strong>에너지바우처</strong><span>{booleanLabel(senior.energyVoucherEligible, '대상', '대상 아님')}</span><span>{applicationLabel(senior.energyVoucherApplied)}</span></div>
            <div><strong>전기요금 할인</strong><span>{booleanLabel(senior.electricityDiscountEligible, '대상', '대상 아님')}</span><span>{applicationLabel(senior.electricityDiscountApplied)}</span></div>
            <div><strong>가스요금 할인</strong><span>{booleanLabel(senior.gasDiscountEligible, '대상', '대상 아님')}</span><span>{applicationLabel(senior.gasDiscountApplied)}</span></div>
          </div>
        </div>
      </div>

      <div className="card detail-risk-card detail-risk-card-wide">
        <div className="section-header">
          <div className="risk-title-summary">
            <span className="card-title" style={{ margin: 0 }}>복지사 확인 우선도</span>
            {risk && <div className="risk-header"><span className={`risk-score ${levelInfo?.cls}`}>{risk.totalScore}점</span><span className={`badge badge-${levelInfo?.cls}`}>{levelInfo?.label}</span></div>}
          </div>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={handleAssess} disabled={assessing}>{assessing ? '산정 중...' : '재산정'}</button>
        </div>
        {risk ? <>
          <div className="risk-wide-content">
            <div className="risk-all-groups">
              {[
                ['A', '실제 위험', areaScore(risk, 'actualRiskScore', 'riskScore')],
                ['B', '조치 지연', areaScore(risk, 'delayScore')],
                ['C', '기본 취약성', areaScore(risk, 'vulnerabilityScore')],
              ].map(([group, label, score]) => (
                <section className={`risk-group risk-group-${group.toLowerCase()}`} key={group}>
                  <div className="risk-group-heading"><span><b>{group}</b>{label}</span><strong>{score}</strong></div>
                  <div className="risk-group-criteria">
                    {RISK_CRITERIA.filter(criteria => criteria.group === group).map(criteria => {
                      const scored = scoredCriteria.find(item => item.value === criteria.value)
                      const applied = scored?.appliedScore > 0
                      return <div className={`risk-criteria-item ${applied ? 'applied' : ''}`} key={criteria.label}><span>{criteria.label}</span><strong>{applied ? `+${scored.appliedScore}점` : '0점'}</strong></div>
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </> : <div className="empty-state detail-compact-empty">평가 이력 없음</div>}
      </div>

      <div className="card detail-management-card">
        <div className="detail-management-tabs">
          <button className={managementTab === 'products' ? 'active' : ''} onClick={() => setManagementTab('products')}>등록 제품 ({products.length})</button>
          <button className={managementTab === 'actions' ? 'active' : ''} onClick={() => setManagementTab('actions')}>조치 기록 ({actions.length})</button>
        </div>

        {managementTab === 'products' && (
          products.length === 0 ? (
            <div className="detail-tab-empty"><strong>등록된 제품이 없습니다.</strong><p>어르신 앱에서 등록한 제품이 이곳에 표시됩니다.</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>제품명</th><th>제조사·모델명</th><th>등록일</th><th>리콜 상태</th><th>관리</th></tr></thead>
              <tbody>{products.map(product => (
                <tr key={product.id}>
                  <td className="font-bold">{product.productName || '-'}</td>
                  <td>{[product.manufacturer, product.modelNumber].filter(Boolean).join(' · ') || '-'}</td>
                  <td>{(product.registeredAt || product.createdAt)?.slice(0, 10) || '-'}</td>
                  <td><span className={`badge badge-${product.recallStatus === 'RECALLED' ? 'recalled' : 'safe'}`}>{product.recallStatus === 'RECALLED' ? '리콜대상' : product.recallStatus || '-'}</span></td>
                  <td><button className="btn-primary detail-small-button" onClick={() => setSelectedProduct(product)}>상세 보기</button></td>
                </tr>
              ))}</tbody>
            </table>
          )
        )}

        {managementTab === 'actions' && (
          <>
            <div className="detail-action-toolbar"><h2>조치 기록</h2><button className="btn-primary detail-small-button" onClick={() => setShowActionModal(true)}>새 기록 추가</button></div>
            {actions.length === 0 ? (
              <div className="detail-tab-empty"><strong>아직 등록된 조치 기록이 없습니다.</strong><p>연락, 상담, 방문 및 지원 내용을 기록할 수 있습니다.</p></div>
            ) : (
              <div className="detail-action-list">{[...actions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(action => (
                <div key={action.id}><span className="detail-action-date">{action.createdAt?.slice(0, 10) || '-'}</span><div><strong>{action.actionType || '-'}</strong><p>{action.note || '-'}</p></div><span className={`badge badge-${action.status === 'COMPLETED' ? 'completed' : 'pending'}`}>{action.status || '-'}</span></div>
              ))}</div>
            )}
          </>
        )}
      </div>

      {showEditModal && <SeniorEditModal senior={senior} onClose={() => setShowEditModal(false)} onSave={handleProfileSave} />}
      {toast && <div className="detail-toast">{toast}</div>}

      {showActionModal && (
        <div className="detail-modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="detail-modal" onClick={event => event.stopPropagation()}>
            <div className="detail-modal-header"><div><h2>새 조치 기록</h2><p>{senior.name}</p></div><button onClick={() => setShowActionModal(false)}>×</button></div>
            <div className="detail-modal-form">
              <label>조치 유형<select value={actionType} onChange={event => setActionType(event.target.value)}><option value="OTHER">기타</option><option value="RECALL">리콜</option><option value="VOUCHER">복지 신청</option><option value="GAS_CHECK">가스점검</option><option value="ELECTRIC_CHECK">전기점검</option><option value="VISIT">방문</option></select></label>
              <label>조치일<input type="text" value="저장 시 자동 기록" disabled /></label>
              <label className="detail-modal-wide">조치 내용<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="조치 내용을 입력하세요" /></label>
              <label>다음 조치일<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
              <label>진행 상태<input type="text" value="확인 필요" disabled /></label>
              {(actionType === 'GAS_CHECK' || actionType === 'ELECTRIC_CHECK') && <label className="detail-check-field"><input type="checkbox" checked={immediateRisk} onChange={event => setImmediateRisk(event.target.checked)} /> 즉시 개선 필요</label>}
            </div>
            <div className="detail-modal-actions"><button className="btn-outline" onClick={() => setShowActionModal(false)}>취소</button><button className="btn-primary" onClick={handleAction} disabled={!note.trim()}>기록 저장</button></div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="detail-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="detail-modal product-detail-modal" onClick={event => event.stopPropagation()}>
            <div className="detail-modal-header"><div><h2>{selectedProduct.productName || '제품 정보'}</h2><p>등록 제품 상세</p></div><button onClick={() => setSelectedProduct(null)}>×</button></div>
            <dl><div><dt>제조사</dt><dd>{selectedProduct.manufacturer || '-'}</dd></div><div><dt>모델명</dt><dd>{selectedProduct.modelNumber || '-'}</dd></div><div><dt>등록일</dt><dd>{(selectedProduct.registeredAt || selectedProduct.createdAt)?.slice(0, 10) || '-'}</dd></div><div><dt>리콜 상태</dt><dd>{selectedProduct.recallStatus || '-'}</dd></div></dl>
            <div className="detail-modal-actions"><button className="btn-outline" onClick={() => setSelectedProduct(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
