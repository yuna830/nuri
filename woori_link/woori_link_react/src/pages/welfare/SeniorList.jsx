import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorList.css'
import { searchAddresses } from '../../api/addressApi'
import { getSeniorsByWelfareWorker, createSenior } from '../../api/seniorApi'
import { getUserId } from '../../utils/auth'

const INCOME_LABEL = { LIVELIHOOD: '생계급여', MEDICAL: '의료급여', HOUSING: '주거급여', EDUCATION: '교육급여', NONE: '해당없음' }
const INIT_FORM = { name: '', age: '', address: '', latitude: null, longitude: null, phone: '', gender: '', incomeLevel: '', disabilityGrade: '', livingAlone: false, energyVoucherApplied: false, electricityDiscountApplied: false }

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length > 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return digits
}

export default function SeniorList() {
  const navigate = useNavigate()
  const [seniors, setSeniors] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INIT_FORM)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [listError, setListError] = useState('')

  useEffect(() => {
    loadSeniors()
  }, [])

  async function loadSeniors() {
    const welfareWorkerId = getUserId()
    if (!welfareWorkerId) {
      setListError('로그인한 복지사 정보를 찾을 수 없습니다.')
      return
    }

    try {
      const r = await getSeniorsByWelfareWorker(welfareWorkerId)
      setSeniors(r.data)
      setListError('')
    } catch (err) {
      setListError(err.response?.data?.message || '대상자 목록을 불러오지 못했습니다.')
      console.error(err.response?.status, err.response?.data)
    }
  }

  const filtered = seniors.filter(s => s.name?.includes(search) || s.address?.includes(search))

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    const nextValue = name === 'phone' ? formatPhone(value) : value
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : nextValue }))
  }

  async function handleAddressSearch() {
    if (addressQuery.trim().length < 2) {
      setAddressError('주소를 2글자 이상 입력해주세요.')
      return
    }

    setAddressLoading(true)
    setAddressError('')
    try {
      const { data } = await searchAddresses(addressQuery)
      setAddressResults(data)
      if (data.length === 0) {
        setAddressError('검색 결과가 없습니다.')
      }
    } catch (err) {
      setAddressResults([])
      setAddressError(err.response?.data?.message || '주소 검색에 실패했습니다.')
    } finally {
      setAddressLoading(false)
    }
  }

  function selectAddress(item) {
    setForm(prev => ({
      ...prev,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    }))
    setAddressQuery(item.address)
    setAddressResults([])
    setAddressError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const welfareWorkerId = getUserId()

    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
      incomeLevel: form.incomeLevel || null,
      welfareWorkerId,
    }

    await createSenior(payload)
    await loadSeniors()

    setShowModal(false)
    setForm(INIT_FORM)
    setAddressQuery('')
    setAddressResults([])
    setAddressError('')
  }

  return (
    <div>
      <h1 className="page-title">대상자 목록</h1>
      <div className="card">
        <div className="senior-list-toolbar">
          <input className="senior-search" placeholder="이름 또는 주소 검색" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ 대상자 등록</button>
        </div>
        {listError ? (
          <div className="empty-state">{listError}</div>
        ) : filtered.length === 0 ? (
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
                <div className="form-group full">
                  <label className="form-label">주소</label>
                  <div className="address-search-row">
                    <input
                      className="form-input"
                      value={addressQuery}
                      onChange={e => {
                        setAddressQuery(e.target.value)
                        setForm(prev => ({ ...prev, address: '', latitude: null, longitude: null }))
                      }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                      placeholder="도로명, 지번, 건물명까지 입력하세요"
                    />
                    <button type="button" className="btn-outline address-search-btn" onClick={handleAddressSearch} disabled={addressLoading}>
                      {addressLoading ? '검색 중' : '주소 검색'}
                    </button>
                  </div>
                  {addressError && <div className="address-search-error">{addressError}</div>}
                  {addressResults.length > 0 && (
                    <div className="address-result-list">
                      {addressResults.map((item, index) => (
                        <button type="button" className="address-result-item" key={`${item.address}-${index}`} onClick={() => selectAddress(item)}>
                          <span>{item.address}</span>
                          {item.jibunAddress && <small>지번: {item.jibunAddress}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.address && (
                    <div className="selected-address">
                      선택 주소: {form.address}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">연락처</label>
                  <input
                    className="form-input"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="010-0000-0000"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>
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
