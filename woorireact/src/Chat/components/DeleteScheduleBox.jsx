import { formatDateKorean, formatScheduleBrief } from "../utils/scheduleText";

export default function DeleteScheduleBox({
  pendingDelete,
  onCancel,
  onDeleteOne,
  onDeleteAll,
}) {
  if (!pendingDelete) return null;

  return (
    <div className="chat-schedule-confirm">
      <p>{formatDateKorean(pendingDelete.date)} 일정 중 무엇을 삭제할까요?</p>
      <div className="pending-delete-list">
        {pendingDelete.schedules.map((schedule) => (
          <button
            key={schedule.id}
            type="button"
            onClick={() => onDeleteOne(schedule.id)}
          >
            {formatScheduleBrief(schedule)}
          </button>
        ))}
      </div>
      <div>
        <button type="button" onClick={onCancel}>취소</button>
        <button type="button" className="danger" onClick={onDeleteAll}>
          전체 삭제
        </button>
      </div>
    </div>
  );
}
