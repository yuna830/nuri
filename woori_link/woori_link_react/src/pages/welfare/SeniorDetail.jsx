import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import '../../css/welfare/SeniorDetail.css'
import AiDecisionNotice from '../../components/common/AiDecisionNotice.jsx'

import {
  getSeniorById,
  updateSeniorProfile,
} from '../../api/seniorApi'

import {
  assessRisk,
  getLatestRisk,
} from '../../api/riskApi'

import {
  getProductsBySenior,
} from '../../api/recallApi'

import {
  getGuardians,
} from '../../api/guardianApi'

const HOUSEHOLD_LABEL = {
  SINGLE: '1인 가구',
  COUPLE: '부부 가구',
  FAMILY: '가족 가구',
  OTHER: '기타 가구',
}


const LEVEL_MAP = {
  HIGH: {
    label: '우선 확인 후보',
    className: 'high',
  },

  MEDIUM: {
    label: '관심 필요',
    className: 'medium',
  },

  LOW: {
    label: '일반',
    className: 'low',
  },
}


const RISK_CRITERIA = [
  {
    group: 'A',
    label: '심각한 지역 기상위험',
    value: 'weatherRisk',
    score: 20,
    recommendation:
      '기상특보 행동요령을 안내하고 현재 안전 상태를 확인하세요.',
  },
  {
    group: 'A',
    label: '사용 중인 미조치 리콜 제품',
    value: 'recallRisk',
    score: 30,
    recommendation:
      '제품 사용 중단 여부와 회수·교환 진행 상태를 확인하세요.',
  },
  {
    group: 'A',
    label: '리콜 제품 사용 여부 미확인',
    value: 'recallUsageUnknown',
    score: 20,
    recommendation:
      '어르신 또는 보호자에게 제품 사용 여부를 확인하세요.',
  },
  {
    group: 'A',
    label: '전기·가스 점검 미완료',
    value: 'safetyInspectionNeeded',
    values: [
      'safetyRisk',
      'safetyInspectionOverdue',
    ],
    score: 25,
    recommendation:
      '전기·가스 안전 점검 일정과 미완료 항목을 확인하세요.',
  },
  {
    group: 'A',
    label: 'AI 안부 확인 연속 미응답',
    value: 'aiNoResponse',
    score: 30,
    recommendation:
      '전화로 현재 상태를 확인하고 필요하면 방문 일정을 등록하세요.',
  },
  {
    group: 'A',
    label: '안전반경 이탈 미확인',
    value: 'locationAnomaly',
    score: 20,
    recommendation:
      '현재 위치와 안전반경 이탈 여부를 확인하세요.',
  },

  {
    group: 'B',
    label: '조치 요청 7일 이상 지연',
    value: 'overdueAction',
    score: 10,
    recommendation:
      '기한이 지난 조치의 담당자와 진행 상태를 확인하세요.',
  },
  {
    group: 'B',
    label: '예정 방문 지연',
    value: 'delayedVisit',
    score: 15,
    recommendation:
      '방문 일정을 다시 지정하고 대상자에게 안내하세요.',
  },
  {
    group: 'B',
    label: '동일 문제 반복',
    value: 'repeatedIssue',
    score: 10,
    recommendation:
      '반복 원인을 확인하고 기존 조치 방법을 재검토하세요.',
  },

  {
    group: 'C',
    label: '독거 가구',
    value: 'livingAlone',
    score: 10,
    recommendation:
      '정기 안부 확인과 비상 연락망을 점검하세요.',
  },
  {
    group: 'C',
    label: '보호자 미등록',
    value: 'guardianMissing',
    score: 10,
    recommendation:
      '보호자 또는 비상 연락처 등록 가능 여부를 확인하세요.',
  },
  {
    group: 'C',
    label: '장기요양 대상',
    value: 'longTermCare',
    score: 10,
    recommendation:
      '현재 이용 중인 장기요양 서비스와 돌봄 공백을 확인하세요.',
  },
  {
    group: 'C',
    label: '중증 장애',
    value: 'severeDisability',
    score: 10,
    recommendation:
      '이동 및 생활지원이 필요한지 확인하세요.',
  },
  {
    group: 'C',
    label: '에너지바우처 대상 미신청',
    value: 'voucherUnapplied',
    score: 5,
    recommendation:
      '에너지바우처 신청 의사와 필요 서류를 확인하세요.',
  },
  {
    group: 'C',
    label: '전기·가스 할인 미신청',
    value: 'discountUnapplied',
    score: 5,
    recommendation:
      '전기·가스 복지 할인 신청 여부를 확인하세요.',
  },
]


