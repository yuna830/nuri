import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../css/welfare/Dashboard.css'
import { getSeniorsByWelfareWorker } from '../../api/seniorApi'
import { getHighRisk, assessAll } from '../../api/riskApi'
import { getActionsByWelfareWorker } from '../../api/actionApi'
import { getProductsBySenior, getRecalledProductsByWelfareWorker } from '../../api/recallApi'
import { getEnergySupportCandidates } from '../../api/energySupportApi'
import { getUserId } from '../../utils/auth'
import { filterProductsByRecallRequests } from '../../utils/recallRequestFilter'

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']
const TYPE_LABEL = {
  RECALL: '리콜 조치',
  VOUCHER: '에너지바우처',
  ELECTRICITY_DISCOUNT: '전기요금 할인',
  GAS_CHECK: '가스 점검',
  ELECTRIC_CHECK: '전기 점검',
  VISIT: '방문 일정',
  SOS: '긴급 확인',
  OTHER: '복지 상담',
}

const dateOnly = value => value ? String(value).slice(0, 10) : ''
const todayString = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dueLabel(action, today) {
  const due = dateOnly(action.dueDate)
  if (!due) return '예정일 미지정'
  const days = Math.round(
    (new Date(`${today}T00:00:00`) - new Date(`${due}T00:00:00`)) / 86400000,
  )
  if (days > 0) return `${days}일 지남`
  if (days === 0) return '오늘까지'
  return `${Math.abs(days)}일 후`
}

