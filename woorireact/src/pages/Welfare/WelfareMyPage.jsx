import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Save, UserRound } from "lucide-react";

import "../../css/welfare/WelfareMyPage.css";

const getCurrentWorker = () => {
    try {
        return JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");
    } catch {
        return null;
    }
};

const formatLoginAt = (value) => {
    if (!value) {
        return "기록 없음";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "기록 없음";
    }

    return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function WelfareMyPage() {
    const navigate = useNavigate();
    const [worker, setWorker] = useState(getCurrentWorker);
    const [form, setForm] = useState(() => ({
        name: worker?.name || "",
        center: worker?.center || "",
    }));
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [isCenterListOpen, setIsCenterListOpen] = useState(false);
    const centerKeyword = form.center.trim().toLowerCase();
    const centerSuggestions = SEOUL_WELFARE_CENTERS.filter((center) =>
        center.toLowerCase().includes(centerKeyword)
    );

    const set = (key, value) => {
        setSaved(false);
        setForm((previousForm) => ({
            ...previousForm,
            [key]: value,
        }));
    };

    const handleSave = () => {
        const name = form.name.trim();
        const center = form.center.trim();

        if (!name) {
            setError("이름을 입력해주세요.");
            return;
        }

        if (!center) {
            setError("소속 기관을 입력해주세요.");
            return;
        }

        const nextWorker = {
            ...worker,
            name,
            center,
        };
        const savedWorkers = readJsonStorage(WELFARE_WORKERS_STORAGE_KEY, []);
        const nextSavedWorkers = savedWorkers.map((savedWorker) =>
            savedWorker.id === worker?.id || savedWorker.workerId === worker?.workerId
                ? {
                    ...savedWorker,
                    name,
                    center,
                }
                : savedWorker
        );
        const hasSavedWorker = nextSavedWorkers.some(
            (savedWorker) => savedWorker.id === worker?.id || savedWorker.workerId === worker?.workerId
        );
        const nextWorkers = hasSavedWorker
            ? nextSavedWorkers
            : [
                ...savedWorkers,
                {
                    id: worker?.id || `W-${worker?.workerId || Date.now()}`,
                    workerId: worker?.workerId,
                    name,
                    role: worker?.role || "복지사",
                    center,
                },
            ];

        localStorage.setItem(WELFARE_WORKERS_STORAGE_KEY, JSON.stringify(nextWorkers));
        sessionStorage.setItem("currentWelfareWorker", JSON.stringify(nextWorker));
        setWorker(nextWorker);
        setError("");
        setSaved(true);
    };

    const handleLogout = () => {
        sessionStorage.removeItem("currentWelfareWorker");
        navigate("/welfare-login");
    };

    if (!worker) {
        return (
            <div className="wm-page">
                <header className="wm-header">
                    <div className="wm-brand-area">
                        <strong className="wm-service-name">우리 woori</strong>
                    </div>
                </header>

                <main className="wm-content">
                    <section className="wm-empty-card">
                        <h1 className="wm-empty-title">로그인이 필요합니다.</h1>
                        <Link to="/welfare-login" className="wm-primary-link">
                            로그인으로 이동
                        </Link>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="wm-page">
            <header className="wm-header">
                <div className="wm-brand-area">
                    <strong className="wm-service-name">우리 woori</strong>
                </div>

                <Link to="/welfare" className="wm-header-link">
                    <ArrowLeft size={16} />
                    대상자 목록
                </Link>
            </header>

            <main className="wm-content">
                <section className="wm-hero">
                    <div>
                        <p className="wm-eyebrow">복지사 계정</p>
                        <h1 className="wm-title">마이페이지</h1>
                        <p className="wm-description">
                            복지사 이름과 소속 기관 정보를 관리합니다.
                        </p>
                    </div>

                    <div className="wm-hero-icon">
                        <UserRound size={34} />
                    </div>
                </section>

                <div className="wm-layout">
                    <aside className="wm-profile-panel">
                        <div className="wm-avatar">
                            <UserRound size={34} />
                        </div>

                        <strong className="wm-profile-name">{worker.name} 복지사</strong>
                        <span className="wm-profile-center">{worker.center || "소속 기관 미등록"}</span>

                        <div className="wm-profile-divider" />

                        <dl className="wm-profile-list">
                            <div className="wm-profile-row">
                                <dt>아이디</dt>
                                <dd>{worker.workerId || "-"}</dd>
                            </div>
                            <div className="wm-profile-row">
                                <dt>권한</dt>
                                <dd>{worker.role || "복지사"}</dd>
                            </div>
                            <div className="wm-profile-row">
                                <dt>최근 로그인</dt>
                                <dd>{formatLoginAt(worker.loginAt)}</dd>
                            </div>
                        </dl>
                    </aside>

                    <section className="wm-form-panel">
                        <div className="wm-section-head">
                            <div>
                                <h2 className="wm-section-title">기본 정보</h2>
                                <p className="wm-section-desc">대상자 관리 화면의 헤더 정보에 바로 반영됩니다.</p>
                            </div>

                            <Building2 size={22} className="wm-section-icon" />
                        </div>

                        {error && <div className="wm-error-box">{error}</div>}
                        {saved && <div className="wm-saved-box">마이페이지 정보가 저장되었습니다.</div>}

                        <div className="wm-form-grid">
                            <label className="wm-field">
                                <span className="wm-label">이름</span>
                                <input
                                    className="wm-input"
                                    value={form.name}
                                    onChange={(event) => set("name", event.target.value)}
                                    placeholder="예: 김복지"
                                />
                            </label>

                            <div className="wm-field wm-center-field">
                                <span className="wm-label">소속 기관</span>
                                <input
                                    className="wm-input"
                                    value={form.center}
                                    onChange={(event) => {
                                        set("center", event.target.value);
                                        setIsCenterListOpen(true);
                                    }}
                                    onFocus={() => setIsCenterListOpen(true)}
                                    onBlur={() => {
                                        window.setTimeout(() => setIsCenterListOpen(false), 120);
                                    }}
                                    placeholder="예: 우리복지센터"
                                />

                                {isCenterListOpen && centerKeyword.length > 0 && (
                                    <div className="wm-center-suggest-list">
                                        {centerSuggestions.length > 0 ? (
                                            centerSuggestions.map((center) => (
                                                <button
                                                    type="button"
                                                    key={center}
                                                    className="wm-center-suggest-item"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        set("center", center);
                                                        setIsCenterListOpen(false);
                                                    }}
                                                >
                                                    {center}
                                                </button>
                                            ))
                                        ) : (
                                            <p className="wm-center-suggest-empty">
                                                검색 결과가 없습니다. 입력한 기관명으로 저장할 수 있습니다.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <label className="wm-field">
                                <span className="wm-label">복지사 아이디</span>
                                <input
                                    className="wm-input wm-readonly-input"
                                    value={worker.workerId || ""}
                                    readOnly
                                />
                            </label>

                            <label className="wm-field">
                                <span className="wm-label">권한</span>
                                <input
                                    className="wm-input wm-readonly-input"
                                    value={worker.role || "복지사"}
                                    readOnly
                                />
                            </label>
                        </div>

                        <div className="wm-actions">
                            <button type="button" className="wm-secondary-button" onClick={handleLogout}>
                                로그아웃
                            </button>

                            <button type="button" className="wm-save-button" onClick={handleSave}>
                                <Save size={17} />
                                저장
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default WelfareMyPage;
