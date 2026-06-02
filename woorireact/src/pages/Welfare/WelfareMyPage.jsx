import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Building2,
    KeyRound,
    LogOut,
    Save,
    Search,
    Trash2,
    UserRound,
} from "lucide-react";

import { formatPhoneNumber } from "../../utils/common/phone.js";
import WelfareCommonHeader from "../../components/welfare/WelfareCommonHeader.jsx";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";

import "../../css/common/Login.css";
import "../../css/welfare/WelfareDashboard.css";
import "../../css/welfare/WelfareMyPage.css";

const AUTH_API_BASE = "http://localhost:8080";
const WELFARE_API_BASE = "http://localhost:8181";

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

const buildWorker = (worker, form) => ({
    ...worker,
    name: form.name.trim(),
    center: form.center.trim(),
    region: form.region.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
});

function WelfareMyPage() {
    const navigate = useNavigate();
    const [worker, setWorker] = useState(getCurrentWorker);
    const [form, setForm] = useState(() => ({
        name: worker?.name || "",
        center: worker?.center || "",
        region: worker?.region || "",
        phone: worker?.phone || "",
        email: worker?.email || "",
    }));
    const [centerQuery, setCenterQuery] = useState(worker?.center || "");
    const [selectedCenter, setSelectedCenter] = useState("");
    const [error, setError] = useState("");
    const [centerResults, setCenterResults] = useState([]);
    const [centerSearchMessage, setCenterSearchMessage] = useState("");
    const [isSearchingCenters, setIsSearchingCenters] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        newPassword: "",
        passwordConfirm: "",
    });
    const [passwordError, setPasswordError] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const set = (key, value) => {
        setForm((previousForm) => ({
            ...previousForm,
            [key]: value,
        }));
    };

    const handleCenterSearch = async () => {
        const keyword = centerQuery.trim();

        if (keyword.length < 2) {
            setError("소속 기관명은 2글자 이상 입력해주세요.");
            setCenterResults([]);
            setCenterSearchMessage("");
            return;
        }

        try {
            setIsSearchingCenters(true);
            setCenterResults([]);
            setCenterSearchMessage("");

            const response = await fetch(
                `${WELFARE_API_BASE}/api/welfare-centers?keyword=${encodeURIComponent(keyword)}`
            );

            if (!response.ok) {
                setError("소속 기관 검색에 실패했습니다.");
                return;
            }

            const centers = await response.json();
            setCenterResults(Array.isArray(centers) ? centers : []);

            if (!Array.isArray(centers) || centers.length === 0) {
                setError("");
                setCenterSearchMessage("검색 결과가 없습니다. 기관명을 다시 확인해주세요.");
                return;
            }

            setError("");
        } catch {
            setError("공공포털 기관 정보를 불러올 수 없습니다.");
        } finally {
            setIsSearchingCenters(false);
        }
    };

    const handleSelectCenter = (center) => {
        setSelectedCenter(center.name);
        setCenterQuery(center.name);
        setCenterResults([]);
        setCenterSearchMessage("");
    };

    const handleApplyCenter = () => {
        const nextCenter = (selectedCenter || centerQuery).trim();

        if (!nextCenter) {
            setError("수정할 소속 기관을 검색하고 선택해주세요.");
            return;
        }

        set("center", nextCenter);
        setSelectedCenter("");
        setCenterResults([]);
        setError("");
    };

    const handleSave = async () => {
        const nextWorker = buildWorker(worker, form);

        if (!nextWorker.name) {
            setError("이름을 입력해주세요.");
            return;
        }

        if (!nextWorker.center) {
            setError("소속 기관을 입력해주세요.");
            return;
        }

        try {
            setIsSaving(true);

            if (worker?.id) {
                const response = await fetch(`${AUTH_API_BASE}/api/welfare-workers/${worker.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: nextWorker.name,
                        center: nextWorker.center,
                        region: nextWorker.region,
                        phone: nextWorker.phone,
                        email: nextWorker.email,
                    }),
                });

                if (!response.ok) {
                    setError("마이페이지 정보 저장에 실패했습니다.");
                    return;
                }

                const updatedWorker = await response.json();
                const savedWorker = {
                    ...updatedWorker,
                    loginAt: worker.loginAt,
                };

                sessionStorage.setItem("currentWelfareWorker", JSON.stringify(savedWorker));
                setWorker(savedWorker);
            } else {
                setError("로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.");
                return;
            }

            setError("");
            alert("마이페이지 정보가 저장되었습니다.");
        } catch {
            setError("서버에 연결할 수 없습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const openPasswordModal = () => {
        setPasswordForm({
            newPassword: "",
            passwordConfirm: "",
        });
        setPasswordError("");
        setIsPasswordModalOpen(true);
    };

    const closePasswordModal = () => {
        setPasswordForm({
            newPassword: "",
            passwordConfirm: "",
        });
        setPasswordError("");
        setPasswordLoading(false);
        setIsPasswordModalOpen(false);
    };

    const setPassword = (key, value) => {
        setPasswordForm((previousForm) => ({
            ...previousForm,
            [key]: value,
        }));
    };

    const handleResetPassword = async () => {
        const newPassword = passwordForm.newPassword.trim();
        const passwordConfirm = passwordForm.passwordConfirm.trim();

        if (!newPassword) {
            setPasswordError("새 비밀번호를 입력해주세요.");
            return;
        }

        if (newPassword.length < 4) {
            setPasswordError("비밀번호는 4자 이상 입력해주세요.");
            return;
        }

        if (newPassword !== passwordConfirm) {
            setPasswordError("비밀번호 확인이 일치하지 않습니다.");
            return;
        }

        try {
            setPasswordLoading(true);
            setPasswordError("");

            const response = await fetch(`${AUTH_API_BASE}/api/welfare-workers/reset-password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workerId: worker.workerId,
                    name: form.name.trim() || worker.name,
                    newPassword,
                }),
            });

            if (!response.ok) {
                setPasswordError("비밀번호 재설정에 실패했습니다. 이름과 계정 정보를 확인해주세요.");
                return;
            }

            alert("비밀번호가 재설정되었습니다.");
            closePasswordModal();
        } catch {
            setPasswordError("서버에 연결할 수 없습니다.");
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem("currentWelfareWorker");
        navigate("/welfare-login");
    };

    const handleWithdraw = async () => {
        const confirmed = window.confirm("탈퇴하면 복지사 계정이 삭제됩니다. 계속할까요?");

        if (!confirmed) {
            return;
        }

        try {
            if (!worker?.id) {
                alert("로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.");
                return;
            }

            const response = await fetch(`${AUTH_API_BASE}/api/welfare-workers/${worker.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                alert("계정 탈퇴에 실패했습니다.");
                return;
            }

            sessionStorage.removeItem("currentWelfareWorker");
            navigate("/welfare-login");
        } catch {
            alert("서버에 연결할 수 없습니다.");
        }
    };

    if (!worker) {
        return (
            <div className="wm-page">
                <WelfareCommonHeader />

                <div className="wd-layout">
                    <WelfareSidebar
                        active="mypage"
                        profileSlot={
                            <aside className="wm-profile-panel wm-profile-panel-sidebar">
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
                                        <dt>이메일</dt>
                                        <dd>{worker.email || "-"}</dd>
                                    </div>
                                    <div className="wm-profile-row">
                                        <dt>최근 로그인</dt>
                                        <dd>{formatLoginAt(worker.loginAt)}</dd>
                                    </div>
                                </dl>

                                <div className="wm-account-actions">
                                    <button type="button" className="wm-secondary-button" onClick={handleLogout}>
                                        <LogOut size={16} />
                                        로그아웃
                                    </button>
                                    <button type="button" className="wm-danger-button" onClick={handleWithdraw}>
                                        <Trash2 size={16} />
                                        탈퇴
                                    </button>
                                </div>
                            </aside>
                        }
                    />
                    <main>
                        <section className="wm-empty-card">
                            <h1 className="wm-empty-title">로그인이 필요합니다</h1>
                            <Link to="/welfare-login" className="wm-primary-link">
                                로그인으로 이동
                            </Link>
                        </section>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="wm-page">
            <WelfareCommonHeader rightText="마이페이지" />

            <div className="wd-layout">
    <WelfareSidebar
        active="mypage"
        profileSlot={
            <aside className="wm-profile-panel wm-profile-panel-sidebar">
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
                        <dt>이메일</dt>
                        <dd>{worker.email || "-"}</dd>
                    </div>
                    <div className="wm-profile-row">
                        <dt>최근 로그인</dt>
                        <dd>{formatLoginAt(worker.loginAt)}</dd>
                    </div>
                </dl>

                <div className="wm-account-actions">
                    <button type="button" className="wm-secondary-button" onClick={handleLogout}>
                        <LogOut size={16} />
                        로그아웃
                    </button>
                    <button type="button" className="wm-danger-button" onClick={handleWithdraw}>
                        <Trash2 size={16} />
                        탈퇴
                    </button>
                </div>
            </aside>
        }
    />

    <main className="wm-content">
        <div className="wm-layout wm-layout-single">
            <div className="wm-main-column">
                <section className="wm-form-panel">
                    <div className="wm-section-head">
                        <div>
                            <h2 className="wm-section-title">계정 정보 수정</h2>
                            <p className="wm-section-desc">저장한 정보는 대상자 관리 화면의 계정 정보에 반영됩니다.</p>
                        </div>

                        <Building2 size={22} className="wm-section-icon" />
                    </div>

                    {error && <div className="wm-error-box">{error}</div>}

                    <div className="wm-form-grid">
                        <label className="wm-field wm-field-half">
                            <span className="wm-label">이름 수정</span>
                            <input
                                className="wm-input"
                                value={form.name}
                                onChange={(event) => set("name", event.target.value)}
                                placeholder="예: 박정아"
                            />
                        </label>

                        <label className="wm-field wm-field-half">
                            <span className="wm-label">아이디 확인</span>
                            <input
                                className="wm-input wm-readonly-input"
                                value={worker.workerId || ""}
                                readOnly
                            />
                        </label>

                        <div className="wm-field wm-center-field">
                            <span className="wm-label">소속 기관 수정</span>
                            <div className="wm-search-row">
                                <input
                                    className="wm-input"
                                    value={centerQuery}
                                    onChange={(event) => {
                                        setCenterQuery(event.target.value);
                                        setSelectedCenter("");
                                        setCenterResults([]);
                                        setCenterSearchMessage("");
                                    }}
                                    placeholder="예: 광진노인종합복지관"
                                    onKeyDown={(event) => event.key === "Enter" && handleCenterSearch()}
                                />
                                <button
                                    type="button"
                                    className="wm-search-button"
                                    onClick={handleCenterSearch}
                                    disabled={isSearchingCenters}
                                >
                                    <Search size={15} />
                                    {isSearchingCenters ? "검색중" : "검색"}
                                </button>
                                <button
                                    type="button"
                                    className="wm-apply-button"
                                    onClick={handleApplyCenter}
                                >
                                    수정
                                </button>
                            </div>

                            <span className="wm-current-center">
                                현재 적용값: {form.center || "소속 기관 미등록"}
                            </span>

                            {centerSearchMessage && (
                                <p className="wm-center-suggest-empty">{centerSearchMessage}</p>
                            )}

                            {centerResults.length > 0 && (
                                <div className="wm-center-suggest-list">
                                    {centerResults.map((center) => (
                                        <button
                                            type="button"
                                            key={`${center.code}-${center.name}`}
                                            className="wm-center-suggest-item"
                                            onClick={() => handleSelectCenter(center)}
                                        >
                                            <strong>{center.name}</strong>
                                            {center.type && <span>{center.type}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label className="wm-field wm-field-half">
                            <span className="wm-label">담당 지역 수정</span>
                            <input
                                className="wm-input"
                                value={form.region}
                                onChange={(event) => set("region", event.target.value)}
                                placeholder="예: 서울시 광진구"
                            />
                        </label>

                        <label className="wm-field wm-field-half">
                            <span className="wm-label">연락처 수정</span>
                            <input
                                className="wm-input"
                                value={form.phone}
                                onChange={(event) => set("phone", formatPhoneNumber(event.target.value))}
                                placeholder="예: 010-1234-5678"
                            />
                        </label>
                    </div>

                    <div className="wm-security-row">
                        <div className="wm-security-copy">
                            <strong>비밀번호 재설정</strong>
                            <span>계정 보안을 위해 필요할 때 새 비밀번호로 변경할 수 있습니다.</span>
                        </div>

                        <button
                            type="button"
                            className="wm-reset-button"
                            onClick={openPasswordModal}
                        >
                            <KeyRound size={16} />
                            재설정
                        </button>
                    </div>
                </section>

                <div className="wm-save-row">
                    <button
                        type="button"
                        className="wm-save-button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        <Save size={17} />
                        {isSaving ? "저장중" : "저장"}
                    </button>
                </div>
            </div>
        </div>
    </main>
</div>
            {isPasswordModalOpen && (
                <div className="login-modal-backdrop" onClick={closePasswordModal}>
                    <section className="login-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="login-modal-header">
                            <div>
                                <h2>비밀번호 재설정</h2>
                                <p>새 비밀번호를 입력하고 한 번 더 확인해주세요.</p>
                            </div>

                            <button className="login-modal-close" type="button" onClick={closePasswordModal}>
                                X
                            </button>
                        </div>

                        <label className="login-label">새 비밀번호</label>
                        <input
                            className="login-input"
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(event) => setPassword("newPassword", event.target.value)}
                            placeholder="새 비밀번호를 입력하세요"
                        />

                        <label className="login-label">새 비밀번호 확인</label>
                        <input
                            className="login-input"
                            type="password"
                            value={passwordForm.passwordConfirm}
                            onChange={(event) => setPassword("passwordConfirm", event.target.value)}
                            placeholder="새 비밀번호를 다시 입력하세요"
                            onKeyDown={(event) => event.key === "Enter" && handleResetPassword()}
                        />

                        {passwordError && <div className="login-error">{passwordError}</div>}

                        <div className="login-modal-actions">
                            <button className="login-modal-secondary" type="button" onClick={closePasswordModal}>
                                닫기
                            </button>
                            <button
                                className="login-modal-primary"
                                type="button"
                                onClick={handleResetPassword}
                                disabled={passwordLoading}
                            >
                                {passwordLoading ? "변경 중..." : "변경"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default WelfareMyPage;
