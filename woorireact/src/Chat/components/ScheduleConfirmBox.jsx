import { scheduleToText } from "../utils/scheduleText";

export default function ScheduleConfirmBox({
  schedule,
  onCancel,
  onConfirm,
  onChooseMeridiem,
}) {
  if (!schedule) return null;

  if (schedule.ambiguousTime) {
    return (
      <div className="chat-schedule-confirm">
        <p>오전과 오후 중 언제인가요?</p>
        <strong>{scheduleToText(schedule)}</strong>
        <div>
          <button type="button" onClick={onCancel}>취소</button>
          <button type="button" onClick={() => onChooseMeridiem("오전")}>오전</button>
          <button type="button" onClick={() => onChooseMeridiem("오후")}>오후</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-schedule-confirm">
      <p>이 일정으로 등록할까요?</p>
      <strong>{scheduleToText(schedule)}</strong>
      <div>
        <button type="button" onClick={onCancel}>취소</button>
        <button type="button" onClick={onConfirm}>등록</button>
      </div>
    </div>
  );
}
