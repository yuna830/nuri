import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getGuardians,
} from '../../api/guardianApi'


const PROFILE_TABS = [
  [
    'basic',
    '기본 정보',
  ],
  [
    'care',
    '생활·돌봄',
  ],
]


const TRI_OPTIONS = [
  [
    '',
    '미확인',
  ],
  [
    'true',
    '예',
  ],
  [
    'false',
    '아니오',
  ],
]


const ELIGIBILITY_OPTIONS = [
  [
    '',
    '미확인',
  ],
  [
    'true',
    '대상',
  ],
  [
    'false',
    '대상 아님',
  ],
]


const APPLICATION_OPTIONS = [
  [
    '',
    '미확인',
  ],
  [
    'false',
    '미신청',
  ],
  [
    'true',
    '신청 완료',
  ],
]


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


function formatPhone(value) {
  const digits =
    value?.replace(/\D/g, '')
    || ''

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

  return digits
}


function ageFromBirthDate(value) {
  if (!value) {
    return '-'
  }

  const birth =
    new Date(
      `${value}T00:00:00`,
    )

  const today =
    new Date()

  let age =
    today.getFullYear()
    - birth.getFullYear()

  const birthdayNotPassed =
    today.getMonth()
    < birth.getMonth()
    || (
      today.getMonth()
      === birth.getMonth()
      && today.getDate()
      < birth.getDate()
    )

  if (birthdayNotPassed) {
    age -= 1
  }

  return `${age}세`
}


