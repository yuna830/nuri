import { useEffect, useState } from 'react'
import '../../css/welfare/EnergyVoucher.css'
import { getEnergySupportCandidates, updateEnergySupportCase } from '../../api/energySupportApi'
import { getUserId } from '../../utils/auth'

const PAGE_SIZE = 7

const ELIGIBILITY_LABEL = {
  HIGH: '높음',
  CONFIRMATION_NEEDED: '확인 필요',
  LOW: '낮음',
}

const STATUS_LABEL = {
  CONFIRMATION_NEEDED: '미확인',
  CONTACT_SCHEDULED: '연락 예정',
  CONSULTED: '상담 완료',
  DOCUMENTS_PREPARING: '서류 준비',
  APPLICATION_SUPPORTING: '신청 지원 중',
  APPLICATION_COMPLETED: '신청 완료',
  RESULT_CONFIRMED: '결과 확인',
  ALREADY_APPLIED: '이미 신청함',
  NOT_ELIGIBLE: '자격 미충족',
  DECLINED: '신청 의사 없음',
  UNREACHABLE: '연락 불가',
  ON_HOLD: '확인 보류',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABEL)
const NEXT_ACTION_REQUIRED_STATUSES = ['CONTACT_SCHEDULED', 'CONSULTED', 'DOCUMENTS_PREPARING', 'APPLICATION_SUPPORTING', 'UNREACHABLE']
const COMPLETED_STATUSES = ['APPLICATION_COMPLETED', 'RESULT_CONFIRMED', 'ALREADY_APPLIED', 'NOT_ELIGIBLE', 'DECLINED']

function getEligibilityLevel(item) {
  if (item.eligibilityLevel === 'HIGH' || item.eligibilityReason?.includes('신청 가능')) return 'HIGH'
  if (item.eligibilityLevel === 'LOW' || item.eligibilityReason?.includes('미충족') || item.eligibilityReason?.includes('신청 불가')) return 'LOW'
  return 'CONFIRMATION_NEEDED'
}

function getEligibilityReasons(reason) {
  if (!reason) return []
  return reason.replace(/^신청 가능\s*:\s*/, '').split(/[,·]/).map(value => value.trim()).filter(Boolean)
}

