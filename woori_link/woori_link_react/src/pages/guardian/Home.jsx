import { useEffect, useState } from 'react';
import { assessRisk, getLatestRisk, getSeniorsByGuardian } from '../../api/guardianApi.js';
import '../../css/guardian/Home.css';
import CareStatusPanel from './CareStatusPanel.jsx';

const RISK_LABEL = { HIGH: '위험', MEDIUM: '주의', LOW: '안전' };
const RISK_BADGE = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };

export default function GuardianHome() {
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
        const promises = data.map((senior) =>
          getLatestRisk(senior.id)
            .then((risk) => ({ id: senior.id, risk: risk.data }))
            .catch(() => ({ id: senior.id, risk: null }))
        );
        return Promise.all(promises);
      })
      .then((results) => {
        const map = {};
        results.forEach(({ id, risk }) => {
          map[id] = risk;
        });
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
    const senior = seniors.find((item) => item.id === selected);
    const risk = risks[selected];

    return (
      <div>
        <div className="detail-header">
          <button className="back-btn" onClick={() => setSelected(null)}>← 목록으로</button>
          <h2 className="guardian-detail-title">{senior.name} 상세</h2>
        </div>
        <div className="detail-grid">
          <div className="card">
            <div className="card-title">기본 정보</div>
            {[
              ['이름', senior.name],
              ['나이', `${senior.age}세`],
              ['주소', senior.address],
              ['연락처', senior.phone],
              ['가구유형', senior.householdType || '-'],
              ['장기요양등급', senior.longTermCare ? `${senior.longTermCare}등급` : '-'],
              ['장애등급', senior.disabilityGrade ? `${senior.disabilityGrade}급` : '-'],
            ].map(([label, value]) => (
              <div className="info-row" key={label}>
                <span className="info-label">{label}</span>
                <span className="info-value">{value}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">위험도 평가</div>
            {risk ? (
              <>
                <div className="risk-summary">
                  <span className={`badge ${RISK_BADGE[risk.level]}`}>{RISK_LABEL[risk.level]}</span>
                  <span>{risk.totalScore}점</span>
                </div>
                <div className="risk-bar-wrap">
                  <div className="risk-bar">
                    <div
                      className={`risk-bar-fill ${risk.level?.toLowerCase()}`}
                      style={{ width: `${Math.min(risk.totalScore, 100)}%` }}
                    />
                  </div>
                </div>
                {risk.riskReason && <p className="risk-reason">{risk.riskReason}</p>}
                <div className="risk-checklist">
                  <div className="checklist-item">
                    <span className={`check-icon ${risk.weatherRisk ? 'done' : 'todo'}`}>
                      {risk.weatherRisk ? '!' : '-'}
                    </span>
                    기상특보 위험 {risk.weatherRisk ? '있음' : '없음'}
                  </div>
                  <div className="checklist-item">
                    <span className={`check-icon ${risk.recallRisk ? 'done' : 'todo'}`}>
                      {risk.recallRisk ? '!' : '-'}
                    </span>
                    리콜 제품 {risk.recallRisk ? '있음' : '없음'}
                  </div>
                  <div className="checklist-item">
                    <span className={`check-icon ${risk.voucherUnapplied ? 'done' : 'todo'}`}>
                      {risk.voucherUnapplied ? '!' : '-'}
                    </span>
                    에너지바우처 미신청 {risk.voucherUnapplied ? '있음' : '없음'}
                  </div>
                </div>
                <button className="btn-primary guardian-full-button" onClick={() => handleAssess(senior.id)}>
                  재평가
                </button>
              </>
            ) : (
              <div className="empty-state guardian-empty-state">
                <p>평가 결과가 없습니다.</p>
                <button className="btn-primary" onClick={() => handleAssess(senior.id)}>위험도 평가하기</button>
              </div>
            )}
          </div>
          <CareStatusPanel seniorId={senior.id} />
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
          {seniors.map((senior) => {
            const risk = risks[senior.id];
            return (
              <div className="senior-card" key={senior.id} onClick={() => setSelected(senior.id)}>
                <div className="senior-card-body">
                  <div className="senior-card-name">{senior.name}</div>
                  <div className="senior-card-sub">{senior.age}세 · {senior.address}</div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">위험도</span>
                    {risk ? (
                      <span className={`badge ${RISK_BADGE[risk.level]}`}>{RISK_LABEL[risk.level]}</span>
                    ) : (
                      <span className="text-muted">미평가</span>
                    )}
                  </div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">에너지바우처</span>
                    <span>{senior.energyVoucherApplied ? '신청완료' : <span className="text-danger">미신청</span>}</span>
                  </div>
                  <div className="senior-card-row">
                    <span className="senior-card-label">가구유형</span>
                    <span>{senior.householdType || '-'}</span>
                  </div>
                </div>
                <div className="senior-card-footer">
                  <span className="senior-score">{risk ? `${risk.totalScore}점` : '-'}</span>
                  <span className="senior-detail-link">상세보기 →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
