import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
};

const WORK_TYPES = ["장시간 서기", "야외 작업", "야간 근무", "중량물 운반", "컴퓨터 작업", "계단 이동", "반복 작업"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

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
  name: "", age: "", gender: "", region: "", phone: "", disabilityGrade: "없음",
  height: "", weight: "", smoking: "없음", drinking: "없음", medicineCount: "없음",
  diabetes: "없음", hypertension: "없음", heart: "없음", joint: "없음",
  stroke: "없음", kidney: "없음", lung: "없음", liver: "없음", cancer: "없음",
  walkingAid: "없음 (스스로 보행 가능)", dementia: "없음", vision: "없음", hearing: "없음",
  recentFall: "없음", hasSurgery: "없음", surgeryDetail: "", otherDisease: "",
  maxHours: "", maxDistance: "", disabledWork: [],
  payType: "무관", hopeDays: [], hopeJobType: [], hopeCondition: [], memo: "",
};

const calcBMI = (h, w) => {
  const hm = parseFloat(h) / 100, wk = parseFloat(w);
  if (!hm || !wk) return null;
  const bmi = (wk / (hm * hm)).toFixed(1);
  let status = "", color = C.green;
  if (bmi < 18.5) { status = "저체중"; color = "#f0a500"; }
  else if (bmi < 23) { status = "정상"; color = C.green; }
  else if (bmi < 25) { status = "과체중"; color = "#f0a500"; }
  else { status = "비만"; color = C.danger; }
  return { bmi, status, color };
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .pr-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .pr-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .pr-nav-back {
    background: transparent; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.85rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
  .pr-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .pr-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .pr-nav-actions { display: flex; gap: 0.6rem; align-items: center; }
  .pr-save-btn {
    background: ${C.green}; color: #fff; border: none; border-radius: 8px;
    padding: 0.45rem 1.4rem; font-size: 0.9rem; font-weight: 700;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
  }
  .pr-reset-btn {
    background: transparent; color: ${C.textMuted}; border: 1px solid ${C.border};
    border-radius: 8px; padding: 0.45rem 1rem; font-size: 0.88rem;
    font-family: 'Noto Sans KR', sans-serif; cursor: pointer;
  }
  .pr-saved-badge {
    background: ${C.greenPale}; border: 1px solid ${C.greenLight}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.82rem; color: ${C.greenDark}; font-weight: 500;
  }

  .pr-layout { max-width: 1100px; margin: 0 auto; padding: 2rem; display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; align-items: start; }

  /* 사이드 네비 */
  .pr-sidenav {
    background: ${C.white}; border-radius: 16px; border: 1px solid ${C.border};
    box-shadow: 0 2px 10px rgba(134,167,136,0.08); overflow: hidden; position: sticky; top: 80px;
  }
  .pr-sidenav-item {
    display: block; width: 100%; padding: 0.8rem 1.1rem; text-align: left;
    font-size: 0.85rem; font-family: 'Noto Sans KR', sans-serif; color: ${C.textMuted};
    background: transparent; border: none; border-bottom: 1px solid ${C.border}; cursor: pointer;
    transition: background 0.12s;
  }
  .pr-sidenav-item:last-child { border-bottom: none; }
  .pr-sidenav-item:hover { background: ${C.greenPale}; color: ${C.green}; }
  .pr-sidenav-item.active { color: ${C.green}; font-weight: 700; background: ${C.greenPale}; }

  /* 폼 */
  .pr-main {}
  .pr-section {
    background: ${C.white}; border-radius: 16px; padding: 1.8rem 2rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08); margin-bottom: 1.2rem;
    scroll-margin-top: 80px;
  }
  .pr-section-title {
    font-size: 1rem; font-weight: 700; color: ${C.text}; margin-bottom: 1.3rem;
    padding-bottom: 0.7rem; border-bottom: 2px solid ${C.greenLight};
  }
  .pr-field { margin-bottom: 1rem; }
  .pr-field:last-child { margin-bottom: 0; }
  .pr-label { font-size: 0.78rem; font-weight: 700; color: ${C.textMuted}; margin-bottom: 0.4rem; display: block; }
  .pr-input {
    width: 100%; padding: 0.7rem 0.95rem; border: 1px solid ${C.border}; border-radius: 8px;
    font-size: 0.92rem; font-family: 'Noto Sans KR', sans-serif; color: ${C.text};
    background: ${C.white}; outline: none; transition: border-color 0.15s;
  }
  .pr-input:focus { border-color: ${C.green}; }
  .pr-select {
    width: 100%; padding: 0.7rem 0.95rem; border: 1px solid ${C.border}; border-radius: 8px;
    font-size: 0.92rem; font-family: 'Noto Sans KR', sans-serif; color: ${C.text};
    background: ${C.white}; outline: none; cursor: pointer;
  }
  .pr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .pr-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
  .pr-chip-group { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.3rem; }
  .pr-chip {
    padding: 0.32rem 0.82rem; border: 1.5px solid ${C.border}; border-radius: 99px;
    font-size: 0.82rem; color: ${C.textMuted}; cursor: pointer; background: transparent;
    font-family: 'Noto Sans KR', sans-serif; transition: all 0.12s;
  }
  .pr-chip.on { background: ${C.green}; border-color: ${C.green}; color: #fff; font-weight: 700; }
  .pr-disease-row { padding-bottom: 0.9rem; border-bottom: 1px solid ${C.border}; margin-bottom: 0.9rem; }
  .pr-disease-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .pr-disease-label { font-size: 0.9rem; font-weight: 700; color: ${C.text}; margin-bottom: 0.5rem; display: block; }
  .pr-bmi-box {
    background: ${C.greenPale}; border: 1px solid ${C.greenLight}; border-radius: 10px;
    padding: 0.9rem 1.1rem; margin-top: 0.8rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
  }
  .pr-hint {
    font-size: 0.78rem; color: ${C.textMuted}; margin-bottom: 1rem; line-height: 1.6;
    background: ${C.greenPale}; padding: 0.7rem 1rem; border-radius: 8px; border: 1px solid ${C.greenLight};
  }
`;

const SECTIONS = [
  { id: "personal", label: "📋 인적사항" },
  { id: "body", label: "📏 신체정보" },
  { id: "chronic", label: "🏥 만성질환" },
  { id: "mobility", label: "🦽 거동·인지·감각" },
  { id: "surgery", label: "⚠️ 낙상·수술" },
  { id: "job", label: "💼 일자리 희망" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    try { const s = localStorage.getItem("user_profile"); return s ? { ...defaultForm, ...JSON.parse(s) } : defaultForm; } catch { return defaultForm; }
  });
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleArr = (key, val) => setForm(prev => {
    const arr = prev[key] || [];
    return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
  });

  const bmi = useMemo(() => calcBMI(form.height, form.weight), [form.height, form.weight]);

  const handleSave = () => {
    localStorage.setItem("user_profile", JSON.stringify(form));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const handleReset = () => {
    if (window.confirm("입력한 정보를 모두 초기화하시겠습니까?")) {
      localStorage.removeItem("user_profile"); setForm(defaultForm);
    }
  };
  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <style>{styles}</style>
      <div className="pr-root">
        <nav className="pr-nav">
          <button className="pr-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="pr-nav-title">👤 내 정보 관리</div>
          <div className="pr-nav-actions">
            {saved && <div className="pr-saved-badge">✅ 저장되었습니다</div>}
            <button className="pr-reset-btn" onClick={handleReset}>초기화</button>
            <button className="pr-save-btn" onClick={handleSave}>저장하기</button>
          </div>
        </nav>

        <div className="pr-layout">

          {/* 사이드 네비 */}
          <aside>
            <div className="pr-sidenav">
              {SECTIONS.map(s => (
                <button key={s.id} className={`pr-sidenav-item ${activeSection === s.id ? "active" : ""}`} onClick={() => scrollTo(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </aside>

          {/* 폼 */}
          <main className="pr-main">

            {/* 인적사항 */}
            <div id="personal" className="pr-section">
              <div className="pr-section-title">📋 인적사항</div>
              <div className="pr-field">
                <label className="pr-label">이름</label>
                <input className="pr-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="홍길동" />
              </div>
              <div className="pr-row">
                <div className="pr-field">
                  <label className="pr-label">나이</label>
                  <input className="pr-input" type="number" value={form.age} onChange={e => set("age", e.target.value)} placeholder="65" />
                </div>
                <div className="pr-field">
                  <label className="pr-label">성별</label>
                  <select className="pr-select" value={form.gender} onChange={e => set("gender", e.target.value)}>
                    <option value="">선택</option><option value="남성">남성</option><option value="여성">여성</option>
                  </select>
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">거주지 (시·군·구)</label>
                <input className="pr-input" value={form.region} onChange={e => set("region", e.target.value)} placeholder="서울시 송파구" />
              </div>
              <div className="pr-row">
                <div className="pr-field">
                  <label className="pr-label">연락처</label>
                  <input className="pr-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="010-0000-0000" />
                </div>
                <div className="pr-field">
                  <label className="pr-label">장애 등급 (해당 시)</label>
                  <div className="pr-chip-group">
                    {["없음", "1급", "2급", "3급", "4급", "5급", "6급"].map(v => (
                      <button key={v} className={`pr-chip ${form.disabilityGrade === v ? "on" : ""}`} onClick={() => set("disabilityGrade", v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 신체정보 */}
            <div id="body" className="pr-section">
              <div className="pr-section-title">📏 기본 신체정보</div>
              <div className="pr-row">
                <div className="pr-field">
                  <label className="pr-label">키 (cm)</label>
                  <input className="pr-input" type="number" value={form.height} onChange={e => set("height", e.target.value)} placeholder="165" />
                </div>
                <div className="pr-field">
                  <label className="pr-label">체중 (kg)</label>
                  <input className="pr-input" type="number" value={form.weight} onChange={e => set("weight", e.target.value)} placeholder="60" />
                </div>
              </div>
              {bmi && (
                <div className="pr-bmi-box">
                  <div><div style={{ fontSize: "0.75rem", color: C.textMuted }}>BMI</div><div style={{ fontSize: "1.5rem", fontWeight: "700", color: bmi.color }}>{bmi.bmi}</div></div>
                  <div><div style={{ fontSize: "0.75rem", color: C.textMuted }}>판정</div><div style={{ fontSize: "0.9rem", fontWeight: "700", color: bmi.color }}>{bmi.status}</div></div>
                </div>
              )}
              <div className="pr-row" style={{ marginTop: "1rem" }}>
                <div className="pr-field">
                  <label className="pr-label">흡연 여부</label>
                  <div className="pr-chip-group">
                    {["없음 (비흡연)", "과거 흡연 (현재 금연)", "흡연 중"].map(v => (
                      <button key={v} className={`pr-chip ${form.smoking === v ? "on" : ""}`} onClick={() => set("smoking", v)}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="pr-field">
                  <label className="pr-label">음주 여부</label>
                  <div className="pr-chip-group">
                    {["없음 (금주)", "가끔 (월 1~2회)", "자주 (주 1회 이상)"].map(v => (
                      <button key={v} className={`pr-chip ${form.drinking === v ? "on" : ""}`} onClick={() => set("drinking", v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">현재 복용 중인 약 개수</label>
                <div className="pr-chip-group">
                  {["없음", "1~2개", "3~5개", "6개 이상"].map(v => (
                    <button key={v} className={`pr-chip ${form.medicineCount === v ? "on" : ""}`} onClick={() => set("medicineCount", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="pr-row">
                <div className="pr-field">
                  <label className="pr-label">하루 최대 활동 가능 시간</label>
                  <select className="pr-select" value={form.maxHours} onChange={e => set("maxHours", e.target.value)}>
                    <option value="">선택</option><option value="2">2시간 이내</option><option value="4">4시간 이내</option><option value="6">6시간 이내</option><option value="8">8시간 이내</option>
                  </select>
                </div>
                <div className="pr-field">
                  <label className="pr-label">이동 가능 거리</label>
                  <select className="pr-select" value={form.maxDistance} onChange={e => set("maxDistance", e.target.value)}>
                    <option value="">선택</option><option value="도보 10분">도보 10분 이내</option><option value="도보 30분">도보 30분 이내</option><option value="대중교통 30분">대중교통 30분 이내</option><option value="대중교통 1시간">대중교통 1시간 이내</option>
                  </select>
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">하기 어려운 작업 유형</label>
                <div className="pr-chip-group">
                  {WORK_TYPES.map(w => (
                    <button key={w} className={`pr-chip ${(form.disabledWork||[]).includes(w) ? "on" : ""}`} onClick={() => toggleArr("disabledWork", w)}>{w}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 만성질환 */}
            <div id="chronic" className="pr-section">
              <div className="pr-section-title">🏥 만성질환 여부</div>
              <div className="pr-hint">해당하는 항목의 정도를 선택해주세요. 잘 모르시면 <b>경증</b>을 선택해주세요.</div>
              {CHRONIC.map(({ key, label, levels }) => (
                <div key={key} className="pr-disease-row">
                  <span className="pr-disease-label">{label}</span>
                  <div className="pr-chip-group">
                    {levels.map(lv => <button key={lv} className={`pr-chip ${form[key] === lv ? "on" : ""}`} onClick={() => set(key, lv)}>{lv}</button>)}
                  </div>
                </div>
              ))}
            </div>

            {/* 거동·인지·감각 */}
            <div id="mobility" className="pr-section">
              <div className="pr-section-title">🦽 거동 · 인지 · 감각</div>
              {[
                { key: "walkingAid", label: "🚶 보행 보조기구", options: ["없음 (스스로 보행 가능)", "지팡이", "보행기", "휠체어"] },
                { key: "dementia", label: "🧠 치매 · 인지장애", options: ["없음", "경도인지장애 (건망증 심함)", "치매 초기", "치매 중증"] },
                { key: "vision", label: "👁 시력 이상", options: ["없음", "경증 (안경·렌즈 착용)", "중증 (일상생활 불편)", "실명"] },
                { key: "hearing", label: "👂 청력 이상", options: ["없음", "경증 (보청기 착용)", "중증 (대화 어려움)"] },
              ].map(({ key, label, options }) => (
                <div key={key} className="pr-disease-row">
                  <span className="pr-disease-label">{label}</span>
                  <div className="pr-chip-group">
                    {options.map(v => <button key={v} className={`pr-chip ${form[key] === v ? "on" : ""}`} onClick={() => set(key, v)}>{v}</button>)}
                  </div>
                </div>
              ))}
            </div>

            {/* 낙상·수술 */}
            <div id="surgery" className="pr-section">
              <div className="pr-section-title">⚠️ 낙상 · 수술 이력</div>
              <div className="pr-disease-row">
                <span className="pr-disease-label">최근 1년 내 낙상 경험</span>
                <div className="pr-chip-group">
                  {["없음", "1회", "2~3회", "4회 이상"].map(v => <button key={v} className={`pr-chip ${form.recentFall === v ? "on" : ""}`} onClick={() => set("recentFall", v)}>{v}</button>)}
                </div>
              </div>
              <div className="pr-disease-row">
                <span className="pr-disease-label">수술 이력</span>
                <div className="pr-chip-group">
                  {["없음", "있음"].map(v => <button key={v} className={`pr-chip ${form.hasSurgery === v ? "on" : ""}`} onClick={() => set("hasSurgery", v)}>{v}</button>)}
                </div>
              </div>
              {form.hasSurgery === "있음" && (
                <div className="pr-field">
                  <label className="pr-label">수술 내용 (연도 포함)</label>
                  <textarea className="pr-input" value={form.surgeryDetail} onChange={e => set("surgeryDetail", e.target.value)} placeholder="예) 2020년 무릎 인공관절 수술, 2022년 백내장 수술 등" rows={3} style={{ resize: "vertical" }} />
                </div>
              )}
              <div className="pr-field">
                <label className="pr-label">기타 특이사항</label>
                <textarea className="pr-input" value={form.otherDisease} onChange={e => set("otherDisease", e.target.value)} placeholder="허리 디스크, 복용 중인 약 이름, 알레르기 등" rows={2} style={{ resize: "vertical" }} />
              </div>
            </div>

            {/* 일자리 희망 조건 */}
            <div id="job" className="pr-section">
              <div className="pr-section-title">💼 일자리 희망 조건</div>
              <div className="pr-field">
                <label className="pr-label">희망 급여 형태</label>
                <div className="pr-chip-group">
                  {["무관", "시급", "월급", "일당"].map(v => <button key={v} className={`pr-chip ${form.payType === v ? "on" : ""}`} onClick={() => set("payType", v)}>{v}</button>)}
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">희망 근무 요일</label>
                <div className="pr-chip-group">
                  {DAYS.map(d => <button key={d} className={`pr-chip ${(form.hopeDays||[]).includes(d) ? "on" : ""}`} onClick={() => toggleArr("hopeDays", d)}>{d}</button>)}
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">희망 직종</label>
                <div className="pr-chip-group">
                  {["경비·청소", "급식·조리 보조", "사무 보조", "육아 보조", "농업·원예", "판매·안내", "환경 정비", "상관없음"].map(v => (
                    <button key={v} className={`pr-chip ${(form.hopeJobType||[]).includes(v) ? "on" : ""}`} onClick={() => toggleArr("hopeJobType", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="pr-field">
                <label className="pr-label">기타 희망 사항</label>
                <textarea className="pr-input" value={form.memo} onChange={e => set("memo", e.target.value)} placeholder="예) 실내 근무 선호, 오전만 가능 등" rows={3} style={{ resize: "vertical" }} />
              </div>
            </div>

          </main>
        </div>
      </div>
    </>
  );
}