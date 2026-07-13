import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/EnergyVoucher.css'
import { getSeniorsByWelfareWorker, getVoucherUnapplied, updateSenior } from '../../api/seniorApi'
import { getUserId } from '../../utils/auth'

const INCOME_LABEL = { LIVELIHOOD: '생계급여', MEDICAL: '의료급여', HOUSING: '주거급여', EDUCATION: '교육급여', NONE: '해당없음' }

export default function EnergyVoucher() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('voucher')
  const [seniors, setSeniors] = useState([])
  const [voucherTargets, setVoucherTargets] = useState([])

  useEffect(() => {
    const welfareWorkerId = getUserId()
    if (welfareWorkerId) {
      getSeniorsByWelfareWorker(welfareWorkerId).then(r => setSeniors(r.data)).catch(() => {})
    }
    getVoucherUnapplied().then(r => setVoucherTargets(r.data)).catch(() => {})
  }, [])

  const voucherList = voucherTargets
  const electricList = seniors.filter(s => !s.electricityDiscountApplied)

  const list = tab === 'voucher' ? voucherList : electricList
  const field = tab === 'voucher' ? 'energyVoucherApplied' : 'electricityDiscountApplied'
  const label = tab === 'voucher' ? '에너지바우처' : '전기요금 복지할인'

  async function markApplied(s) {
    await updateSenior(s.id, { [field]: true })
    setSeniors(prev => prev.map(x => x.id === s.id ? { ...x, [field]: true } : x))
    setVoucherTargets(prev => prev.filter(x => x.id !== s.id))
  }

  return (
    <div>
      <h1 className="page-title">에너지바우처 미신청 대상</h1>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'voucher' ? 'active' : ''}`} onClick={() => setTab('voucher')}>에너지바우처 ({voucherList.length})</button>
        <button className={`tab-btn ${tab === 'electric' ? 'active' : ''}`} onClick={() => setTab('electric')}>전기요금 할인 ({electricList.length})</button>
      </div>
      <div className="info-banner">
        {tab === 'voucher'
          ? '에너지바우처는 기초생활수급자·차상위계층 중 노인·장애인·영유아 가구가 신청 가능합니다. 정확한 자격은 읍면동 주민센터에서 확인하세요.'
          : '전기요금 복지할인은 기초생활수급자·차상위계층·장애인 등이 신청 가능합니다. 한국전력공사 또는 주민센터를 통해 신청하세요.'}
      </div>
      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state">{label} 미신청 대상자가 없습니다</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>이름</th><th>나이</th><th>주소</th><th>소득구분</th><th>장애등급</th><th>조치</th></tr>
            </thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id}>
                  <td className="font-bold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/welfare/seniors/${s.id}`)}>{s.name}</td>
                  <td>{s.age}세</td>
                  <td>{s.address}</td>
                  <td>{INCOME_LABEL[s.incomeLevel] || '-'}</td>
                  <td>{s.disabilityGrade || '-'}</td>
                  <td>
                    <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => markApplied(s)}>신청완료 처리</button>
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
