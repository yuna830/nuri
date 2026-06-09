import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProfilePhotoPicker from "../../components/ProfilePhotoPicker.jsx";
import { resolveUploadUrl, uploadProfileImage } from "../../api/userPageApi.js";
import { SPRING_API_BASE } from "../../config/api.js";
import { formatPhoneNumber } from "../../utils/common/phone.js";
import { saveCurrentSeniorProfile } from "../../utils/user/currentSeniorStorage.js";
import {
  CHRONIC,
  AVOID_ENVIRONMENTS,
  CARE_NEEDS,
  CURRENT_BENEFITS,
  DAYS,
  DISABILITY_GRADES,
  DISABILITY_TYPES,
  HOUSEHOLD_TYPES,
  HOUSING_TYPES,
  JOB_CONDITIONS,
  JOB_TYPES,
  LIVING_COST_STATUSES,
  MEDICINE_COUNTS,
  NONE,
  PENSION_STATUSES,
  REST_NEEDS,
  VISION_LEVELS,
  HEARING_LEVELS,
  WORK_TYPES,
  calculateAge,
  calcBMI,
  createMedicine,
  defaultForm,
  normalizeForm,
  syncMedicationsWithCount,
} from "../../utils/user/profileForm.js";
import "../../css/common/SignUp.css";

const STEPS = ["기본 정보", "건강 정보", "복약 정보", "건강 상태", "거동/인지/감각", "복지 정보", "활동/일자리"];

