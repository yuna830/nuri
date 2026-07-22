import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GuardianLayout from './GuardianLayout.jsx';
import { askGuardianRag } from '../../api/guardianHomeApi.js';
import { getSeniorsByGuardian } from '../../api/guardianApi.js';
import '../../css/guardian/WelfareAssistant.css';
import '../../css/guardian/WelfareAssistantProfile.css';

const SUGGESTIONS = [
  { icon: '₩', title: '에너지바우처', question: '에너지바우처 신청 조건과 필요한 서류를 알려주세요.' },
  { icon: '⚡', title: '전기요금 감면', question: '전기요금 복지할인 대상과 신청 방법을 알려주세요.' },
  { icon: '♨', title: '도시가스 경감', question: '도시가스요금 경감 대상과 신청 서류를 알려주세요.' },
  { icon: '!', title: '리콜 대응', question: '리콜 제품을 발견하면 어떻게 조치해야 하나요?' },
];

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: '안녕하세요. 복지제도, 요금감면, 제품 리콜과 생활안전 정보를 공식 문서에 근거해 안내해 드립니다. 궁금한 내용을 입력해 주세요.',
  sources: [],
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function buildWelfareProfile(senior) {
  if (!senior) return null;
  const benefitStatuses = [
    senior.livelihoodBenefit && '생계급여',
    senior.medicalBenefit && '의료급여',
    senior.housingBenefit && '주거급여',
    senior.educationBenefit && '교육급여',
  ].filter(Boolean);
  const currentBenefits = [
    ...benefitStatuses,
    senior.energyVoucherApplied && '에너지바우처 신청',
    senior.electricityDiscountApplied && '전기요금 복지할인 신청',
    senior.gasDiscountApplied && '도시가스요금 경감 신청',
  ].filter(Boolean);

  return {
    name: senior.name ?? null,
    age: senior.age ?? null,
    gender: senior.gender ?? null,
    address: [senior.address, senior.detailAddress].filter(Boolean).join(' ') || null,
    region: senior.address ?? null,
    incomeLevel: senior.incomeLevel && senior.incomeLevel !== 'NONE' ? senior.incomeLevel : null,
    householdType: senior.householdType ?? null,
    livingAlone: senior.livingAlone ?? null,
    basicLivelihoodStatus: benefitStatuses.length ? benefitStatuses.join(', ') : null,
    disabilityStatus: senior.disabilityGrade ?? (senior.disabledHouseholdMember ? '장애 세대원 있음' : null),
    longTermCareGrade: senior.longTermCare ? '장기요양 해당' : null,
    currentBenefits,
    welfareMemo: senior.energyVoucherReason ?? null,
  };
}

