import { useRef, useState } from "react";

export default function TodaySchedulePanel({
  schedules,
  selectedDate,
  onDateChange,
  onScheduleOpen,
  onScheduleEdit,
  onScheduleDelete,
}) {

  const panelRef = useRef(null);
  const [showAll, setShowAll] = useState(false);
  const visibleSchedules = showAll ? schedules : schedules.slice(0, 3);
  const hasMore = schedules.length > 3;

  const scrollPanelToTop = () => {
    panelRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const toggleSchedules = () => {
    if (showAll) {
      scrollPanelToTop();
      setShowAll(false);
      requestAnimationFrame(scrollPanelToTop);
      return;
    }

    setShowAll(true);
  };

  const handleDateChange = (event) => {
    setShowAll(false);
    scrollPanelToTop();
    onDateChange(event.target.value);
  };

  return (
    <aside ref={panelRef} className={`schedule-list-panel ${showAll ? "expanded" : ""}`}>

      <button className="chatbot-sub-action schedule-panel-action" type="button" onClick={onScheduleOpen}>
        일정 등록하기
      </button>

      <div className="schedule-list-head">
        <h2>등록된 일정</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
        />
      </div>

      {schedules.length === 0 ? (
        <p>선택한 날짜에 등록된 일정이 없어요.</p>
      ) : (
        visibleSchedules.map((schedule) => (
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

      {hasMore && (
        <button
          type="button"
          className="schedule-more-button"
          onClick={toggleSchedules}
        >
          {showAll ? "접기" : `더보기 ${schedules.length - 3}개`}
        </button>
      )}
    </aside>
  );
}
