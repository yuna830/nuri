import '../../css/common/AiDecisionNotice.css';

const NOTICE_MESSAGES = {
  safety:
    'AI 분석은 위험 신호 확인을 돕는 참고 정보입니다. 의료·행정 판단과 복지 자격은 담당 기관 또는 복지사가 최종 확인합니다.',
  welfare:
    '공식 문서 기반 AI 안내이며, 정책·개인 상황에 따라 달라질 수 있어 신청 전 담당 기관 확인이 필요합니다.',
};

export default function AiDecisionNotice({
  type = 'safety',
  className = '',
}) {
  const message = NOTICE_MESSAGES[type] ?? NOTICE_MESSAGES.safety;

  return (
    <aside
      className={[
        'ai-decision-notice',
        `ai-decision-notice--${type}`,
        className,
      ].filter(Boolean).join(' ')}
      role="note"
      aria-label="AI 결과 이용 안내"
    >
      <strong className="ai-decision-notice__label">
        AI 안내
      </strong>

      <p>{message}</p>
    </aside>
  );
}
