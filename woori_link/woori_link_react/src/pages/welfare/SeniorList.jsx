import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorList.css'
import { getSeniors, createSenior } from '../../api/seniorApi'

const INCOME_LABEL = { BASIC_LIVELIHOOD: '기초생활', NEAR_POVERTY: '차상위', LOWER_MIDDLE: '하위중간', MIDDLE: '중간', UPPER: '상위' }
const INIT_FORM = { name: '', age: '', address: '', phone: '', gender: '', incomeLevel: '', disabilityGrade: '', livingAlone: false, energyVoucherApplied: false, electricityDiscountApplied: false }

export default function SeniorList() {
  const navigate = useNavigate()
  const [seniors, setSeniors] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INIT_FORM)

  useEffect(() => { getSeniors().then(r => setSeniors(r.data)).catch(() => {}) }, [])

  const filtered = seniors.filter(s => s.name?.includes(search) || s.address?.includes(search))

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await createSenior({ ...form, age: Number(form.age), welfareWorkerId: 1 })
    const r = await getSeniors()
    setSeniors(r.data)
    setShowModal(false)
    setForm(INIT_FORM)
  }

  return (
    <div>
      <h1 className="page-title">대상자 목록</h1>
      <div className="card">
        <div className="senior-list-toolbar">
          <input className="senior-search" placeholder="이름 또는 주소 검색" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ 대상자 등록</button>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">대상자가 없습니다</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>이름</th><th>나이</th><th>주소</th><th>소득구분</th><th>에너지바우처</th><th>관리</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="font-bold">{s.name}</td>
                  <td>{s.age}세</td>
                  <td>{s.address}</td>
                  <td><span className="income-tag">{INCOME_LABEL[s.incomeLevel] || '-'}</span></td>
                  <td>{s.energyVoucherApplied ? <span className="badge badge-completed">신청완료</span> : <span className="badge badge-pending">미신청</span>}</td>
                  <td>
                    <div className="action-cell">
                      <button className="btn-sm primary" onClick={() => navigate(`/welfare/seniors/${s.id}`)}>상세</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>대상자 등록</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">이름 *</label><input className="form-input" name="name" value={form.name} onChange={handleChange} required /></div>
                <div className="form-group"><label className="form-label">나이</label><input className="form-input" name="age" type="number" value={form.age} onChange={handleChange} /></div>
                <div className="form-group full"><label className="form-label">주소</label><input className="form-input" name="address" value={form.address} onChange={handleChange} /></div>
                <div className="form-group"><label className="form-label">연락처</label><input className="form-input" name="phone" value={form.phone} onChange={handleChange} /></div>
                <div className="form-group"><label className="form-label">소득구분</label>
                  <select className="form-select" name="incomeLevel" value={form.incomeLevel} onChange={handleChange}>
                    <option value="">선택</option>
                    {Object.entries(INCOME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">장애등급</label><input className="form-input" name="disabilityGrade" value={form.disabilityGrade} onChange={handleChange} /></div>
                <div className="form-group full">
                  <label className="checkbox-row"><input type="checkbox" name="livingAlone" checked={form.livingAlone} onChange={handleChange} /> 독거</label>
                  <label className="checkbox-row"><input type="checkbox" name="energyVoucherApplied" checked={form.energyVoucherApplied} onChange={handleChange} /> 에너지바우처 신청</label>
                  <label className="checkbox-row"><input type="checkbox" name="electricityDiscountApplied" checked={form.electricityDiscountApplied} onChange={handleChange} /> 전기요금 복지할인 신청</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="btn-primary">등록</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
