import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC",
  green: "#86A788",
  greenDark: "#5f7d61",
  greenLight: "#b8d4ba",
  greenPale: "#eef6ef",
  white: "#ffffff",
  danger: "#e05252",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .su-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; }
  .su-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .su-nav-logo { font-size: 1.1rem; font-weight: 700; color: ${C.green}; }
  .su-nav-step { font-size: 0.85rem; color: ${C.textMuted}; margin-left: auto; }
  .su-layout { max-width: 900px; margin: 0 auto; padding: 2rem; }
  .su-section {
    background: ${C.white}; border-radius: 16px; padding: 1.8rem 2rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    margin-bottom: 1.2rem;
  }
  .su-section-title {
    font-size: 1rem; font-weight: 700; color: ${C.text};
    margin-bottom: 1.3rem; padding-bottom: 0.7rem;
    border-bottom: 2px solid ${C.greenLight};
    display: flex; align-items: center; gap: 0.5rem;
  }
  .su-field { margin-bottom: 1rem; }
  .su-field:last-child { margin-bottom: 0; }
  .su-label { font-size: 0.78rem; font-weight: 700; color: ${C.textMuted}; margin-bottom: 0.4rem; display: block; }
  .su-required { color: ${C.danger}; margin-left: 2px; }
  .su-input {
    width: 100%; padding: 0.7rem 0.95rem; border: 1px solid ${C.border};
    border-radius: 8px; font-size: 0.92rem; font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text}; background: ${C.white}; outline: none; transition: border-color 0.15s;
  }
  .su-input:focus { border-color: ${C.green}; }
  .su-select {
    width: 100%; padding: 0.7rem 0.95rem; border: 1px solid ${C.border};
    border-radius: 8px; font-size: 0.92rem; font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text}; background: ${C.white}; outline: none; cursor: pointer;
  }
  .su-select:focus { border-color: ${C.green}; }
  .su-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .su-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
  .su-check-group { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.3rem; }
  .su-chip {
    padding: 0.35rem 0.85rem; border: 1.5px solid ${C.border}; border-radius: 99px;
    font-size: 0.82rem; color: ${C.textMuted}; cursor: pointer;
    transition: all 0.13s; user-select: none; background: transparent;
    font-family: 'Noto Sans KR', sans-serif;
  }
  .su-chip.on { background: ${C.green}; border-color: ${C.green}; color: #fff; font-weight: 700; }
  .su-disease-row {
    padding-bottom: 0.9rem; border-bottom: 1px solid ${C.border}; margin-bottom: 0.9rem;
  }
  .su-disease-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .su-disease-label { font-size: 0.9rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.5rem; display: block; }
  .su-btn-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
  .su-btn-prev {
    background: transparent; border: 1px solid ${C.border}; border-radius: 10px;
    padding: 0.75rem 1.8rem; font-size: 0.92rem;
    font-family: 'Noto Sans KR', sans-serif; color: ${C.textMuted}; cursor: pointer;
  }
  .su-btn-next {
    background: ${C.green}; border: none; border-radius: 10px;
    padding: 0.75rem 2.5rem; font-size: 0.92rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; color: #fff; cursor: pointer;
    box-shadow: 0 2px 10px rgba(134,167,136,0.3);
  }
  .su-btn-next:hover { opacity: 0.92; }
  .su-error {
    background: #fdf0f0; border: 1px solid #f5c6c6; border-radius: 8px;
    padding: 0.7rem 1rem; font-size: 0.85rem; color: ${C.danger}; margin-bottom: 1rem;
  }
  .su-hint {
    font-size: 0.78rem; color: ${C.textMuted}; margin-bottom: 1rem; line-height: 1.6;
    background: ${C.greenPale}; padding: 0.7rem 1rem; border-radius: 8px;
    border: 1px solid ${C.greenLight};
  }
  .su-bmi-box {
    background: ${C.greenPale}; border: 1px solid ${C.greenLight};
    border-radius: 10px; padding: 0.9rem 1.1rem; margin-top: 0.8rem;
    display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
  }
  .su-bmi-val { font-size: 1.5rem; font-weight: 700; color: ${C.green}; }
  .su-bmi-label { font-size: 0.78rem; color: ${C.textMuted}; }
  .su-bmi-status { font-size: 0.85rem; font-weight: 700; }
`;

const WORK_TYPES = ["장시간 서기", "야외 작업", "야간 근무", "중량물 운반", "컴퓨터 작업", "계단 이동", "반복 작업", "고객 응대"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const STEPS = ["인적사항", "신체 · 건강정보", "일자리 희망조건"];

const CHRONIC = [
  { key: "diabetes",     label: "🩸 당뇨",                levels: ["없음", "경증 (식이요법·경구약)", "중증 (인슐린 투여)"] },
  { key: "hypertension", label: "💊 고혈압",               levels: ["없음", "경증 (약 복용·조절 중)", "중증 (합병증 있음)"] },
  { key: "heart",        label: "❤️ 심장질환",             levels: ["없음", "경증 (부정맥·협심증 등)", "중증 (심부전·수술 이력)"] },
  { key: "joint",        label: "🦴 관절질환 (무릎·허리)", levels: ["없음", "경증 (가끔 통증·약 복용)", "중증 (보조기구·수술 이력)"] },
  { key: "stroke",       label: "🧠 뇌졸중·중풍",          levels: ["없음", "경증 (후유증 경미)", "중증 (마비·언어장애 등)"] },
  { key: "kidney",       label: "🫘 신장질환",             levels: ["없음", "경증 (신기능 저하)", "중증 (투석 중)"] },
  { key: "lung",         label: "🫁 폐·호흡기 질환",       levels: ["없음", "경증 (천식·만성기관지염)", "중증 (COPD·산소호흡기)"] },
  { key: "liver",        label: "🟡 간질환",               levels: ["없음", "경증 (지방간·간염 보균)", "중증 (간경화·간암)"] },
  { key: "cancer",       label: "🎗 암 (과거·현재)",        levels: ["없음", "완치·관리 중", "치료 중 (항암·방사선 등)"] },
];

const defaultForm = {
  // 인적사항
  name: "", age: "", gender: "", region: "", phone: "",
  disabilityGrade: "없음",
  // 신체 기본
  height: "", weight: "", smoking: "없음", drinking: "없음",
  medicineCount: "없음",
  // 만성질환
  diabetes: "없음", hypertension: "없음", heart: "없음",
  joint: "없음", stroke: "없음", kidney: "없음",
  lung: "없음", liver: "없음", cancer: "없음",
  // 거동·인지·감각
  walkingAid: "없음 (스스로 보행 가능)",
  dementia: "없음", vision: "없음", hearing: "없음",
  // 낙상·수술
  recentFall: "없음", hasSurgery: "없음", surgeryDetail: "",
  otherDisease: "",
  // 활동 조건
  maxHours: "", maxDistance: "", disabledWork: [],
  // 희망 조건
  payType: "무관", hopeDays: [], hopeJobType: [], memo: "",
};

const calcBMI = (height, weight) => {
  const h = parseFloat(height) / 100;
  const w = parseFloat(weight);
  if (!h || !w) return null;
  const bmi = (w / (h * h)).toFixed(1);
  let status = "", color = C.green;
  if (bmi < 18.5) { status = "저체중"; color = "#f0a500"; }
  else if (bmi < 23) { status = "정상"; color = C.green; }
  else if (bmi < 25) { status = "과체중"; color = "#f0a500"; }
  else { status = "비만"; color = C.danger; }
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
    } catch {}
    return defaultForm;
  });
  const [error, setError] = useState("");

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleArr = (key, val) => {
    setForm(prev => {
      const arr = prev[key] || [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
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

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    if (step < 2) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      localStorage.setItem("user_profile", JSON.stringify(form));
      localStorage.removeItem("login_temp");
      navigate("/user");
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="su-root">

        <nav className="su-nav">
          <div className="su-nav-logo">🌿 케어링 CaRing</div>
          <div className="su-nav-step">정보 등록 {step + 1} / 3</div>
        </nav>

        {/* 스텝바 */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1rem 2rem", display: "flex", alignItems: "center" }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.78rem", fontWeight: "700", flexShrink: 0,
                  background: i < step ? C.greenLight : i === step ? C.green : C.white,
                  border: `2px solid ${i <= step ? C.green : C.border}`,
                  color: i < step ? C.greenDark : i === step ? "#fff" : C.textMuted,
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{
                  fontSize: "0.82rem", marginLeft: "0.4rem",
                  color: i === step ? C.green : C.textMuted,
                  fontWeight: i === step ? "700" : "400",
                  marginRight: "0.5rem", whiteSpace: "nowrap",
                }}>
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: "2px", background: i < step ? C.green : C.border, marginRight: "0.5rem" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="su-layout">
          {error && <div className="su-error">⚠️ {error}</div>}

          {/* ── 스텝 1: 인적사항 ── */}
          {step === 0 && (
            <div className="su-section">
              <div className="su-section-title">📋 인적사항</div>
              <div className="su-field">
                <label className="su-label">이름 <span className="su-required">*</span></label>
                <input className="su-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="홍길동" />
              </div>
              <div className="su-row">
                <div className="su-field">
                  <label className="su-label">나이 <span className="su-required">*</span></label>
                  <input className="su-input" type="number" value={form.age} onChange={e => set("age", e.target.value)} placeholder="65" />
                </div>
                <div className="su-field">
                  <label className="su-label">성별 <span className="su-required">*</span></label>
                  <select className="su-select" value={form.gender} onChange={e => set("gender", e.target.value)}>
                    <option value="">선택</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
              </div>
              <div className="su-field">
                <label className="su-label">거주지 (시·군·구) <span className="su-required">*</span></label>
                <input className="su-input" value={form.region} onChange={e => set("region", e.target.value)} placeholder="서울시 송파구" />
              </div>
              <div className="su-field">
                <label className="su-label">연락처</label>
                <input className="su-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="010-0000-0000" />
              </div>
              <div className="su-field">
                <label className="su-label">장애 등급 (해당 시)</label>
                <div className="su-check-group">
                  {["없음", "1급", "2급", "3급", "4급", "5급", "6급"].map(v => (
                    <button key={v} className={`su-chip ${form.disabilityGrade === v ? "on" : ""}`} onClick={() => set("disabilityGrade", v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 스텝 2: 신체·건강정보 ── */}
          {step === 1 && (
            <>
              {/* 기본 신체정보 */}
              <div className="su-section">
                <div className="su-section-title">📏 기본 신체정보</div>
                <div className="su-row">
                  <div className="su-field">
                    <label className="su-label">키 (cm)</label>
                    <input className="su-input" type="number" value={form.height} onChange={e => set("height", e.target.value)} placeholder="165" />
                  </div>
                  <div className="su-field">
                    <label className="su-label">체중 (kg)</label>
                    <input className="su-input" type="number" value={form.weight} onChange={e => set("weight", e.target.value)} placeholder="60" />
                  </div>
                </div>

                {/* BMI 자동 계산 */}
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
                    <div style={{ fontSize: "0.75rem", color: C.textMuted, lineHeight: 1.5 }}>
                      정상: 18.5 ~ 22.9<br />과체중: 23 ~ 24.9<br />비만: 25 이상
                    </div>
                  </div>
                )}

                <div className="su-row" style={{ marginTop: "1rem" }}>
                  <div className="su-field">
                    <label className="su-label">흡연 여부</label>
                    <div className="su-check-group">
                      {["없음 (비흡연)", "과거 흡연 (현재 금연)", "흡연 중"].map(v => (
                        <button key={v} className={`su-chip ${form.smoking === v ? "on" : ""}`} onClick={() => set("smoking", v)}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="su-field">
                    <label className="su-label">음주 여부</label>
                    <div className="su-check-group">
                      {["없음 (금주)", "가끔 (월 1~2회)", "자주 (주 1회 이상)"].map(v => (
                        <button key={v} className={`su-chip ${form.drinking === v ? "on" : ""}`} onClick={() => set("drinking", v)}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="su-field">
                  <label className="su-label">현재 복용 중인 약 개수</label>
                  <div className="su-check-group">
                    {["없음", "1~2개", "3~5개", "6개 이상"].map(v => (
                      <button key={v} className={`su-chip ${form.medicineCount === v ? "on" : ""}`} onClick={() => set("medicineCount", v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 만성질환 */}
              <div className="su-section">
                <div className="su-section-title">🏥 만성질환 여부</div>
                <div className="su-hint">
                  해당하는 항목의 정도를 선택해주세요. 잘 모르시면 <b>경증</b>을 선택하시고, 의사 진단을 기준으로 선택해주세요.
                </div>
                {CHRONIC.map(({ key, label, levels }) => (
                  <div className="su-disease-row" key={key}>
                    <span className="su-disease-label">{label}</span>
                    <div className="su-check-group">
                      {levels.map(lv => (
                        <button key={lv} className={`su-chip ${form[key] === lv ? "on" : ""}`} onClick={() => set(key, lv)}>{lv}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 거동·인지·감각 */}
              <div className="su-section">
                <div className="su-section-title">🦽 거동 · 인지 · 감각</div>

                <div className="su-disease-row">
                  <span className="su-disease-label">🚶 보행 보조기구 사용</span>
                  <div className="su-check-group">
                    {["없음 (스스로 보행 가능)", "지팡이", "보행기", "휠체어"].map(v => (
                      <button key={v} className={`su-chip ${form.walkingAid === v ? "on" : ""}`} onClick={() => set("walkingAid", v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="su-disease-row">
                  <span className="su-disease-label">🧠 치매 · 인지장애</span>
                  <div className="su-check-group">
                    {["없음", "경도인지장애 (건망증 심함)", "치매 초기", "치매 중증"].map(v => (
                      <button key={v} className={`su-chip ${form.dementia === v ? "on" : ""}`} onClick={() => set("dementia", v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="su-disease-row">
                  <span className="su-disease-label">👁 시력 이상</span>
                  <div className="su-check-group">
                    {["없음", "경증 (안경·렌즈 착용)", "중증 (일상생활 불편)", "실명"].map(v => (
                      <button key={v} className={`su-chip ${form.vision === v ? "on" : ""}`} onClick={() => set("vision", v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="su-disease-row">
                  <span className="su-disease-label">👂 청력 이상</span>
                  <div className="su-check-group">
                    {["없음", "경증 (보청기 착용)", "중증 (대화 어려움)"].map(v => (
                      <button key={v} className={`su-chip ${form.hearing === v ? "on" : ""}`} onClick={() => set("hearing", v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 낙상·수술 이력 */}
              <div className="su-section">
                <div className="su-section-title">⚠️ 낙상 · 수술 이력</div>

                <div className="su-disease-row">
                  <span className="su-disease-label">최근 1년 내 낙상 경험</span>
                  <div className="su-check-group">
                    {["없음", "1회", "2~3회", "4회 이상"].map(v => (
                      <button key={v} className={`su-chip ${form.recentFall === v ? "on" : ""}`} onClick={() => set("recentFall", v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="su-disease-row">
                  <span className="su-disease-label">수술을 받으신 적이 있으신가요?</span>
                  <div className="su-check-group">
                    {["없음", "있음"].map(v => (
                      <button key={v} className={`su-chip ${form.hasSurgery === v ? "on" : ""}`} onClick={() => set("hasSurgery", v)}>{v}</button>
                    ))}
                  </div>
                </div>

                {form.hasSurgery === "있음" && (
                  <div className="su-field">
                    <label className="su-label">어떤 수술을 받으셨나요? (연도 포함해서 자세히 적어주세요)</label>
                    <textarea
                      className="su-input"
                      value={form.surgeryDetail}
                      onChange={e => set("surgeryDetail", e.target.value)}
                      placeholder="예) 2020년 무릎 인공관절 수술, 2022년 백내장 수술, 2023년 담낭 절제 등"
                      rows={3}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                )}

                <div className="su-field">
                  <label className="su-label">기타 특이사항 (선택)</label>
                  <textarea
                    className="su-input"
                    value={form.otherDisease}
                    onChange={e => set("otherDisease", e.target.value)}
                    placeholder="예) 허리 디스크, 복용 중인 약 이름, 알레르기 등 추가로 알려주실 내용"
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              {/* 활동 조건 */}
              <div className="su-section">
                <div className="su-section-title">⚡ 활동 조건</div>
                <div className="su-row">
                  <div className="su-field">
                    <label className="su-label">하루 최대 활동 가능 시간 <span className="su-required">*</span></label>
                    <select className="su-select" value={form.maxHours} onChange={e => set("maxHours", e.target.value)}>
                      <option value="">선택해주세요</option>
                      <option value="2">2시간 이내</option>
                      <option value="4">4시간 이내</option>
                      <option value="6">6시간 이내</option>
                      <option value="8">8시간 이내</option>
                    </select>
                  </div>
                  <div className="su-field">
                    <label className="su-label">이동 가능 거리 <span className="su-required">*</span></label>
                    <select className="su-select" value={form.maxDistance} onChange={e => set("maxDistance", e.target.value)}>
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
                    {WORK_TYPES.map(w => (
                      <button
                        key={w}
                        className={`su-chip ${(form.disabledWork || []).includes(w) ? "on" : ""}`}
                        onClick={() => toggleArr("disabledWork", w)}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 스텝 3: 일자리 희망 조건 ── */}
          {step === 2 && (
            <div className="su-section">
              <div className="su-section-title">💼 일자리 희망 조건</div>
              <div className="su-field">
                <label className="su-label">희망 급여 형태</label>
                <div className="su-check-group">
                  {["무관", "시급", "월급", "일당"].map(v => (
                    <button key={v} className={`su-chip ${form.payType === v ? "on" : ""}`} onClick={() => set("payType", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="su-field">
                <label className="su-label">희망 근무 요일 (중복 선택 가능)</label>
                <div className="su-check-group">
                  {DAYS.map(d => (
                    <button key={d} className={`su-chip ${(form.hopeDays || []).includes(d) ? "on" : ""}`} onClick={() => toggleArr("hopeDays", d)}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="su-field">
                <label className="su-label">희망 직종 (중복 선택 가능)</label>
                <div className="su-check-group">
                  {["경비·청소", "급식·조리 보조", "사무 보조", "육아 보조", "농업·원예", "판매·안내", "환경 정비", "상관없음"].map(v => (
                    <button key={v} className={`su-chip ${(form.hopeJobType || []).includes(v) ? "on" : ""}`} onClick={() => toggleArr("hopeJobType", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="su-field">
                <label className="su-label">희망 근무 형태</label>
                <div className="su-check-group">
                  {["실내 근무 선호", "오전 근무", "오후 근무", "주 3일 이하", "단기 가능", "장기 희망"].map(v => (
                    <button key={v} className={`su-chip ${(form.hopeCondition || []).includes(v) ? "on" : ""}`} onClick={() => toggleArr("hopeCondition", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="su-field">
                <label className="su-label">기타 희망 사항 (선택)</label>
                <textarea
                  className="su-input"
                  value={form.memo}
                  onChange={e => set("memo", e.target.value)}
                  placeholder="예) 이전 직업 경력, 특기, 자격증 등 추가로 알려주실 내용"
                  rows={4}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="su-btn-row">
            {step > 0
              ? <button className="su-btn-prev" onClick={() => { setError(""); setStep(step - 1); window.scrollTo(0, 0); }}>← 이전</button>
              : <button className="su-btn-prev" onClick={() => navigate("/")}>← 로그인으로</button>
            }
            <button className="su-btn-next" onClick={handleNext}>
              {step < 2 ? "다음 →" : "✅ 등록 완료"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}