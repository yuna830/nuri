const booleanLabel = (value, yes, no) => (
  value === true ? yes : value === false ? no : '미확인'
);

function CardShell({ title, loading, empty, children }) {
  return (
    <section className="energy-detail-card">
      <header className="energy-detail-card__header">
        <div>
          <h3>{title}</h3>
          <p>사용자 앱과 보호자 웹에서 입력한 정보를 확인합니다.</p>
        </div>
      </header>
      {loading ? (
        <div className="energy-detail-card__state">정보를 불러오는 중입니다.</div>
      ) : empty ? (
        <div className="energy-detail-card__state">등록된 정보 없음</div>
      ) : children}
    </section>
  );
}

function DetailGrid({ items, address }) {
  return (
    <div className="energy-detail-card__grid">
      {items.map(([label, value]) => (
        <div key={label}><span>{label}</span><strong>{value || '미입력'}</strong></div>
      ))}
      {address && (
        <div className="energy-detail-card__full">
          <span>{address[0]}</span><strong>{address[1] || '미입력'}</strong>
        </div>
      )}
    </div>
  );
}

function MissingSummary({ missingInformation, completeText }) {
  const missing = Array.isArray(missingInformation)
    ? missingInformation
    : [];
  return (
    <div className={`energy-detail-card__summary ${missing.length === 0 ? 'complete' : ''}`}>
      <strong>{missing.length === 0 ? '입력 정보 확인 완료' : '추가 확인 필요'}</strong>
      {missing.length === 0
        ? <p>{completeText}</p>
        : <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul>}
    </div>
  );
}

function CommonProfileCard({ profile, loading }) {
  return (
    <CardShell title="공통 자격 정보" loading={loading} empty={!profile}>
      <DetailGrid items={[
        ['기초생활수급', booleanLabel(profile?.basicLivelihoodRecipient, '해당', '해당 없음')],
        ['차상위계층', booleanLabel(profile?.nearPoverty, '해당', '해당 없음')],
        ['장애인 세대', booleanLabel(profile?.disabledHousehold, '해당', '해당 없음')],
        ['국가유공자 세대', booleanLabel(profile?.nationalMeritHousehold, '해당', '해당 없음')],
        ['노인 세대', booleanLabel(profile?.seniorHousehold, '해당', '해당 없음')],
        ['영유아 포함', booleanLabel(profile?.infantHousehold, '해당', '해당 없음')],
        ['임산부 포함', booleanLabel(profile?.pregnantHousehold, '해당', '해당 없음')],
        ['세대원 수', profile?.householdSize?.toString()],
        ['에너지바우처 수급', booleanLabel(profile?.energyVoucherRecipient, '수급', '미수급')],
        ['난방 에너지원', profile?.heatingEnergyType],
      ]} />
    </CardShell>
  );
}

export function VoucherDetailCard({ detail, loading, missingInformation }) {
  return (
    <CardShell title="에너지바우처 등록 정보" loading={loading} empty={!detail}>
      <DetailGrid items={[
        ['소득 기준', booleanLabel(detail?.incomeCriteriaConfirmed, '충족', '미충족')],
        ['기초생활수급 종류', detail?.livelihoodBenefitTypes],
        ['세대원 특성', booleanLabel(detail?.householdCharacteristicConfirmed, '충족', '미충족')],
        ['세대원 특성 상세', detail?.householdCharacteristics],
        ['중복 지원 여부', booleanLabel(detail?.winterOtherEnergySupportRecipient, '있음', '없음')],
        ['중복 지원명', detail?.otherEnergySupportTypes],
        ['신청 연도', detail?.applicationYear?.toString()],
        ['신청 결과', detail?.applicationResult],
      ]} />
      <MissingSummary
        missingInformation={missingInformation}
        completeText="신청 검토에 필요한 에너지바우처 정보가 입력되어 있습니다."
      />
    </CardShell>
  );
}

export function ElectricityDetailCard({ detail, loading, missingInformation }) {
  return (
    <CardShell title="전기요금 등록 정보" loading={loading} empty={!detail}>
      <DetailGrid
        items={[
          ['전기 사용', booleanLabel(detail?.usesElectricity, '사용함', '사용하지 않음')],
          ['전기 공급사', detail?.electricityProvider],
          ['고객번호', detail?.customerNumber],
          ['계약자명', detail?.contractorName],
          ['최근 고지서', booleanLabel(detail?.recentBillChecked, '확인함', '확인하지 못함')],
          ['주소 일치 여부', booleanLabel(detail?.addressSame, '일치', '불일치')],
          ['복지 자격', booleanLabel(detail?.welfareEligible, '자격 있음', '자격 없음')],
        ]}
        address={detail?.addressSame === false
          ? ['전기 사용 주소', detail?.serviceAddress]
          : null}
      />
      <MissingSummary
        missingInformation={missingInformation}
        completeText="신청 검토에 필요한 전기요금 정보가 입력되어 있습니다."
      />
    </CardShell>
  );
}

export function GasDetailCard({ detail, loading, missingInformation }) {
  return (
    <CardShell title="도시가스 등록 정보" loading={loading} empty={!detail}>
      <DetailGrid
        items={[
          ['도시가스 사용', booleanLabel(detail?.usesCityGas, '사용함', '사용하지 않음')],
          ['도시가스 회사', detail?.gasCompany],
          ['고객번호', detail?.gasCustomerNumber],
          ['계약자명', detail?.gasContractorName],
          ['최근 고지서', booleanLabel(detail?.recentBillChecked, '확인함', '확인하지 못함')],
          ['주소 일치 여부', booleanLabel(detail?.addressSame, '일치', '불일치')],
        ]}
        address={detail?.addressSame === false
          ? ['도시가스 사용 주소', detail?.gasServiceAddress]
          : null}
      />
      <MissingSummary
        missingInformation={missingInformation}
        completeText="신청 검토에 필요한 도시가스 정보가 입력되어 있습니다."
      />
    </CardShell>
  );
}

export default function EnergySupportDetailCard({
  supportType,
  profile,
  profileLoading,
  voucherDetail,
  electricityDetail,
  gasDetail,
  loading,
  missingInformation,
}) {
  let detailCard = null;
  switch (supportType) {
    case 'VOUCHER':
      detailCard = <VoucherDetailCard detail={voucherDetail} loading={loading} missingInformation={missingInformation} />;
      break;
    case 'ELECTRICITY':
      detailCard = <ElectricityDetailCard detail={electricityDetail} loading={loading} missingInformation={missingInformation} />;
      break;
    case 'GAS':
      detailCard = <GasDetailCard detail={gasDetail} loading={loading} missingInformation={missingInformation} />;
      break;
    default:
      break;
  }
  return (
    <div className="energy-detail-pair">
      <CommonProfileCard profile={profile} loading={profileLoading} />
      {detailCard}
    </div>
  );
}
