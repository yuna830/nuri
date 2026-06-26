import { useEffect, useState } from 'react'
import { getPendingActions, updateActionStatus } from '../../api/actionApi'

const STATUS_LABEL = { PENDING: '미처리', IN_PROGRESS: '처리중', COMPLETED: '완료', CANCELLED: '취소' }
const TYPE_LABEL = { SOS: 'SOS', RECALL: '리콜', VOUCHER: '바우처', GAS_CHECK: '가스점검', ELECTRIC_CHECK: '전기점검', VISIT: '방문', OTHER: '기타' }

export default function ActionList() {
  const [actions, setActions] = useState([])

  useEffect(() => { getPendingActions().then(r => setActions(r.data)).catch(() => {}) }, [])

  async function complete(id) {
    await updateActionStatus(id, 'COMPLETED')
    setActions(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div>
      <h1 className="page-title">조치 관리</h1>
      <div className="card">
        {actions.length === 0 ? (
          <div className="empty-state">미처리 조치가 없습니다</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>유형</th><th>어르신ID</th><th>상태</th><th>메모</th><th>등록일</th><th>처리</th></tr>
            </thead>
            <tbody>
              {actions.map(a => (
                <tr key={a.id}>
                  <td><span className="badge badge-pending">{TYPE_LABEL[a.actionType] || a.actionType}</span></td>
                  <td>{a.seniorId}</td>
                  <td>{STATUS_LABEL[a.status] || a.status}</td>
                  <td className="text-muted">{a.note || '-'}</td>
                  <td className="text-muted">{a.createdAt?.slice(0, 10)}</td>
                  <td>
                    <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => complete(a.id)}>완료</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
