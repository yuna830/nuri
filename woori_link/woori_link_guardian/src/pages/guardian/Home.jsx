import { useEffect, useState } from 'react';
import { getSeniorsByGuardian, getLatestRisk, assessRisk } from '../../api/guardianApi.js';
import '../../css/guardian/Home.css';

const RISK_LABEL = { HIGH: '위험', MEDIUM: '주의', LOW: '안전' };
const RISK_BADGE = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };

export default function Home() {
  const [seniors, setSeniors] = useState([]);
  const [risks, setRisks] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSeniorsByGuardian()
      .then(({ data }) => {
        setSeniors(data);
        return data;
      })
      .then((data) => {
        const promises = data.map((s) =>
          getLatestRisk(s.id)
            .then((r) => ({ id: s.id, risk: r.data }))
            .catch(() => ({ id: s.id, risk: null }))
        );
        return Promise.all(promises);
      })
      .then((results) => {
        const map = {};
        results.forEach(({ id, risk }) => { map[id] = risk; });
        setRisks(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAssess = async (seniorId) => {
    const { data } = await assessRisk(seniorId);
    setRisks((prev) => ({ ...prev, [seniorId]: data }));
  };

  if (loading) return <div className="empty-state">불러오는 중...</div>;

  if (selected) {
    const s = seniors.find((x) => x.id === selected);
    const r = risks[selected];
    return (
      <div>
        <div className="detail-header">
          <button className="back-btn" onClick={() => setSelected(null)}>← 목록으로</button>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>{s.name} 상세</h2>
        </div>
        <div className="detail-grid">
          <div className="card">
            <div className="card-title">기본 정보</div>
            {[
              ['이름', s.name],
              ['나이', `${s.age}세`],
              ['주소', s.address],
              ['연락처', s.phone],
              ['가구유형', s.householdType || '-'],
              ['장기요양등급', s.longTermCare ? `${s.longTermCare}등급` : '-'],
              ['장애등급', s.disabilityGrade ? `${s.disabilityGrade}급` : '-'],
            ].map(([label, value]) => (
              <div className="info-row" key={label}>
                <span className="info-label">{label}</span>
                <span className="info-value">{value}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">위험도 평가</div>
            {r ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <span className={`badge ${RISK_BADGE[r.level]}`}>{RISK_LABEL[r.level]}</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    {r.totalScore}점
                  </span>
                </div>
                <div className="risk-bar-wrap">
                  <div className="risk-bar">
                    <div
                      className={`risk-bar-fill ${r.level?.toLowerCase()}`}
                      style={{ width: `${Math.min(r.totalScore, 100)}%` }}
                    />
                  </div>
                </div>
                {r.riskReason && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{r.riskReason}</p>
                )}
                <div style={{ marginTop: 12 }}>
                  <div className="checklist-item">
                    <span className={`check-icon ${r.weatherRisk ? 'done' : 'todo'}`}>
                      {r.weatherRisk ? '!' : '-'}
                    </span>
                    기상특보 위험 {r.weatherRisk ? '있음' : '없음'}
                  </div>
                  <div className="checklist-item">
                    <span className={`check-icon ${r.recallRisk ? 'done' : 'todo'}`}>
                      {r.recallRisk ? '!' : '-'}
                    </span>
                    리콜 제품 {r.recallRisk ? '있음' : '없음'}
                  </div>
                  <div className="checklist-item">
                    <span className={`check-icon ${r.voucherUnapplied ? 'done' : 'todo'}`}>
                      {r.voucherUnapplied ? '!' : '-'}
                    </span>
                    에너지바우처 미신청 {r.voucherUnapplied ? '있음' : '없음'}
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 16, width: '100%' }}
                  onClick={() => handleAssess(s.id)}
                >
                  재평가
                </button>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p style={{ marginBottom: 12 }}>평가 결과가 없습니다.</p>
                <button className="btn-primary" onClick={() => handleAssess(s.id)}>위험도 평가하기</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">담당 어르신 현황</h1>
      {seniors.length === 0 ? (
        <div className="empty-state">담당 어르신이 없습니다.</div>
      ) : (
        <div className="senior-grid">
          {seniors.map((s) => {
            const r = risks[s.id];
            return (
              <div className="senior-card" key={s.id} onClick={() => setSelected(s.id)}>
                <div className="senior-card-body">
                  <div className="senior-card-name">{s.name}</div>
                  <div className="senior-card-sub">{s.age}세 · {s.address}</div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">위험도</span>
                    {r ? (
                      <span className={`badge ${RISK_BADGE[r.level]}`}>{RISK_LABEL[r.level]}</span>
                    ) : (
                      <span className="text-muted">미평가</span>
                    )}
                  </div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">에너지바우처</span>
                    <span>{s.energyVoucherApplied ? '신청완료' : <span className="text-danger">미신청</span>}</span>
                  </div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">가구유형</span>
                    <span>{s.householdType || '-'}</span>
                  </div>
                </div>
                <div className="senior-card-footer">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {r ? `${r.totalScore}점` : '-'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>상세보기 →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
