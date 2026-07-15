import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/Dashboard.css'

const summarizeMemo = (memo) => {
  if (!memo) return '-'
  const text = memo.trim()
  const sentenceEnd = text.search(/[.!?](?:\s|$)/)
  if (sentenceEnd >= 0) {
    const firstSentence = text.slice(0, sentenceEnd + 1)
    return firstSentence.length < text.length ? `${firstSentence}…` : firstSentence
  }
  return text.length > 50 ? `${text.slice(0, 50)}…` : text
}
import { getSeniorsByWelfareWorker } from '../../api/seniorApi'
import { getHighRisk, assessAll } from '../../api/riskApi'
import { getActionsByWelfareWorker } from '../../api/actionApi'
import { getRecalledProducts } from '../../api/recallApi'
import { getUserId } from '../../utils/auth'

const ACTION_STATUS_LABEL = {
  RECALL: '리콜 조치 예정',
  VOUCHER: '신청 지원 예정',
  GAS_CHECK: '가스점검 예정',
  ELECTRIC_CHECK: '전기점검 예정',
  VISIT: '방문 예정',
  SOS: '긴급 확인 필요',
  OTHER: '확인 진행 중',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [seniors, setSeniors] = useState([])
  const [highRisk, setHighRisk] = useState([])
  const [pending, setPending] = useState([])
  const [recalled, setRecalled] = useState([])
  const [assessing, setAssessing] = useState(false)

  useEffect(() => {
    const welfareWorkerId = getUserId()
    if (welfareWorkerId) {
      getSeniorsByWelfareWorker(welfareWorkerId).then(r => setSeniors(r.data)).catch(err => {
        console.error(err.response?.status, err.response?.data)
      })
      getActionsByWelfareWorker(welfareWorkerId)
        .then(r => setPending(r.data.filter(action => action.status === 'PENDING')))
        .catch(() => {})
    }
    getHighRisk().then(r => setHighRisk(r.data)).catch(() => {})
    getRecalledProducts().then(r => setRecalled(r.data)).catch(() => {})
  }, [])

  const energySupportCandidates = seniors.filter(s => {
    const voucherCandidate = s.energyVoucherEligible && !s.energyVoucherApplied
    const electricCandidate = !s.electricityDiscountApplied && (
      s.electricityDiscountEligible || s.livelihoodBenefit || s.medicalBenefit ||
      s.housingBenefit || s.educationBenefit || s.disabilityGrade
    )
    return voucherCandidate || electricCandidate
  })

  async function handleAssessAll() {
    setAssessing(true)
    try {
      await assessAll()
      const r = await getHighRisk()
      setHighRisk(r.data)
    } finally {
      setAssessing(false)
    }
  }

  function getPrimaryReason(reason) {
    if (!reason) return '-'
    return reason.split(' + ').slice(0, 2).join(' · ')
  }

  function getCurrentStatus(seniorId) {
    const action = pending.find(item => item.seniorId === seniorId)
    return action ? (ACTION_STATUS_LABEL[action.actionType] || '조치 예정') : '확인 필요'
  }

  function getSeniorName(seniorId) {
    return seniors.find(senior => senior.id === seniorId)?.name || '미확인'
  }

  return (
    <div>
      <h1 className="page-title">대시보드</h1>

      <div className="dashboard-stats">
        <div className="stat-card" onClick={() => navigate('/welfare/seniors')}>
          <div className="label">전체 대상자</div>
          <div className="value">{seniors.length}</div>
        </div>
        <div className="stat-card danger" onClick={() => navigate('/welfare/seniors')}>
          <div className="label">우선 확인 후보</div>
          <div className="value">{highRisk.length}</div>
        </div>
        <div className="stat-card warning" onClick={() => navigate('/welfare/energy-voucher')}>
          <div className="label">에너지복지 확인 필요</div>
          <div className="value">{energySupportCandidates.length}</div>
        </div>
        <div className="stat-card danger" onClick={() => navigate('/welfare/recalled')}>
          <div className="label">리콜 제품 보유</div>
          <div className="value">{recalled.length}</div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="card-title" style={{ margin: 0 }}>우선 확인 대상자</span>
            <button
              type="button"
              className={`risk-refresh-btn ${assessing ? 'loading' : ''}`}
              onClick={handleAssessAll}
              disabled={assessing}
              aria-label="확인 우선도 다시 산정"
              title="확인 우선도 다시 산정"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
              </svg>
            </button>
          </div>
          {highRisk.length === 0 ? (
            <div className="empty-state">우선 확인 대상자가 없습니다</div>
          ) : (
            <div className="dashboard-scroll-area">
              <table className="data-table">
                <thead>
                  <tr><th>이름</th><th>나이</th><th>점수</th><th>주요 사유</th><th>현재 상태</th></tr>
                </thead>
                <tbody>
                  {highRisk.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/welfare/seniors/${r.seniorId}`)}>
                      <td className="font-bold">{r.seniorName}</td>
                      <td>{r.seniorAge}세</td>
                      <td><span className="risk-score-cell high">{r.totalScore}점</span></td>
                      <td className="priority-reason">{getPrimaryReason(r.riskReason)}</td>
                      <td><span className="priority-status">{getCurrentStatus(r.seniorId)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="card-title" style={{ margin: 0 }}>미처리 조치</span>
            <button className="btn-text" onClick={() => navigate('/welfare/actions')}>전체 보기</button>
          </div>
          {pending.length === 0 ? (
            <div className="empty-state">미처리 조치가 없습니다</div>
          ) : (
            <div className="dashboard-scroll-area">
              <table className="data-table pending-actions-table">
                <thead>
                  <tr><th>유형</th><th>어르신</th><th>메모</th></tr>
                </thead>
                <tbody>
                  {pending.map(a => (
                    <tr key={a.id}>
                      <td><span className="badge badge-pending">{a.actionType}</span></td>
                      <td className="font-bold">{getSeniorName(a.seniorId)}</td>
                      <td className="muted-text memo-summary" title={a.note || ''}>{summarizeMemo(a.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
