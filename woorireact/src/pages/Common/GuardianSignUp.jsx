import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatPhoneNumber } from "../../utils/common/phone.js";
import "../../css/common/SignUp.css";

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  passwordConfirm: "",
  seniorKeyword: "",
  seniorRelation: "",
  selectedSeniorId: "",
};

export default function GuardianSignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [seniorResults, setSeniorResults] = useState([]);
  const [selectedSenior, setSelectedSenior] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "보호자 이름을 입력해주세요.";
    if (!form.phone.trim()) return "보호자 연락처를 입력해주세요.";
    if (!form.email.trim()) return "이메일을 입력해주세요.";
    if (!form.password.trim()) return "비밀번호를 입력해주세요.";
    if (form.password !== form.passwordConfirm) return "비밀번호가 일치하지 않습니다.";
    if (!form.selectedSeniorId) return "연결할 사용자를 검색해서 선택해주세요.";
    if (!form.seniorRelation.trim()) return "사용자와의 관계를 입력해주세요.";
    return "";
  };

  const searchSenior = async () => {
    const keyword = form.seniorKeyword.trim();

    if (keyword.length < 2) {
      alert("사용자 이름이나 전화번호를 2글자 이상 입력해주세요.");
      return;
    }

    try {
      setError("");
      setIsSearching(true);

      const response = await fetch(
        `http://localhost:8080/api/seniors/search?keyword=${encodeURIComponent(keyword)}`
      );

      const data = response.ok ? await response.json() : [];
      const results = Array.isArray(data) ? data : [];

      setSeniorResults(results);

      if (!response.ok || results.length === 0) {
        setError("검색된 사용자가 없습니다. 사용자 회원가입을 먼저 완료해주세요.");
      }
    } catch (searchError) {
      console.error("사용자 검색 실패:", searchError);
      setError("사용자 검색에 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSenior = (profile) => {
    setSelectedSenior(profile);
    set("selectedSeniorId", profile?.senior?.id || "");
    setError("");
  };

  const handleSubmit = async () => {
    const validationMessage = validate();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("http://localhost:8080/api/guardians/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
          seniorId: Number(form.selectedSeniorId),
          seniorRelation: form.seniorRelation.trim(),
        }),
      });

      if (!response.ok) {
        alert("회원가입에 실패했습니다. 이미 가입된 이메일인지 확인해주세요.");
        return;
      }

      navigate("/glogin");
    } catch (submitError) {
      console.error("보호자 회원가입 실패:", submitError);
      alert("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="su-root">
      <nav className="su-nav">
        <div className="su-nav-inner">
          <div className="su-nav-logo">🌿 우리 woori</div>

          <div className="su-nav-actions">
            <span className="su-nav-step">보호자 계정 등록</span>
            <button
              className="su-nav-login"
              type="button"
              onClick={() => navigate("/glogin")}
            >
              로그인
            </button>
          </div>
        </div>
      </nav>

      <div className="su-layout">
        {error && <div className="su-error">⚠️ {error}</div>}

        <section className="su-section">
          <div className="su-section-title">보호자 회원가입</div>

          <div className="su-row">
            <div className="su-field">
              <label className="su-label">
                이름 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="이름을 입력해주세요"
              />
            </div>

            <div className="su-field">
              <label className="su-label">
                연락처 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                value={form.phone}
                onChange={(event) => set("phone", formatPhoneNumber(event.target.value))}
                placeholder="예: 010-0000-0000"
              />
            </div>
          </div>

          <div className="su-field">
            <label className="su-label">
              이메일 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="예: guardian@example.com"
            />
          </div>

          <div className="su-row">
            <div className="su-field">
              <label className="su-label">
                비밀번호 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                type="password"
                value={form.password}
                onChange={(event) => set("password", event.target.value)}
                placeholder="비밀번호를 입력해주세요"
              />
            </div>

            <div className="su-field">
              <label className="su-label">
                비밀번호 확인 <span className="su-required">*</span>
              </label>
              <input
                className="su-input"
                type="password"
                value={form.passwordConfirm}
                onChange={(event) => set("passwordConfirm", event.target.value)}
                placeholder="비밀번호를 다시 입력해주세요"
              />
            </div>
          </div>
        </section>

        <section className="su-section">
          <div className="su-section-title">관리할 사용자 연결</div>

          <div className="su-hint">
            사용자 회원가입이 먼저 되어 있어야 건강정보, 위치정보, SOS 알림이 보호자 화면에 같이 연결됩니다.
          </div>

          <div className="su-field">
            <label className="su-label">
              사용자 검색 <span className="su-required">*</span>
            </label>
            <div className="su-search-row">
              <input
                className="su-input"
                value={form.seniorKeyword}
                onChange={(event) => {
                  set("seniorKeyword", event.target.value);
                  setSelectedSenior(null);
                  set("selectedSeniorId", "");
                }}
                placeholder="예: 사용자 이름 또는 010-0000-0000"
                onKeyDown={(event) => event.key === "Enter" && searchSenior()}
              />
              <button className="su-search-btn" type="button" onClick={searchSenior}>
                {isSearching ? "검색 중..." : "검색"}
              </button>
            </div>
          </div>

          {seniorResults.length > 0 && (
            <div className="su-senior-results">
              {seniorResults.map((profile) => {
                const senior = profile.senior;
                const isSelected = String(form.selectedSeniorId) === String(senior.id);

                return (
                  <button
                    key={senior.id}
                    className={`su-senior-result ${isSelected ? "selected" : ""}`}
                    type="button"
                    onClick={() => selectSenior(profile)}
                  >
                    <strong>{senior.name}</strong>
                    <span>{senior.phone || "연락처 없음"}</span>
                    <em>{senior.region || senior.address || "주소 없음"}</em>
                  </button>
                );
              })}
            </div>
          )}

          {selectedSenior && (
            <div className="su-selected-senior">
              연결 대상: <strong>{selectedSenior.senior.name}</strong>
            </div>
          )}

          <div className="su-field">
            <label className="su-label">
              관계 <span className="su-required">*</span>
            </label>
            <input
              className="su-input"
              value={form.seniorRelation}
              onChange={(event) => set("seniorRelation", event.target.value)}
              placeholder="예: 딸, 아들, 배우자, 요양보호사"
            />
          </div>
        </section>

        <div className="su-btn-row su-btn-row-end">
          <button
            className="su-btn-next"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "가입 중..." : "보호자 가입 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