export default function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => {
    try {
      const temp = localStorage.getItem("login_temp");
      if (!temp) return defaultForm;
      const { name, phone } = JSON.parse(temp);
      return { ...defaultForm, name: name || "", phone: phone || "" };
    } catch {
      return defaultForm;
    }
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const bmi = useMemo(() => calcBMI(form.height, form.weight, form.gender), [form.height, form.weight, form.gender]);
  const derivedAge = useMemo(() => calculateAge(form.birthDate), [form.birthDate]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleArr = (key, value) => {
    setForm((prev) => {
      const arr = prev[key] || [];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value] };
    });
  };

  const setMedicine = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.map((medicine, currentIndex) =>
        currentIndex === index ? { ...medicine, [key]: value } : medicine
      ),
    }));
  };

  const addMedicine = () => setForm((prev) => ({ ...prev, medications: [...prev.medications, createMedicine()] }));
  const removeMedicine = (index) =>
    setForm((prev) => ({ ...prev, medications: prev.medications.filter((_, currentIndex) => currentIndex !== index) }));

  const handleMedicineCountChange = (value) => {
    setForm((prev) => ({
      ...prev,
      medicineCount: value,
      medications: syncMedicationsWithCount(prev.medications, value),
    }));
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      setError("");
      const { imageUrl } = await uploadProfileImage(file);
      set("profileImageUrl", resolveUploadUrl(imageUrl));
    } catch (uploadError) {
      console.error("회원가입 사진 업로드 실패:", uploadError);
      setError("사진 업로드에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const validate = () => {
    if (step === 0) {
      if (!form.name.trim()) return "이름을 입력해주세요.";
      if (!form.birthDate) return "생년월일을 입력해주세요.";
      if (!derivedAge || derivedAge < 14) return "중학교 1학년 기준인 만 14세 이상만 가입할 수 있어요.";
      if (!form.gender) return "성별을 선택해주세요.";
      if (!form.city.trim() || !form.district.trim() || !form.dong.trim()) return "시/도, 구/군, 거주지 주소를 입력해주세요.";
      if (!form.phone.trim()) return "전화번호를 입력해주세요.";
    }

    if (step === 1) {
      if (!form.height) return "키를 입력해주세요.";
      if (!form.weight) return "몸무게를 입력해주세요.";
    }


    return "";
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...normalizeForm(form),
        profileImageUrl: resolveUploadUrl(form.profileImageUrl),
        // 백엔드 SeniorCreateRequest는 List<String>을 기대 — CSV 문자열 덮어쓰기
        currentBenefits: form.currentBenefits || [],
        careNeeds: form.careNeeds || [],
        disabledWork: form.disabledWork || [],
        avoidEnvironment: form.avoidEnvironment || [],
        hopeDays: form.hopeDays || [],
        hopeJobType: form.hopeJobType || [],
        hopeCondition: form.hopeCondition || [],
      };
      const response = await fetch(`${SPRING_API_BASE}/api/seniors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setStep(0);
          setError("이미 등록된 전화번호입니다. 다른 전화번호를 입력해주세요.");
          window.scrollTo(0, 0);
          setSaving(false);
          return;
        }
        const text = await response.text().catch(() => "");
        throw new Error(`signup failed (${response.status})${text ? `: ${text}` : ""}`);
      }

      const profile = await response.json();
      saveCurrentSeniorProfile(profile);
      localStorage.setItem("current_senior_id", String(profile?.senior?.id || ""));
      localStorage.removeItem("login_temp");
      navigate("/user");
    } catch (submitError) {
      console.error("사용자 회원가입 실패:", submitError);
      alert("회원가입 저장에 실패했습니다. 서버가 켜져 있는지 확인해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    setError("");
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      window.scrollTo(0, 0);
      return;
    }

    await submit();
  };

  return (
    <div className="su-root">
      <nav className="su-nav">
        <div className="su-nav-inner">
          <div className="su-nav-logo">우리 woori</div>
          <div className="su-nav-actions">
            <span className="su-nav-step">사용자 정보 등록 {step + 1} / {STEPS.length}</span>
            <button className="su-nav-login" type="button" onClick={() => navigate("/")}>로그인</button>
          </div>
        </div>
      </nav>

      <div className="su-layout">
        {error && <div className="su-error">{error}</div>}

        {step === 0 && (
          <section className="su-section">
            <SectionTitle step={step}>기본 정보</SectionTitle>
            <ProfilePhotoPicker
              classPrefix="su"
              imageUrl={form.profileImageUrl}
              uploading={uploadingPhoto}
              onChange={handleProfileImageChange}
              onRemove={() => set("profileImageUrl", "")}
              alt="사용자 프로필 사진"
            />

            <div className="su-field">
              <label className="su-label">이름 <span className="su-required">*</span></label>
              <input className="su-input" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="예: 김영희" />
            </div>

            <div className="su-row">
              <div className="su-field">
                <label className="su-label">생년월일 <span className="su-required">*</span></label>
                <input
                  className="su-input"
                  type="date"
                  value={form.birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => {
                    const birthDate = event.target.value;
                    const age = calculateAge(birthDate);
                    setForm((prev) => ({
                      ...prev,
                      birthDate,
                      age: age ? String(age) : "",
                    }));
                  }}
                />
                {derivedAge ? <div className="su-field-help">현재 만 {derivedAge}세</div> : null}
              </div>
              <div className="su-field">
                <label className="su-label">성별 <span className="su-required">*</span></label>
                <select className="su-select" value={form.gender} onChange={(event) => set("gender", event.target.value)}>
                  <option value="">선택</option>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            <div className="su-row">
              <AddressInput label="시/도" value={form.city} onChange={(value) => set("city", value)} placeholder="서울특별시" required />
              <AddressInput label="구/군" value={form.district} onChange={(value) => set("district", value)} placeholder="강남구" required />
            </div>
            <div className="su-row">
              <AddressInput label="도로명/지명/동네" value={form.dong} onChange={(value) => set("dong", value)} placeholder="예: 역삼로, 역삼역, 역삼동" required />
              <AddressInput label="상세주소" value={form.detailAddress} onChange={(value) => set("detailAddress", value)} placeholder="예: 101동 1203호" />
            </div>

            <div className="su-field">
              <label className="su-label">전화번호 <span className="su-required">*</span></label>
              <input className="su-input" value={form.phone} onChange={(event) => set("phone", formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
            </div>

            <div className="su-row">
              <SelectField label="장애 등급" value={form.disabilityGrade} options={DISABILITY_GRADES} onChange={(value) => set("disabilityGrade", value)} />
              <SelectField label="장애 유형" value={form.disabilityType} options={DISABILITY_TYPES} onChange={(value) => set("disabilityType", value)} />
            </div>

            {/* 보호자 유무 */}
            <div className="su-toggle-row">
              <div>
                <p className="su-toggle-title">보호자 있음</p>
                <p className="su-toggle-desc">보호자가 없는 경우 꺼주세요.</p>
              </div>
              <label className="su-switch">
                <input type="checkbox" checked={form.hasGuardian} onChange={(e) => set("hasGuardian", e.target.checked)} />
                <span className="su-slider" />
              </label>
            </div>
          </section>
        )}

        {step === 1 && (
            <section className="su-section">
              <SectionTitle step={step}>건강 정보</SectionTitle>
              <div className="su-row">
                <InputField label="키(cm)" type="number" value={form.height} onChange={(value) => set("height", value)} required />
                <InputField label="몸무게(kg)" type="number" value={form.weight} onChange={(value) => set("weight", value)} required />
              </div>

              {bmi && (
                <div className="su-bmi-box">
                  <div className="su-bmi-item"><div className="su-bmi-label">BMI</div><div className="su-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div></div>
                  <div className="su-bmi-item"><div className="su-bmi-label">판정</div><div className="su-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div></div>
                  <div className="su-bmi-guide">{bmi.guide}</div>
                </div>
              )}

              <ChipField label="흡연 여부" value={form.smoking} options={[NONE, "금연 중", "과거 흡연", "가끔 흡연", "흡연 중"]} onSelect={(value) => set("smoking", value)} />
              <ChipField label="음주 여부" value={form.drinking} options={[NONE, "금주 실천 중", "가끔", "주 1~2회", "자주"]} onSelect={(value) => set("drinking", value)} />
              <InputField
                label="알레르기 정보"
                value={form.allergies}
                onChange={(value) => set("allergies", value)}
                placeholder="예: 땅콩, 우유, 갑각류 / 없으면 없음"
              />
            </section>
        )}

        {step === 2 && (
            <section className="su-section">
              <div className="su-section-title">복약 정보</div>
              <ChipField label="현재 복용 중인 약 개수" value={form.medicineCount} options={MEDICINE_COUNTS} onSelect={handleMedicineCountChange} />
              <div className="su-medication-list">
                {form.medications.map((medicine, index) => (
                  <div className="su-medication-card" key={`medicine-${index}`}>
                    <div className="su-medication-head">
                      <strong>복용 약 {index + 1}</strong>
                      <button type="button" onClick={() => removeMedicine(index)}>삭제</button>
                    </div>
                    <InputField label="약 이름" value={medicine.name} onChange={(value) => setMedicine(index, "name", value)} placeholder="혈압약" />
                    <div className="su-row">
                      <InputField label="복용 시작일" type="date" value={medicine.startDate} onChange={(value) => setMedicine(index, "startDate", value)} />
                      <InputField label="복용 종료일" type="date" value={medicine.endDate} onChange={(value) => setMedicine(index, "endDate", value)} disabled={medicine.ongoing} />
                    </div>
                    <label className="su-inline-check">
                      <input
                        type="checkbox"
                        checked={medicine.ongoing}
                        onChange={(event) => {
                          setMedicine(index, "ongoing", event.target.checked);
                          if (event.target.checked) setMedicine(index, "endDate", "");
                        }}
                      />
                      <span>계속 복용 중이라 종료일이 없어요</span>
                    </label>
                    <div className="su-row">
                      <InputField label="복용 간격(시간)" type="number" value={medicine.interval} onChange={(value) => setMedicine(index, "interval", value)} placeholder="예: 8" />
                      <InputField label="하루 복용 횟수" type="number" value={medicine.dailyCount} onChange={(value) => setMedicine(index, "dailyCount", value)} placeholder="2" />
                    </div>
                    <label className="su-inline-check">
                      <input
                        type="checkbox"
                        checked={medicine.alertEnabled || false}
                        onChange={(event) => setMedicine(index, "alertEnabled", event.target.checked)}
                      />
                      <span>이 약 복용 시간에 알림 받기</span>
                    </label>
                  </div>
                ))}
              </div>
              <button className="su-add-line-btn" type="button" onClick={addMedicine}>+ 복용 약 추가</button>
            </section>
        )}

        {step === 3 && (
            <section className="su-section">
              <div className="su-section-title">건강 상태</div>
              <div className="su-hint">어려운 의학 단계 대신 일상에서 판단하기 쉬운 기준으로 선택해주세요.</div>
              {CHRONIC.map(({ key, label, levels }) => (
                <ChipField key={key} label={label} value={form[key]} options={levels} onSelect={(value) => set(key, value)} />
              ))}
            </section>
        )}

        {step === 4 && (
            <section className="su-section">
              <div className="su-section-title">거동/인지/감각</div>
              <ChipField label="보행 보조기구" value={form.walkingAid} options={[NONE, "지팡이", "보행기", "휠체어"]} onSelect={(value) => set("walkingAid", value)} />
              <ChipField label="기억하거나 판단하는 데 어려움" value={form.dementia} options={[NONE, "가끔 헷갈림", "도움이 자주 필요함"]} onSelect={(value) => set("dementia", value)} />
              <ChipField label="눈으로 보는 데 어려움" value={form.vision} options={VISION_LEVELS} onSelect={(value) => set("vision", value)} />
              <ChipField label="귀로 듣는 데 어려움" value={form.hearing} options={HEARING_LEVELS} onSelect={(value) => set("hearing", value)} />
              <ChipField label="최근 1년 낙상 경험" value={form.recentFall} options={[NONE, "1회", "2~3회", "4회 이상"]} onSelect={(value) => set("recentFall", value)} />
            </section>
        )}

        {step === 5 && (() => {
          const needsCheck = [
            form.livingCostStatus,
            form.householdType,
            form.pensionStatus,
            form.housingType,
            ...(form.currentBenefits || []),
            ...(form.careNeeds || []),
          ].includes("잘 모르겠어요");
          return (
            <section className="su-section">
              <SectionTitle step={step}>복지 정보</SectionTitle>
              <div className="su-hint">복지 제도 추천과 상담에 필요한 기본 정보입니다. 잘 모르는 항목은 나중에 보호자나 복지사가 도와드릴 수 있어요.</div>
              <ChipField label="생활비 상황" value={form.livingCostStatus} options={LIVING_COST_STATUSES} onSelect={(value) => set("livingCostStatus", value)} />
              <ChipField label="가구 형태" value={form.householdType} options={HOUSEHOLD_TYPES} onSelect={(value) => set("householdType", value)} />
              <MultiChipField label="현재 받고 있는 복지 혜택" values={form.currentBenefits} options={CURRENT_BENEFITS} onToggle={(value) => toggleArr("currentBenefits", value)} />
              <ChipField label="연금 수급 상태" value={form.pensionStatus} options={PENSION_STATUSES} onSelect={(value) => set("pensionStatus", value)} />
              <ChipField label="주거 형태" value={form.housingType} options={HOUSING_TYPES} onSelect={(value) => set("housingType", value)} />
              <MultiChipField label="도움이 필요한 일" values={form.careNeeds} options={CARE_NEEDS} onToggle={(value) => toggleArr("careNeeds", value)} />
              <div className="su-field">
                <label className="su-label">그 밖에 참고사항</label>
                <textarea className="su-input su-textarea" value={form.welfareMemo} onChange={(event) => set("welfareMemo", event.target.value)} rows={4} placeholder="예: 구청 지원, 병원비 지원, 식사 지원 등" />
              </div>
              {needsCheck && (
                <div className="su-guardian-notice">
                  <strong>잘 모르는 항목이 있어요</strong>
                  <p>보호자나 복지사가 나중에 확인 후 입력해 드릴 수 있어요. 일단 그대로 진행하셔도 됩니다.</p>
                </div>
              )}
            </section>
          );
        })()}

        {step === 6 && (
          <section className="su-section">
            <SectionTitle step={step} onSkip={submit} skipDisabled={saving || uploadingPhoto}>활동 및 일자리 조건</SectionTitle>
            <div className="su-row">
              <SelectField label="하루 최대 활동 가능 시간" value={form.maxHours} options={["", "2", "4", "6", "8"]} optionLabels={{ "": "선택해주세요", 2: "2시간 이내", 4: "4시간 이내", 6: "6시간 이내", 8: "8시간 이내" }} onChange={(value) => set("maxHours", value)} required />
              <SelectField label="이동 가능 거리" value={form.maxDistance} options={["", "도보 10분 이내", "도보 30분 이내", "대중교통 30분 이내", "대중교통 1시간 이내"]} optionLabels={{ "": "선택해주세요" }} onChange={(value) => set("maxDistance", value)} required />
            </div>
            <MultiChipField label="하기 어려운 작업" values={form.disabledWork} options={WORK_TYPES} onToggle={(value) => toggleArr("disabledWork", value)} />
            <SelectField label="쉬는 시간이 얼마나 필요하세요?" value={form.restNeed} options={REST_NEEDS} onChange={(value) => set("restNeed", value)} />
            <MultiChipField label="피하고 싶은 작업 환경" values={form.avoidEnvironment} options={AVOID_ENVIRONMENTS} onToggle={(value) => toggleArr("avoidEnvironment", value)} />
            <ChipField label="희망 급여 형태" value={form.payType} options={["무관", "시급", "월급", "일당"]} onSelect={(value) => set("payType", value)} />
            <MultiChipField label="희망 근무 요일" values={form.hopeDays} options={DAYS} onToggle={(value) => toggleArr("hopeDays", value)} />
            <MultiChipField label="희망 직종" values={form.hopeJobType} options={JOB_TYPES} onToggle={(value) => toggleArr("hopeJobType", value)} />
            <MultiChipField label="희망 근무 형태" values={form.hopeCondition} options={JOB_CONDITIONS} onToggle={(value) => toggleArr("hopeCondition", value)} />
            <div className="su-field">
              <label className="su-label">기타 희망사항</label>
              <textarea className="su-input su-textarea" value={form.memo} onChange={(event) => set("memo", event.target.value)} rows={4} />
            </div>
          </section>
        )}

        <div className={`su-btn-row ${step === 0 ? "su-btn-row-end" : ""}`}>
          {step > 0 && <button className="su-btn-prev" type="button" onClick={() => setStep((prev) => prev - 1)}>이전</button>}
          <button className="su-btn-next" type="button" onClick={handleNext} disabled={saving || uploadingPhoto}>
            {saving ? "저장 중..." : step < STEPS.length - 1 ? "다음" : "등록 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, step, onSkip, skipDisabled }) {
  const isLast = step === STEPS.length - 1;
  return (
    <div className="su-section-title-row">
      <div className="su-section-title">{children}</div>
      <div className="su-section-progress">
        {isLast && onSkip ? (
          <button className="su-btn-skip" type="button" onClick={onSkip} disabled={skipDisabled}>
            건너뛰기
          </button>
        ) : (
          <>
            <span className="su-section-step-circle">{step + 1}</span>
            <span className="su-section-step-text">/ {STEPS.length}</span>
          </>
        )}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "", required = false, disabled = false }) {
  return (
    <div className="su-field">
      <label className="su-label">{label} {required && <span className="su-required">*</span>}</label>
      <input className="su-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

function AddressInput(props) {
  return <InputField {...props} />;
}

function SelectField({ label, value, options, optionLabels = {}, onChange, required = false }) {
  return (
    <div className="su-field">
      <label className="su-label">{label} {required && <span className="su-required">*</span>}</label>
      <select className="su-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택</option>
        {options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}
      </select>
    </div>
  );
}

function ChipField({ label, value, options, onSelect }) {
  return (
    <div className="su-field">
      <label className="su-label">{label}</label>
      <div className="su-check-group">
        {options.map((option) => (
          <button key={option} className={`su-chip ${value === option ? "on" : ""}`} type="button" onClick={() => onSelect(value === option ? "" : option)}>{option}</button>
        ))}
      </div>
    </div>
  );
}

function MultiChipField({ label, values, options, onToggle }) {
  return (
    <div className="su-field">
      <label className="su-label">{label}</label>
      <div className="su-check-group">
        {options.map((option) => (
          <button key={option} className={`su-chip ${(values || []).includes(option) ? "on" : ""}`} type="button" onClick={() => onToggle(option)}>{option}</button>
        ))}
      </div>
    </div>
  );
}
