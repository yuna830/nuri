import '../../css/common/AiDecisionNotice.css';

const NOTICE_MESSAGES = {
  safety:
    'AI 분석 결과는 위험 신호를 조기에 발견하기 위한 참고 정보이며, 의료·행정적 판단이나 복지 수급 자격을 확정하지 않습니다. 최종 판단은 담당 기관 또는 복지사가 수행합니다.',
  welfare:
    '안내 내용은 공식 문서를 기반으로 생성되지만 정책 변경이나 개인 상황에 따라 달라질 수 있습니다. 실제 신청 가능 여부는 담당 기관에 최종 확인해 주세요.',
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
        AI 결과 이용 안내
      </strong>

      <p>{message}</p>
    </aside>
  );
}
