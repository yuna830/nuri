import { useEffect, useMemo, useState } from 'react'
import { getGuardians } from '../../api/guardianApi'

const TABS = [['basic', '기본 정보'], ['care', '생활·돌봄'], ['welfare', '복지 정보']]
const TRI_OPTIONS = [['', '미확인'], ['true', '예'], ['false', '아니오']]
const ELIGIBILITY_OPTIONS = [['', '미확인'], ['true', '대상'], ['false', '대상 아님']]
const APPLICATION_OPTIONS = [['', '미확인'], ['false', '미신청'], ['true', '신청 완료']]

const toSelectValue = value => value === true ? 'true' : value === false ? 'false' : ''
const toNullableBoolean = value => value === 'true' ? true : value === 'false' ? false : null

function formatPhone(value) {
  const digits = value?.replace(/\D/g, '') || ''
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return digits
}

function ageFromBirthDate(value) {
  if (!value) return '-'
  const birth = new Date(`${value}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return `${age}세`
}

export default function SeniorEditModal({ senior, onClose, onSave }) {
  const [tab, setTab] = useState('basic')
  const [guardians, setGuardians] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    name: senior.name || '', birthDate: senior.birthDate || '', gender: senior.gender || '',
    phone: formatPhone(senior.phone), address: senior.address || '', detailAddress: senior.detailAddress || '',
    guardianId: senior.guardianId ?? '', householdType: senior.householdType || '', housingType: senior.housingType || '',
    livingAlone: toSelectValue(senior.livingAlone), disabilityGrade: senior.disabilityGrade || '',
    longTermCare: toSelectValue(senior.longTermCare), incomeLevel: senior.incomeLevel || '',
    livelihoodBenefit: toSelectValue(senior.livelihoodBenefit), medicalBenefit: toSelectValue(senior.medicalBenefit),
    housingBenefit: toSelectValue(senior.housingBenefit), educationBenefit: toSelectValue(senior.educationBenefit),
    energyVoucherEligible: toSelectValue(senior.energyVoucherEligible), energyVoucherApplied: toSelectValue(senior.energyVoucherApplied),
    electricityDiscountEligible: toSelectValue(senior.electricityDiscountEligible), electricityDiscountApplied: toSelectValue(senior.electricityDiscountApplied),
    gasDiscountEligible: toSelectValue(senior.gasDiscountEligible), gasDiscountApplied: toSelectValue(senior.gasDiscountApplied),
  }))

  useEffect(() => { getGuardians().then(r => setGuardians(r.data)).catch(() => setGuardians([])) }, [])
  const maxBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const set = (name, value) => setForm(previous => ({ ...previous, [name]: value }))

  function handleEligibilityChange(prefix, value) {
    setForm(previous => ({
      ...previous,
      [`${prefix}Eligible`]: value,
      ...(value === 'false' ? { [`${prefix}Applied`]: '' } : {}),
    }))
  }

  function validate() {
    if (!form.name.trim()) return '이름을 입력해 주세요.'
    if (form.birthDate && form.birthDate > maxBirthDate) return '생년월일은 미래 날짜일 수 없습니다.'
    const digits = form.phone.replace(/\D/g, '')
    if (digits && !/^0\d{8,10}$/.test(digits)) return '연락처를 올바르게 입력해 주세요.'
    return ''
  }

  function deriveIncomeLevel() {
    const levels = [['livelihoodBenefit', 'LIVELIHOOD'], ['medicalBenefit', 'MEDICAL'], ['housingBenefit', 'HOUSING'], ['educationBenefit', 'EDUCATION']]
    const selected = levels.find(([key]) => form[key] === 'true')
    if (selected) return selected[1]
    return levels.every(([key]) => form[key] === 'false') ? 'NONE' : null
  }

  async function submit() {
    const message = validate()
    if (message) { setError(message); return }
    setSaving(true)
    setError('')
    const bool = key => toNullableBoolean(form[key])
    try {
      await onSave({
        ...form,
        name: form.name.trim(), phone: form.phone.replace(/\D/g, ''),
        guardianId: form.guardianId === '' ? null : Number(form.guardianId),
        incomeLevel: deriveIncomeLevel(),
        livingAlone: bool('livingAlone'), longTermCare: bool('longTermCare'),
        livelihoodBenefit: bool('livelihoodBenefit'), medicalBenefit: bool('medicalBenefit'),
        housingBenefit: bool('housingBenefit'), educationBenefit: bool('educationBenefit'),
        energyVoucherEligible: bool('energyVoucherEligible'), energyVoucherApplied: bool('energyVoucherApplied'),
        electricityDiscountEligible: bool('electricityDiscountEligible'), electricityDiscountApplied: bool('electricityDiscountApplied'),
        gasDiscountEligible: bool('gasDiscountEligible'), gasDiscountApplied: bool('gasDiscountApplied'),
      })
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data || '저장하지 못했습니다.')
    } finally { setSaving(false) }
  }

  const triSelect = (name, labels = TRI_OPTIONS) => (
    <select value={form[name]} onChange={e => set(name, e.target.value)}>{labels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
  )

  const applicationSelect = prefix => {
    const ineligible = form[`${prefix}Eligible`] === 'false'
    return <select disabled={ineligible} value={ineligible ? 'not_applicable' : form[`${prefix}Applied`]} onChange={e => set(`${prefix}Applied`, e.target.value)}>
      {ineligible && <option value="not_applicable">해당 없음</option>}
      {!ineligible && APPLICATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  }

  const benefitToggle = name => <div className="benefit-toggle" role="group">
    {TRI_OPTIONS.map(([value, label]) => <button type="button" key={value} className={form[name] === value ? 'active' : ''} onClick={() => set(name, value)}>{label}</button>)}
  </div>

  return <div className="detail-modal-overlay" onClick={onClose}>
    <div className="detail-modal senior-edit-modal" onClick={e => e.stopPropagation()}>
      <div className="detail-modal-header"><div><h2>{senior.name} 어르신 정보 수정</h2><p>원본 정보를 수정하면 확인 우선도가 다시 계산됩니다.</p></div><button onClick={onClose}>×</button></div>
      <div className="edit-modal-tabs">{TABS.map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</div>

      {tab === 'basic' && <div className="detail-modal-form">
        <label>이름<input value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <label>생년월일<input type="date" max={maxBirthDate} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} /></label>
        <label>현재 나이<input value={ageFromBirthDate(form.birthDate)} disabled aria-label="생년월일로 자동 계산된 현재 나이" /></label>
        <label>성별<select value={form.gender} onChange={e => set('gender', e.target.value)}><option value="">미확인</option><option value="MALE">남성</option><option value="FEMALE">여성</option></select></label>
        <label>연락처<input value={form.phone} onChange={e => set('phone', formatPhone(e.target.value))} placeholder="010-0000-0000" inputMode="numeric" /></label>
        <label>보호자<select value={form.guardianId} onChange={e => set('guardianId', e.target.value)}><option value="">미등록</option>{guardians.map(g => <option key={g.id} value={g.id}>{g.name} · {g.relationship || '관계 미상'} · {formatPhone(g.phone) || '-'}</option>)}</select></label>
        <label className="detail-modal-wide">주소<input value={form.address} onChange={e => set('address', e.target.value)} /></label>
        <label className="detail-modal-wide">상세 주소<input value={form.detailAddress} onChange={e => set('detailAddress', e.target.value)} /></label>
      </div>}

      {tab === 'care' && <div className="detail-modal-form">
        <label>가구 형태<select value={form.householdType} onChange={e => set('householdType', e.target.value)}><option value="">미확인</option><option value="SINGLE">1인 가구</option><option value="COUPLE">부부 가구</option><option value="FAMILY">가족 가구</option><option value="OTHER">기타 가구</option></select></label>
        <label>주거 형태<select value={form.housingType} onChange={e => set('housingType', e.target.value)}><option value="">미확인</option>{['자가','전세','월세','공공임대','시설 거주','기타'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>독거 여부<select value={form.livingAlone} onChange={e => set('livingAlone', e.target.value)}><option value="">미확인</option><option value="true">독거</option><option value="false">비독거</option></select></label>
        <label>장애등급<input value={form.disabilityGrade} onChange={e => set('disabilityGrade', e.target.value)} placeholder="미입력 시 해당 없음" /></label>
        <label>장기요양 여부<select value={form.longTermCare} onChange={e => set('longTermCare', e.target.value)}><option value="">미확인</option><option value="true">대상</option><option value="false">대상 아님</option></select></label>
      </div>}

      {tab === 'welfare' && <div className="detail-modal-form welfare-edit-grid">
        {['livelihoodBenefit','medicalBenefit','housingBenefit','educationBenefit'].map((name, index) => <label key={name}>{['생계급여','의료급여','주거급여','교육급여'][index]}{benefitToggle(name)}</label>)}
        <div className="welfare-edit-table">
          <div className="welfare-edit-head"><span>지원 항목</span><span>자격</span><span>신청 상태</span></div>
          {[['energyVoucher','에너지바우처'],['electricityDiscount','전기요금 할인'],['gasDiscount','가스요금 할인']].map(([prefix, label]) => <div className="welfare-status-row" key={prefix}><strong>{label}</strong><select value={form[`${prefix}Eligible`]} onChange={e => handleEligibilityChange(prefix, e.target.value)}>{ELIGIBILITY_OPTIONS.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select>{applicationSelect(prefix)}</div>)}
        </div>
      </div>}

      {error && <div className="edit-modal-error">{error}</div>}
      <div className="detail-modal-actions"><button className="btn-outline" onClick={onClose}>취소</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? '저장 중...' : '저장 및 재산정'}</button></div>
    </div>
  </div>
}
