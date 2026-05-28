import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProfilePhotoPicker from "../../components/ProfilePhotoPicker.jsx";
import { uploadProfileImage } from "../../api/userPageApi.js";
import { formatPhoneNumber } from "../../utils/common/phone.js";
import {
  CHRONIC,
  DAYS,
  DISABILITY_GRADES,
  DISABILITY_TYPES,
  JOB_CONDITIONS,
  JOB_TYPES,
  MEDICINE_COUNTS,
  NONE,
  WORK_TYPES,
  calculateAge,
  calcBMI,
  createMedicine,
  defaultForm,
  normalizeForm,
  syncMedicationsWithCount,
} from "../../utils/user/profileForm.js";
import "../../css/common/SignUp.css";

const STEPS = ["기본 정보", "건강/복약", "보호/일자리"];

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

  const bmi = useMemo(() => calcBMI(form.height, form.weight), [form.height, form.weight]);
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
      set("profileImageUrl", imageUrl);
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
      if (!form.city.trim() || !form.district.trim() || !form.dong.trim()) return "시/구/동 주소를 입력해주세요.";
      if (!form.phone.trim()) return "전화번호를 입력해주세요.";
    }

    if (step === 1) {
      if (!form.height) return "키를 입력해주세요.";
      if (!form.weight) return "몸무게를 입력해주세요.";
    }

    if (step === 2) {
      if (!form.maxHours) return "하루 최대 활동 가능 시간을 선택해주세요.";
      if (!form.maxDistance) return "이동 가능 거리를 선택해주세요.";
    }

    return "";
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      const payload = normalizeForm(form);
      const response = await fetch("http://localhost:8080/api/seniors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("signup failed");

      const profile = await response.json();
      sessionStorage.setItem("currentSenior", JSON.stringify(profile));
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
              <AddressInput label="동" value={form.dong} onChange={(value) => set("dong", value)} placeholder="역삼동" required />
              <AddressInput label="상세주소" value={form.detailAddress} onChange={(value) => set("detailAddress", value)} placeholder="101동 1203호" />
            </div>

            <div className="su-field">
              <label className="su-label">전화번호 <span className="su-required">*</span></label>
              <input className="su-input" value={form.phone} onChange={(event) => set("phone", formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
            </div>

            <div className="su-row">
              <SelectField label="장애 등급" value={form.disabilityGrade} options={DISABILITY_GRADES} onChange={(value) => set("disabilityGrade", value)} />
              <SelectField label="장애 유형" value={form.disabilityType} options={DISABILITY_TYPES} onChange={(value) => set("disabilityType", value)} />
            </div>
          </section>
        )}

        {step === 1 && (
          <>
            <section className="su-section">
              <SectionTitle step={step}>건강 정보</SectionTitle>
              <div className="su-row">
                <InputField label="키(cm)" type="number" value={form.height} onChange={(value) => set("height", value)} required />
                <InputField label="몸무게(kg)" type="number" value={form.weight} onChange={(value) => set("weight", value)} required />
              </div>

              {bmi && (
                <div className="su-bmi-box">
                  <div><div className="su-bmi-label">BMI</div><div className="su-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div></div>
                  <div><div className="su-bmi-label">판정</div><div className="su-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div></div>
                </div>
              )}

              <ChipField label="흡연 여부" value={form.smoking} options={[NONE, "과거 흡연", "흡연 중"]} onSelect={(value) => set("smoking", value)} />
              <ChipField label="음주 여부" value={form.drinking} options={[NONE, "가끔", "자주"]} onSelect={(value) => set("drinking", value)} />
              <InputField
                label="알레르기 정보"
                value={form.allergies}
                onChange={(value) => set("allergies", value)}
                placeholder="예: 땅콩, 우유, 갑각류 / 없으면 없음"
              />
            </section>

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
                  </div>
                ))}
              </div>
              <button className="su-add-line-btn" type="button" onClick={addMedicine}>+ 복용 약 추가</button>
            </section>

            <section className="su-section">
              <div className="su-section-title">건강 상태</div>
              <div className="su-hint">어려운 의학 단계 대신 일상에서 판단하기 쉬운 기준으로 선택해주세요.</div>
              {CHRONIC.map(({ key, label, levels }) => (
                <ChipField key={key} label={label} value={form[key]} options={levels} onSelect={(value) => set(key, value)} />
              ))}
            </section>
          </>
        )}

        {step === 2 && (
          <section className="su-section">
            <SectionTitle step={step}>활동 및 일자리 조건</SectionTitle>
            <div className="su-row">
              <SelectField label="하루 최대 활동 가능 시간" value={form.maxHours} options={["", "2", "4", "6", "8"]} optionLabels={{ "": "선택해주세요", 2: "2시간 이내", 4: "4시간 이내", 6: "6시간 이내", 8: "8시간 이내" }} onChange={(value) => set("maxHours", value)} required />
              <SelectField label="이동 가능 거리" value={form.maxDistance} options={["", "도보 10분 이내", "도보 30분 이내", "대중교통 30분 이내", "대중교통 1시간 이내"]} optionLabels={{ "": "선택해주세요" }} onChange={(value) => set("maxDistance", value)} required />
            </div>
            <MultiChipField label="하기 어려운 작업" values={form.disabledWork} options={WORK_TYPES} onToggle={(value) => toggleArr("disabledWork", value)} />
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

function SectionTitle({ children, step }) {
  return (
    <div className="su-section-title-row">
      <div className="su-section-title">{children}</div>
      <div className="su-section-progress">
        <span className="su-section-step-circle">{step + 1}</span>
        <span className="su-section-step-text">/ {STEPS.length}</span>
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
          <button key={option} className={`su-chip ${value === option ? "on" : ""}`} type="button" onClick={() => onSelect(option)}>{option}</button>
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
