import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecalledProducts, refreshRecall } from '../../api/recallApi'
import { getSeniorById } from '../../api/seniorApi'

export default function RecallList() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const r = await getRecalledProducts().catch(() => ({ data: [] }))
    setProducts(r.data)
  }

  async function handleRefresh() {
    setLoading(true)
    try { await refreshRecall(); await load() }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>리콜 보유 대상</h1>
        <button className="btn-primary" onClick={handleRefresh} disabled={loading}>{loading ? '조회 중...' : '리콜 재조회'}</button>
      </div>
      <div className="card">
        {products.length === 0 ? (
          <div className="empty-state">리콜 제품 보유 대상이 없습니다</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>어르신ID</th><th>제품명</th><th>제조사</th><th>모델번호</th><th>리콜사유</th><th>확인</th></tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }} onClick={() => navigate(`/welfare/seniors/${p.seniorId}`)}>{p.seniorId}</td>
                  <td className="font-bold">{p.productName}</td>
                  <td>{p.manufacturer || '-'}</td>
                  <td>{p.modelNumber || '-'}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{p.recallReason || '-'}</td>
                  <td><span className="badge badge-recalled">리콜대상</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