function valueOrDash(value) {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return '-'
  }

  return value
}


function formatPhone(value) {
  const digits =
    value?.replace(/\D/g, '')

  if (!digits) {
    return '-'
  }

  if (digits.length === 11) {
    return digits.replace(
      /(\d{3})(\d{4})(\d{4})/,
      '$1-$2-$3',
    )
  }

  if (digits.length === 10) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{4})/,
      '$1-$2-$3',
    )
  }

  return value
}


function booleanLabel(
  value,
  trueLabel = '예',
  falseLabel = '아니오',
) {
  if (value === true) {
    return trueLabel
  }

  if (value === false) {
    return falseLabel
  }

  return '미확인'
}


function applicationLabel(value) {
  if (value === true) {
    return '신청 완료'
  }

  if (value === false) {
    return '미신청'
  }

  return '미확인'
}


function supportApplicationLabel(
  eligible,
  applied,
) {
  if (eligible === false) {
    return '해당 없음'
  }

  return applicationLabel(applied)
}


function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  return new Date(value)
    .toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/\. /g, '.')
    .replace(/\.$/, '')
}


function getScoredCriteria(risk) {
  if (!risk) {
    return []
  }

  const groupScores = {
    A: Number(
      risk.actualRiskScore
      ?? risk.riskScore
      ?? 0,
    ),

    B: Math.min(
      Number(
        risk.delayScore
        ?? 0,
      ),
      40,
    ),

    C: Math.min(
      Number(
        risk.vulnerabilityScore
        ?? 0,
      ),
      25,
    ),
  }

  return ['A', 'B', 'C']
    .flatMap((group) => {
      const appliedCriteria =
        RISK_CRITERIA.filter(
          (criteria) => {
            if (
              criteria.group
              !== group
            ) {
              return false
            }

            const values =
              criteria.values
              ?? [criteria.value]

            return values.some(
              (value) =>
                risk[value] === true,
            )
          },
        )

      let remainingScore =
        groupScores[group]

      return appliedCriteria.map(
        (criteria, index) => {
          const isLast =
            index
            === appliedCriteria.length - 1

          const appliedScore =
            isLast
              ? remainingScore
              : Math.min(
                criteria.score,
                remainingScore,
              )

          remainingScore =
            Math.max(
              0,
              remainingScore
              - appliedScore,
            )

          return {
            ...criteria,
            appliedScore,
          }
        },
      )
    })
    .filter(
      (criteria) =>
        criteria.appliedScore > 0,
    )
}


function getWelfareBenefitSummary(senior) {
  const benefits = [
    [
      '생계급여',
      senior.livelihoodBenefit,
    ],
    [
      '의료급여',
      senior.medicalBenefit,
    ],
    [
      '주거급여',
      senior.housingBenefit,
    ],
    [
      '교육급여',
      senior.educationBenefit,
    ],
  ]
    .filter(
      ([, active]) =>
        active === true,
    )
    .map(([label]) => label)

  if (benefits.length === 0) {
    return '해당 없음'
  }

  return benefits.join(' · ')
}


function toSelectValue(value) {
  if (value === true) {
    return 'true'
  }

  if (value === false) {
    return 'false'
  }

  return ''
}


function toNullableBoolean(value) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return null
}


function createProfileForm(senior) {
  return {
    name: senior.name || '',
    birthDate: senior.birthDate || '',
    gender: senior.gender || '',
    phone: formatPhone(senior.phone),
    address: senior.address || '',
    detailAddress:
      senior.detailAddress || '',
    guardianId:
      senior.guardianId ?? '',
    householdType:
      senior.householdType || '',
    housingType:
      senior.housingType || '',
    livingAlone:
      toSelectValue(
        senior.livingAlone,
      ),
    disabilityGrade:
      senior.disabilityGrade || '',
    longTermCare:
      toSelectValue(
        senior.longTermCare,
      ),
  }
}


