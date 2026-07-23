import { useEffect, useState } from 'react'
import '../../css/welfare/Schedule.css'
import { createAction, deleteAction, getActionsByWelfareWorker, updateActionStatus } from '../../api/actionApi'
import { getUserId } from '../../utils/auth'
const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function actionScheduleTitle(action) {
  const seniorName = action.seniorName || '어르신'
  const productName = action.productName || ''
  return productName
    ? `${seniorName}님 - ${productName} 조치 방문일`
    : `${seniorName}님 조치 방문일`
}

function actionToCalendarEvent(action) {
  return {
    ...action,
    visitDate: action.dueDate ? String(action.dueDate).slice(0, 10) : null,
    visitTime: action.visitTime || '',
    purpose: actionScheduleTitle(action),
  }
}

function dedupeCalendarEvents(events) {
  const byKey = new Map()
  for (const event of events) {
    const key = [
      event.actionType,
      event.seniorId,
      event.productName || event.purpose,
      event.visitDate,
    ].join('|')
    const previous = byKey.get(key)
    if (!previous || Number(event.id) > Number(previous.id)) byKey.set(key, event)
  }
  return Array.from(byKey.values())
}

export default function Schedule() {
  const welfareWorkerId = getUserId()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [schedules, setSchedules] = useState([])
  const [selected, setSelected] = useState(today.toISOString().slice(0, 10))
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ seniorId: '', visitTime: '', purpose: '', note: '' })

  useEffect(() => { load() }, [year, month])

  async function load() {
    const response = await getActionsByWelfareWorker(welfareWorkerId).catch(() => ({ data: [] }))
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`
    const actionSchedules = (Array.isArray(response.data) ? response.data : [])
      .filter(action => action.dueDate)
      .map(actionToCalendarEvent)
      .filter(schedule => schedule.visitDate >= monthStart && schedule.visitDate <= monthEnd)
    setSchedules(dedupeCalendarEvents(actionSchedules))
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  function buildCells() {
    const first = new Date(year, month - 1, 1).getDay()
    const days = new Date(year, month, 0).getDate()
    const prevDays = new Date(year, month - 1, 0).getDate()
    const cells = []
    for (let i = first - 1; i >= 0; i--) cells.push({ day: prevDays - i, curr: false })
    for (let d = 1; d <= days; d++) cells.push({ day: d, curr: true })
    while (cells.length % 7 !== 0) cells.push({ day: cells.length - days - first + 1, curr: false })
    return cells
  }

  function dateStr(d) { return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` }

  function getEventsForDay(d) {
    const ds = dateStr(d)
    return schedules.filter(s => s.visitDate === ds)
  }

  const selectedSchedules = schedules.filter(s => s.visitDate === selected)

  async function handleSubmit(e) {
    e.preventDefault()
    await createAction({
      welfareWorkerId,
      seniorId: Number(form.seniorId),
      actionType: 'VISIT',
      actionSubject: 'WELFARE_WORKER',
      status: 'PENDING',
      dueDate: selected,
      note: form.note || form.purpose || '방문 조치',
    })
    await load()
    setShowModal(false)
    setForm({ seniorId: '', visitTime: '', purpose: '', note: '' })
  }

  async function handleStatus(id, status) {
    await updateActionStatus(id, status)
    await load()
  }

  async function handleDelete(id) {
    await deleteAction(id)
    await load()
  }

  const cells = buildCells()
  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div>
      <h1 className="page-title">방문 일정</h1>

      <div className="schedule-toolbar">
        <div className="month-nav">
          <button onClick={prevMonth}>‹</button>
          <span>{year}년 {month}월</span>
          <button onClick={nextMonth}>›</button>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ 일정 등록</button>
      </div>

      <div className="schedule-layout">
        <div className="calendar">
          <div className="calendar-header">{DAYS.map(d => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {cells.map((c, i) => {
              const ds = c.curr ? dateStr(c.day) : null
              const dow = i % 7
              return (
                <div key={i}
                  className={['calendar-cell', !c.curr && 'other-month', ds === todayStr && 'today', ds === selected && 'selected', dow === 0 && 'sunday', dow === 6 && 'saturday'].filter(Boolean).join(' ')}
                  onClick={() => c.curr && setSelected(ds)}>
                  <div className="cell-day">{c.day}</div>
                  {c.curr && getEventsForDay(c.day).slice(0, 2).map(s => (
                    <div key={s.id} className={`calendar-event ${s.status?.toLowerCase()}`}>{s.purpose}</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        <div className="schedule-panel">
          <div className="card-title">{selected} 일정 ({selectedSchedules.length})</div>
          {selectedSchedules.length === 0 ? (
            <div className="empty-state">일정이 없습니다</div>
          ) : selectedSchedules.map(s => (
            <div className="schedule-item" key={s.id}>
              <div className="schedule-time">{s.visitTime || '시간 미정'}</div>
              <div className="schedule-body">{s.purpose}</div>
              {s.productName && <div className="schedule-product">대상 제품: {s.productName}</div>}
              <div className="schedule-actions">
                {!['COMPLETED', 'CANCELLED'].includes(s.status) && <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleStatus(s.id, 'COMPLETED')}>완료</button>}
                <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleDelete(s.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selected} 일정 등록</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">님 ID</label><input className="form-input" value={form.seniorId} onChange={e => setForm(p => ({ ...p, seniorId: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">방문 시간</label><input className="form-input" type="time" value={form.visitTime} onChange={e => setForm(p => ({ ...p, visitTime: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">방문 목적</label><input className="form-input" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">메모</label><input className="form-input" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} /></div>
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
