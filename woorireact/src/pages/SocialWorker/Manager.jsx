import { useEffect, useMemo, useState } from "react";
import { profileToForm } from "../../utils/user/profileForm.js";

function Management() {
  const [profiles, setProfiles] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:8080/api/seniors");
        if (!response.ok) throw new Error("사용자 조회 실패");
        const data = await response.json();
        setProfiles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("복지사 사용자 정보 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, []);

  const rows = useMemo(() => {
    const normalizedKeyword = keyword.trim();
    return profiles
      .map((profile) => ({ raw: profile, form: profileToForm(profile) }))
      .filter(({ form }) => {
        if (!normalizedKeyword) return true;
        return [form.name, form.phone, form.region, form.guardianName, form.socialWorkerName]
          .filter(Boolean)
          .some((value) => String(value).includes(normalizedKeyword));
      });
  }, [keyword, profiles]);

  return (
    <main style={{ minHeight: "100vh", background: "#fffdec", padding: "2rem", fontFamily: "Noto Sans KR, sans-serif" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.2rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem" }}>복지사 사용자 관리</h1>
            <p style={{ margin: "0.35rem 0 0", color: "#6f856f", fontSize: "0.9rem" }}>사용자 기본정보, 건강/복약, 보호자, 일자리 정보를 한 화면에서 확인합니다.</p>
          </div>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이름, 연락처, 주소, 보호자 검색"
            style={{ marginLeft: "auto", width: 280, padding: "0.75rem 0.9rem", borderRadius: 8, border: "1px solid #d4e8d6" }}
          />
        </header>

        {loading ? (
          <div style={cardStyle}>사용자 정보를 불러오는 중입니다.</div>
        ) : rows.length === 0 ? (
          <div style={cardStyle}>표시할 사용자 정보가 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {rows.map(({ raw, form }) => (
              <article key={raw?.senior?.id || `${form.name}-${form.phone}`} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.9rem" }}>
                  <div>
                    <strong style={{ fontSize: "1.1rem" }}>{form.name || "이름 없음"}</strong>
                    <span style={{ marginLeft: "0.5rem", color: "#6f856f" }}>{form.age ? `${form.age}세` : "-"} · {form.gender || "-"}</span>
                  </div>
                  <span style={{ color: "#6f856f", fontSize: "0.82rem" }}>마지막 접속 {form.lastLoginAt ? new Date(form.lastLoginAt).toLocaleString("ko-KR") : "기록 없음"}</span>
                </div>

                <div style={gridStyle}>
                  <Info title="연락/주소" lines={[form.phone, form.region]} />
                  <Info title="보호자" lines={[form.guardianName || "미지정", form.guardianRelation && `${form.guardianRelation} → ${form.seniorRelationToGuardian || "-"}`]} />
                  <Info title="담당 복지사" lines={[form.socialWorkerName || "미지정", form.socialWorkerPhone]} />
                  <Info title="건강" lines={[`키 ${form.height || "-"}cm / 몸무게 ${form.weight || "-"}kg`, `약 ${form.medicineCount || "없음"}`, form.otherDisease]} />
                  <Info
                    title="복약 상세"
                    lines={form.medications.length
                      ? form.medications.map((medicine) => [
                          medicine.name,
                          medicine.ongoing
                            ? `${medicine.startDate || "시작일 미입력"}부터 계속 복용`
                            : [medicine.startDate, medicine.endDate].filter(Boolean).join(" ~ "),
                          medicine.interval ? `${medicine.interval}시간마다` : "",
                          medicine.dailyCount ? `하루 ${medicine.dailyCount}회` : "",
                        ].filter(Boolean).join(" / "))
                      : ["없음"]}
                  />
                  <Info title="일자리" lines={[form.maxHours && `${form.maxHours}시간 이내`, form.maxDistance, form.hopeJobType.join(", "), form.memo]} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #d4e8d6",
  borderRadius: 12,
  padding: "1rem",
  boxShadow: "0 2px 12px rgba(134, 167, 136, 0.08)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "0.8rem",
};

function Info({ title, lines }) {
  return (
    <div style={{ background: "#fbfdf8", border: "1px solid #eef2e8", borderRadius: 8, padding: "0.8rem" }}>
      <div style={{ fontWeight: 700, marginBottom: "0.45rem", color: "#4f6f52" }}>{title}</div>
      {(lines || []).filter(Boolean).map((line) => (
        <div key={line} style={{ color: "#1e2a1f", fontSize: "0.88rem", lineHeight: 1.5 }}>{line}</div>
      ))}
    </div>
  );
}

export default Management;