export default function SeniorEditModal({
  senior,
  mode = 'profile',
  onClose,
  onSave,
}) {
  const isWelfareMode =
    mode === 'welfare'

  const [
    tab,
    setTab,
  ] = useState(
    isWelfareMode
      ? 'welfare'
      : 'basic',
  )

  const [
    guardians,
    setGuardians,
  ] = useState([])

  const [
    error,
    setError,
  ] = useState('')

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState(() => ({
    name:
      senior.name
      || '',

    birthDate:
      senior.birthDate
      || '',

    gender:
      senior.gender
      || '',

    phone:
      formatPhone(
        senior.phone,
      ),

    address:
      senior.address
      || '',

    detailAddress:
      senior.detailAddress
      || '',

    guardianId:
      senior.guardianId
      ?? '',

    householdType:
      senior.householdType
      || '',

    housingType:
      senior.housingType
      || '',

    livingAlone:
      toSelectValue(
        senior.livingAlone,
      ),

    disabilityGrade:
      senior.disabilityGrade
      || '',

    longTermCare:
      toSelectValue(
        senior.longTermCare,
      ),

    incomeLevel:
      senior.incomeLevel
      || '',

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
  }))


  useEffect(() => {
    if (isWelfareMode) {
      return
    }

    getGuardians()
      .then((response) => {
        setGuardians(
          Array.isArray(
            response.data,
          )
            ? response.data
            : [],
        )
      })
      .catch(() => {
        setGuardians([])
      })
  }, [isWelfareMode])


  useEffect(() => {
    setTab(
      isWelfareMode
        ? 'welfare'
        : 'basic',
    )
  }, [isWelfareMode])


  const maxBirthDate =
    useMemo(
      () =>
        new Date()
          .toISOString()
          .slice(0, 10),
      [],
    )


  function setField(
    name,
    value,
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    )
  }


  function handleEligibilityChange(
    prefix,
    value,
  ) {
    setForm(
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


  function validate() {
    if (
      !form.name.trim()
    ) {
      return '이름을 입력해 주세요.'
    }

    if (
      form.birthDate
      && form.birthDate
      > maxBirthDate
    ) {
      return '생년월일은 미래 날짜일 수 없습니다.'
    }

    const phoneDigits =
      form.phone.replace(
        /\D/g,
        '',
      )

    if (
      phoneDigits
      && !/^0\d{8,10}$/.test(
        phoneDigits,
      )
    ) {
      return '연락처를 올바르게 입력해 주세요.'
    }

    return ''
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
          form[key] === 'true',
      )

    if (selected) {
      return selected[1]
    }

    const allFalse =
      levels.every(
        ([key]) =>
          form[key] === 'false',
      )

    return allFalse
      ? 'NONE'
      : null
  }


  async function submit() {
    if (saving) {
      return
    }

    const message =
      validate()

    if (message) {
      setError(message)
      return
    }

    setSaving(true)
    setError('')

    const booleanValue =
      (key) =>
        toNullableBoolean(
          form[key],
        )

    try {
      await onSave({
        ...form,

        name:
          form.name.trim(),

        phone:
          form.phone.replace(
            /\D/g,
            '',
          ),

        guardianId:
          form.guardianId === ''
            ? null
            : Number(
              form.guardianId,
            ),

        incomeLevel:
          deriveIncomeLevel(),

        livingAlone:
          booleanValue(
            'livingAlone',
          ),

        longTermCare:
          booleanValue(
            'longTermCare',
          ),

        livelihoodBenefit:
          booleanValue(
            'livelihoodBenefit',
          ),

        medicalBenefit:
          booleanValue(
            'medicalBenefit',
          ),

        housingBenefit:
          booleanValue(
            'housingBenefit',
          ),

        educationBenefit:
          booleanValue(
            'educationBenefit',
          ),

        energyVoucherEligible:
          booleanValue(
            'energyVoucherEligible',
          ),

        energyVoucherApplied:
          booleanValue(
            'energyVoucherApplied',
          ),

        electricityDiscountEligible:
          booleanValue(
            'electricityDiscountEligible',
          ),

        electricityDiscountApplied:
          booleanValue(
            'electricityDiscountApplied',
          ),

        gasDiscountEligible:
          booleanValue(
            'gasDiscountEligible',
          ),

        gasDiscountApplied:
          booleanValue(
            'gasDiscountApplied',
          ),
      })
    } catch (requestError) {
      setError(
        requestError
          ?.response
          ?.data
          ?.message
        || requestError
          ?.response
          ?.data
        || '저장하지 못했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }


  function renderApplicationSelect(
    prefix,
  ) {
    const ineligible =
      form[
        `${prefix}Eligible`
      ] === 'false'

    return (
      <select
        value={
          ineligible
            ? 'not_applicable'
            : form[
              `${prefix}Applied`
            ]
        }
        disabled={ineligible}
        onChange={(event) =>
          setField(
            `${prefix}Applied`,
            event.target.value,
          )
        }
      >
        {ineligible && (
          <option value="not_applicable">
            해당 없음
          </option>
        )}

        {!ineligible
          && APPLICATION_OPTIONS.map(
            ([
              value,
              label,
            ]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ),
          )}
      </select>
    )
  }


  function renderBenefitToggle(
    name,
  ) {
    return (
      <div
        className="benefit-toggle"
        role="group"
      >
        {TRI_OPTIONS.map(
          ([
            value,
            label,
          ]) => (
            <button
              type="button"
              key={value}
              className={
                form[name]
                === value
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setField(
                  name,
                  value,
                )
              }
            >
              {label}
            </button>
          ),
        )}
      </div>
    )
  }


  return (
    <div
      className="detail-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target
          === event.currentTarget
          && !saving
        ) {
          onClose()
        }
      }}
    >
      <div
        className="detail-modal senior-edit-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="detail-modal-header">
          <div>
            <h2>
              {senior.name}님
              {' '}
              {isWelfareMode
                ? '복지 정보 수정'
                : '기본·생활 정보 수정'}
            </h2>

            <p>
              {isWelfareMode
                ? '복지 자격과 지원 신청 상태를 수정합니다.'
                : '인적 정보와 생활·돌봄 정보를 수정합니다.'}
            </p>
          </div>

          <button
            type="button"
            aria-label="닫기"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {!isWelfareMode && (
          <div className="edit-modal-tabs">
            {PROFILE_TABS.map(
              ([
                value,
                label,
              ]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    tab === value
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setTab(value)
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        )}

        {tab === 'basic' && (
          <div className="detail-modal-form">
            <label>
              이름

              <input
                value={form.name}
                onChange={(event) =>
                  setField(
                    'name',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              생년월일

              <input
                type="date"
                max={maxBirthDate}
                value={form.birthDate}
                onChange={(event) =>
                  setField(
                    'birthDate',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              현재 나이

              <input
                value={
                  ageFromBirthDate(
                    form.birthDate,
                  )
                }
                disabled
                readOnly
                aria-label="생년월일로 계산된 현재 나이"
              />
            </label>

            <label>
              성별

              <select
                value={form.gender}
                onChange={(event) =>
                  setField(
                    'gender',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미확인
                </option>

                <option value="MALE">
                  남성
                </option>

                <option value="FEMALE">
                  여성
                </option>
              </select>
            </label>

            <label>
              연락처

              <input
                value={form.phone}
                inputMode="numeric"
                placeholder="010-0000-0000"
                onChange={(event) =>
                  setField(
                    'phone',
                    formatPhone(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label>
              보호자

              <select
                value={form.guardianId}
                onChange={(event) =>
                  setField(
                    'guardianId',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미등록
                </option>

                {guardians.map(
                  (guardian) => (
                    <option
                      key={guardian.id}
                      value={guardian.id}
                    >
                      {guardian.name}
                      {' · '}
                      {guardian.relationship
                        || '관계 미상'}
                      {' · '}
                      {formatPhone(
                        guardian.phone,
                      )
                        || '-'}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="detail-modal-wide">
              주소

              <input
                value={form.address}
                onChange={(event) =>
                  setField(
                    'address',
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="detail-modal-wide">
              상세 주소

              <input
                value={form.detailAddress}
                onChange={(event) =>
                  setField(
                    'detailAddress',
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        )}

        {tab === 'care' && (
          <div className="detail-modal-form">
            <label>
              가구 형태

              <select
                value={form.householdType}
                onChange={(event) =>
                  setField(
                    'householdType',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미확인
                </option>

                <option value="SINGLE">
                  1인 가구
                </option>

                <option value="COUPLE">
                  부부 가구
                </option>

                <option value="FAMILY">
                  가족 가구
                </option>

                <option value="OTHER">
                  기타 가구
                </option>
              </select>
            </label>

            <label>
              주거 형태

              <select
                value={form.housingType}
                onChange={(event) =>
                  setField(
                    'housingType',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미확인
                </option>

                {[
                  '자가',
                  '전세',
                  '월세',
                  '공공임대',
                  '시설 거주',
                  '기타',
                ].map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              독거 여부

              <select
                value={form.livingAlone}
                onChange={(event) =>
                  setField(
                    'livingAlone',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미확인
                </option>

                <option value="true">
                  독거
                </option>

                <option value="false">
                  비독거
                </option>
              </select>
            </label>

            <label>
              장애등급

              <input
                value={form.disabilityGrade}
                placeholder="미입력 시 해당 없음"
                onChange={(event) =>
                  setField(
                    'disabilityGrade',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              장기요양 여부

              <select
                value={form.longTermCare}
                onChange={(event) =>
                  setField(
                    'longTermCare',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  미확인
                </option>

                <option value="true">
                  대상
                </option>

                <option value="false">
                  대상 아님
                </option>
              </select>
            </label>
          </div>
        )}

        {tab === 'welfare' && (
          <div className="welfare-edit-content">
            <section className="welfare-edit-section">
              <div className="welfare-edit-section-header">
                <h3>
                  기초생활보장
                </h3>

                <p>
                  현재 확인된 급여 수급 여부를 입력합니다.
                </p>
              </div>

              <div className="detail-modal-form welfare-benefit-edit-grid">
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
                  ([
                    name,
                    label,
                  ]) => (
                    <label key={name}>
                      {label}

                      {renderBenefitToggle(
                        name,
                      )}
                    </label>
                  ),
                )}
              </div>
            </section>

            <section className="welfare-edit-section">
              <div className="welfare-edit-section-header">
                <h3>
                  지원 자격 및 신청 상태
                </h3>

                <p>
                  지원 가능 여부와 현재 신청 상태를 수정합니다.
                </p>
              </div>

              <div className="welfare-edit-table">
                <div className="welfare-edit-head">
                  <span>
                    지원 항목
                  </span>

                  <span>
                    자격
                  </span>

                  <span>
                    신청 상태
                  </span>
                </div>

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
                  ]) => (
                    <div
                      className="welfare-status-row"
                      key={prefix}
                    >
                      <strong>
                        {label}
                      </strong>

                      <select
                        value={
                          form[
                            `${prefix}Eligible`
                          ]
                        }
                        onChange={(event) =>
                          handleEligibilityChange(
                            prefix,
                            event.target.value,
                          )
                        }
                      >
                        {ELIGIBILITY_OPTIONS.map(
                          ([
                            value,
                            optionLabel,
                          ]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {optionLabel}
                            </option>
                          ),
                        )}
                      </select>

                      {renderApplicationSelect(
                        prefix,
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        )}

        {error && (
          <div className="edit-modal-error">
            {String(error)}
          </div>
        )}

        <div className="detail-modal-actions">
          <button
            type="button"
            className="btn-outline"
            disabled={saving}
            onClick={onClose}
          >
            취소
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={submit}
          >
            {saving
              ? '저장 중...'
              : '저장 및 재산정'}
          </button>
        </div>
      </div>
    </div>
  )
}