function createWelfareForm(senior) {
  return {
    livelihoodBenefit:
      toSelectValue(
        senior.livelihoodBenefit,
      ),
    medicalBenefit:
      toSelectValue(
        senior.medicalBenefit,
      ),
    housingBenefit:
      toSelectValue(
        senior.housingBenefit,
      ),
    educationBenefit:
      toSelectValue(
        senior.educationBenefit,
      ),
    energyVoucherEligible:
      toSelectValue(
        senior.energyVoucherEligible,
      ),
    energyVoucherApplied:
      toSelectValue(
        senior.energyVoucherApplied,
      ),
    electricityDiscountEligible:
      toSelectValue(
        senior.electricityDiscountEligible,
      ),
    electricityDiscountApplied:
      toSelectValue(
        senior.electricityDiscountApplied,
      ),
    gasDiscountEligible:
      toSelectValue(
        senior.gasDiscountEligible,
      ),
    gasDiscountApplied:
      toSelectValue(
        senior.gasDiscountApplied,
      ),
  }
}


export default function SeniorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [
    senior,
    setSenior,
  ] = useState(null)

  const [
    risk,
    setRisk,
  ] = useState(null)

  const [
    products,
    setProducts,
  ] = useState([])

  const [
    guardians,
    setGuardians,
  ] = useState([])

  const [
    assessing,
    setAssessing,
  ] = useState(false)

  const [
    profileForm,
    setProfileForm,
  ] = useState(null)

  const [
    profileSaving,
    setProfileSaving,
  ] = useState(false)

  const [
    welfareForm,
    setWelfareForm,
  ] = useState(null)

  const [
    welfareSaving,
    setWelfareSaving,
  ] = useState(false)

  const [
    toast,
    setToast,
  ] = useState('')


  useEffect(() => {
    loadDetail()
  }, [id])


  async function loadDetail() {
    const results =
      await Promise.allSettled([
        getSeniorById(id),
        getLatestRisk(id),
        getProductsBySenior(id),
        getGuardians(),
      ])

    if (
      results[0].status
      === 'fulfilled'
    ) {
      setSenior(
        results[0].value.data,
      )
    }

    if (
      results[1].status
      === 'fulfilled'
    ) {
      setRisk(
        results[1].value.data,
      )
    }

    if (
      results[2].status
      === 'fulfilled'
    ) {
      setProducts(
        Array.isArray(
          results[2].value.data,
        )
          ? results[2].value.data
          : [],
      )
    } else {
      setProducts([])
    }

    if (
      results[3].status
      === 'fulfilled'
    ) {
      setGuardians(
        Array.isArray(
          results[3].value.data,
        )
          ? results[3].value.data
          : [],
      )
    } else {
      setGuardians([])
    }
  }


  function showToast(message) {
    setToast(message)

    window.setTimeout(() => {
      setToast('')
    }, 3500)
  }


  async function handleAssess() {
    if (assessing) {
      return
    }

    setAssessing(true)

    try {
      const response =
        await assessRisk(id)

      setRisk(response.data)

      showToast(
        '확인 우선도가 다시 계산되었습니다.',
      )
    } catch (error) {
      console.error(
        '확인 우선도 재산정 실패:',
        error,
      )

      showToast(
        '확인 우선도를 다시 계산하지 못했습니다.',
      )
    } finally {
      setAssessing(false)
    }
  }


  async function handleProfileSave(data) {
    try {
      const updated =
        await updateSeniorProfile(
          id,
          data,
        )

      setSenior(updated.data)
      setProfileForm(null)
      setWelfareForm(null)

      try {
        const recalculated =
          await assessRisk(id)

        setRisk(
          recalculated.data,
        )

        showToast(
          '대상자 정보가 수정되었으며 확인 우선도가 재산정되었습니다.',
        )
      } catch (error) {
        console.error(
          '정보 저장 후 재산정 실패:',
          error,
        )

        showToast(
          '대상자 정보는 저장되었지만 확인 우선도 재산정에 실패했습니다.',
        )
      }
    } catch (error) {
      console.error(
        '대상자 정보 수정 실패:',
        error,
      )

      throw error
    }
  }


  function startProfileEdit() {
    setProfileForm(
      createProfileForm(senior),
    )
  }


  function updateProfileField(
    name,
    value,
  ) {
    setProfileForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    )
  }


  async function saveInlineProfile() {
    if (
      !profileForm.name.trim()
    ) {
      showToast(
        '이름을 입력해 주세요.',
      )
      return
    }

    setProfileSaving(true)

    try {
      await handleProfileSave({
        name:
          profileForm.name.trim(),
        birthDate:
          profileForm.birthDate
          || null,
        gender:
          profileForm.gender
          || null,
        phone:
          profileForm.phone
            .replace(/\D/g, '')
          || null,
        address:
          profileForm.address.trim()
          || null,
        detailAddress:
          profileForm.detailAddress
            .trim()
          || null,
        guardianId:
          profileForm.guardianId === ''
            ? null
            : Number(
              profileForm.guardianId,
            ),
        householdType:
          profileForm.householdType
          || null,
        housingType:
          profileForm.housingType
          || null,
        livingAlone:
          toNullableBoolean(
            profileForm.livingAlone,
          ),
        disabilityGrade:
          profileForm.disabilityGrade
            .trim()
          || null,
        longTermCare:
          toNullableBoolean(
            profileForm.longTermCare,
          ),
        incomeLevel:
          senior.incomeLevel ?? null,
        livelihoodBenefit:
          senior.livelihoodBenefit
          ?? null,
        medicalBenefit:
          senior.medicalBenefit ?? null,
        housingBenefit:
          senior.housingBenefit ?? null,
        educationBenefit:
          senior.educationBenefit
          ?? null,
        energyVoucherEligible:
          senior.energyVoucherEligible
          ?? null,
        energyVoucherApplied:
          senior.energyVoucherApplied
          ?? null,
        electricityDiscountEligible:
          senior.electricityDiscountEligible
          ?? null,
        electricityDiscountApplied:
          senior.electricityDiscountApplied
          ?? null,
        gasDiscountEligible:
          senior.gasDiscountEligible
          ?? null,
        gasDiscountApplied:
          senior.gasDiscountApplied
          ?? null,
      })
    } catch {
      showToast(
        '대상자 정보를 저장하지 못했습니다.',
      )
    } finally {
      setProfileSaving(false)
    }
  }


  function updateWelfareField(
    name,
    value,
  ) {
    setWelfareForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    )
  }


  function updateEligibility(
    prefix,
    value,
  ) {
    setWelfareForm(
      (previous) => ({
        ...previous,
        [`${prefix}Eligible`]:
          value,
        ...(
          value === 'false'
            ? {
              [`${prefix}Applied`]:
                '',
            }
            : {}
        ),
      }),
    )
  }


  function deriveIncomeLevel() {
    const levels = [
      [
        'livelihoodBenefit',
        'LIVELIHOOD',
      ],
      [
        'medicalBenefit',
        'MEDICAL',
      ],
      [
        'housingBenefit',
        'HOUSING',
      ],
      [
        'educationBenefit',
        'EDUCATION',
      ],
    ]

    const selected =
      levels.find(
        ([key]) =>
          welfareForm[key]
          === 'true',
      )

    if (selected) {
      return selected[1]
    }

    return levels.every(
      ([key]) =>
        welfareForm[key]
        === 'false',
    )
      ? 'NONE'
      : null
  }


  async function saveInlineWelfare() {
    setWelfareSaving(true)

    try {
      await handleProfileSave({
        name: senior.name,
        birthDate:
          senior.birthDate ?? null,
        gender:
          senior.gender ?? null,
        phone:
          senior.phone ?? null,
        address:
          senior.address ?? null,
        detailAddress:
          senior.detailAddress ?? null,
        guardianId:
          senior.guardianId ?? null,
        householdType:
          senior.householdType ?? null,
        housingType:
          senior.housingType ?? null,
        livingAlone:
          senior.livingAlone ?? null,
        disabilityGrade:
          senior.disabilityGrade ?? null,
        longTermCare:
          senior.longTermCare ?? null,
        incomeLevel:
          deriveIncomeLevel(),
        livelihoodBenefit:
          toNullableBoolean(
            welfareForm
              .livelihoodBenefit,
          ),
        medicalBenefit:
          toNullableBoolean(
            welfareForm
              .medicalBenefit,
          ),
        housingBenefit:
          toNullableBoolean(
            welfareForm
              .housingBenefit,
          ),
        educationBenefit:
          toNullableBoolean(
            welfareForm
              .educationBenefit,
          ),
        energyVoucherEligible:
          toNullableBoolean(
            welfareForm
              .energyVoucherEligible,
          ),
        energyVoucherApplied:
          toNullableBoolean(
            welfareForm
              .energyVoucherApplied,
          ),
        electricityDiscountEligible:
          toNullableBoolean(
            welfareForm
              .electricityDiscountEligible,
          ),
        electricityDiscountApplied:
          toNullableBoolean(
            welfareForm
              .electricityDiscountApplied,
          ),
        gasDiscountEligible:
          toNullableBoolean(
            welfareForm
              .gasDiscountEligible,
          ),
        gasDiscountApplied:
          toNullableBoolean(
            welfareForm
              .gasDiscountApplied,
          ),
      })
    } catch {
      showToast(
        '복지 정보를 저장하지 못했습니다.',
      )
    } finally {
      setWelfareSaving(false)
    }
  }


  const levelInfo =
    risk
      ? (
        LEVEL_MAP[risk.level]
        ?? LEVEL_MAP.LOW
      )
      : LEVEL_MAP.LOW


  const scoredCriteria =
    useMemo(
      () =>
        getScoredCriteria(risk),
      [risk],
    )


  const recallProductCount =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.recallDecisionStatus
            === 'RECALL_CONFIRMED'
            || (
              !product.recallDecisionStatus
              && product.recallStatus
              === 'RECALLED'
            ),
        ).length,
      [products],
    )


  const reviewRequiredProductCount =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.recallDecisionStatus
            === 'REVIEW_REQUIRED',
        ).length,
      [products],
    )


  const guardianName =
    guardians.find(
      (guardian) =>
        Number(guardian.id)
        === Number(
          senior?.guardianId,
        ),
    )?.name


  if (!senior) {
    return (
      <div className="empty-state">
        대상자 정보를 불러오는 중입니다.
      </div>
    )
  }


  return (
    <div className="senior-detail-page">
      <div className="detail-title-row">
        <button
          type="button"
          className="detail-title-back"
          aria-label="대상자 목록으로 이동"
          onClick={() =>
            navigate('/welfare/seniors')
          }
        >
          &lt;
        </button>

        <div>
          <h1 className="page-title">
            {senior.name}
          </h1>
        </div>
      </div>

      <section className="card detail-info-card">
        <div className="detail-section-header">
          <div>
            <h2 className="card-title">
              대상자 기본 정보
            </h2>
          </div>

          {profileForm ? (
            <div className="detail-inline-actions">
              <button
                type="button"
                className="btn-outline detail-small-button"
                disabled={profileSaving}
                onClick={() =>
                  setProfileForm(null)
                }
              >
                취소
              </button>

              <button
                type="button"
                className="btn-primary detail-small-button"
                disabled={profileSaving}
                onClick={saveInlineProfile}
              >
                {profileSaving
                  ? '저장 중...'
                  : '저장'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-outline detail-small-button"
              onClick={startProfileEdit}
            >
              수정
            </button>
          )}
        </div>

        <div className="detail-information-section">
          <h3>인적 정보</h3>

          <div className="detail-info-grid">
            <div className="info-row">
              <span className="info-label">
                이름
              </span>

              {profileForm ? (
                <div className="detail-inline-pair">
                  <input
                    className="detail-inline-input"
                    value={profileForm.name}
                    aria-label="이름"
                    onChange={(event) =>
                      updateProfileField(
                        'name',
                        event.target.value,
                      )
                    }
                  />

                  <select
                    className="detail-inline-select detail-inline-select-compact"
                    value={profileForm.gender}
                    aria-label="성별"
                    onChange={(event) =>
                      updateProfileField(
                        'gender',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">미확인</option>
                    <option value="MALE">남성</option>
                    <option value="FEMALE">여성</option>
                  </select>
                </div>
              ) : (
                <span className="info-value">
                  {valueOrDash(senior.name)}
                  {senior.gender === 'MALE'
                    && ' (남성)'}
                  {senior.gender === 'FEMALE'
                    && ' (여성)'}
                </span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">
                생년월일
              </span>

              {profileForm ? (
                <input
                  type="date"
                  className="detail-inline-input"
                  value={profileForm.birthDate}
                  aria-label="생년월일"
                  onChange={(event) =>
                    updateProfileField(
                      'birthDate',
                      event.target.value,
                    )
                  }
                />
              ) : (
                <span className="info-value">
                  {senior.birthDate
                    ?.replaceAll('-', '.')
                    || '정보 미등록'}
                </span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">
                연락처
              </span>

              {profileForm ? (
                <input
                  className="detail-inline-input"
                  value={profileForm.phone}
                  aria-label="연락처"
                  placeholder="010-0000-0000"
                  onChange={(event) =>
                    updateProfileField(
                      'phone',
                      event.target.value,
                    )
                  }
                />
              ) : (
                <span className="info-value">
                  {formatPhone(senior.phone)}
                </span>
              )}
            </div>

            <div className="info-row info-row-wide">
              <span className="info-label">
                주소
              </span>

              {profileForm ? (
                <div className="detail-inline-pair">
                  <input
                    className="detail-inline-input"
                    value={profileForm.address}
                    aria-label="주소"
                    placeholder="주소"
                    onChange={(event) =>
                      updateProfileField(
                        'address',
                        event.target.value,
                      )
                    }
                  />

                  <input
                    className="detail-inline-input"
                    value={profileForm.detailAddress}
                    aria-label="상세 주소"
                    placeholder="상세 주소"
                    onChange={(event) =>
                      updateProfileField(
                        'detailAddress',
                        event.target.value,
                      )
                    }
                  />
                </div>
              ) : (
                <span className="info-value">
                  {senior.address
                    ? `${senior.address}${
                      senior.detailAddress
                        ? ` (${senior.detailAddress})`
                        : ''
                    }`
                    : '정보 미등록'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-information-section">
          <h3>생활·돌봄 정보</h3>

          <div className="detail-info-grid">
            <div className="info-row">
              <span className="info-label">
                가구 형태
              </span>

              {profileForm ? (
                <div className="detail-inline-pair">
                  <select
                    className="detail-inline-select"
                    value={profileForm.householdType}
                    aria-label="가구 형태"
                    onChange={(event) =>
                      updateProfileField(
                        'householdType',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">미확인</option>
                    <option value="SINGLE">1인 가구</option>
                    <option value="COUPLE">부부 가구</option>
                    <option value="FAMILY">가족 가구</option>
                    <option value="OTHER">기타 가구</option>
                  </select>

                  <select
                    className="detail-inline-select"
                    value={profileForm.livingAlone}
                    aria-label="독거 여부"
                    onChange={(event) =>
                      updateProfileField(
                        'livingAlone',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">미확인</option>
                    <option value="true">독거</option>
                    <option value="false">비독거</option>
                  </select>
                </div>
              ) : (
                <span className="info-value">
                  {senior.householdType
                    ? (
                      HOUSEHOLD_LABEL[
                        senior.householdType
                      ]
                      || senior.householdType
                    )
                    : '정보 미등록'}
                  {senior.livingAlone
                    !== null
                    && senior.livingAlone
                    !== undefined
                    && ` · ${
                      senior.livingAlone
                        ? '독거'
                        : '비독거'
                    }`}
                </span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">
                주거 형태
              </span>

              {profileForm ? (
                <input
                  className="detail-inline-input"
                  value={profileForm.housingType}
                  aria-label="주거 형태"
                  onChange={(event) =>
                    updateProfileField(
                      'housingType',
                      event.target.value,
                    )
                  }
                />
              ) : (
                <span className="info-value">
                  {senior.housingType
                    || '정보 미등록'}
                </span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">
                장애등급
              </span>

              {profileForm ? (
                <input
                  className="detail-inline-input"
                  value={profileForm.disabilityGrade}
                  aria-label="장애등급"
                  placeholder="해당 없으면 비워 두세요"
                  onChange={(event) =>
                    updateProfileField(
                      'disabilityGrade',
                      event.target.value,
                    )
                  }
                />
              ) : (
                <span className="info-value">
                  {senior.disabilityGrade
                    || '해당 없음'}
                </span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">
                장기요양
              </span>

              {profileForm ? (
                <select
                  className="detail-inline-select"
                  value={profileForm.longTermCare}
                  aria-label="장기요양 여부"
                  onChange={(event) =>
                    updateProfileField(
                      'longTermCare',
                      event.target.value,
                    )
                  }
                >
                  <option value="">미확인</option>
                  <option value="true">대상</option>
                  <option value="false">대상 아님</option>
                </select>
              ) : (
                <span className="info-value">
                  {booleanLabel(
                    senior.longTermCare,
                    '대상',
                    '대상 아님',
                  )}
                </span>
              )}
            </div>

            <div className="info-row info-row-wide">
              <span className="info-label">
                보호자
              </span>

              {profileForm ? (
                <select
                  className="detail-inline-select"
                  value={profileForm.guardianId}
                  aria-label="보호자"
                  onChange={(event) =>
                    updateProfileField(
                      'guardianId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">미등록</option>
                  {guardians.map(
                    (guardian) => (
                      <option
                        key={guardian.id}
                        value={guardian.id}
                      >
                        {guardian.name}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <span className="info-value">
                  {senior.guardianId
                    ? guardianName
                      || '등록된 보호자'
                    : '미등록'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-last-updated">
          마지막 수정:
          {' '}
          {formatDateTime(
            senior.updatedAt,
          )}
        </div>
      </section>

      <section className="card detail-risk-card detail-risk-card-wide">
        <div className="detail-section-header">
          <div>
            <h2 className="card-title">
              복지사 확인 우선도
            </h2>
          </div>

          <div className="risk-heading-actions">
            {risk && (
              <div className="risk-header">
                <span
                  className={[
                    'risk-score',
                    levelInfo.className,
                  ].join(' ')}
                >
                  {risk.totalScore ?? 0}점
                </span>

                <span className="risk-level-text">
                  · {levelInfo.label}
                </span>
              </div>
            )}

            <button
              type="button"
              className="btn-primary detail-small-button"
              disabled={assessing}
              onClick={handleAssess}
            >
              {assessing
                ? '산정 중...'
                : '재산정'}
            </button>
          </div>
        </div>

        <AiDecisionNotice
          className="detail-risk-ai-notice"
        />

        {!risk ? (
          <div className="detail-empty-message">
            <strong>
              평가 이력이 없습니다.
            </strong>

            <p>
              재산정을 실행해 현재 확인 우선도를 계산하세요.
            </p>
          </div>
        ) : scoredCriteria.length === 0 ? (
          <div className="detail-empty-message">
            <strong>
              현재 우선 확인이 필요한 항목이 없습니다.
            </strong>

            <p>
              점수가 발생한 위험 또는 취약 조건이 없습니다.
            </p>
          </div>
        ) : (
          <div className="risk-reasons">
            <h3>현재 확인 사유</h3>

            <div className="risk-paired-list">
              {scoredCriteria.map(
                (criteria) => (
                  <div
                    className="risk-paired-item"
                    key={criteria.value}
                  >
                    <div className="risk-paired-heading">
                      <strong>
                        {criteria.label}
                      </strong>

                      <span>
                        +{criteria.appliedScore}점
                      </span>
                    </div>

                    <p>
                      {criteria.recommendation}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {risk && (
          <div className="risk-score-breakdown">
            <h3>점수 구성</h3>

            <div className="risk-score-breakdown-grid">
              <div>
                <span>실제 위험</span>
                <strong>
                  {risk.actualRiskScore ?? 0}점
                </strong>
              </div>

              <div>
                <span>조치 지연</span>
                <strong>
                  {risk.delayScore ?? 0}점
                </strong>
              </div>

              <div>
                <span>기본 취약성</span>
                <strong>
                  {risk.vulnerabilityScore ?? 0}점
                </strong>
              </div>
            </div>

            <p className="risk-score-assessed-at">
              마지막 산정 {formatDateTime(risk.assessedAt)}
            </p>
          </div>
        )}
      </section>

      <section className="card detail-welfare-card">
        <div className="detail-section-header">
          <div>
            <h2 className="card-title">
              복지 자격 및 지원 현황
            </h2>
          </div>

          {welfareForm ? (
            <div className="detail-inline-actions">
              <button
                type="button"
                className="btn-outline detail-small-button"
                disabled={welfareSaving}
                onClick={() =>
                  setWelfareForm(null)
                }
              >
                취소
              </button>

              <button
                type="button"
                className="btn-primary detail-small-button"
                disabled={welfareSaving}
                onClick={saveInlineWelfare}
              >
                {welfareSaving
                  ? '저장 중...'
                  : '저장'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-outline detail-small-button"
              onClick={() =>
                setWelfareForm(
                  createWelfareForm(
                    senior,
                  ),
                )
              }
            >
              수정
            </button>
          )}
        </div>

        <div className="welfare-benefit-section">
          <span className="welfare-section-label">
            기초생활보장
          </span>

          {welfareForm ? (
            <div className="welfare-inline-benefits">
              {[
                [
                  'livelihoodBenefit',
                  '생계급여',
                ],
                [
                  'medicalBenefit',
                  '의료급여',
                ],
                [
                  'housingBenefit',
                  '주거급여',
                ],
                [
                  'educationBenefit',
                  '교육급여',
                ],
              ].map(
                ([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>

                    <select
                      className="detail-inline-select"
                      value={
                        welfareForm[key]
                      }
                      onChange={(event) =>
                        updateWelfareField(
                          key,
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        미확인
                      </option>
                      <option value="true">
                        수급
                      </option>
                      <option value="false">
                        해당 없음
                      </option>
                    </select>
                  </label>
                ),
              )}
            </div>
          ) : (
            <strong>
              {getWelfareBenefitSummary(
                senior,
              )}
            </strong>
          )}
        </div>

        <div className="support-status-table">
          {[
            [
              'energyVoucher',
              '에너지바우처',
            ],
            [
              'electricityDiscount',
              '전기요금 복지 할인',
            ],
            [
              'gasDiscount',
              '도시가스요금 경감',
            ],
          ].map(
            ([
              prefix,
              label,
            ]) => {
              const eligibleKey =
                `${prefix}Eligible`
              const appliedKey =
                `${prefix}Applied`
              const ineligible =
                welfareForm?.[
                  eligibleKey
                ] === 'false'

              return (
                <div
                  className={[
                    'support-status-row',
                    ineligible
                      ? 'is-ineligible'
                      : '',
                  ].filter(Boolean).join(' ')}
                  key={prefix}
                >
                  <strong>{label}</strong>

                  <div className="support-status-values">
                    <label>
                      <small>자격</small>

                      {welfareForm ? (
                        <select
                          className="detail-inline-select"
                          value={
                            welfareForm[
                              eligibleKey
                            ]
                          }
                          onChange={(event) =>
                            updateEligibility(
                              prefix,
                              event.target.value,
                            )
                          }
                        >
                          <option value="">미확인</option>
                          <option value="true">대상</option>
                          <option value="false">대상 아님</option>
                        </select>
                      ) : (
                        <span>
                          {booleanLabel(
                            senior[
                              eligibleKey
                            ],
                            '대상',
                            '대상 아님',
                          )}
                        </span>
                      )}
                    </label>

                    <label>
                      <small>신청 상태</small>

                      {welfareForm ? (
                        <select
                          className="detail-inline-select"
                          value={
                            ineligible
                              ? 'not_applicable'
                              : welfareForm[
                                appliedKey
                              ]
                          }
                          disabled={ineligible}
                          onChange={(event) =>
                            updateWelfareField(
                              appliedKey,
                              event.target.value,
                            )
                          }
                        >
                          {ineligible ? (
                            <option value="not_applicable">
                              해당 없음
                            </option>
                          ) : (
                            <>
                              <option value="">미확인</option>
                              <option value="false">미신청</option>
                              <option value="true">신청 완료</option>
                            </>
                          )}
                        </select>
                      ) : (
                        <span>
                          {supportApplicationLabel(
                            senior[
                              eligibleKey
                            ],
                            senior[
                              appliedKey
                            ],
                          )}
                        </span>
                      )}
                    </label>
                  </div>

                </div>
              )
            },
          )}
        </div>
      </section>

      {products.length > 0 && (
        <section className="product-summary-bar">
          <div>
            <span className="product-summary-title">
              제품 안전
            </span>

            <div className="product-summary-counts">
              <span>
                등록 제품
                {' '}
                <strong>
                  {products.length}개
                </strong>
              </span>

              <span>
                리콜 확인 필요
                {' '}
                <strong>
                  {recallProductCount}개
                </strong>
              </span>

              <span>
                추가 확인 필요
                {' '}
                <strong>
                  {reviewRequiredProductCount}개
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-outline detail-small-button"
            onClick={() =>
              navigate(
                `/welfare/recalled?seniorId=${id}`,
              )
            }
          >
            리콜 관리
          </button>
        </section>
      )}

      {toast && (
        <div
          className="detail-toast"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
