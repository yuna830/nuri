import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Save, UserRound } from "lucide-react";

import { SEOUL_WELFARE_CENTERS, WELFARE_WORKERS_STORAGE_KEY } from "../../utils/welfare/welfareConstants";
import { readJsonStorage } from "../../utils/welfare/welfareStorage";
import WelfareHeader from "./WelfareHeader";

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
        year : "numeric",
        month : "2-digit",
        day : "2-digit",
        hour : "2-digit",
        minute : "2-digit",
    });
};

function WelfareMyPage() {
    const navigate = useNavigate();
    const [worker, setWorker] = useState(getCurrentWorker);
    const [form, setForm] = useState(() => ({
        name : worker?.name || "",
        center : worker?.center || "",
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
            [key] : value,
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
                    id : worker?.id || `W-${worker?.workerId || Date.now()}`,
                    workerId : worker?.workerId,
                    name,
                    role : worker?.role || "복지사",
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
            <div style = {styles.page}>
                <WelfareHeader />
                <main style = {styles.content}>
                    <section style = {styles.emptyCard}>
                        <h1 style = {styles.emptyTitle}>로그인이 필요합니다.</h1>
                        <Link to = "/welfare-login" style = {styles.primaryLink}>로그인으로 이동</Link>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div style = {styles.page}>
            <WelfareHeader>
                <Link to = "/welfare" style = {styles.headerLink}>
                    <ArrowLeft size = {16} />
                    대상자 목록
                </Link>
            </WelfareHeader>

            <main style = {styles.content}>
                <section style = {styles.hero}>
                    <div>
                        <p style = {styles.eyebrow}>복지사 계정</p>
                        <h1 style = {styles.title}>마이페이지</h1>
                        <p style = {styles.description}>
                            복지사 이름과 소속 기관 정보를 관리합니다.
                        </p>
                    </div>
                    <div style = {styles.heroIcon}>
                        <UserRound size = {34} />
                    </div>
                </section>

                <div style = {styles.layout}>
                    <aside style = {styles.profilePanel}>
                        <div style = {styles.avatar}>
                            <UserRound size = {34} />
                        </div>
                        <strong style = {styles.profileName}>{worker.name} 복지사</strong>
                        <span style = {styles.profileCenter}>{worker.center || "소속 기관 미등록"}</span>

                        <div style = {styles.profileDivider} />

                        <dl style = {styles.profileList}>
                            <div style = {styles.profileRow}>
                                <dt>아이디</dt>
                                <dd>{worker.workerId || "-"}</dd>
                            </div>
                            <div style = {styles.profileRow}>
                                <dt>권한</dt>
                                <dd>{worker.role || "복지사"}</dd>
                            </div>
                            <div style = {styles.profileRow}>
                                <dt>최근 로그인</dt>
                                <dd>{formatLoginAt(worker.loginAt)}</dd>
                            </div>
                        </dl>
                    </aside>

                    <section style = {styles.formPanel}>
                        <div style = {styles.sectionHead}>
                            <div>
                                <h2 style = {styles.sectionTitle}>기본 정보</h2>
                                <p style = {styles.sectionDesc}>대상자 관리 화면의 헤더 정보에 바로 반영됩니다.</p>
                            </div>
                            <Building2 size = {22} color = "#86a788" />
                        </div>

                        {error && <div style = {styles.errorBox}>{error}</div>}
                        {saved && <div style = {styles.savedBox}>마이페이지 정보가 저장되었습니다.</div>}

                        <div style = {styles.formGrid}>
                            <label style = {styles.field}>
                                <span style = {styles.label}>이름</span>
                                <input
                                    style = {styles.input}
                                    value = {form.name}
                                    onChange = {(event) => set("name", event.target.value)}
                                    placeholder = "예: 김복지"
                                />
                            </label>

                            <div style = {{ ...styles.field, ...styles.centerField }}>
                                <span style = {styles.label}>소속 기관</span>
                                <input
                                    style = {styles.input}
                                    value = {form.center}
                                    onChange = {(event) => {
                                        set("center", event.target.value);
                                        setIsCenterListOpen(true);
                                    }}
                                    onFocus = {() => setIsCenterListOpen(true)}
                                    onBlur = {() => {
                                        window.setTimeout(() => setIsCenterListOpen(false), 120);
                                    }}
                                    placeholder = "예: 우리복지센터"
                                />
                                {isCenterListOpen && centerKeyword.length > 0 && (
                                    <div style = {styles.centerSuggestList}>
                                        {centerSuggestions.length > 0 ? (
                                            centerSuggestions.map((center) => (
                                                <button
                                                    type = "button"
                                                    key = {center}
                                                    style = {styles.centerSuggestItem}
                                                    onMouseDown = {(event) => event.preventDefault()}
                                                    onClick = {() => {
                                                        set("center", center);
                                                        setIsCenterListOpen(false);
                                                    }}
                                                >
                                                    {center}
                                                </button>
                                            ))
                                        ) : (
                                            <p style = {styles.centerSuggestEmpty}>
                                                검색 결과가 없습니다. 입력한 기관명으로 저장할 수 있습니다.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <label style = {styles.field}>
                                <span style = {styles.label}>복지사 아이디</span>
                                <input
                                    style = {{ ...styles.input, ...styles.readOnlyInput }}
                                    value = {worker.workerId || ""}
                                    readOnly
                                />
                            </label>

                            <label style = {styles.field}>
                                <span style = {styles.label}>권한</span>
                                <input
                                    style = {{ ...styles.input, ...styles.readOnlyInput }}
                                    value = {worker.role || "복지사"}
                                    readOnly
                                />
                            </label>
                        </div>

                        <div style = {styles.actions}>
                            <button type = "button" style = {styles.secondaryButton} onClick = {handleLogout}>
                                로그아웃
                            </button>
                            <button type = "button" style = {styles.saveButton} onClick = {handleSave}>
                                <Save size = {17} />
                                저장
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

const styles = {
    page : {
        minHeight : "100vh",
        backgroundColor : "var(--bg-color)",
        color : "var(--text-color)",
    },
    content : {
        width : "min(1220px, calc(100% - 48px))",
        margin : "0 auto",
        padding : "34px 0 68px",
    },
    headerLink : {
        height : "36px",
        padding : "0 14px",
        borderRadius : "8px",
        border : "1px solid var(--main-color)",
        color : "var(--main-color)",
        backgroundColor : "white",
        display : "inline-flex",
        alignItems : "center",
        gap : "6px",
        textDecoration : "none",
        fontSize : "14px",
        fontWeight : "700",
        whiteSpace : "nowrap",
    },
    hero : {
        minHeight : "150px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        padding : "28px 32px",
        display : "flex",
        alignItems : "center",
        justifyContent : "space-between",
        gap : "24px",
        boxShadow : "0 6px 20px rgba(134, 167, 136, 0.08)",
    },
    eyebrow : {
        margin : "0 0 8px",
        color : "var(--main-color)",
        fontSize : "14px",
        fontWeight : "800",
    },
    title : {
        margin : 0,
        fontSize : "30px",
        fontWeight : "800",
        letterSpacing : 0,
    },
    description : {
        margin : "10px 0 0",
        color : "#66756a",
        fontSize : "15px",
        lineHeight : 1.6,
    },
    heroIcon : {
        width : "72px",
        height : "72px",
        borderRadius : "50%",
        backgroundColor : "#edf5ee",
        color : "var(--main-color)",
        display : "grid",
        placeItems : "center",
        flexShrink : 0,
    },
    layout : {
        marginTop : "18px",
        display : "grid",
        gridTemplateColumns : "320px minmax(0, 1fr)",
        gap : "18px",
        alignItems : "start",
    },
    profilePanel : {
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        padding : "26px",
        display : "flex",
        flexDirection : "column",
        alignItems : "center",
        textAlign : "center",
    },
    avatar : {
        width : "76px",
        height : "76px",
        borderRadius : "50%",
        backgroundColor : "#edf5ee",
        color : "var(--main-color)",
        display : "grid",
        placeItems : "center",
        marginBottom : "14px",
    },
    profileName : {
        fontSize : "21px",
        fontWeight : "800",
    },
    profileCenter : {
        marginTop : "6px",
        color : "#6d7a70",
        fontSize : "14px",
    },
    profileDivider : {
        width : "100%",
        height : "1px",
        backgroundColor : "var(--border-color)",
        margin : "22px 0",
    },
    profileList : {
        width : "100%",
        margin : 0,
        display : "flex",
        flexDirection : "column",
        gap : "12px",
        textAlign : "left",
    },
    profileRow : {
        display : "grid",
        gridTemplateColumns : "88px minmax(0, 1fr)",
        gap : "10px",
        fontSize : "14px",
        lineHeight : 1.5,
    },
    formPanel : {
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        padding : "28px 32px",
    },
    sectionHead : {
        display : "flex",
        alignItems : "flex-start",
        justifyContent : "space-between",
        gap : "18px",
        marginBottom : "22px",
        paddingBottom : "16px",
        borderBottom : "1px solid var(--border-color)",
    },
    sectionTitle : {
        margin : 0,
        fontSize : "20px",
        fontWeight : "800",
    },
    sectionDesc : {
        margin : "6px 0 0",
        color : "#718076",
        fontSize : "14px",
    },
    errorBox : {
        marginBottom : "16px",
        padding : "12px 14px",
        borderRadius : "8px",
        backgroundColor : "#fff0f0",
        color : "#b42f2f",
        fontSize : "14px",
        fontWeight : "700",
    },
    savedBox : {
        marginBottom : "16px",
        padding : "12px 14px",
        borderRadius : "8px",
        backgroundColor : "#edf7ef",
        color : "#3f7d46",
        fontSize : "14px",
        fontWeight : "700",
    },
    formGrid : {
        display : "grid",
        gridTemplateColumns : "repeat(2, minmax(0, 1fr))",
        gap : "18px",
    },
    field : {
        display : "flex",
        flexDirection : "column",
        gap : "8px",
        minWidth : 0,
    },
    centerField : {
        position : "relative",
        zIndex : 5,
    },
    label : {
        color : "#26352a",
        fontSize : "14px",
        fontWeight : "800",
    },
    input : {
        width : "100%",
        height : "48px",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        padding : "0 14px",
        color : "var(--text-color)",
        backgroundColor : "white",
        fontSize : "15px",
        fontFamily : "\"Noto Sans KR\", sans-serif",
        outline : "none",
        boxSizing : "border-box",
    },
    readOnlyInput : {
        backgroundColor : "#f7faf7",
        color : "#6f7b72",
    },
    centerSuggestList : {
        position : "absolute",
        top : "76px",
        left : 0,
        right : 0,
        zIndex : 20,
        maxHeight : "190px",
        overflowY : "auto",
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        boxShadow : "0 10px 24px rgba(0, 0, 0, 0.12)",
        padding : "6px",
    },
    centerSuggestItem : {
        width : "100%",
        minHeight : "36px",
        border : "none",
        borderRadius : "6px",
        backgroundColor : "white",
        color : "var(--text-color)",
        fontSize : "14px",
        fontWeight : "600",
        textAlign : "left",
        padding : "8px 10px",
        cursor : "pointer",
    },
    centerSuggestEmpty : {
        margin : 0,
        padding : "10px",
        color : "#718076",
        fontSize : "13px",
        lineHeight : 1.5,
    },
    actions : {
        marginTop : "26px",
        display : "flex",
        justifyContent : "flex-end",
        gap : "10px",
    },
    secondaryButton : {
        height : "42px",
        padding : "0 18px",
        borderRadius : "8px",
        border : "1px solid var(--border-color)",
        backgroundColor : "white",
        color : "#526057",
        fontSize : "14px",
        fontWeight : "700",
        cursor : "pointer",
    },
    saveButton : {
        height : "42px",
        padding : "0 20px",
        borderRadius : "8px",
        border : "none",
        backgroundColor : "var(--main-color)",
        color : "white",
        fontSize : "14px",
        fontWeight : "800",
        display : "inline-flex",
        alignItems : "center",
        gap : "7px",
        cursor : "pointer",
    },
    emptyCard : {
        border : "1px solid var(--border-color)",
        borderRadius : "8px",
        backgroundColor : "white",
        padding : "40px",
        textAlign : "center",
    },
    emptyTitle : {
        margin : "0 0 18px",
        fontSize : "22px",
    },
    primaryLink : {
        display : "inline-flex",
        alignItems : "center",
        height : "42px",
        padding : "0 18px",
        borderRadius : "8px",
        backgroundColor : "var(--main-color)",
        color : "white",
        fontWeight : "800",
        textDecoration : "none",
    },
};

export default WelfareMyPage;
