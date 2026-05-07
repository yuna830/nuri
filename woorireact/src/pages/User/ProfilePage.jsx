import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/user/ProfilePage.css";
import {
  CHRONIC,
  WORK_TYPES,
  DAYS,
  JOB_TYPES,
  JOB_CONDITIONS,
  SECTIONS,
  defaultForm,
  profileToForm,
  formToProfile,
  calcBMI,
} from "../../utils/user/profileForm.js";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedCurrentSenior = sessionStorage.getItem("currentSenior");

        if (savedCurrentSenior) {
          const cachedProfile = JSON.parse(savedCurrentSenior);
          const seniorId = cachedProfile?.senior?.id;

          if (seniorId) {
            const response = await fetch(`http://localhost:8181/api/seniors/${seniorId}`);

            if (response.ok) {
              const freshProfile = await response.json();
              sessionStorage.setItem("currentSenior", JSON.stringify(freshProfile));
              setForm(profileToForm(freshProfile));
              return;
            }
          }
        }

        const response = await fetch("http://localhost:8181/api/seniors");

        if (!response.ok) return;

        const profiles = await response.json();
        const latestProfile = profiles[profiles.length - 1];

        if (!latestProfile) return;

        sessionStorage.setItem("currentSenior", JSON.stringify(latestProfile));
        setForm(profileToForm(latestProfile));
      } catch (error) {
        console.error("프로필 정보 조회 실패:", error);
      }
    };

    loadProfile();
  }, []);

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

  const handleSave = () => {
    const savedCurrentSenior = sessionStorage.getItem("currentSenior");

    if (savedCurrentSenior) {
      const profile = JSON.parse(savedCurrentSenior);
      const nextProfile = formToProfile(profile, form);
      sessionStorage.setItem("currentSenior", JSON.stringify(nextProfile));
    }

    setSaved(true);

    setTimeout(() => {
      navigate("/user");
    }, 700);
  };

  const handleReset = () => {
    if (window.confirm("입력한 정보를 모두 초기화하시겠습니까?")) {
      setForm(defaultForm);
    }
  };

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="pr-root">
      <nav className="pr-nav">
        <button className="pr-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>

        <div className="pr-nav-title">내 정보 관리</div>

        <div className="pr-nav-actions">
          {saved && <div className="pr-saved-badge">저장되었습니다</div>}

          <button className="pr-reset-btn" type="button" onClick={handleReset}>
            초기화
          </button>

          <button className="pr-save-btn" type="button" onClick={handleSave}>
            저장하기
          </button>
        </div>
      </nav>

      <div className="pr-layout">
        <aside>
          <div className="pr-sidenav">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`pr-sidenav-item ${activeSection === section.id ? "active" : ""}`}
                type="button"
                onClick={() => scrollTo(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="pr-main">
          <section id="personal" className="pr-section">
            <div className="pr-section-title">인적사항</div>

            <div className="pr-field">
              <label className="pr-label">이름</label>
              <input className="pr-input" value={form.name} onChange={(event) => set("name", event.target.value)} />
            </div>

            <div className="pr-row">
              <div className="pr-field">
                <label className="pr-label">나이</label>
                <input className="pr-input" type="number" value={form.age} onChange={(event) => set("age", event.target.value)} />
              </div>

              <div className="pr-field">
                <label className="pr-label">성별</label>
                <select className="pr-select" value={form.gender} onChange={(event) => set("gender", event.target.value)}>
                  <option value="">선택</option>
                  <option value="남성">남성</option>
                  <option value="여성">여성</option>
                </select>
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">거주지 (시·군·구)</label>
              <input className="pr-input" value={form.region} onChange={(event) => set("region", event.target.value)} />
            </div>

            <div className="pr-row">
              <div className="pr-field">
                <label className="pr-label">연락처</label>
                <input className="pr-input" value={form.phone} onChange={(event) => set("phone", event.target.value)} />
              </div>

              <div className="pr-field">
                <label className="pr-label">장애 등급 (해당 시)</label>
                <div className="pr-chip-group">
                  {["없음", "1급", "2급", "3급", "4급", "5급", "6급"].map((value) => (
                    <button
                      key={value}
                      className={`pr-chip ${form.disabilityGrade === value ? "on" : ""}`}
                      type="button"
                      onClick={() => set("disabilityGrade", value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="body" className="pr-section">
            <div className="pr-section-title">기본 신체정보</div>

            <div className="pr-row">
              <div className="pr-field">
                <label className="pr-label">키 (cm)</label>
                <input className="pr-input" type="number" value={form.height} onChange={(event) => set("height", event.target.value)} />
              </div>

              <div className="pr-field">
                <label className="pr-label">체중 (kg)</label>
                <input className="pr-input" type="number" value={form.weight} onChange={(event) => set("weight", event.target.value)} />
              </div>
            </div>

            {bmi && (
              <div className="pr-bmi-box">
                <div>
                  <div className="pr-bmi-label">BMI 지수</div>
                  <div className="pr-bmi-val" style={{ color: bmi.color }}>{bmi.bmi}</div>
                </div>

                <div>
                  <div className="pr-bmi-label">판정</div>
                  <div className="pr-bmi-status" style={{ color: bmi.color }}>{bmi.status}</div>
                </div>

                <div className="pr-bmi-guide">
                  저체중: 18.5 미만<br />
                  정상: 18.5 ~ 22.9<br />
                  과체중: 23 ~ 24.9<br />
                  비만: 25 이상
                </div>
              </div>
            )}

            <div className="pr-row pr-row-spaced">
              <div className="pr-field">
                <label className="pr-label">흡연 여부</label>
                <div className="pr-chip-group">
                  {["없음 (비흡연)", "과거 흡연 (현재 금연)", "흡연 중"].map((value) => (
                    <button key={value} className={`pr-chip ${form.smoking === value ? "on" : ""}`} type="button" onClick={() => set("smoking", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pr-field">
                <label className="pr-label">음주 여부</label>
                <div className="pr-chip-group">
                  {["없음 (금주)", "가끔 (월 1~2회)", "자주 (주 1회 이상)"].map((value) => (
                    <button key={value} className={`pr-chip ${form.drinking === value ? "on" : ""}`} type="button" onClick={() => set("drinking", value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">현재 복용 중인 약 개수</label>
              <div className="pr-chip-group">
                {["없음", "1~2개", "3~5개", "6개 이상"].map((value) => (
                  <button key={value} className={`pr-chip ${form.medicineCount === value ? "on" : ""}`} type="button" onClick={() => set("medicineCount", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section id="chronic" className="pr-section">
            <div className="pr-section-title">만성질환 여부</div>
            <div className="pr-hint">
              해당하는 항목의 정도를 선택해주세요. 잘 모르시면 경증을 선택하시고, 의사 진단을 기준으로 선택해주세요.
            </div>

            {CHRONIC.map(({ key, label, levels }) => (
              <div key={key} className="pr-disease-row">
                <span className="pr-disease-label">{label}</span>

                <div className="pr-chip-group">
                  {levels.map((level) => (
                    <button key={level} className={`pr-chip ${form[key] === level ? "on" : ""}`} type="button" onClick={() => set(key, level)}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section id="mobility" className="pr-section">
            <div className="pr-section-title">거동 · 인지 · 감각</div>

            {[
              { key: "walkingAid", label: "보행 보조기구 사용", options: ["없음 (스스로 보행 가능)", "지팡이", "보행기", "휠체어"] },
              { key: "dementia", label: "치매 · 인지장애", options: ["없음", "경도인지장애 (건망증 심함)", "치매 초기", "치매 중증"] },
              { key: "vision", label: "시력 이상", options: ["없음", "경증 (안경·렌즈 착용)", "중증 (일상생활 불편)", "실명"] },
              { key: "hearing", label: "청력 이상", options: ["없음", "경증 (보청기 착용)", "중증 (대화 어려움)"] },
            ].map(({ key, label, options }) => (
              <div key={key} className="pr-disease-row">
                <span className="pr-disease-label">{label}</span>

                <div className="pr-chip-group">
                  {options.map((value) => (
                    <button key={value} className={`pr-chip ${form[key] === value ? "on" : ""}`} type="button" onClick={() => set(key, value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section id="surgery" className="pr-section">
            <div className="pr-section-title">낙상 · 수술 이력</div>

            <div className="pr-disease-row">
              <span className="pr-disease-label">최근 1년 내 낙상 경험</span>
              <div className="pr-chip-group">
                {["없음", "1회", "2~3회", "4회 이상"].map((value) => (
                  <button key={value} className={`pr-chip ${form.recentFall === value ? "on" : ""}`} type="button" onClick={() => set("recentFall", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="pr-disease-row">
              <span className="pr-disease-label">수술을 받으신 적이 있으신가요?</span>
              <div className="pr-chip-group">
                {["없음", "있음"].map((value) => (
                  <button key={value} className={`pr-chip ${form.hasSurgery === value ? "on" : ""}`} type="button" onClick={() => set("hasSurgery", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {form.hasSurgery === "있음" && (
              <div className="pr-field">
                <label className="pr-label">어떤 수술을 받으셨나요?</label>
                <textarea className="pr-input pr-textarea" value={form.surgeryDetail} onChange={(event) => set("surgeryDetail", event.target.value)} rows={3} />
              </div>
            )}

            <div className="pr-field">
              <label className="pr-label">기타 특이사항</label>
              <textarea className="pr-input pr-textarea" value={form.otherDisease} onChange={(event) => set("otherDisease", event.target.value)} rows={2} />
            </div>
          </section>

          <section id="activity" className="pr-section">
            <div className="pr-section-title">활동 조건</div>

            <div className="pr-row">
              <div className="pr-field">
                <label className="pr-label">하루 최대 활동 가능 시간</label>
                <select className="pr-select" value={form.maxHours} onChange={(event) => set("maxHours", event.target.value)}>
                  <option value="">선택해주세요</option>
                  <option value="2">2시간 이내</option>
                  <option value="4">4시간 이내</option>
                  <option value="6">6시간 이내</option>
                  <option value="8">8시간 이내</option>
                </select>
              </div>

              <div className="pr-field">
                <label className="pr-label">이동 가능 거리</label>
                <select className="pr-select" value={form.maxDistance} onChange={(event) => set("maxDistance", event.target.value)}>
                  <option value="">선택해주세요</option>
                  <option value="도보 10분">도보 10분 이내</option>
                  <option value="도보 30분">도보 30분 이내</option>
                  <option value="대중교통 30분">대중교통 30분 이내</option>
                  <option value="대중교통 1시간">대중교통 1시간 이내</option>
                </select>
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">하기 어려운 작업 유형</label>
              <div className="pr-chip-group">
                {WORK_TYPES.map((value) => (
                  <button key={value} className={`pr-chip ${(form.disabledWork || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("disabledWork", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section id="job" className="pr-section">
            <div className="pr-section-title">일자리 희망 조건</div>

            <div className="pr-field">
              <label className="pr-label">희망 급여 형태</label>
              <div className="pr-chip-group">
                {["무관", "시급", "월급", "일당"].map((value) => (
                  <button key={value} className={`pr-chip ${form.payType === value ? "on" : ""}`} type="button" onClick={() => set("payType", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">희망 근무 요일</label>
              <div className="pr-chip-group">
                {DAYS.map((value) => (
                  <button key={value} className={`pr-chip ${(form.hopeDays || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeDays", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">희망 직종</label>
              <div className="pr-chip-group">
                {JOB_TYPES.map((value) => (
                  <button key={value} className={`pr-chip ${(form.hopeJobType || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeJobType", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">희망 근무 형태</label>
              <div className="pr-chip-group">
                {JOB_CONDITIONS.map((value) => (
                  <button key={value} className={`pr-chip ${(form.hopeCondition || []).includes(value) ? "on" : ""}`} type="button" onClick={() => toggleArr("hopeCondition", value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="pr-field">
              <label className="pr-label">기타 희망 사항</label>
              <textarea className="pr-input pr-textarea" value={form.memo} onChange={(event) => set("memo", event.target.value)} rows={4} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
