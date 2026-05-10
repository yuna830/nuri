import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveUploadUrl, uploadProfileImage } from "../../api/userPageApi.js";
import { formatPhoneNumber } from "../../utils/common/phone.js";
import "../../css/common/SignUp.css";

const STEPS = ["기본 정보", "건강 정보", "활동과 일자리"];
const DISABILITY_GRADES = ["없음", "심하지 않은 장애", "심한 장애", "1급", "2급", "3급", "4급", "5급", "6급"];
const DISABILITY_TYPES = ["해당 없음", "지체장애", "뇌병변장애", "시각장애", "청각장애", "언어장애", "지적장애", "자폐성장애", "정신장애", "신장장애", "심장장애", "호흡기장애", "간장애", "안면장애", "장루·요루장애", "뇌전증장애", "기타"];
const SIMPLE_LEVELS = ["없음", "경증", "중증"];
const CHRONIC = [
  { key: "diabetes", label: "당뇨" },
  { key: "hypertension", label: "고혈압" },
  { key: "heart", label: "심장질환" },
  { key: "joint", label: "관절질환" },
  { key: "stroke", label: "뇌졸중" },
  { key: "kidney", label: "신장질환" },
  { key: "lung", label: "호흡기질환" },
  { key: "liver", label: "간질환" },
  { key: "cancer", label: "암" },
];
const WORK_TYPES = ["장시간 서 있기", "야외 작업", "야간 근무", "무거운 물건 운반", "컴퓨터 작업", "계단 이동", "반복 작업", "고객 응대"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const JOB_TYPES = ["경비·청소", "급식·조리 보조", "사무 보조", "돌봄 보조", "작업·수공예", "판매·안내", "환경 정비", "상관없음"];
const JOB_CONDITIONS = ["실내 근무 선호", "안전 근무", "오후 근무", "주 3일 이하", "단기 가능", "앉아서 근무"];

const defaultForm = {
  name: "",
  age: "",
  gender: "",
  region: "",
  phone: "",
  profileImageUrl: "",
  disabilityGrade: "없음",
  disabilityType: "해당 없음",
  height: "",
  weight: "",
  smoking: "없음",
  drinking: "없음",
  medicineCount: "없음",
  diabetes: "없음",
  hypertension: "없음",
  heart: "없음",
  joint: "없음",
  stroke: "없음",
  kidney: "없음",
  lung: "없음",
  liver: "없음",
  cancer: "없음",
  walkingAid: "없음",
  dementia: "없음",
  vision: "없음",
  hearing: "없음",
  recentFall: "없음",
  hasSurgery: "없음",
  surgeryDetail: "",
  otherDisease: "",
  maxHours: "",
  maxDistance: "",
  disabledWork: [],
  payType: "무관",
  hopeDays: [],
  hopeJobType: [],
  hopeCondition: [],
  memo: "",
};

const calcBMI = (height, weight) => {
  const h = Number(height) / 100;
  const w = Number(weight);
  if (!h || !w || Number.isNaN(h) || Number.isNaN(w)) return null;

  const bmi = Number((w / (h * h)).toFixed(1));
  if (bmi < 18.5) return { bmi, status: "저체중", color: "#4f8fb8" };
  if (bmi < 23) return { bmi, status: "정상", color: "#5f9f72" };
  if (bmi < 25) return { bmi, status: "과체중", color: "#d89b2b" };
  return { bmi, status: "비만", color: "#d95757" };
};

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

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArr = (key, value) => {
    setForm((prev) => {
      const arr = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(value)
          ? arr.filter((item) => item !== value)
          : [...arr, value],
      };
    });
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
      if (!form.age) return "나이를 입력해주세요.";
      if (!form.gender) return "성별을 선택해주세요.";
      if (!form.region.trim()) return "거주지를 입력해주세요.";
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

      const response = await fetch("http://localhost:8080/api/seniors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          <div className="su-nav-logo">🌿 우리 woori</div>

          <div className="su-nav-actions">
            <span className="su-nav-step">
              사용자 정보 등록 {step + 1} / {STEPS.length}
            </span>
            <button className="su-nav-login" type="button" onClick={() => navigate("/")}>
              로그인
            </button>
          </div>
        </div>
      </nav>

      <div className="su-stepbar">
        <div className="su-stepbar-inner">
          {STEPS.map((stepLabel, index) => (
            <div
              key={stepLabel}
              className={`su-step-item ${index < STEPS.length - 1 ? "grow" : ""}`}
            >
              <div className={`su-step-circle ${index < step ? "done" : index === step ? "active" : ""}`}>
                {index < step ? "✓" : index + 1}
              </div>
              <span className={`su-step-label ${index === step ? "active" : ""}`}>
                {stepLabel}
              </span>
              {index < STEPS.length - 1 && (
                <div className={`su-step-line ${index < step ? "done" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="su-layout">
        {error && <div className="su-error">⚠️ {error}</div>}

        {step === 0 && (
          <section className="su-section">
            <div className="su-section-title">👤 기본 정보</div>

            <div className="su-photo-row">
              <div className="su-photo-preview">
                {form.profileImageUrl ? (
                  <img src={resolveUploadUrl(form.profileImageUrl)} alt="사용자 사진" />
                ) : (
                  <span>사진</span>
                )}
              </div>

              <div className="su-photo-actions">
                <label className="su-photo-btn">
                  {uploadingPhoto ? "업로드 중..." : "사진 선택"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    disabled={uploadingPhoto}
                  />
                </label>

                {form.profileImageUrl && (
                  <button
                    className="su-photo-remove"
                    type="button"
                    onClick={() => set("profileImageUrl", "")}
                  >
                    사진 삭제
                  </button>
                )}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">
                이름 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="예: 김영희"
              />
            </div>

            <div className="su-row">
              <div className="su-field">
                <label className="su-label">
                  나이 <span className="su-required">*</span>
                </label>
                <input
                  className="su-input"
                  type="number"
                  value={form.age}
                  onChange={(event) => set("age", event.target.value)}
                  placeholder="예: 72"
                />
              </div>

              <div className="su-field">
                <label className="su-label">
                  성별 <span className="su-required">*</span>
                </label>
                <select className="su-select" value={form.gender} onChange={(event) => set("gender", event.target.value)}>
                  <option value="">선택</option>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">
                거주지 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.region}
                onChange={(event) => set("region", event.target.value)}
                placeholder="예: 서울특별시 송파구"
              />
            </div>

            <div className="su-field">
              <label className="su-label">
                전화번호 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.phone}
                onChange={(event) => set("phone", formatPhoneNumber(event.target.value))}
                placeholder="예: 010-0000-0000"
              />
            </div>

            <div className="su-row">
              <div className="su-field">
                <label className="su-label">장애 정도</label>
                <select className="su-select" value={form.disabilityGrade} onChange={(event) => set("disabilityGrade", event.target.value)}>
                  {DISABILITY_GRADES.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div className="su-field">
                <label className="su-label">장애 유형</label>
                <select className="su-select" value={form.disabilityType} onChange={(event) => set("disabilityType", event.target.value)}>
                  {DISABILITY_TYPES.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <>
            <section className="su-section">
              <div className="su-section-title">🩺 신체 정보</div>

              <div className="su-row">
                <div className="su-field">
                  <label className="su-label">
                    키(cm) <span className="su-required">*</span>
                  </label>
                  <input
                    className="su-input"
                    type="number"
                    value={form.height}
                    onChange={(event) => set("height", event.target.value)}
                    placeholder="예: 160"
                  />
                </div>

                <div className="su-field">
                  <label className="su-label">
                    몸무게(kg) <span className="su-required">*</span>
                  </label>
                  <input
                    className="su-input"
                    type="number"
                    value={form.weight}
                    onChange={(event) => set("weight", event.target.value)}
                    placeholder="예: 58"
                  />
                </div>
              </div>

              {bmi && (
                <div className="su-bmi-box">
                  <div>
                    <div className="su-bmi-label">BMI</div>
                    <div className="su-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div>
                  </div>
                  <div>
                    <div className="su-bmi-label">판정</div>
                    <div className="su-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div>
                  </div>
                  <div className="su-bmi-guide">
                    {form.age}세 · {form.gender || "성별 미선택"} 기준 입력값으로 계산
                    <br />
                    BMI = 몸무게(kg) / 키(m)의 제곱
                  </div>
                </div>
              )}

              <div className="su-row su-row-spaced">
                <div className="su-field">
                  <label className="su-label">흡연 여부</label>
                  <div className="su-check-group">
                    {["없음", "과거 흡연", "흡연 중"].map((value) => (
                      <button key={value} className={`su-chip ${form.smoking === value ? "on" : ""}`} type="button" onClick={() => set("smoking", value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="su-field">
                  <label className="su-label">음주 여부</label>
                  <div className="su-check-group">
                    {["없음", "가끔", "자주"].map((value) => (
                      <button key={value} className={`su-chip ${form.drinking === value ? "on" : ""}`} type="button" onClick={() => set("drinking", value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="su-field">
                <label className="su-label">현재 복용 중인 약 개수</label>
                <div className="su-check-group">
                  {["없음", "1~2개", "3~5개", "6개 이상"].map((value) => (
                    <button key={value} className={`su-chip ${form.medicineCount === value ? "on" : ""}`} type="button" onClick={() => set("medicineCount", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="su-section">
              <div className="su-section-title">🏥 건강 상태</div>
              <div className="su-hint">
                정확히 모르시면 가장 가까운 정도를 선택해주세요. 나중에 내 정보 수정에서 다시 바꿀 수 있어요.
              </div>

              {CHRONIC.map(({ key, label }) => (
                <div className="su-disease-row" key={key}>
                  <span className="su-disease-label">{label}</span>
                  <div className="su-check-group">
                    {SIMPLE_LEVELS.map((level) => (
                      <button key={level} className={`su-chip ${form[key] === level ? "on" : ""}`} type="button" onClick={() => set(key, level)}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="su-section">
              <div className="su-section-title">🚶 이동·인지·감각</div>

              {[
                { key: "walkingAid", label: "보행 보조기구", options: ["없음", "지팡이", "보행기", "휠체어"] },
                { key: "dementia", label: "치매·인지 어려움", options: ["없음", "경도", "중증"] },
                { key: "vision", label: "시력 어려움", options: ["없음", "경도", "중증", "실명"] },
                { key: "hearing", label: "청력 어려움", options: ["없음", "경도", "중증"] },
                { key: "recentFall", label: "최근 1년 낙상 경험", options: ["없음", "1회", "2~3회", "4회 이상"] },
                { key: "hasSurgery", label: "수술 이력", options: ["없음", "있음"] },
              ].map(({ key, label, options }) => (
                <div className="su-disease-row" key={key}>
                  <span className="su-disease-label">{label}</span>
                  <div className="su-check-group">
                    {options.map((value) => (
                      <button key={value} className={`su-chip ${form[key] === value ? "on" : ""}`} type="button" onClick={() => set(key, value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {form.hasSurgery === "있음" && (
                <div className="su-field">
                  <label className="su-label">수술 내용</label>
                  <textarea
                    className="su-input su-textarea"
                    value={form.surgeryDetail}
                    onChange={(event) => set("surgeryDetail", event.target.value)}
                    placeholder="예: 2023년 무릎 수술"
                    rows={3}
                  />
                </div>
              )}

              <div className="su-field">
                <label className="su-label">기타 건강 참고사항</label>
                <textarea
                  className="su-input su-textarea"
                  value={form.otherDisease}
                  onChange={(event) => set("otherDisease", event.target.value)}
                  placeholder="예: 오래 서 있으면 허리가 아픔"
                  rows={3}
                />
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <section className="su-section">
            <div className="su-section-title">💼 활동과 일자리 조건</div>

            <div className="su-row">
              <div className="su-field">
                <label className="su-label">
                  하루 최대 활동 가능 시간 <span className="su-required">*</span>
                </label>
                <select className="su-select" value={form.maxHours} onChange={(event) => set("maxHours", event.target.value)}>
                  <option value="">선택해주세요</option>
                  <option value="2">2시간 이내</option>
                  <option value="4">4시간 이내</option>
                  <option value="6">6시간 이내</option>
                  <option value="8">8시간 이내</option>
                </select>
              </div>

              <div className="su-field">
                <label className="su-label">
                  이동 가능 거리 <span className="su-required">*</span>
                </label>
                <select className="su-select" value={form.maxDistance} onChange={(event) => set("maxDistance", event.target.value)}>
                  <option value="">선택해주세요</option>
                  <option value="도보 10분 이내">도보 10분 이내</option>
                  <option value="도보 30분 이내">도보 30분 이내</option>
                  <option value="대중교통 30분 이내">대중교통 30분 이내</option>
                  <option value="대중교통 1시간 이내">대중교통 1시간 이내</option>
                </select>
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">하기 어려운 작업</label>
              <div className="su-check-group">
                {WORK_TYPES.map((workType) => (
                  <button key={workType} className={`su-chip ${(form.disabledWork || []).includes(workType) ? "on" : ""}`} type="button" onClick={() => toggleArr("disabledWork", workType)}>
                    {workType}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 급여 형태</label>
              <div className="su-check-group">
                {["무관", "시급", "월급", "일당"].map((value) => (
                  <button key={value} className={`su-chip ${form.payType === value ? "on" : ""}`} type="button" onClick={() => set("payType", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 근무 요일</label>
              <div className="su-check-group">
                {DAYS.map((day) => (
                  <button key={day} className={`su-chip ${(form.hopeDays || []).includes(day) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeDays", day)}>
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 직종</label>
              <div className="su-check-group">
                {JOB_TYPES.map((value) => (
                  <button key={value} className={`su-chip ${(form.hopeJobType || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeJobType", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 근무 형태</label>
              <div className="su-check-group">
                {JOB_CONDITIONS.map((value) => (
                  <button key={value} className={`su-chip ${(form.hopeCondition || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeCondition", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">기타 희망사항</label>
              <textarea
                className="su-input su-textarea"
                value={form.memo}
                onChange={(event) => set("memo", event.target.value)}
                placeholder="예: 앉아서 할 수 있는 일을 선호함"
                rows={4}
              />
            </div>
          </section>
        )}

        <div className={`su-btn-row ${step === 0 ? "su-btn-row-end" : ""}`}>
          {step > 0 && (
            <button
              className="su-btn-prev"
              type="button"
              onClick={() => {
                setError("");
                setStep((prev) => prev - 1);
                window.scrollTo(0, 0);
              }}
            >
              ← 이전
            </button>
          )}

          <button
            className="su-btn-next"
            type="button"
            onClick={handleNext}
            disabled={saving || uploadingPhoto}
          >
            {saving ? "저장 중..." : step < STEPS.length - 1 ? "다음" : "등록 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
