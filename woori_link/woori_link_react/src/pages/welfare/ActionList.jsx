import { useEffect, useMemo, useState } from 'react'
import { getActionsByWelfareWorker, getPendingActions, updateActionStatus } from '../../api/actionApi'
import { getUserId } from '../../utils/auth'
import '../../css/welfare/ActionList.css'

const STATUS_LABEL = {
  PENDING: '확인 필요',
  IN_PROGRESS: '조치 진행',
  COMPLETED: '조치 완료',
  CANCELLED: '대상 아님',
}

const TYPE_LABEL = {
  SOS: 'SOS',
  RECALL: '리콜 제품 확인',
  VOUCHER: '에너지바우처 신청 지원',
  ELECTRICITY_DISCOUNT: '전기요금 할인 신청 지원',
  GAS_CHECK: '전기·가스 안전점검',
  ELECTRIC_CHECK: '전기·가스 안전점검',
  WEATHER_CHECK: '기상위험 안부 확인',
  VISIT: '방문 확인',
  OTHER: '기타 복지 상담',
}

const PRIORITY_LABEL = { HIGH: '높음', MEDIUM: '보통', NORMAL: '보통', LOW: '낮음' }
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-'
}

function isDelayed(action) {
  if (!action.dueDate || TERMINAL_STATUSES.includes(action.status)) return false
  return String(action.dueDate).slice(0, 10) < new Date().toISOString().slice(0, 10)
}

function priorityOf(action) {
  if (action.priority && PRIORITY_LABEL[action.priority]) return action.priority
  if (action.immediateRisk === true) return 'HIGH'
  return null
}

function typeLabel(action) {
  return TYPE_LABEL[action.actionType] || action.actionType || '미확인'
}

function statusGroup(action) {
  if (isDelayed(action)) return 'DELAYED'
  if (action.status === 'PENDING') return 'PENDING'
  if (action.status === 'COMPLETED' || action.status === 'CANCELLED') return 'COMPLETED'
  return 'IN_PROGRESS'
}

