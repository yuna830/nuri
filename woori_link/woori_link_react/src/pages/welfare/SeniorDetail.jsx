import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorDetail.css'
import { getSeniorById, updateSenior } from '../../api/seniorApi'
import { getLatestRisk, assessRisk } from '../../api/riskApi'
import { getActionsBySenior, createAction } from '../../api/actionApi'
import { getProductsBySenior } from '../../api/recallApi'

const INCOME_LABEL = { BASIC_LIVELIHOOD: '기초생활', NEAR_POVERTY: '차상위', LOWER_MIDDLE: '하위중간', MIDDLE: '중간', UPPER: '상위' }
const LEVEL_MAP = { HIGH: { label: '우선 확인 후보', cls: 'high' }, MEDIUM: { label: '관심 필요', cls: 'medium' }, LOW: { label: '일반', cls: 'low' } }
const RISK_CRITERIA = [
  { group: 'A', label: '심각한 지역 기상위험', value: 'weatherRisk', score: 20 },
  { group: 'A', label: '사용 중인 미조치 리콜 제품', value: 'recallRisk', score: 30 },
  { group: 'A', label: '리콜 제품 사용 여부 미확인', value: 'recallUsageUnknown', score: 20 },
  { group: 'A', label: '전기·가스 즉시 개선 항목', value: 'safetyRisk', score: 25 },
  { group: 'A', label: '전기·가스 점검 미완료', value: 'safetyInspectionOverdue', score: 10 },
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
    const applied = RISK_CRITERIA.filter(criteria => criteria.group === group && risk[criteria.value] === true)
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
  const [showRiskDetails, setShowRiskDetails] = useState(false)
  const [managementTab, setManagementTab] = useState('products')
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    getSeniorById(id).then(r => setSenior(r.data)).catch(() => {})
    getLatestRisk(id).then(r => setRisk(r.data)).catch(() => {})
    getActionsBySenior(id).then(r => setActions(r.data)).catch(() => {})
    getProductsBySenior(id).then(r => setProducts(r.data)).catch(() => {})
  }, [id])

  async function handleAssess() {
    setAssessing(true)
    try { const r = await assessRisk(id); setRisk(r.data) }
    finally { setAssessing(false) }
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
  const appliedCriteria = scoredCriteria.filter(criteria => criteria.appliedScore > 0)

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
          <div className="card-title">기본 정보</div>
          <div className="detail-info-grid">
            <div className="info-row"><span className="info-label">나이</span><span className="info-value">{senior.age !== null && senior.age !== undefined ? `${senior.age}세` : '-'}</span></div>
            <div className="info-row"><span className="info-label">연락처</span><span className="info-value">{valueOrDash(senior.phone)}</span></div>
            <div className="info-row info-row-wide"><span className="info-label">주소</span><span className="info-value">{valueOrDash(senior.address)}</span></div>
            <div className="info-row"><span className="info-label">소득구분</span><span className="info-value">{valueOrDash(INCOME_LABEL[senior.incomeLevel])}</span></div>
            <div className="info-row"><span className="info-label">장애등급</span><span className="info-value">{valueOrDash(senior.disabilityGrade)}</span></div>
            <div className="info-row"><span className="info-label">독거여부</span><span className="info-value">{senior.livingAlone === true ? '독거' : senior.livingAlone === false ? '비독거' : '-'}</span></div>
            <div className="info-row"><span className="info-label">보호자 등록 여부</span><span className="info-value">{senior.guardianId ? '등록' : '미등록'}</span></div>
          </div>
        </div>

        <div className="card detail-risk-card">
          <div className="section-header">
            <span className="card-title" style={{ margin: 0 }}>복지사 확인 우선도</span>
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={handleAssess} disabled={assessing}>
              {assessing ? '산정 중...' : '재산정'}
            </button>
          </div>
          {risk ? (
            <>
              <div className="risk-header">
                <span className={`risk-score ${levelInfo?.cls}`}>{risk.totalScore}점</span>
                <span className={`badge badge-${levelInfo?.cls}`}>{levelInfo?.label}</span>
              </div>
              <div className="risk-applied-section">
                <h3>점수 반영 항목</h3>
                {appliedCriteria.length === 0 ? <div className="risk-no-items">반영된 항목이 없습니다.</div> : appliedCriteria.map(criteria => (
                  <div className="risk-row" key={criteria.label}><span>{criteria.label}</span><strong>+{criteria.appliedScore}점</strong></div>
                ))}
              </div>
              <div className="risk-area-scores">
                <h3>영역별 점수</h3>
                <div><span>실제 위험 <strong>{areaScore(risk, 'actualRiskScore', 'riskScore')}</strong></span><span>조치 지연 <strong>{areaScore(risk, 'delayScore')}</strong></span><span>기본 취약성 <strong>{areaScore(risk, 'vulnerabilityScore')}</strong></span></div>
              </div>
              <button type="button" className="risk-toggle-button" onClick={() => setShowRiskDetails(true)}>상세 보기</button>
            </>
          ) : <div className="empty-state detail-compact-empty">평가 이력 없음</div>}
        </div>
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

      {showRiskDetails && risk && (
        <div className="detail-modal-overlay" onClick={() => setShowRiskDetails(false)}>
          <div className="detail-modal risk-detail-modal" onClick={event => event.stopPropagation()}>
            <div className="detail-modal-header"><div><h2>전체 산정 기준</h2><p>{risk.totalScore}점 · {levelInfo?.label}</p></div><button onClick={() => setShowRiskDetails(false)}>×</button></div>
            <div className="risk-detail-groups">{[['A', 'A 실제 위험'], ['B', 'B 조치 지연'], ['C', 'C 기본 취약성']].map(([group, title]) => (
              <section key={group}><h3>{title}</h3>{RISK_CRITERIA.filter(criteria => criteria.group === group).map(criteria => {
                const scored = scoredCriteria.find(item => item.value === criteria.value)
                return (
                  <div className="risk-row" key={criteria.label}><span>{criteria.label}</span><span className={scored?.appliedScore > 0 ? 'risk-flag-on' : 'risk-flag-off'}>{scored?.appliedScore > 0 ? `해당 · +${scored.appliedScore}점` : '해당없음 · 0점'}</span></div>
                )
              })}</section>
            ))}</div>
            <div className="detail-modal-actions"><button className="btn-outline" onClick={() => setShowRiskDetails(false)}>닫기</button></div>
          </div>
        </div>
      )}

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
