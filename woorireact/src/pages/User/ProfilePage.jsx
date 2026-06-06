import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ProfilePhotoPicker from "../../components/ProfilePhotoPicker.jsx";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import { readAlert, resolveUploadUrl, uploadProfileImage } from "../../api/userPageApi.js";
import { notifyProfileUpdateComplete } from "../../api/welfareDashboardApi.js";
import { SPRING_API_BASE } from "../../config/api.js";
import { formatPhoneNumber } from "../../utils/common/phone.js";
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
  SECTIONS,
  VISION_LEVELS,
  HEARING_LEVELS,
  WORK_TYPES,
  calculateAge,
  calcBMI,
  createMedicine,
  defaultForm,
  normalizeForm,
  profileToForm,
  syncMedicationsWithCount,
} from "../../utils/user/profileForm.js";
import "../../css/user/ProfilePage.css";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(defaultForm);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [activeSection, setActiveSection] = useState("personal");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const requestedSection = searchParams.get("section");

    if (SECTIONS.some((section) => section.id === requestedSection)) {
       
      setActiveSection(requestedSection);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedCurrentSenior = sessionStorage.getItem("currentSenior");
        if (savedCurrentSenior) {
          const cachedProfile = JSON.parse(savedCurrentSenior);
          const seniorId = cachedProfile?.senior?.id;
          if (seniorId) {
            const response = await fetch(`${SPRING_API_BASE}/api/seniors/${seniorId}`);
            if (response.ok) {
              const freshProfile = await response.json();
              sessionStorage.setItem("currentSenior", JSON.stringify(freshProfile));
              setForm(profileToForm(freshProfile));
              setIsLoaded(true);
              return;
            }
          }
        }

        const response = await fetch(`${SPRING_API_BASE}/api/seniors`);
        if (!response.ok) return;
        const profiles = await response.json();
        const latestProfile = profiles[profiles.length - 1];
        if (!latestProfile) return;
        sessionStorage.setItem("currentSenior", JSON.stringify(latestProfile));
        setForm(profileToForm(latestProfile));
        setIsLoaded(true);
      } catch (error) {
        console.error("프로필 정보 조회 실패:", error);
        setIsLoaded(true);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

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

  const bmi = useMemo(() => calcBMI(form.height, form.weight, form.gender), [form.height, form.weight, form.gender]);

  const saveProfile = async (nextForm) => {
    const savedCurrentSenior = sessionStorage.getItem("currentSenior");
    if (!savedCurrentSenior) throw new Error("수정할 사용자 정보를 찾을 수 없습니다.");

    const profile = JSON.parse(savedCurrentSenior);
    const seniorId = profile?.senior?.id;
    if (!seniorId) throw new Error("사용자 ID를 찾을 수 없습니다.");

    // PUT /api/seniors/{id} 는 flat SeniorCreateRequest를 기대함
    // formToProfile(중첩구조)를 보내면 Jackson이 모든 필드를 null로 읽어서 데이터가 날아감
    const payload = {
      ...normalizeForm(nextForm),
      profileImageUrl: resolveUploadUrl(nextForm.profileImageUrl),
      heartDisease: nextForm.heart,
      jointDisease: nextForm.joint,
      kidneyDisease: nextForm.kidney,
      lungDisease: nextForm.lung,
      respiratoryDisease: nextForm.lung,
      liverDisease: nextForm.liver,
      // 백엔드가 List<String>으로 받는 필드 — normalizeForm이 CSV로 변환하므로 배열로 덮어쓰기
      currentBenefits: nextForm.currentBenefits || [],
      careNeeds: nextForm.careNeeds || [],
      disabledWork: nextForm.disabledWork || [],
      avoidEnvironment: nextForm.avoidEnvironment || [],
      hopeDays: nextForm.hopeDays || [],
      hopeJobType: nextForm.hopeJobType || [],
      hopeCondition: nextForm.hopeCondition || [],
    };
    const response = await fetch(`${SPRING_API_BASE}/api/seniors/${seniorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`프로필 수정 실패 (${response.status})${text ? `: ${text}` : ""}`);
    }
    const updatedProfile = await response.json();
    sessionStorage.setItem("currentSenior", JSON.stringify(updatedProfile));
    setForm(profileToForm(updatedProfile));
    return updatedProfile;
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const { imageUrl } = await uploadProfileImage(file);
      const nextForm = { ...form, profileImageUrl: resolveUploadUrl(imageUrl) };
      setForm(nextForm);
      await saveProfile(nextForm);
    } catch (error) {
      console.error("프로필 사진 업로드 실패:", error);
      alert("프로필 사진 업로드에 실패했습니다.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!isLoaded) return;
    const alertId = searchParams.get("alertId");
    try {
      setSaving(true);
      setSaveToast("saving");
      const updatedProfile = await saveProfile(form);
      if (alertId) {
        const seniorId = updatedProfile?.senior?.id;
        await readAlert(alertId).catch(() => {});
        if (seniorId) {
          await notifyProfileUpdateComplete({ seniorId, alertId }).catch(() => {});
        }
      }
      setSaveToast("saved");
      setTimeout(() => {
        setSaveToast(null);
        navigate("/user");
      }, 1000);
    } catch (error) {
      setSaveToast(null);
      console.error("프로필 수정 실패:", error);
      alert(error.message || "정보 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case "personal":
        return (
          <section className="pr-section">
            <div className="pr-section-header">
              <h2>인적사항</h2>
            </div>
            <ProfilePhotoPicker
              classPrefix="pr"
              imageUrl={form.profileImageUrl}
              uploading={uploadingPhoto}
              onChange={handleProfileImageChange}
              onRemove={() => set("profileImageUrl", "")}
              alt="프로필 사진"
            />
            <InputField label="이름" value={form.name} onChange={(value) => set("name", value)} />
            <div className="pr-row">
              <InputField
                label="생년월일"
                type="date"
                value={form.birthDate}
                onChange={(value) => {
                  const age = calculateAge(value);
                  setForm((prev) => ({
                    ...prev,
                    birthDate: value,
                    age: age ? String(age) : "",
                  }));
                }}
              />
              <SelectField label="성별" value={form.gender} options={["", "여성", "남성", "기타"]} labels={{ "": "선택" }} onChange={(value) => set("gender", value)} />
            </div>
            <div className="pr-row">
              <InputField label="시/도" value={form.city} onChange={(value) => set("city", value)} />
              <InputField label="구/군" value={form.district} onChange={(value) => set("district", value)} />
            </div>
            <div className="pr-row">
              <InputField label="도로명/지명/동네" value={form.dong} onChange={(value) => set("dong", value)} placeholder="예: 역삼로, 역삼역, 역삼동" />
              <InputField label="상세주소" value={form.detailAddress} onChange={(value) => set("detailAddress", value)} placeholder="예: 101동 1203호" />
            </div>
            <div className="pr-row">
              <InputField label="연락처" value={form.phone} onChange={(value) => set("phone", formatPhoneNumber(value))} />
              <SelectField label="장애 등급" value={form.disabilityGrade} options={DISABILITY_GRADES} onChange={(value) => set("disabilityGrade", value)} />
            </div>
            <SelectField label="장애 유형" value={form.disabilityType} options={DISABILITY_TYPES} onChange={(value) => set("disabilityType", value)} />
          </section>
        );

      case "body":
        return (
          <section className="pr-section">
            <div className="pr-section-title">신체정보</div>
            <div className="pr-row">
              <InputField label="키(cm)" type="number" value={form.height} onChange={(value) => set("height", value)} />
              <InputField label="몸무게(kg)" type="number" value={form.weight} onChange={(value) => set("weight", value)} />
            </div>
            {bmi && (
              <div className="pr-bmi-box">
                <div className="pr-bmi-item"><div className="pr-bmi-label">BMI</div><div className="pr-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div></div>
                <div className="pr-bmi-item"><div className="pr-bmi-label">판정</div><div className="pr-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div></div>
                <div className="pr-bmi-guide">{bmi.guide}</div>
              </div>
            )}
            <ChipField label="흡연 여부" value={form.smoking} options={[NONE, "금연 중", "과거 흡연", "가끔 흡연", "흡연 중"]} onSelect={(value) => set("smoking", value)} />
            <ChipField label="음주 여부" value={form.drinking} options={[NONE, "금주 실천 중", "가끔", "주 1~2회", "자주"]} onSelect={(value) => set("drinking", value)} />
            <InputField label="알레르기 정보" value={form.allergies} onChange={(value) => set("allergies", value)} />
          </section>
        );

      case "medication":
        return (
          <section className="pr-section">
            <div className="pr-section-title">복약정보</div>
            <ChipField label="현재 복용 중인 약 개수" value={form.medicineCount} options={MEDICINE_COUNTS} onSelect={handleMedicineCountChange} />
            {form.medications.map((medicine, index) => (
              <div className="pr-medication-card" key={`medicine-${index}`}>
                <div className="pr-medication-head">
                  <strong>복용 약 {index + 1}</strong>
                  <button type="button" onClick={() => removeMedicine(index)}>삭제</button>
                </div>
                <InputField label="약 이름" value={medicine.name} onChange={(value) => setMedicine(index, "name", value)} />
                <div className="pr-row">
                  <InputField label="복용 시작일" type="date" value={medicine.startDate} onChange={(value) => setMedicine(index, "startDate", value)} />
                  <InputField label="복용 종료일" type="date" value={medicine.endDate} onChange={(value) => setMedicine(index, "endDate", value)} disabled={medicine.ongoing} />
                </div>
                <label className="pr-inline-check">
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
                <div className="pr-row">
                  <InputField label="복용 간격(시간)" type="number" value={medicine.interval} onChange={(value) => setMedicine(index, "interval", value)} />
                  <InputField label="하루 복용 횟수" type="number" value={medicine.dailyCount} onChange={(value) => setMedicine(index, "dailyCount", value)} />
                </div>
                <label className="pr-inline-check">
                  <input
                    type="checkbox"
                    checked={medicine.alertEnabled || false}
                    onChange={(event) => setMedicine(index, "alertEnabled", event.target.checked)}
                  />
                  <span>이 약 복용 시간에 알림 받기</span>
                </label>
              </div>
            ))}
            <button className="pr-add-line-btn" type="button" onClick={addMedicine}>+ 복용 약 추가</button>
          </section>
        );

      case "chronic":
        return (
          <section className="pr-section">
            <div className="pr-section-title">만성질환</div>
            <div className="pr-hint">의학적 등급보다 실제 생활 기준에 맞춰 선택해주세요.</div>
            {CHRONIC.map(({ key, label, levels }) => (
              <ChipField key={key} label={label} value={form[key]} options={levels} onSelect={(value) => set(key, value)} />
            ))}
          </section>
        );

      case "mobility":
        return (
          <section className="pr-section">
            <div className="pr-section-title">거동/인지/감각</div>
            <ChipField label="보행 보조기구" value={form.walkingAid} options={[NONE, "지팡이", "보행기", "휠체어"]} onSelect={(value) => set("walkingAid", value)} />
            <ChipField label="기억하거나 판단하는 데 어려움" value={form.dementia} options={[NONE, "가끔 헷갈림", "도움이 자주 필요함"]} onSelect={(value) => set("dementia", value)} />
            <ChipField label="눈으로 보는 데 어려움" value={form.vision} options={VISION_LEVELS} onSelect={(value) => set("vision", value)} />
            <ChipField label="귀로 듣는 데 어려움" value={form.hearing} options={HEARING_LEVELS} onSelect={(value) => set("hearing", value)} />
            <ChipField label="최근 1년 낙상 경험" value={form.recentFall} options={[NONE, "1회", "2~3회", "4회 이상"]} onSelect={(value) => set("recentFall", value)} />
            <ChipField label="수술 이력" value={form.hasSurgery} options={[NONE, "있음"]} onSelect={(value) => set("hasSurgery", value)} />
            {form.hasSurgery === "있음" && <TextareaField label="수술 내용" value={form.surgeryDetail} onChange={(value) => set("surgeryDetail", value)} />}
            <TextareaField label="기타 건강 참고사항" value={form.otherDisease} onChange={(value) => set("otherDisease", value)} />
          </section>
        );

      case "activity":
        return (
          <section className="pr-section">
            <div className="pr-section-title">활동 조건</div>
            <div className="pr-row">
              <SelectField label="하루 최대 활동 시간" value={form.maxHours} options={["", "2", "4", "6", "8"]} labels={{ "": "선택", 2: "2시간 이내", 4: "4시간 이내", 6: "6시간 이내", 8: "8시간 이내" }} onChange={(value) => set("maxHours", value)} />
              <SelectField label="이동 가능 거리" value={form.maxDistance} options={["", "도보 10분 이내", "도보 30분 이내", "대중교통 30분 이내", "대중교통 1시간 이내"]} labels={{ "": "선택" }} onChange={(value) => set("maxDistance", value)} />
            </div>
            <MultiChipField label="하기 어려운 작업" values={form.disabledWork} options={WORK_TYPES} onToggle={(value) => toggleArr("disabledWork", value)} />
            <SelectField label="쉬는 시간이 얼마나 필요하세요?" value={form.restNeed} options={REST_NEEDS} onChange={(value) => set("restNeed", value)} />
            <MultiChipField label="피하고 싶은 작업 환경" values={form.avoidEnvironment} options={AVOID_ENVIRONMENTS} onToggle={(value) => toggleArr("avoidEnvironment", value)} />
          </section>
        );

      case "welfare": {
        const needsCheck = [
          form.livingCostStatus,
          form.householdType,
          form.pensionStatus,
          form.housingType,
          ...(form.currentBenefits || []),
          ...(form.careNeeds || []),
        ].includes("잘 모르겠어요");
        return (
          <section className="pr-section">
            <div className="pr-section-title">복지정보</div>
            <div className="pr-hint">복지 지원 대상 여부와 필요한 서비스를 파악하기 위한 정보입니다.</div>
            <ChipField label="생활비 상황" value={form.livingCostStatus} options={LIVING_COST_STATUSES} onSelect={(value) => set("livingCostStatus", value)} />
            <ChipField label="가구 형태" value={form.householdType} options={HOUSEHOLD_TYPES} onSelect={(value) => set("householdType", value)} />
            <MultiChipField label="현재 받고 있는 복지 혜택" values={form.currentBenefits} options={CURRENT_BENEFITS} onToggle={(value) => toggleArr("currentBenefits", value)} />
            <ChipField label="연금 수급 상태" value={form.pensionStatus} options={PENSION_STATUSES} onSelect={(value) => set("pensionStatus", value)} />
            <ChipField label="주거 형태" value={form.housingType} options={HOUSING_TYPES} onSelect={(value) => set("housingType", value)} />
            <MultiChipField label="도움이 필요한 일" values={form.careNeeds} options={CARE_NEEDS} onToggle={(value) => toggleArr("careNeeds", value)} />
            <TextareaField label="그 밖에 참고사항" value={form.welfareMemo} onChange={(value) => set("welfareMemo", value)} rows={4} />
            {needsCheck && (
              <div className="pr-guardian-notice">
                <strong>복지사 확인 필요</strong>
                <p>일부 항목을 잘 모르겠다고 하셨어요. 보호자나 복지사가 확인 후 입력해 드릴 수 있어요.</p>
              </div>
            )}
          </section>
        );
      }

      case "job":
        return (
          <section className="pr-section">
            <div className="pr-section-title">일자리 희망 조건</div>
            <ChipField label="희망 급여 형태" value={form.payType} options={["무관", "시급", "월급", "일당"]} onSelect={(value) => set("payType", value)} />
            <MultiChipField label="희망 근무 요일" values={form.hopeDays} options={DAYS} onToggle={(value) => toggleArr("hopeDays", value)} />
            <MultiChipField label="희망 직종" values={form.hopeJobType} options={JOB_TYPES} onToggle={(value) => toggleArr("hopeJobType", value)} />
            <MultiChipField label="희망 근무 형태" values={form.hopeCondition} options={JOB_CONDITIONS} onToggle={(value) => toggleArr("hopeCondition", value)} />
            <TextareaField label="기타 희망사항" value={form.memo} onChange={(value) => set("memo", value)} rows={4} />
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pr-root">
      <UserCommonHeader />

      <div className="pr-layout">
        <aside>
          <div className="pr-sidenav">
            {SECTIONS.map((section) => (
              <button key={section.id} className={`pr-sidenav-item ${activeSection === section.id ? "active" : ""}`} type="button" onClick={() => setActiveSection(section.id)}>
                {section.label}
              </button>
            ))}
          </div>
          <div className="pr-side-actions">
            <button className="pr-reset-btn" type="button" onClick={() => setForm(defaultForm)} disabled={saving}>
              초기화
            </button>
            <button className="pr-save-btn" type="button" onClick={handleSave} disabled={saving || !isLoaded}>
              {!isLoaded ? "불러오는 중..." : saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </aside>

        <main className="pr-main">{renderSection()}</main>
      </div>

      {saveToast && (
        <div className="pr-save-popup-backdrop" role="status" aria-live="polite">
          <div className="pr-save-popup">
            {saveToast === "saving" ? (
              <div className="pr-save-spinner" aria-hidden="true" />
            ) : (
              <div className="pr-save-check" aria-hidden="true">✓</div>
            )}
            <div className="pr-save-popup-title">
              {saveToast === "saving" ? "저장 중입니다" : "저장되었습니다"}
            </div>
            <p className="pr-save-popup-desc">
              {saveToast === "saving" ? "변경한 정보를 반영하고 있어요." : "내 정보가 정상적으로 반영되었어요."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "", readOnly = false, disabled = false }) {
  return (
    <div className="pr-field">
      <label className="pr-label">{label}</label>
      <input className="pr-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} disabled={disabled} />
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 3 }) {
  return (
    <div className="pr-field">
      <label className="pr-label">{label}</label>
      <textarea className="pr-input pr-textarea" value={value} onChange={(event) => onChange(event.target.value)} rows={rows} />
    </div>
  );
}

function SelectField({ label, value, options, labels = {}, onChange }) {
  return (
    <div className="pr-field">
      <label className="pr-label">{label}</label>
      <select className="pr-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
      </select>
    </div>
  );
}

function ChipField({ label, value, options, onSelect }) {
  return (
    <div className="pr-field">
      <label className="pr-label">{label}</label>
      <div className="pr-chip-group">
        {options.map((option) => (
          <button key={option} className={`pr-chip ${value === option ? "on" : ""}`} type="button" onClick={() => onSelect(option)}>{option}</button>
        ))}
      </div>
    </div>
  );
}

function MultiChipField({ label, values, options, onToggle }) {
  return (
    <div className="pr-field">
      <label className="pr-label">{label}</label>
      <div className="pr-chip-group">
        {options.map((option) => (
          <button key={option} className={`pr-chip ${(values || []).includes(option) ? "on" : ""}`} type="button" onClick={() => onToggle(option)}>{option}</button>
        ))}
      </div>
    </div>
  );
}
