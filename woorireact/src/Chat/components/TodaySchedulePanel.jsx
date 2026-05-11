export default function TodaySchedulePanel({
  schedules,
  selectedDate,
  onDateChange,
  onScheduleEdit,
  onScheduleDelete,
}) {
  return (
    <aside className="schedule-list-panel">
      <div className="schedule-list-head">
        <h2>등록된 일정</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>

      {schedules.length === 0 ? (
        <p>선택한 날짜에 등록된 일정이 없어요.</p>
      ) : (
        schedules.map((schedule) => (
          <article key={schedule.id} className="saved-schedule-card">
            <p>{schedule.text}</p>
            <div className="saved-schedule-actions">
              <button type="button" onClick={() => onScheduleEdit(schedule)}>수정</button>
              <button
                type="button"
                className="danger"
                onClick={() => onScheduleDelete(schedule.id)}
              >
                삭제
              </button>
            </div>
          </article>
        ))
      )}
    </aside>
  );
}
