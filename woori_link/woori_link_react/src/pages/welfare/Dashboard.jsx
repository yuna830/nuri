import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/Dashboard.css'
import { getSeniors } from '../../api/seniorApi'
import { getHighRisk, assessAll } from '../../api/riskApi'
import { getPendingActions } from '../../api/actionApi'
import { getRecalledProducts } from '../../api/recallApi'

const WELFARE_WORKER_ID = 1

export default function Dashboard() {
  const navigate = useNavigate()
  const [seniors, setSeniors] = useState([])
  const [highRisk, setHighRisk] = useState([])
  const [pending, setPending] = useState([])
  const [recalled, setRecalled] = useState([])
  const [assessing, setAssessing] = useState(false)

  useEffect(() => {
    getSeniors().then(r => setSeniors(r.data)).catch(() => {})
    getHighRisk().then(r => setHighRisk(r.data)).catch(() => {})
    getPendingActions().then(r => setPending(r.data)).catch(() => {})
    getRecalledProducts().then(r => setRecalled(r.data)).catch(() => {})
  }, [])

  const voucherUnapplied = seniors.filter(s => !s.energyVoucherApplied)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>대시보드</h1>
        <button className="btn-primary" onClick={handleAssessAll} disabled={assessing}>
          {assessing ? '산정 중...' : '전체 위험도 산정'}
        </button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card" onClick={() => navigate('/seniors')}>
          <div className="label">전체 대상자</div>
          <div className="value">{seniors.length}</div>
        </div>
        <div className="stat-card danger" onClick={() => navigate('/seniors')}>
          <div className="label">고위험군</div>
          <div className="value">{highRisk.length}</div>
        </div>
        <div className="stat-card warning" onClick={() => navigate('/energy-voucher')}>
          <div className="label">에너지바우처 미신청</div>
          <div className="value">{voucherUnapplied.length}</div>
        </div>
        <div className="stat-card danger" onClick={() => navigate('/recalled')}>
          <div className="label">리콜 제품 보유</div>
          <div className="value">{recalled.length}</div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="card-title" style={{ margin: 0 }}>고위험 대상자</span>
            <button className="btn-text" onClick={() => navigate('/seniors')}>전체 보기</button>
          </div>
          {highRisk.length === 0 ? (
            <div className="empty-state">고위험 대상자가 없습니다</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>이름</th><th>나이</th><th>위험도</th><th>점수</th><th>사유</th></tr>
              </thead>
              <tbody>
                {highRisk.slice(0, 5).map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/seniors/${r.seniorId}`)}>
                    <td className="font-bold">{r.seniorName}</td>
                    <td>{r.seniorAge}세</td>
                    <td><span className="badge badge-high">높음</span></td>
                    <td><span className={`risk-score-cell high`}>{r.totalScore}점</span></td>
                    <td className="muted-text">{r.riskReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="card-title" style={{ margin: 0 }}>미처리 조치</span>
            <button className="btn-text" onClick={() => navigate('/actions')}>전체 보기</button>
          </div>
          {pending.length === 0 ? (
            <div className="empty-state">미처리 조치가 없습니다</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>유형</th><th>어르신ID</th><th>메모</th></tr>
              </thead>
              <tbody>
                {pending.slice(0, 5).map(a => (
                  <tr key={a.id}>
                    <td><span className="badge badge-pending">{a.actionType}</span></td>
                    <td>{a.seniorId}</td>
                    <td className="muted-text">{a.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
