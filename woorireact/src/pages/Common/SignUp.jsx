import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import "../../css/common/SignUp.css";

const WORK_TYPES = ["장시간 서기", "야외 작업", "야간 근무", "중량물 운반", "컴퓨터 작업", "계단 이동", "반복 작업", "고객 응대"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const STEPS = ["인적사항", "신체 · 건강정보", "일자리 희망조건"];

const CHRONIC = [
  { key: "diabetes", label: "🩸 당뇨", levels: ["없음", "경증 (식이요법·경구약)", "중증 (인슐린 투여)"] },
  { key: "hypertension", label: "💊 고혈압", levels: ["없음", "경증 (약 복용·조절 중)", "중증 (합병증 있음)"] },
  { key: "heart", label: "❤️ 심장질환", levels: ["없음", "경증 (부정맥·협심증 등)", "중증 (심부전·수술 이력)"] },
  { key: "joint", label: "🦴 관절질환 (무릎·허리)", levels: ["없음", "경증 (가끔 통증·약 복용)", "중증 (보조기구·수술 이력)"] },
  { key: "stroke", label: "🧠 뇌졸중·중풍", levels: ["없음", "경증 (후유증 경미)", "중증 (마비·언어장애 등)"] },
  { key: "kidney", label: "🫘 신장질환", levels: ["없음", "경증 (신기능 저하)", "중증 (투석 중)"] },
  { key: "lung", label: "🫁 폐·호흡기 질환", levels: ["없음", "경증 (천식·만성기관지염)", "중증 (COPD·산소호흡기)"] },
  { key: "liver", label: "🟡 간질환", levels: ["없음", "경증 (지방간·간염 보균)", "중증 (간경화·간암)"] },
  { key: "cancer", label: "🎗 암 (과거·현재)", levels: ["없음", "완치·관리 중", "치료 중 (항암·방사선 등)"] },
];

const defaultForm = {
  name: "",
  age: "",
  gender: "",
  region: "",
  phone: "",
  disabilityGrade: "없음",
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
  walkingAid: "없음 (스스로 보행 가능)",
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
  const h = parseFloat(height) / 100;
  const w = parseFloat(weight);

  if (!h || !w) return null;

  const bmi = (w / (h * h)).toFixed(1);
  let status = "";
  let color = "#86A788";

  if (bmi < 18.5) {
    status = "저체중";
    color = "#f0a500";
  } else if (bmi < 23) {
    status = "정상";
  } else if (bmi < 25) {
    status = "과체중";
    color = "#f0a500";
  } else {
    status = "비만";
    color = "#e05252";
  }

  return { bmi, status, color };
};

export default function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => {
    try {
      const temp = localStorage.getItem("login_temp");

      if (temp) {
        const { name, phone } = JSON.parse(temp);
        return { ...defaultForm, name, phone };
      }
    } catch {
      return defaultForm;
    }

    return defaultForm;
  });
  const [error, setError] = useState("");

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

  const bmi = useMemo(() => calcBMI(form.height, form.weight), [form.height, form.weight]);

  const validate = () => {
    if (step === 0) {
      if (!form.name) return "이름을 입력해주세요.";
      if (!form.age) return "나이를 입력해주세요.";
      if (!form.gender) return "성별을 선택해주세요.";
      if (!form.region) return "거주지를 입력해주세요.";
    }

    if (step === 1) {
      if (!form.maxHours) return "하루 최대 활동 가능 시간을 선택해주세요.";
      if (!form.maxDistance) return "이동 가능 거리를 선택해주세요.";
    }

    return "";
  };

  const handleNext = async () => {
    const validationMessage = validate();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");

    if (step < 2) {
      setStep(step + 1);
      window.scrollTo(0, 0);
      return;
    }

    const response = await fetch("http://localhost:8080/api/seniors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    const senior = data.senior;

    if (senior?.id) {
      localStorage.setItem("current_senior_id", String(senior.id));
      localStorage.setItem(
        "user_profile",
        JSON.stringify({
          ...form,
          id: senior.id,
          name: senior.name || form.name,
          region: senior.region || form.region,
        })
      );
    }

    localStorage.removeItem("login_temp");
    navigate("/user");


  return (
    <div className="su-root">
      <nav className="su-nav">
        <div className="su-nav-logo">🌿 우리 woori</div>
        <div className="su-nav-step">정보 등록 {step + 1} / 3</div>
      </nav>

      <div className="su-stepbar">
        <div className="su-stepbar-inner">
          {STEPS.map((stepLabel, index) => (
            <div
              key={stepLabel}
              className={`su-step-item ${index < STEPS.length - 1 ? "grow" : ""}`}
            >
              <div
                className={`su-step-circle ${
                  index < step ? "done" : index === step ? "active" : ""
                }`}
              >
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
          <div className="su-section">
            <div className="su-section-title">📋 인적사항</div>

            <div className="su-field">
              <label className="su-label">이름 <span className="su-required">*</span></label>
              <input className="su-input" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="홍길동" />
            </div>

            <div className="su-row">
              <div className="su-field">
                <label className="su-label">나이 <span className="su-required">*</span></label>
                <input className="su-input" type="number" value={form.age} onChange={(event) => set("age", event.target.value)} placeholder="65" />
              </div>

              <div className="su-field">
                <label className="su-label">성별 <span className="su-required">*</span></label>
                <select className="su-select" value={form.gender} onChange={(event) => set("gender", event.target.value)}>
                  <option value="">선택</option>
                  <option value="남성">남성</option>
                  <option value="여성">여성</option>
                </select>
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">거주지 (시·군·구) <span className="su-required">*</span></label>
              <input className="su-input" value={form.region} onChange={(event) => set("region", event.target.value)} placeholder="서울시 송파구" />
            </div>

            <div className="su-field">
              <label className="su-label">연락처</label>
              <input className="su-input" value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="010-0000-0000" />
            </div>

            <div className="su-field">
              <label className="su-label">장애 등급 (해당 시)</label>
              <div className="su-check-group">
                {["없음", "1급", "2급", "3급", "4급", "5급", "6급"].map((value) => (
                  <button key={value} className={`su-chip ${form.disabilityGrade === value ? "on" : ""}`} type="button" onClick={() => set("disabilityGrade", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="su-section">
              <div className="su-section-title">📏 기본 신체정보</div>

              <div className="su-row">
                <div className="su-field">
                  <label className="su-label">키 (cm)</label>
                  <input className="su-input" type="number" value={form.height} onChange={(event) => set("height", event.target.value)} placeholder="165" />
                </div>

                <div className="su-field">
                  <label className="su-label">체중 (kg)</label>
                  <input className="su-input" type="number" value={form.weight} onChange={(event) => set("weight", event.target.value)} placeholder="60" />
                </div>
              </div>

              {bmi && (
                <div className="su-bmi-box">
                  <div>
                    <div className="su-bmi-label">BMI 지수</div>
                    <div className="su-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div>
                  </div>

                  <div>
                    <div className="su-bmi-label">판정</div>
                    <div className="su-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div>
                  </div>

                  <div className="su-bmi-guide">
                    정상: 18.5 ~ 22.9
                    <br />
                    과체중: 23 ~ 24.9
                    <br />
                    비만: 25 이상
                  </div>
                </div>
              )}

              <div className="su-row su-row-spaced">
                <div className="su-field">
                  <label className="su-label">흡연 여부</label>
                  <div className="su-check-group">
                    {["없음 (비흡연)", "과거 흡연 (현재 금연)", "흡연 중"].map((value) => (
                      <button key={value} className={`su-chip ${form.smoking === value ? "on" : ""}`} type="button" onClick={() => set("smoking", value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="su-field">
                  <label className="su-label">음주 여부</label>
                  <div className="su-check-group">
                    {["없음 (금주)", "가끔 (월 1~2회)", "자주 (주 1회 이상)"].map((value) => (
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
            </div>

            <div className="su-section">
              <div className="su-section-title">🏥 만성질환 여부</div>
              <div className="su-hint">
                해당하는 항목의 정도를 선택해주세요. 잘 모르시면 <b>경증</b>을 선택하시고, 의사 진단을 기준으로 선택해주세요.
              </div>

              {CHRONIC.map(({ key, label, levels }) => (
                <div className="su-disease-row" key={key}>
                  <span className="su-disease-label">{label}</span>
                  <div className="su-check-group">
                    {levels.map((level) => (
                      <button key={level} className={`su-chip ${form[key] === level ? "on" : ""}`} type="button" onClick={() => set(key, level)}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="su-section">
              <div className="su-section-title">🦽 거동 · 인지 · 감각</div>

              <div className="su-disease-row">
                <span className="su-disease-label">🚶 보행 보조기구 사용</span>
                <div className="su-check-group">
                  {["없음 (스스로 보행 가능)", "지팡이", "보행기", "휠체어"].map((value) => (
                    <button key={value} className={`su-chip ${form.walkingAid === value ? "on" : ""}`} type="button" onClick={() => set("walkingAid", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="su-disease-row">
                <span className="su-disease-label">🧠 치매 · 인지장애</span>
                <div className="su-check-group">
                  {["없음", "경도인지장애 (건망증 심함)", "치매 초기", "치매 중증"].map((value) => (
                    <button key={value} className={`su-chip ${form.dementia === value ? "on" : ""}`} type="button" onClick={() => set("dementia", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="su-disease-row">
                <span className="su-disease-label">👁 시력 이상</span>
                <div className="su-check-group">
                  {["없음", "경증 (안경·렌즈 착용)", "중증 (일상생활 불편)", "실명"].map((value) => (
                    <button key={value} className={`su-chip ${form.vision === value ? "on" : ""}`} type="button" onClick={() => set("vision", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="su-disease-row">
                <span className="su-disease-label">👂 청력 이상</span>
                <div className="su-check-group">
                  {["없음", "경증 (보청기 착용)", "중증 (대화 어려움)"].map((value) => (
                    <button key={value} className={`su-chip ${form.hearing === value ? "on" : ""}`} type="button" onClick={() => set("hearing", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="su-section">
              <div className="su-section-title">⚠️ 낙상 · 수술 이력</div>

              <div className="su-disease-row">
                <span className="su-disease-label">최근 1년 내 낙상 경험</span>
                <div className="su-check-group">
                  {["없음", "1회", "2~3회", "4회 이상"].map((value) => (
                    <button key={value} className={`su-chip ${form.recentFall === value ? "on" : ""}`} type="button" onClick={() => set("recentFall", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="su-disease-row">
                <span className="su-disease-label">수술을 받으신 적이 있으신가요?</span>
                <div className="su-check-group">
                  {["없음", "있음"].map((value) => (
                    <button key={value} className={`su-chip ${form.hasSurgery === value ? "on" : ""}`} type="button" onClick={() => set("hasSurgery", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {form.hasSurgery === "있음" && (
                <div className="su-field">
                  <label className="su-label">어떤 수술을 받으셨나요? (연도 포함해서 자세히 적어주세요)</label>
                  <textarea
                    className="su-input su-textarea"
                    value={form.surgeryDetail}
                    onChange={(event) => set("surgeryDetail", event.target.value)}
                    placeholder="예) 2020년 무릎 인공관절 수술, 2022년 백내장 수술, 2023년 담낭 절제 등"
                    rows={3}
                  />
                </div>
              )}

              <div className="su-field">
                <label className="su-label">기타 특이사항 (선택)</label>
                <textarea
                  className="su-input su-textarea"
                  value={form.otherDisease}
                  onChange={(event) => set("otherDisease", event.target.value)}
                  placeholder="예) 허리 디스크, 복용 중인 약 이름, 알레르기 등 추가로 알려주실 내용"
                  rows={3}
                />
              </div>
            </div>

            <div className="su-section">
              <div className="su-section-title">⚡ 활동 조건</div>

              <div className="su-row">
                <div className="su-field">
                  <label className="su-label">하루 최대 활동 가능 시간 <span className="su-required">*</span></label>
                  <select className="su-select" value={form.maxHours} onChange={(event) => set("maxHours", event.target.value)}>
                    <option value="">선택해주세요</option>
                    <option value="2">2시간 이내</option>
                    <option value="4">4시간 이내</option>
                    <option value="6">6시간 이내</option>
                    <option value="8">8시간 이내</option>
                  </select>
                </div>

                <div className="su-field">
                  <label className="su-label">이동 가능 거리 <span className="su-required">*</span></label>
                  <select className="su-select" value={form.maxDistance} onChange={(event) => set("maxDistance", event.target.value)}>
                    <option value="">선택해주세요</option>
                    <option value="도보 10분">도보 10분 이내</option>
                    <option value="도보 30분">도보 30분 이내</option>
                    <option value="대중교통 30분">대중교통 30분 이내</option>
                    <option value="대중교통 1시간">대중교통 1시간 이내</option>
                  </select>
                </div>
              </div>

              <div className="su-field">
                <label className="su-label">하기 어려운 작업 유형 (중복 선택 가능)</label>
                <div className="su-check-group">
                  {WORK_TYPES.map((workType) => (
                    <button key={workType} className={`su-chip ${(form.disabledWork || []).includes(workType) ? "on" : ""}`} type="button" onClick={() => toggleArr("disabledWork", workType)}>
                      {workType}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="su-section">
            <div className="su-section-title">💼 일자리 희망 조건</div>

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
              <label className="su-label">희망 근무 요일 (중복 선택 가능)</label>
              <div className="su-check-group">
                {DAYS.map((day) => (
                  <button key={day} className={`su-chip ${(form.hopeDays || []).includes(day) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeDays", day)}>
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 직종 (중복 선택 가능)</label>
              <div className="su-check-group">
                {["경비·청소", "급식·조리 보조", "사무 보조", "육아 보조", "농업·원예", "판매·안내", "환경 정비", "상관없음"].map((value) => (
                  <button key={value} className={`su-chip ${(form.hopeJobType || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeJobType", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">희망 근무 형태</label>
              <div className="su-check-group">
                {["실내 근무 선호", "오전 근무", "오후 근무", "주 3일 이하", "단기 가능", "장기 희망"].map((value) => (
                  <button key={value} className={`su-chip ${(form.hopeCondition || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeCondition", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-field">
              <label className="su-label">기타 희망 사항 (선택)</label>
              <textarea
                className="su-input su-textarea"
                value={form.memo}
                onChange={(event) => set("memo", event.target.value)}
                placeholder="예) 이전 직업 경력, 특기, 자격증 등 추가로 알려주실 내용"
                rows={4}
              />
            </div>
          </div>
        )}

        <div className="su-btn-row">
          {step > 0 ? (
            <button
              className="su-btn-prev"
              type="button"
              onClick={() => {
                setError("");
                setStep(step - 1);
                window.scrollTo(0, 0);
              }}
            >
              ← 이전
            </button>
          ) : (
            <button className="su-btn-prev" type="button" onClick={() => navigate("/")}>
              ← 로그인으로
            </button>
          )}

          <button className="su-btn-next" type="button" onClick={handleNext}>
            {step < 2 ? "다음 →" : "✅ 등록 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
}