function activityTime(value, today) {
  if (!value) return '시간 미확인'
  const date = new Date(value)
  const day = dateOnly(value)
  if (day === today) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  const yesterday = new Date(`${today}T00:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === dateOnly(yesterday.toISOString())) return '어제'
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [seniors, setSeniors] = useState([])
  const [highRisk, setHighRisk] = useState([])
  const [actions, setActions] = useState([])
  const [recalled, setRecalled] = useState([])
  const [energyCandidates, setEnergyCandidates] = useState([])
  const [assessing, setAssessing] = useState(false)
  const today = todayString()
  const initialDate = new Date(`${today}T00:00:00`)
  const [calendarYear, setCalendarYear] = useState(initialDate.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(initialDate.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(today)
  const [openScheduleDate, setOpenScheduleDate] = useState(null)

  useEffect(() => {
    if (!openScheduleDate) return undefined

    const closePopoverOnOutsideClick = event => {
      if (
        event.target.closest('.calendar-popover')
        || event.target.closest('.mini-calendar-cell > button')
      ) {
        return
      }
      setOpenScheduleDate(null)
    }

    document.addEventListener('mousedown', closePopoverOnOutsideClick)
    return () => {
      document.removeEventListener('mousedown', closePopoverOnOutsideClick)
    }
  }, [openScheduleDate])

  useEffect(() => {
    const welfareWorkerId = getUserId()
    if (!welfareWorkerId) return

    async function loadDashboard() {
      const [seniorResult, actionResult, riskResult, energyResults] = await Promise.all([
        getSeniorsByWelfareWorker(welfareWorkerId).catch(() => ({ data: [] })),
        getActionsByWelfareWorker(welfareWorkerId).catch(() => ({ data: [] })),
        getHighRisk().catch(() => ({ data: [] })),
        Promise.all(
          ['VOUCHER', 'ELECTRICITY', 'GAS'].map(type =>
            getEnergySupportCandidates(welfareWorkerId, type, 'ACTIVE')
              .then(response => (Array.isArray(response.data) ? response.data : [])
                .map(item => ({ ...item, supportType: item.supportType || type })))
              .catch(() => []),
          ),
        ),
      ])

      const loadedSeniors = Array.isArray(seniorResult.data) ? seniorResult.data : []
      const loadedActions = Array.isArray(actionResult.data) ? actionResult.data : []
      setSeniors(loadedSeniors)
      setActions(loadedActions)
      setHighRisk(Array.isArray(riskResult.data) ? riskResult.data : [])
      setEnergyCandidates(energyResults.flat())

      const recalledResult = await getRecalledProductsByWelfareWorker(welfareWorkerId)
        .catch(() => ({ data: [] }))
      if (Array.isArray(recalledResult.data) && recalledResult.data.length > 0) {
        setRecalled(filterProductsByRecallRequests(recalledResult.data, loadedActions))
        return
      }
      const productResults = await Promise.all(
        loadedSeniors.map(senior =>
          getProductsBySenior(senior.id).catch(() => ({ data: [] }))),
      )
      const products = productResults
        .flatMap(result => Array.isArray(result.data) ? result.data : [])
        .filter(product =>
          product.recallDecisionStatus === 'RECALL_CONFIRMED'
          || (!product.recallDecisionStatus && product.recallStatus === 'RECALLED'))
      setRecalled(filterProductsByRecallRequests(products, loadedActions))
    }

    loadDashboard()
  }, [])

  const seniorById = useMemo(
    () => new Map(seniors.map(senior => [Number(senior.id), senior])),
    [seniors],
  )
  const assignedIds = useMemo(
    () => new Set(seniors.map(senior => Number(senior.id))),
    [seniors],
  )
  const assignedHighRisk = useMemo(
    () => highRisk
      .filter(item => assignedIds.has(Number(item.seniorId)) && Number(item.totalScore || 0) >= 30)
      .sort((a, b) => Number(b.totalScore || 0) - Number(a.totalScore || 0)),
    [assignedIds, highRisk],
  )
  const activeActions = actions.filter(action => !TERMINAL_STATUSES.includes(action.status))
  const todayVisits = activeActions.filter(
    action => action.actionType === 'VISIT' && dateOnly(action.dueDate) === today,
  )
  const todayContacts = activeActions.filter(
    action => action.actionType !== 'VISIT' && dateOnly(action.dueDate) === today,
  )
  const overdueActions = activeActions
    .filter(action => action.dueDate && dateOnly(action.dueDate) < today)
    .sort((a, b) => dateOnly(a.dueDate).localeCompare(dateOnly(b.dueDate)))
  const newCandidates = energyCandidates.filter(candidate =>
    !candidate.status || candidate.status === 'CONFIRMATION_NEEDED')
  const visitActions = actions.filter(action =>
    action.actionType === 'VISIT' && action.dueDate)
  const selectedVisits = visitActions.filter(action =>
    dateOnly(action.dueDate) === selectedDate)
  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay()
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate()
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  function seniorName(item) {
    return item.seniorName || seniorById.get(Number(item.seniorId))?.name || '대상자'
  }

  function goToAction(action) {
    if (action.actionType === 'VISIT') navigate('/welfare/schedule')
    else if (action.actionType === 'RECALL') navigate('/welfare/recalled')
    else if (['VOUCHER', 'ELECTRICITY_DISCOUNT'].includes(action.actionType)) {
      navigate('/welfare/energy-voucher')
    } else if (action.seniorId) navigate(`/welfare/seniors/${action.seniorId}`)
  }

  async function handleAssessAll() {
    setAssessing(true)
    try {
      await assessAll()
      const response = await getHighRisk()
      setHighRisk(Array.isArray(response.data) ? response.data : [])
    } finally {
      setAssessing(false)
    }
  }

  const workItems = [
    ['오늘 방문', todayVisits.length, '오늘 예정된 방문 일정', () => navigate('/welfare/schedule')],
    ['오늘 연락', todayContacts.length, '오늘 연락하거나 확인할 대상', () => navigate('/welfare/energy-voucher')],
    ['기한 지난 업무', overdueActions.length, '예정일이 지난 미완료 조치', () => overdueActions[0] && goToAction(overdueActions[0])],
    ['신규 확인 업무', newCandidates.length, '처음 확인해야 하는 에너지복지 업무', () => navigate('/welfare/energy-voucher')],
  ]

  function changeCalendarMonth(offset) {
    const next = new Date(calendarYear, calendarMonth - 1 + offset, 1)
    setCalendarYear(next.getFullYear())
    setCalendarMonth(next.getMonth() + 1)
    setSelectedDate(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
    )
    setOpenScheduleDate(null)
  }

  function calendarDate(day) {
    return `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function calendarTone(day) {
    const date = calendarDate(day)
    const visits = visitActions.filter(action => dateOnly(action.dueDate) === date)
    if (visits.some(action => action.immediateRisk === true || action.priority === 'HIGH')) return 'urgent'
    if (visits.some(action => !TERMINAL_STATUSES.includes(action.status) && date < today)) return 'overdue'
    return visits.length > 0 ? 'scheduled' : ''
  }

  return (
    <div className="welfare-dashboard">
      <div className="dashboard-heading">
        <div>
          <h1 className="page-title">대시보드</h1>
        </div>
      </div>

      <div className="dashboard-stats">
        {[
          ['전체 대상자', seniors.length, '/welfare/seniors', 'normal'],
          ['우선 확인 후보', assignedHighRisk.length, '/welfare/seniors', 'danger'],
          ['에너지복지 미처리 건', energyCandidates.length, '/welfare/energy-voucher', 'warning'],
          ['리콜 조치 요청', recalled.length, '/welfare/recalled', 'danger'],
        ].map(([label, value, path, tone]) => (
          <button key={label} type="button" className={`stat-card ${tone}`} onClick={() => navigate(path)}>
            <span className="label">{label}</span>
            <strong className="value">{value}</strong>
          </button>
        ))}
      </div>

      <section className="dashboard-panel dashboard-workspace">
        <div className="dashboard-work-column">
          <h2>오늘의 업무</h2>
          <div className="today-work-list">
            {workItems.map(([label, count, , onClick]) => (
              <button type="button" key={label} onClick={onClick}>
                <span>{label}</span>
                <strong>{count}건</strong>
                <b>›</b>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-calendar-column">
          <div className="mini-calendar-heading">
            <h2>{calendarYear}년 {calendarMonth}월 방문 일정</h2>
            <div>
              <button type="button" aria-label="이전 달" onClick={() => changeCalendarMonth(-1)}>‹</button>
              <button type="button" aria-label="다음 달" onClick={() => changeCalendarMonth(1)}>›</button>
            </div>
          </div>
          <div className="mini-calendar">
            <div className="mini-calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="mini-calendar-days">
              {calendarCells.map((day, index) => day ? (
                <div className="mini-calendar-cell" key={day}>
                  <button
                    type="button"
                    className={[
                      calendarDate(day) === today ? 'today' : '',
                      calendarDate(day) === selectedDate ? 'selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      const date = calendarDate(day)
                      setSelectedDate(date)
                      setOpenScheduleDate(previous => previous === date ? null : date)
                    }}
                  >
                    <span>{day}</span>
                    {calendarTone(day) && <i className={calendarTone(day)} />}
                  </button>

                  {openScheduleDate === calendarDate(day) && (
                    <div className="calendar-popover">
                      <strong>{calendarMonth}월 {day}일 일정</strong>
                      {selectedVisits.length === 0 ? (
                        <p>방문 일정이 없습니다.</p>
                      ) : selectedVisits.map(action => (
                        <button type="button" key={action.id} onClick={() => goToAction(action)}>
                          <b>{action.visitTime || '시간 미정'}</b>
                          <span>{seniorName(action)} · {action.note || '방문 일정'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : <span key={`empty-${index}`} />)}
            </div>
          </div>
          <div className="calendar-legend">
            <span><i className="scheduled" />방문 예정</span>
            <span><i className="overdue" />기한 초과</span>
            <span><i className="urgent" />긴급 일정</span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-management">
        <div className="dashboard-priority-column">
          <div className="dashboard-panel-heading">
            <h2>우선 확인 대상자</h2>
            <button type="button" onClick={handleAssessAll} disabled={assessing}>
              {assessing ? '산정 중' : '다시 산정'}
            </button>
          </div>
          {assignedHighRisk.length === 0 ? (
            <div className="dashboard-empty">우선 확인 대상자가 없습니다.</div>
          ) : (
            <div className="dashboard-list">
              {assignedHighRisk.slice(0, 5).map(item => {
                const related = activeActions.find(action => Number(action.seniorId) === Number(item.seniorId))
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="priority-person-row"
                    onClick={() => navigate(`/welfare/seniors/${item.seniorId}`)}
                  >
                    <div><strong>{item.seniorName} · {item.seniorAge}세</strong><small>{String(item.riskReason || '-').replaceAll(' + ', ' · ')}</small></div>
                    <span>{related ? (TYPE_LABEL[related.actionType] || '조치 예정') : '확인 필요'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="dashboard-overdue-column">
          <h2>기한 지난 업무</h2>
          {overdueActions.length === 0 ? (
            <div className="dashboard-empty">현재 지연된 조치가 없습니다.</div>
          ) : (
            <div className="dashboard-list">
              {overdueActions.slice(0, 5).map(action => (
                <button type="button" key={action.id} className="overdue-row" onClick={() => goToAction(action)}>
                  <span>{TYPE_LABEL[action.actionType] || '후속 조치'}</span>
                  <div><strong>{seniorName(action)}</strong><small>{action.note || '조치 내용 확인 필요'}</small></div>
                  <b>{dueLabel(action, today)}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
