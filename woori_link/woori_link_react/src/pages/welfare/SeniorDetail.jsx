import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorDetail.css'
import { getSeniorById, updateSenior } from '../../api/seniorApi'
import { getLatestRisk, assessRisk } from '../../api/riskApi'
import { getActionsBySenior, createAction } from '../../api/actionApi'
import { getProductsBySenior } from '../../api/recallApi'

const INCOME_LABEL = { BASIC_LIVELIHOOD: '기초생활', NEAR_POVERTY: '차상위', LOWER_MIDDLE: '하위중간', MIDDLE: '중간', UPPER: '상위' }
const LEVEL_MAP = { HIGH: { label: '높음', cls: 'high' }, MEDIUM: { label: '보통', cls: 'medium' }, LOW: { label: '낮음', cls: 'low' } }

export default function SeniorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [senior, setSenior] = useState(null)
  const [risk, setRisk] = useState(null)
  const [actions, setActions] = useState([])
  const [products, setProducts] = useState([])
  const [note, setNote] = useState('')
  const [assessing, setAssessing] = useState(false)

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
    await createAction({ seniorId: Number(id), welfareWorkerId: 1, actionType: 'OTHER', actionSubject: 'WELFARE_WORKER', note })
    const r = await getActionsBySenior(id)
    setActions(r.data)
    setNote('')
  }

  if (!senior) return <div className="empty-state">불러오는 중...</div>

  const levelInfo = risk ? LEVEL_MAP[risk.level] : null

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/seniors')}>← 목록으로</button>
      <h1 className="page-title">{senior.name}</h1>

      <div className="detail-grid">
        <div className="card">
          <div className="card-title">기본 정보</div>
          {[['나이', `${senior.age}세`], ['주소', senior.address], ['연락처', senior.phone], ['소득구분', INCOME_LABEL[senior.incomeLevel]], ['장애등급', senior.disabilityGrade || '-'], ['독거여부', senior.livingAlone ? '독거' : '-']].map(([l, v]) => (
            <div className="info-row" key={l}><span className="info-label">{l}</span><span className="info-value">{v || '-'}</span></div>
          ))}
        </div>

        <div className="card">
          <div className="section-header">
            <span className="card-title" style={{ margin: 0 }}>위험도 평가</span>
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={handleAssess} disabled={assessing}>
              {assessing ? '산정 중...' : '재산정'}
            </button>
          </div>
          {risk ? (
            <>
              <div className="risk-header">
                <span className={`risk-score ${levelInfo?.cls}`}>{risk.totalScore}점</span>
                <span className="badge badge-high">{levelInfo?.label}</span>
              </div>
              <div className="risk-reason-box">{risk.riskReason}</div>
              {[['기상특보', risk.weatherRisk], ['리콜 제품', risk.recallRisk], ['바우처 미신청', risk.voucherUnapplied]].map(([l, v]) => (
                <div className="risk-row" key={l}>
                  <span>{l}</span>
                  <span className={v ? 'risk-flag-on' : 'risk-flag-off'}>{v ? '해당' : '해당없음'}</span>
                </div>
              ))}
            </>
          ) : <div className="empty-state" style={{ padding: 20 }}>평가 이력 없음</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">등록 제품 ({products.length})</div>
        {products.length === 0 ? <div className="empty-state">등록된 제품이 없습니다</div> : (
          <table className="data-table">
            <thead><tr><th>제품명</th><th>제조사</th><th>모델번호</th><th>리콜여부</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.productName}</td><td>{p.manufacturer || '-'}</td><td>{p.modelNumber || '-'}</td>
                  <td><span className={`badge badge-${p.recallStatus === 'RECALLED' ? 'recalled' : 'safe'}`}>{p.recallStatus === 'RECALLED' ? '리콜대상' : '안전'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">조치 기록</div>
        <div className="action-form-box">
          <textarea className="action-form-note" placeholder="조치 내용을 입력하세요" value={note} onChange={e => setNote(e.target.value)} />
          <button className="btn-primary" style={{ marginTop: 10 }} onClick={handleAction}>기록 추가</button>
        </div>
        {actions.length === 0 ? <div className="empty-state" style={{ marginTop: 16 }}>조치 기록이 없습니다</div> : (
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead><tr><th>유형</th><th>상태</th><th>메모</th><th>일시</th></tr></thead>
            <tbody>
              {actions.map(a => (
                <tr key={a.id}>
                  <td>{a.actionType}</td>
                  <td><span className={`badge badge-${a.status === 'COMPLETED' ? 'completed' : 'pending'}`}>{a.status}</span></td>
                  <td>{a.note || '-'}</td>
                  <td className="muted-text">{a.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