export default function EnergyVoucher() {
  const [tab, setTab] = useState('VOUCHER')
  const [voucherCases, setVoucherCases] = useState([])
  const [electricCases, setElectricCases] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({
    existingApplicationStatus: 'UNKNOWN',
    applicationIntent: 'UNKNOWN',
    declineReason: '',
    status: 'CONFIRMATION_NEEDED',
    contactMethod: '',
    nextActionDate: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCases() }, [])

  async function loadCases() {
    const welfareWorkerId = getUserId()
    if (!welfareWorkerId) return
    const [voucher, electric] = await Promise.all([
      getEnergySupportCandidates(welfareWorkerId, 'VOUCHER').catch(() => ({ data: [] })),
      getEnergySupportCandidates(welfareWorkerId, 'ELECTRICITY').catch(() => ({ data: [] })),
    ])
    setVoucherCases(voucher.data)
    setElectricCases(electric.data)
  }

  const list = tab === 'VOUCHER' ? voucherCases : electricCases
  const label = tab === 'VOUCHER' ? '에너지바우처' : '전기요금 할인'
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const pagedList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  function openCase(item) {
    setSelected(item)
    setForm({
      existingApplicationStatus: item.existingApplicationStatus || 'UNKNOWN',
      applicationIntent: item.applicationIntent || 'UNKNOWN',
      declineReason: item.declineReason || '',
      status: item.status || 'CONFIRMATION_NEEDED',
      contactMethod: item.contactMethod || '',
      nextActionDate: item.nextActionDate || '',
      note: item.note || '',
    })
  }

  async function saveCase(e) {
    e.preventDefault()
    const requiresNextAction = NEXT_ACTION_REQUIRED_STATUSES.includes(form.status) || form.applicationIntent === 'DECIDE_LATER'
    if (requiresNextAction && !form.nextActionDate) {
      alert('현재 지원 상태에서는 다음 조치일을 입력해야 합니다.')
      return
    }
    if (form.applicationIntent === 'DOES_NOT_WANT' && !form.declineReason) {
      alert('신청하지 않는 사유를 선택해 주세요.')
      return
    }
    if (form.status === 'NOT_ELIGIBLE' && !form.note.trim()) {
      alert('자격 미충족 사유를 메모에 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      await updateEnergySupportCase(selected.seniorId, selected.supportType, {
        ...form,
        nextActionDate: form.nextActionDate || null,
      })
      await loadCases()
      setSelected(null)
    } finally {
      setSaving(false)
    }
  }

  function changeTab(nextTab) {
    setTab(nextTab)
    setCurrentPage(1)
  }

  function changeExistingApplicationStatus(value) {
    setForm(prev => ({
      ...prev,
      existingApplicationStatus: value,
      status: value === 'ALREADY_APPLIED' ? 'ALREADY_APPLIED' : prev.status === 'ALREADY_APPLIED' ? 'CONFIRMATION_NEEDED' : prev.status,
      nextActionDate: value === 'ALREADY_APPLIED' ? '' : prev.nextActionDate,
    }))
  }

  function changeApplicationIntent(value) {
    setForm(prev => ({
      ...prev,
      applicationIntent: value,
      declineReason: value === 'DOES_NOT_WANT' ? prev.declineReason : '',
      status: value === 'DOES_NOT_WANT' ? 'DECLINED' : prev.status === 'DECLINED' ? 'CONFIRMATION_NEEDED' : prev.status,
      nextActionDate: value === 'DOES_NOT_WANT' ? '' : prev.nextActionDate,
    }))
  }

  function changeStatus(value) {
    setForm(prev => ({
      ...prev,
      status: value,
      nextActionDate: COMPLETED_STATUSES.includes(value) ? '' : prev.nextActionDate,
    }))
  }

  return (
    <div>
      <h1 className="page-title">에너지복지 신청 확인 대상</h1>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'VOUCHER' ? 'active' : ''}`} onClick={() => changeTab('VOUCHER')}>
          에너지바우처 확인 대상 ({voucherCases.length})
        </button>
        <button className={`tab-btn ${tab === 'ELECTRICITY' ? 'active' : ''}`} onClick={() => changeTab('ELECTRICITY')}>
          전기요금 할인 확인 대상 ({electricCases.length})
        </button>
      </div>

      <div className="info-banner">
        신청 가능성이 있는 어르신 목록입니다. 실제 자격과 기존 신청 여부를 확인하고, 상담부터 신청 완료까지 지원 상태를 기록하세요.
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state">{label} 확인 대상자가 없습니다</div>
        ) : (
          <>
            <table className="data-table support-table">
              <thead>
                <tr><th>이름</th><th>신청 가능성</th><th>확인 필요 정보</th><th>지원 상태</th><th>다음 조치일</th><th>관리</th></tr>
              </thead>
              <tbody>
                {pagedList.map(item => {
                  const missing = item.missingInformation || []
                  const eligibilityLevel = getEligibilityLevel(item)
                  return (
                    <tr key={item.seniorId}>
                      <td className="font-bold">{item.seniorName}</td>
                      <td>
                        <span className={`support-possibility eligibility-${eligibilityLevel.toLowerCase()}`}>
                          {ELIGIBILITY_LABEL[eligibilityLevel]}
                        </span>
                      </td>
                      <td className="support-check-info">
                        {missing.length === 0 ? (
                          <span className="support-check-complete">확인 완료</span>
                        ) : (
                          <>
                            <strong>확인 필요 {missing.length}개</strong>
                            <small>{missing.join(' · ')}</small>
                          </>
                        )}
                      </td>
                      <td><span className={`support-status status-${item.status?.toLowerCase()}`}>{STATUS_LABEL[item.status] || '미확인'}</span></td>
                      <td className="support-next-action">{item.nextActionDate || '-'}</td>
                      <td><button className="btn-primary support-manage-btn" onClick={() => openCase(item)}>지원 관리</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="voucher-pagination">
                <button className="voucher-page-btn voucher-page-arrow" onClick={() => setCurrentPage(page => page - 1)} disabled={currentPage === 1}><span>‹</span></button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                  <button key={page} className={`voucher-page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                ))}
                <button className="voucher-page-btn voucher-page-arrow" onClick={() => setCurrentPage(page => page + 1)} disabled={currentPage === totalPages}><span>›</span></button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="support-modal-overlay" onClick={() => setSelected(null)}>
          <form className="support-modal" onSubmit={saveCase} onClick={e => e.stopPropagation()}>
            <div className="support-modal-header">
              <div>
                <h2>{selected.seniorName} · {selected.seniorAge}세</h2>
                <p>{selected.supportType === 'VOUCHER' ? '에너지바우처' : '전기요금 할인'} 신청 지원</p>
              </div>
              <button type="button" className="support-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <section className="support-detail-section">
              <h3>신청 가능성 판단 근거</h3>
              <div className="support-auto-eligibility">
                <strong>자격 조건</strong>
                <span className={`support-possibility eligibility-${getEligibilityLevel(selected).toLowerCase()}`}>
                  {getEligibilityLevel(selected) === 'HIGH' ? '주요 조건 충족' : ELIGIBILITY_LABEL[getEligibilityLevel(selected)]}
                </span>
              </div>
              <ul className="support-eligibility-reasons">
                {getEligibilityReasons(selected.eligibilityReason).map(reason => <li key={reason}>{reason}</li>)}
              </ul>
              <div className="support-verification-summary">
                <div><strong>지원 필요 여부</strong><span>{selected.missingInformation?.includes('기존 신청 여부') ? '기존 신청 여부 확인 필요' : '확인됨'}</span></div>
                <div><strong>추가 확인 필요</strong><span>{selected.missingInformation?.length ? selected.missingInformation.join(' · ') : '없음'}</span></div>
              </div>
              <small>등록된 정보를 기준으로 산정한 신청 가능성입니다. 실제 자격과 기존 신청 여부는 행정복지센터 등 담당 기관을 통해 최종 확인해야 합니다.</small>
            </section>

            <div className="support-form-grid">
              <label>
                기존 신청 여부
                <select value={form.existingApplicationStatus} onChange={e => changeExistingApplicationStatus(e.target.value)}>
                  <option value="UNKNOWN">미확인</option>
                  <option value="NOT_APPLIED">미신청</option>
                  <option value="ALREADY_APPLIED">이미 신청함</option>
                </select>
              </label>
              <label>
                신청 의사
                <select value={form.applicationIntent} onChange={e => changeApplicationIntent(e.target.value)}>
                  <option value="UNKNOWN">미확인</option>
                  <option value="WANTS_TO_APPLY">신청 희망</option>
                  <option value="DOES_NOT_WANT">신청하지 않음</option>
                  <option value="DECIDE_LATER">추후 결정</option>
                </select>
              </label>
              <label>
                지원 상태
                <select value={form.status} onChange={e => changeStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </label>
              <label>
                상담 방법
                <select value={form.contactMethod} onChange={e => setForm(prev => ({ ...prev, contactMethod: e.target.value }))}>
                  <option value="">선택</option><option value="전화">전화</option><option value="방문">방문</option><option value="대면 상담">대면 상담</option><option value="보호자 연락">보호자 연락</option><option value="문자">문자</option><option value="기타">기타</option>
                </select>
              </label>
              {form.applicationIntent === 'DOES_NOT_WANT' && (
                <label>
                  신청하지 않는 사유 *
                  <select value={form.declineReason} onChange={e => setForm(prev => ({ ...prev, declineReason: e.target.value }))} required>
                    <option value="">선택</option>
                    <option value="SELF_DECLINED">본인 거절</option>
                    <option value="FAMILY_DISCUSSION_REQUIRED">가족과 상의 필요</option>
                    <option value="USING_OTHER_SUPPORT">이미 다른 지원 이용 중</option>
                    <option value="OTHER">기타</option>
                  </select>
                </label>
              )}
              <label>
                다음 조치일 {(NEXT_ACTION_REQUIRED_STATUSES.includes(form.status) || form.applicationIntent === 'DECIDE_LATER') && '*'}
                <input type="date" value={form.nextActionDate} onChange={e => setForm(prev => ({ ...prev, nextActionDate: e.target.value }))} required={NEXT_ACTION_REQUIRED_STATUSES.includes(form.status) || form.applicationIntent === 'DECIDE_LATER'} disabled={COMPLETED_STATUSES.includes(form.status)} />
              </label>
              <label className="support-note-field">
                상담 및 담당자 메모 {form.status === 'NOT_ELIGIBLE' && '*'}
                <textarea value={form.note} onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))} placeholder={form.status === 'NOT_ELIGIBLE' ? '자격 미충족 사유를 입력하세요' : '확인 내용, 신청 의사, 준비 서류 등을 기록하세요'} required={form.status === 'NOT_ELIGIBLE'} />
              </label>
            </div>

            {selected.history?.length > 0 && (
              <section className="support-history">
                <h3>상담 및 조치 기록</h3>
                {selected.history.map(activity => (
                  <div className="support-history-item" key={activity.id}>
                    <div>
                      <strong>{STATUS_LABEL[activity.status] || activity.status}</strong>
                      <span>{activity.createdAt?.replace('T', ' ').slice(0, 16)}</span>
                    </div>
                    <p>{activity.contactMethod || '상담 방법 미입력'} · 다음 조치일 {activity.nextActionDate || '-'}</p>
                    {activity.note && <small>{activity.note}</small>}
                  </div>
                ))}
              </section>
            )}

            <div className="support-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setSelected(null)}>닫기</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중...' : '지원 기록 저장'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
