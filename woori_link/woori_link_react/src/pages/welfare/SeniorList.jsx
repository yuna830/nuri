import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/SeniorList.css'
import {
  getSeniorsByWelfareWorker,
  searchSeniors,
  assignWelfareWorker,
} from '../../api/seniorApi'
import { getUserId } from '../../utils/auth'

const INCOME_LABEL = { LIVELIHOOD: '생계급여', MEDICAL: '의료급여', HOUSING: '주거급여', EDUCATION: '교육급여', NONE: '해당없음' }

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
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [listError, setListError] = useState('')
  const [searchForm, setSearchForm] = useState({ name: '', phone: '' })
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

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

  function handleSearchChange(e) {
    const { name, value } = e.target
    setSearchForm(prev => ({
      ...prev,
      [name]: name === 'phone' ? formatPhone(value) : value,
    }))
  }

  async function handleSearch(e) {
    e.preventDefault()

    if (!searchForm.name.trim() || !searchForm.phone.trim()) {
      setSearchError('이름과 전화번호를 모두 입력해주세요.')
      return
    }

    setSearchLoading(true)
    setSearchError('')

    try {
      const { data } = await searchSeniors({
        name: searchForm.name.trim(),
        phone: searchForm.phone,
      })

      setSearchResults(data)

      if (data.length === 0) {
        setSearchError('일치하는 사용자가 없습니다.')
      }
    } catch (err) {
      setSearchResults([])
      setSearchError(err.response?.data?.message || '사용자 검색에 실패했습니다.')
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleAssign(senior) {
    const welfareWorkerId = getUserId()

    if (!welfareWorkerId) {
      setSearchError('로그인한 복지사 정보를 찾을 수 없습니다.')
      return
    }

    try {
      await assignWelfareWorker(senior.id, welfareWorkerId)
      await loadSeniors()

      setShowModal(false)
      setSearchForm({ name: '', phone: '' })
      setSearchResults([])
      setSearchError('')
    } catch (err) {
      setSearchError(err.response?.data?.message || '대상자 등록에 실패했습니다.')
    }
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
            <h2>대상자 검색</h2>

            <form onSubmit={handleSearch}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">이름 *</label>
                  <input
                    className="form-input"
                    name="name"
                    value={searchForm.name}
                    onChange={handleSearchChange}
                    placeholder="사용자 이름"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">전화번호 *</label>
                  <input
                    className="form-input"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={13}
                    value={searchForm.phone}
                    onChange={handleSearchChange}
                    placeholder="010-0000-0000"
                    required
                  />
                </div>
              </div>

              {searchError && (
                <div className="search-error">{searchError}</div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn-primary" disabled={searchLoading}>
                  {searchLoading ? '검색 중...' : '검색'}
                </button>
              </div>
            </form>

            {searchResults.length > 0 && (
              <div className="senior-search-results">
                {searchResults.map(senior => (
                  <div className="senior-search-result" key={senior.id}>
                    <div>
                      <strong>{senior.name}</strong>
                      <span>{senior.phone}</span>
                      <small>{senior.address || '주소 미입력'}</small>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleAssign(senior)}
                    >
                      선택
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