export default function ActionList() {
  const [actions, setActions] = useState([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortByDueDate, setSortByDueDate] = useState(true)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const welfareWorkerId = getUserId()
    try {
      const response = welfareWorkerId
        ? await getActionsByWelfareWorker(welfareWorkerId)
        : await getPendingActions()
      setActions(Array.isArray(response.data) ? response.data : [])
    } catch {
      setActions([])
    }
  }

  const counts = useMemo(() => ({
    ALL: actions.length,
    PENDING: actions.filter(action => statusGroup(action) === 'PENDING').length,
    IN_PROGRESS: actions.filter(action => statusGroup(action) === 'IN_PROGRESS').length,
    DELAYED: actions.filter(action => statusGroup(action) === 'DELAYED').length,
    COMPLETED: actions.filter(action => statusGroup(action) === 'COMPLETED').length,
  }), [actions])

  const types = useMemo(() => [...new Set(actions.map(action => action.actionType).filter(Boolean))], [actions])

  const visibleActions = useMemo(() => {
    const priorityRank = { HIGH: 0, MEDIUM: 1, NORMAL: 1, LOW: 2 }
    return actions
      .filter(action => activeTab === 'ALL' || statusGroup(action) === activeTab)
      .filter(action => !search.trim() || (action.seniorName || '').includes(search.trim()))
      .filter(action => typeFilter === 'ALL' || action.actionType === typeFilter)
      .filter(action => statusFilter === 'ALL' || action.status === statusFilter)
      .sort((first, second) => {
        const delayDifference = Number(isDelayed(second)) - Number(isDelayed(first))
        if (delayDifference) return delayDifference
        const priorityDifference = (priorityRank[priorityOf(first)] ?? 3) - (priorityRank[priorityOf(second)] ?? 3)
        if (priorityDifference) return priorityDifference
        if (sortByDueDate) return (first.dueDate || '9999-12-31').localeCompare(second.dueDate || '9999-12-31')
        return 0
      })
  }, [actions, activeTab, search, typeFilter, statusFilter, sortByDueDate])

  function openModal(action) {
    setSelected(action)
    setForm({
      status: action.status || 'PENDING',
      dueDate: action.dueDate || '',
      contactMethod: action.contactMethod || '',
      visitRequired: action.visitRequired ?? '',
      guardianContacted: action.guardianContacted ?? '',
      note: action.note || '',
      completionDetail: action.completionDetail || '',
    })
  }

  async function saveAction(event) {
    event.preventDefault()
    if (form.status === 'COMPLETED' && !form.completionDetail.trim()) {
      alert('완료 내용을 입력해 주세요.')
      return
    }
    const savedNote = form.status === 'COMPLETED'
      ? [form.note.trim(), `완료 내용: ${form.completionDetail.trim()}`].filter(Boolean).join('\n')
      : form.note

    setSaving(true)
    try {
      await updateActionStatus(selected.id, form.status, savedNote)
      await load()
      setSelected(null)
    } finally {
      setSaving(false)
    }
    // TODO: 다음 조치일, 상담 방법, 방문 필요 여부, 보호자 연락 여부 전용 저장 API 연결 필요
  }

  return (
    <div>
      <div className="action-page-title">
        <h1 className="page-title">조치 관리</h1>
        <p>등록된 후속 조치의 일정과 진행 상태를 관리합니다.</p>
      </div>

      <div className="action-summary-tabs">
        {[
          ['ALL', '전체'], ['PENDING', '확인 필요'], ['IN_PROGRESS', '진행 중'], ['DELAYED', '지연'], ['COMPLETED', '완료'],
        ].map(([value, label]) => (
          <button key={value} className={`${activeTab === value ? 'active' : ''} ${value === 'DELAYED' && counts.DELAYED > 0 ? 'has-delay' : ''}`} onClick={() => setActiveTab(value)}>
            <span>{label}</span><strong>{counts[value]}</strong>
          </button>
        ))}
      </div>

      <div className="card action-card">
        <div className="action-list-toolbar">
          <h2>조치 목록</h2>
          <div className="action-filters">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="대상자 이름 검색" />
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
              <option value="ALL">조치 유형 전체</option>
              {types.map(type => <option key={type} value={type}>{TYPE_LABEL[type] || type}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="ALL">진행 상태 전체</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className={`action-sort-button ${sortByDueDate ? 'active' : ''}`} onClick={() => setSortByDueDate(previous => !previous)}>다음 조치일순</button>
          </div>
        </div>
        {visibleActions.length === 0 ? (
          <div className="action-empty-state">
            <strong>현재 진행 중인 조치가 없습니다.</strong>
            <p>에너지복지 신청 지원이나 리콜 제품 확인에서 후속 대응이 등록되면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <table className="data-table action-table">
            <thead><tr><th>우선도</th><th>대상자</th><th>조치 유형</th><th>조치 내용</th><th>진행 상태</th><th>다음 조치일</th><th>관리</th></tr></thead>
            <tbody>
              {visibleActions.map(action => {
                const priority = priorityOf(action)
                return (
                  <tr key={action.id} className={isDelayed(action) ? 'delayed' : ''}>
                    <td><span className={`action-priority priority-${priority?.toLowerCase() || 'unknown'}`}>{PRIORITY_LABEL[priority] || '미확인'}</span></td>
                    <td className="font-bold">{action.seniorName || '-'}</td>
                    <td>{typeLabel(action)}</td>
                    <td className="action-description">{action.title || action.description || action.note || '-'}</td>
                    <td><span className={`action-status status-${action.status?.toLowerCase()}`}>{STATUS_LABEL[action.status] || '미확인'}</span></td>
                    <td className={isDelayed(action) ? 'action-overdue-date' : ''}>{formatDate(action.dueDate)}</td>
                    <td><button className="btn-primary action-manage-button" onClick={() => openModal(action)}>조치 관리</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="action-modal-overlay" onClick={() => setSelected(null)}>
          <form className="action-modal" onSubmit={saveAction} onClick={event => event.stopPropagation()}>
            <div className="action-modal-header">
              <div><h2>{selected.seniorName || '대상자 미확인'} · {selected.seniorAge ?? '-'}세</h2><p>{typeLabel(selected)}</p></div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </div>

            <section className="action-information">
              <h3>조치 정보</h3>
              <dl>
                <div><dt>조치 내용</dt><dd>{selected.title || selected.description || selected.note || '-'}</dd></div>
                <div><dt>생성 원인</dt><dd>{selected.cause || selected.reason || '-'}</dd></div>
                <div><dt>원본 기능</dt><dd>{selected.sourceFeature || selected.source || typeLabel(selected)}</dd></div>
                <div><dt>생성일</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                <div><dt>담당 복지사</dt><dd>{selected.welfareWorkerName || '-'}</dd></div>
              </dl>
            </section>

            <div className="action-form-grid">
              <label>진행 상태<select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>다음 조치일<input type="date" value={form.dueDate} disabled title="저장 API 연결 필요" /></label>
              <label>상담 방법<select value={form.contactMethod} disabled title="저장 API 연결 필요"><option value="">미확인</option><option>전화</option><option>방문</option><option>대면 상담</option><option>보호자 연락</option><option>문자</option><option>기타</option></select></label>
              <label>방문 필요 여부<select value={form.visitRequired} disabled title="저장 API 연결 필요"><option value="">미확인</option><option value="true">필요</option><option value="false">불필요</option></select></label>
              <label>보호자 연락 여부<select value={form.guardianContacted} disabled title="저장 API 연결 필요"><option value="">미확인</option><option value="true">연락 완료</option><option value="false">연락하지 않음</option></select></label>
              <label className="action-wide-field">담당자 메모<textarea value={form.note} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} /></label>
              {form.status === 'COMPLETED' && <label className="action-wide-field">완료 내용 *<textarea value={form.completionDetail} onChange={event => setForm(previous => ({ ...previous, completionDetail: event.target.value }))} required /></label>}
            </div>

            {Array.isArray(selected.history) && selected.history.length > 0 && (
              <section className="action-history"><h3>조치 이력</h3>{selected.history.map((history, index) => <div key={history.id || index}><strong>{history.type || history.status || '기록'}</strong><span>{history.createdAt?.replace('T', ' ').slice(0, 16) || '-'}</span><p>{history.note || '-'}</p></div>)}</section>
            )}

            <div className="action-api-notice">상태와 메모만 현재 API로 저장됩니다.</div>
            <div className="action-modal-actions"><button type="button" className="btn-outline" onClick={() => setSelected(null)}>닫기</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중...' : '조치 기록 저장'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