function SourceList({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="welfare-chat__sources">
      <strong>근거 문서</strong>
      {sources.slice(0, 4).map((source, index) => {
        const label = (source.title || `근거 문서 ${index + 1}`)
          .replace(/\.md$/i, '')
          .replaceAll('_', ' ')
          .replace(/^["']|["']$/g, '');
        const meta = [source.authority, source.effectiveYear && `${source.effectiveYear}년`]
          .filter(Boolean)
          .join(' · ');
        return source.url ? (
          <a key={source.id || index} href={source.url} target="_blank" rel="noreferrer">
            {label}{meta && <small>{meta}</small>}
          </a>
        ) : (
          <span key={source.id || index}>{label}{meta && <small>{meta}</small>}</span>
        );
      })}
    </div>
  );
}

function AssessmentResult({ assessment }) {
  if (!assessment) return null;

  return (
    <div className="welfare-assessment">
      <p className="welfare-assessment__summary">{assessment.summary}</p>
      {!!assessment.profileFacts?.length && (
        <dl className="welfare-assessment__facts">
          {assessment.profileFacts.map((fact) => (
            <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>
      )}
      <div className="welfare-assessment__candidates">
        {assessment.candidates?.map((candidate) => (
          <section key={candidate.serviceId} className="welfare-assessment__candidate">
            <header>
              <strong>{candidate.serviceName}</strong>
              <span className={`welfare-assessment__status welfare-assessment__status--${candidate.status?.toLowerCase()}`}>
                {candidate.statusLabel}
              </span>
            </header>
            {!!candidate.matchedConditions?.length && (
              <div><b>확인된 조건</b><ul>{candidate.matchedConditions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            {!!candidate.missingConditions?.length && (
              <div><b>추가 확인 필요</b><ul>{candidate.missingConditions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            {!!candidate.conflictingConditions?.length && (
              <div><b>현재 정보와 맞지 않는 조건</b><ul>{candidate.conflictingConditions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            <p>{candidate.decisionReason}</p>
            <small>{candidate.applicationGuide}</small>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function WelfareAssistant() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [seniors, setSeniors] = useState([]);
  const [seniorLoading, setSeniorLoading] = useState(true);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const selectedSeniorId = searchParams.get('seniorId') || '';
  const selectedSenior = useMemo(
    () => seniors.find((senior) => String(senior.id) === selectedSeniorId) || null,
    [seniors, selectedSeniorId],
  );

  useEffect(() => {
    let active = true;
    getSeniorsByGuardian()
      .then((response) => { if (active) setSeniors(asArray(response.data)); })
      .catch(() => { if (active) setSeniors([]); })
      .finally(() => { if (active) setSeniorLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  const submitQuestion = async (value) => {
    const text = String(value || '').trim();
    if (!text || loading) return;

    const previousHistory = messages
      .filter((message) => message.id !== 'welcome')
      .map(({ role, text: messageText }) => ({ role, text: messageText }))
      .slice(-8);
    const userMessage = { id: `user-${Date.now()}`, role: 'user', text, sources: [] };

    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setError('');
    setLoading(true);

    try {
      const profile = buildWelfareProfile(selectedSenior);
      const result = await askGuardianRag(
        text,
        previousHistory,
        profile,
        'qa',
      );
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result.answer,
        sources: result.sources,
        assessment: result.assessment,
      }]);
    } catch (requestError) {
      setError(requestError.message || '답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitQuestion(question);
  };

  const selectSenior = (event) => {
    const seniorId = event.target.value;
    setSearchParams(seniorId ? { seniorId } : {});
    setMessages([INITIAL_MESSAGE]);
    setQuestion('');
    setError('');
  };

  return (
    <GuardianLayout activeMenu="welfare">
      <main className="welfare-assistant-page">
        <header className="welfare-assistant-page__header">
          <div>
            <h1>복지·안전 도우미</h1>
            <p>복지제도와 생활안전 정보를 근거 문서와 함께 안내합니다.</p>
          </div>
          <div className="welfare-assistant-page__actions">
            <label>
              <span>상담 대상</span>
              <select value={selectedSeniorId} onChange={selectSenior} disabled={seniorLoading}>
                <option value="">일반 질문</option>
                {seniors.map((senior) => (
                  <option value={senior.id} key={senior.id}>{senior.name} 어르신</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { setMessages([INITIAL_MESSAGE]); setError(''); }}>
              새 대화
            </button>
          </div>
        </header>

        <section className="welfare-assistant-shell">
          <aside className="welfare-assistant-guide">
            <div className="welfare-assistant-guide__intro">
              <i>W</i>
              <strong>무엇을 물어볼 수 있나요?</strong>
              <p>아래 항목을 선택하거나 직접 질문해 보세요.</p>
            </div>
            <div className="welfare-assistant-guide__suggestions">
              {SUGGESTIONS.map((item) => (
                <button type="button" key={item.title} onClick={() => submitQuestion(item.question)} disabled={loading}>
                  <b>{item.icon}</b>
                  <span><strong>{item.title}</strong><small>{item.question}</small></span>
                </button>
              ))}
            </div>
            <p className="welfare-assistant-guide__notice">
              자격 및 리콜 판정은 등록 정보와 공식 조회 결과를 기준으로 하며, 답변은 안내 목적으로 제공됩니다.
            </p>
          </aside>

          <div className="welfare-chat">
            {selectedSenior && (
              <div className="welfare-chat__subject">
                <div>
                  <b>{selectedSenior.name?.slice(0, 1) || '어'}</b>
                  <span>
                    <strong>{selectedSenior.name} 어르신 기준 상담</strong>
                    <small>
                      {selectedSenior.age ? `만 ${selectedSenior.age}세` : '나이 미입력'} · {' '}
                      {selectedSenior.livingAlone === true ? '독거' : selectedSenior.householdType || '가구형태 미입력'}
                    </small>
                  </span>
                </div>
                <p>등록 정보가 부족하면 대상 여부를 확정하지 않고 추가 확인 항목을 안내합니다.</p>
              </div>
            )}
            <div className="welfare-chat__messages" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className={`welfare-chat__message welfare-chat__message--${message.role}`}>
                  {message.role === 'assistant' && <span className="welfare-chat__avatar">W</span>}
                  <div>
                    {message.assessment
                      ? <AssessmentResult assessment={message.assessment} />
                      : <p>{message.text}</p>}
                    <SourceList sources={message.sources} />
                  </div>
                </article>
              ))}
              {loading && (
                <article className="welfare-chat__message welfare-chat__message--assistant">
                  <span className="welfare-chat__avatar">W</span>
                  <div className="welfare-chat__typing"><i /><i /><i /><span>관련 문서를 확인하고 있습니다.</span></div>
                </article>
              )}
              <div ref={endRef} />
            </div>

            {error && <div className="welfare-chat__error">{error}</div>}

            <form className="welfare-chat__composer" onSubmit={handleSubmit}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion(question);
                  }
                }}
                placeholder="궁금한 복지·안전 정보를 입력해 주세요."
                maxLength={500}
                rows={1}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !question.trim()} aria-label="질문 보내기">→</button>
            </form>
            <small className="welfare-chat__caption">정확한 자격 판정은 행정복지센터 또는 해당 기관에서 최종 확인해 주세요.</small>
          </div>
        </section>
      </main>
    </GuardianLayout>
  );
}
