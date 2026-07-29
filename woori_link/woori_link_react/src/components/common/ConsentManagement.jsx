import { useMemo, useState } from 'react';

import '../../css/common/ConsentManagement.css';

const ROLE_ITEMS = {
  guardian: [
    { key: 'guardianPrivacy', label: '보호자 개인정보 수집·이용', description: '계정 운영과 어르신 연결을 위해 이름, 연락처, 관계 정보를 처리합니다.', required: true },
    { key: 'guardianConsultation', label: '상담 및 조치 기록 저장', description: '복지사 상담 요청과 처리 결과를 서비스에 보관합니다.', required: true },
    { key: 'guardianAi', label: 'AI 분석 결과 이용', description: '안부·위험 신호와 맞춤 복지 안내를 보호자 화면에 제공합니다.' },
    { key: 'guardianExternalAi', label: '외부 AI 서비스 전송', description: '분석에 필요한 최소 정보만 비식별화하여 외부 AI 서비스에 전송합니다.' },
  ],
  welfare: [
    { key: 'workerPrivacy', label: '업무 계정 개인정보 처리', description: '본인 확인과 기관 업무 수행을 위해 계정 정보를 처리합니다.', required: true },
    { key: 'workerRecords', label: '상담·후속조치 기록 저장', description: '대상자 보호와 업무 인계를 위해 상담 및 조치 이력을 보관합니다.', required: true },
    { key: 'workerSharing', label: '기관 내 업무 기록 공유', description: '배정된 담당자와 관리자에게 필요한 업무 기록을 공유합니다.', required: true },
    { key: 'workerAi', label: 'AI 업무 보조 기능 이용', description: '위험 신호 요약과 복지 정보 검토를 위한 AI 보조 기능을 사용합니다.' },
  ],
};

function readStored(role, items) {
  try {
    const saved = JSON.parse(localStorage.getItem(`woori-consents-${role}`) || '{}');
    return Object.fromEntries(items.map((item) => [
      item.key,
      item.required ? true : saved[item.key]?.agreed !== false,
    ]));
  } catch {
    return Object.fromEntries(items.map((item) => [item.key, true]));
  }
}

export default function ConsentManagement({ role = 'guardian', embedded = false }) {
  const items = useMemo(() => ROLE_ITEMS[role] ?? ROLE_ITEMS.guardian, [role]);
  const [values, setValues] = useState(() => readStored(role, items));
  const [updatedAt, setUpdatedAt] = useState('');

  function updateConsent(item, agreed) {
    if (item.required) return;

    const next = { ...values, [item.key]: agreed };
    const changedAt = new Date().toISOString();
    setValues(next);
    setUpdatedAt(changedAt);

    const records = Object.fromEntries(items.map((entry) => [
      entry.key,
      {
        agreed: entry.required ? true : next[entry.key] !== false,
        required: Boolean(entry.required),
        policyVersion: '2026.07',
        updatedAt: entry.key === item.key ? changedAt : null,
      },
    ]));
    localStorage.setItem(`woori-consents-${role}`, JSON.stringify(records));
  }

  return (
    <section
      className={`consent-management ${embedded ? 'consent-management--embedded' : ''}`}
      aria-labelledby={`${role}-consent-title`}
    >
      <header className="consent-management__header">
        <div>
          <h2 id={`${role}-consent-title`}>개인정보 및 동의 관리</h2>
          <p>수집 목적과 이용 범위를 확인하고 선택 동의를 변경할 수 있습니다.</p>
        </div>
        <span>약관 버전 2026.07</span>
      </header>

      <div className="consent-management__list">
        {items.map((item) => {
          const agreed = values[item.key] !== false;
          return (
            <article className="consent-management__item" key={item.key}>
              <div className="consent-management__copy">
                <div>
                  <strong>{item.label}</strong>
                  <span className={item.required ? 'required' : 'optional'}>
                    {item.required ? '필수' : '선택'}
                  </span>
                </div>
                <p>{item.description}</p>
              </div>

              <label className={`consent-management__toggle ${agreed ? 'is-on' : ''} ${item.required ? 'is-locked' : ''}`}>
                <input
                  type="checkbox"
                  checked={agreed}
                  disabled={item.required}
                  onChange={(event) => updateConsent(item, event.target.checked)}
                  aria-label={`${item.label} ${agreed ? '동의' : '미동의'}`}
                />
                <span aria-hidden="true"><i /></span>
                <b>{agreed ? '동의' : '미동의'}</b>
              </label>
            </article>
          );
        })}
      </div>

      <footer className="consent-management__footer">
        <span>ⓘ</span>
        <p>
          선택 동의는 언제든 철회할 수 있습니다. 필수 동의 철회와 개인정보 삭제는 계정 탈퇴 절차에서 처리됩니다.
          {updatedAt && ` 최근 변경 ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(updatedAt))}`}
        </p>
      </footer>
    </section>
  );
}
