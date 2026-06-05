import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import KakaoMap from "../../components/KakaoMap.jsx";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import {
  COLORS,
  calcHealthScore,
  menus,
} from "../../utils/user/userPageData";
import {
  createSosAlert,
  createSosCancelAlert,
  fetchActivityBaseline,
  fetchActivitySlots,
  fetchActivityToday,
  fetchActivityTrend,
  fetchFallEvents,
  fetchFallPattern,
  fetchFallDetectionStatus,
  fetchSeniorAlerts,
  fetchTodayClimateAlerts,
  fetchTodayForecast,
  getCurrentSeniorId as getSavedSeniorId,
  readAlert,
  resolveUploadUrl,
  reverseGeocode,
  sendCheckInReply,
} from "../../api/userPageApi.js";
import { fetchJobList } from "../../utils/user/jobApi";
import { findWelfarePrograms, normalizePerson } from "../../welfareChat";
import "leaflet/dist/leaflet.css";
import "../../css/user/UserPage.css";

const getInitialSeniorProfile = () => {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

const getHealthScoresFromProfile = (profile) => {
  const healthInfo = profile?.healthInfo;
  if (!healthInfo) return null;
  return calcHealthScore({
    diabetes: healthInfo.diabetes,
    hypertension: healthInfo.hypertension,
    heart: healthInfo.heartDisease,
    joint: healthInfo.jointDisease,
    stroke: healthInfo.stroke,
    kidney: healthInfo.kidneyDisease,
    lung: healthInfo.lungDisease,
    liver: healthInfo.liverDisease,
    cancer: healthInfo.cancer,
    walkingAid: healthInfo.walkingAid,
    dementia: healthInfo.dementia,
    vision: healthInfo.vision,
    hearing: healthInfo.hearing,
    recentFall: healthInfo.recentFall,
    smoking: healthInfo.smoking,
    drinking: healthInfo.drinking,
    medicineCount: healthInfo.medicineCount,
  });
};

const buildUserWelfarePerson = (profile, userName, userRegion) => {
  const senior = profile?.senior ?? {};
  const healthInfo = profile?.healthInfo ?? {};
  const medicationInfo = Array.isArray(healthInfo.medications)
    ? healthInfo.medications.map((item) => item?.name || item).filter(Boolean).join(", ")
    : "";
  const diseases = [
    healthInfo.diabetes,
    healthInfo.hypertension,
    healthInfo.heartDisease,
    healthInfo.jointDisease,
    healthInfo.stroke,
    healthInfo.kidneyDisease,
    healthInfo.lungDisease,
    healthInfo.liverDisease,
    healthInfo.cancer,
    healthInfo.dementia,
    healthInfo.vision,
    healthInfo.hearing,
    healthInfo.recentFall,
  ].filter((value) => value && value !== "없음");

  return normalizePerson({
    id: senior.id,
    name: senior.name || userName,
    age: senior.age,
    gender: senior.gender,
    region: senior.region || senior.address || userRegion,
    address: senior.address || senior.region || userRegion,
    healthStatus: healthInfo.healthStatus,
    condition: diseases.join(", "),
    diseases,
    medicationInfo,
    medicineCount: healthInfo.medicineCount,
    incomeLevel: healthInfo.incomeLevel,
    household: healthInfo.householdType,
    householdType: healthInfo.householdType,
    currentBenefits: healthInfo.currentBenefits,
    welfareMemo: healthInfo.welfareMemo,
    welfareDecision: senior.welfareDecision,
    welfareDecisionReason: senior.welfareDecisionReason,
    healthInfo,
  });
};

function RadarChart({ scores, labels = {}, summaryLabel = "종합 점수", note = "", quality = null }) {
  const keys = Object.keys(scores);
  const vals = Object.values(scores);
  const count = keys.length;
  const cx = 130, cy = 130, radius = 95;
  const angle = (i) => (Math.PI * 2 * i) / count - Math.PI / 2;
  const point = (i, ratio) => ({
    x: cx + radius * ratio * Math.cos(angle(i)),
    y: cy + radius * ratio * Math.sin(angle(i)),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = vals.map((v, i) => point(i, v / 100));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / count);
  const avgColor = avg >= 75 ? COLORS.green : avg >= 50 ? "#f0a500" : COLORS.danger;

  return (
    <div className="up-radar-wrap">
      <svg width="260" height="260" viewBox="0 0 260 260">
        {gridLevels.map((lvl) => (
          <polygon key={lvl}
            points={keys.map((_, i) => { const p = point(i, lvl); return `${p.x},${p.y}`; }).join(" ")}
            fill="none" stroke={COLORS.border} strokeWidth="1" />
        ))}
        {keys.map((_, i) => { const p = point(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={COLORS.border} strokeWidth="1" />; })}
        <path d={pathD} fill={COLORS.green} fillOpacity="0.2" stroke={COLORS.green} strokeWidth="2.5" />
        {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={COLORS.green} stroke="#fff" strokeWidth="2" />)}
        {keys.map((key, i) => { const p = point(i, 1.28); return <text key={key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="700" fill={COLORS.greenDark} fontFamily="Noto Sans KR, sans-serif">{labels[key] || key}</text>; })}
        {vals.map((v, i) => { const p = point(i, (v / 100) * 0.68); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={COLORS.text} fontWeight="700">{v}</text>; })}
      </svg>
      <div className="up-radar-info">
        <div className="up-radar-label">{summaryLabel}</div>
        <div className="up-radar-score" style={{ color: avgColor }}>{avg}</div>
        <div className="up-radar-unit">/ 100점</div>
        {quality && (
          <div className={`up-radar-quality ${quality.level || ""}`}>
            {quality.level === "good" ? "안정 수집" : quality.level === "insufficient" ? "수집 중" : null}
          </div>
        )}
        {note && <div className="up-radar-note">{note}</div>}
        {keys.map((key, i) => (
          <div key={key} className="up-radar-row">
            <div className="up-radar-key">{labels[key] || key}</div>
            <div className="up-radar-bar">
              <div className="up-radar-bar-fill" style={{
                width: `${vals[i]}%`,
                background: vals[i] >= 75 ? COLORS.green : vals[i] >= 50 ? "#f0a500" : COLORS.danger,
              }} />
            </div>
            <div className="up-radar-value">{vals[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const formatScore = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "-");

const getActivityLabel = (score) => {
  const val = Number(score);
  if (!Number.isFinite(val)) return { text: "수집 중", level: "slot-empty" };
  if (val >= 60) return { text: "양호", level: "slot-high" };
  if (val >= 25) return { text: "보통", level: "slot-mid" };
  return { text: "활동 적음", level: "slot-low" };
};

const DEFAULT_ACTIVITY_TODAY = {
  status: "pending",
  scores: null,
  labels: { activity: "활동량", balance: "균형", routine: "생활 리듬", safety: "안전" },
  message: "하루치 활동 데이터가 쌓이면 다음날부터 비교를 시작합니다.",
  overall_note: "하루치 활동 데이터가 쌓이면 다음날부터 비교를 시작합니다.",
  data_quality: { level: "insufficient", message: "오늘은 활동 데이터를 수집하고 있습니다." },
};

const DEFAULT_ACTIVITY_SLOTS = {
  slots: {
    morning: { label: "오전", status: "empty", data_points: 0, scores: {} },
    afternoon: { label: "오후", status: "empty", data_points: 0, scores: {} },
    evening: { label: "저녁", status: "empty", data_points: 0, scores: {} },
  },
};

const DEFAULT_ACTIVITY_BASELINE = {
  status: "pending",
  message: "정보를 모으는 중이에요. 며칠 지나면 평소 움직임과 비교해 보여드려요.",
};

const DEFAULT_FALL_PATTERN = {
  status: "pending",
  message: "데이터를 수집하고 있습니다. 낙상 전후 변화는 기록이 쌓이면 보여드립니다.",
};

const getSafeZoneAlertRadius = (zone, accuracy) => {
  const radius = Number(zone?.radiusMeters ?? 500);
  const gpsTolerance = accuracy == null
    ? 75
    : Math.min(Math.max(Number(accuracy) || 75, 50), 150);
  return radius + gpsTolerance + 30;
};

function ActivityInsightCards({ slots, baseline, fallPattern, onInfoClick }) {
  const slotList = slots?.slots ? Object.entries(slots.slots) : [];
  const baselineItems = baseline?.today_comparison
    ? Object.entries(baseline.today_comparison).slice(0, 3)
    : [];
  const fallWarnings = Array.isArray(fallPattern?.warning_signs) ? fallPattern.warning_signs.slice(0, 3) : [];

  return (
    <div className="up-content-row">
      <div className="up-card full up-activity-insights">
        <div className="up-card-head">
          <div className="up-card-title">활동 변화 분석</div>
        </div>

        <div className="up-insight-grid">
          <section className="up-insight-panel">
            <div className="up-insight-title">시간대별 활동</div>
            {slotList.length ? (
              <div className="up-slot-list">
                {slotList.map(([key, slot]) => {
                  const label = slot.status === "ok"
                    ? getActivityLabel(slot.scores?.activity)
                    : { text: "수집 중", level: "slot-empty" };
                  return (
                    <div key={key} className="up-slot-item">
                      <div>
                        <strong>{slot.label}</strong>
                        <span>{slot.status === "ok" ? `${slot.data_points}개 기록` : "기록 없음"}</span>
                      </div>
                      <b className={label.level}>{label.text}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="up-insight-empty">시간대별 활동 데이터를 불러오는 중입니다.</p>
            )}
          </section>

          <section className="up-insight-panel">
            <div className="up-insight-title">평소 움직임 비교</div>
            {baseline?.status === "ok" ? (
              <div className="up-baseline-list">
                {baselineItems.map(([key, item]) => (
                  <div key={key} className={`up-baseline-item ${item.level}`}>
                    <span>{baseline.labels?.[key] || key}</span>
                    <strong>{formatScore(item.today)}</strong>
                    <em>{item.level === "anomaly" ? "평소와 다름" : item.level === "deviation" ? "약간 다름" : "평소 범위"}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p className="up-insight-empty">{"정보를 모으는 중이에요. 며칠 지나면 평소 움직임과 비교해 보여드려요."}</p>
            )}
          </section>

          <section className="up-insight-panel">
            <div className="up-insight-title">낙상 전후 변화</div>
            {fallPattern?.status === "ok" ? (
              <div className="up-warning-list">
                {fallWarnings.map((warning, index) => (
                  <div key={index} className="up-warning-item">{warning}</div>
                ))}
              </div>
            ) : (
              <p className="up-insight-empty">{fallPattern?.message || "낙상 기록이 생기면 전후 활동 변화를 보여줍니다."}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
function scheduleFromApi(schedule) {
  return {
    id: schedule.id,
    date: schedule.scheduleDate,
    time: schedule.scheduleTime?.slice(0, 5) || "시간 미정",
    text: schedule.content || schedule.title,
  };
}

function todayValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${date}`;
}

function getCurrentSeniorId(initialSenior) {
  try {
    const saved = sessionStorage.getItem("currentSenior");
    const sessionId = saved ? JSON.parse(saved)?.senior?.id : null;
    return localStorage.getItem("current_senior_id") || sessionId || initialSenior?.id || "";
  } catch {
    return localStorage.getItem("current_senior_id") || initialSenior?.id || "";
  }
}

const formatDongAddress = (address = "") => {
  const parts = String(address)
    .replaceAll(",", " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 3).join(" ");
};

const toTelHref = (phone = "") => {
  const digits = String(phone).replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : "";
};

const getLocalCareTeam = (seniorId) => {
  if (!seniorId) return null;

  try {
    const careTeamMap = JSON.parse(localStorage.getItem("seniorCareTeamMap") || "{}");
    return careTeamMap[String(seniorId)] || null;
  } catch {
    return null;
  }
};

const isSameJson = (first, second) => JSON.stringify(first) === JSON.stringify(second);

const setChanged = (setter, nextValue) => {
  setter((prevValue) => (isSameJson(prevValue, nextValue) ? prevValue : nextValue));
};

const isTodayDateTime = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
};

const isSosAlert = (alert) => {
  const text = `${alert?.type || ""} ${alert?.title || ""} ${alert?.message || ""}`;
  return alert?.type === "SOS" || alert?.type === "SOS_CANCEL" || /SOS/.test(text);
};

const PENDING_SOS_CLEAR_GRACE_MS = 5000;

const markPendingSos = (alertResult) => {
  localStorage.setItem("pending_sos", "true");
  localStorage.setItem("pending_sos_at", String(Date.now()));
  if (alertResult?.id) {
    localStorage.setItem("pending_sos_id", String(alertResult.id));
  }
};

const clearPendingSosStorage = () => {
  localStorage.removeItem("pending_sos");
  localStorage.removeItem("pending_sos_at");
  localStorage.removeItem("pending_sos_id");
};

const shouldClearPendingSos = (sosAlerts) => {
  const pendingId = localStorage.getItem("pending_sos_id");
  const pendingAt = Number(localStorage.getItem("pending_sos_at") || 0);

  if (sosAlerts.length > 0 && sosAlerts.every((alert) => alert.isRead || alert.type === "SOS_CANCEL")) {
    return true;
  }

  if (!pendingId && !pendingAt) {
    return sosAlerts.length === 0;
  }

  if (pendingAt && Date.now() - pendingAt < PENDING_SOS_CLEAR_GRACE_MS) {
    return false;
  }

  if (!pendingId) {
    return sosAlerts.length === 0 || !sosAlerts.some((alert) => alert.type === "SOS" && !alert.isRead);
  }

  return !sosAlerts.some((alert) => String(alert.id) === pendingId && !alert.isRead);
};

const HANDLED_CALL_ALERTS_KEY = "handled_call_alert_ids";
const HANDLED_CALL_SUPPRESS_UNTIL_KEY = "handled_call_alert_suppress_until";
const HANDLED_CALL_ALERT_CUTOFF_KEY = "handled_call_alert_cutoff_at";

const getHandledCallAlertIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(HANDLED_CALL_ALERTS_KEY) || "[]").map(String));
  } catch {
    return new Set();
  }
};

const markCallAlertHandled = (alertId) => {
  const handledIds = getHandledCallAlertIds();
  if (alertId) handledIds.add(String(alertId));
  localStorage.setItem(HANDLED_CALL_ALERTS_KEY, JSON.stringify([...handledIds].slice(-50)));
  localStorage.setItem(HANDLED_CALL_SUPPRESS_UNTIL_KEY, String(Date.now() + 30 * 1000));
  localStorage.setItem(HANDLED_CALL_ALERT_CUTOFF_KEY, String(Date.now() + 5000));
};

const isCallAlertHandled = (alert) => {
  const suppressUntil = Number(localStorage.getItem(HANDLED_CALL_SUPPRESS_UNTIL_KEY) || 0);
  if (suppressUntil > Date.now()) return true;

  const handledCutoff = Number(localStorage.getItem(HANDLED_CALL_ALERT_CUTOFF_KEY) || 0);
  const createdAt = alert?.createdAt ? Date.parse(alert.createdAt) : 0;
  if (handledCutoff && createdAt && createdAt <= handledCutoff) return true;

  if (!alert?.id) return false;
  return getHandledCallAlertIds().has(String(alert.id));
};

export default function UserPage() {
  const navigate = useNavigate();
  const initialProfile = getInitialSeniorProfile();
  const initialSenior = initialProfile?.senior;
  const initialLocalCareTeam = getLocalCareTeam(initialSenior?.id);
  const locationIntervalRef = useRef(null);
  const weatherIntervalRef = useRef(null);
  const weatherAlertIntervalRef = useRef(null);
  const locationWatchRef = useRef(null);
  // 보호자 페이지 이동 경로에서 위치가 너무 자주 저장되는 것을 방지
  const lastSavedLocationRef = useRef(null);

  const [weather, setWeather] = useState(null);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [showSOS, setShowSOS] = useState(false);
  const [activityInfoModal, setActivityInfoModal] = useState(null);
  const [pendingSos, setPendingSos] = useState(() => localStorage.getItem("pending_sos") === "true");
  // eslint-disable-next-line no-unused-vars
  const [dateStr, setDateStr] = useState("");
  const [userName, setUserName] = useState(initialSenior?.name || "사용자");
  const [userRegion, setUserRegion] = useState(initialSenior?.region || initialSenior?.address || "");
  const [profileImageUrl, setProfileImageUrl] = useState(initialSenior?.profileImageUrl || "");
  const [currentProfile, setCurrentProfile] = useState(initialProfile);
  const [careTeam, setCareTeam] = useState({
    guardianName: initialProfile?.guardian?.name || initialProfile?.guardianName || initialSenior?.guardianName || initialLocalCareTeam?.guardianName || "",
    guardianRelation: initialProfile?.relation || initialSenior?.guardianRelation || initialLocalCareTeam?.guardianRelation || "",
    guardianPhone: initialProfile?.guardian?.phone || initialSenior?.guardianPhone || initialLocalCareTeam?.guardianPhone || "",
    socialWorkerName: initialProfile?.socialWorker?.name || initialProfile?.socialWorkerName || initialSenior?.socialWorkerName || initialLocalCareTeam?.socialWorkerName || "",
    socialWorkerPhone: initialProfile?.socialWorker?.phone || initialProfile?.socialWorkerPhone || initialSenior?.socialWorkerPhone || initialLocalCareTeam?.socialWorkerPhone || "",
  });
  // eslint-disable-next-line no-unused-vars
  const [healthScores, setHealthScores] = useState(() => getHealthScoresFromProfile(initialProfile));
  const [activityToday, setActivityToday] = useState(DEFAULT_ACTIVITY_TODAY);
  const [activityTrend, setActivityTrend] = useState(null);
  const [activitySlots, setActivitySlots] = useState(DEFAULT_ACTIVITY_SLOTS);
  const [activityBaseline, setActivityBaseline] = useState(DEFAULT_ACTIVITY_BASELINE);
  const [activityFallPattern, setActivityFallPattern] = useState(DEFAULT_FALL_PATTERN);
  // eslint-disable-next-line no-unused-vars
  const [deviceStatus, setDeviceStatus] = useState("checking");
  const [sensorConnected, setSensorConnected] = useState(null);
  const [scheduleList, setScheduleList] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [allSchedules, setAllSchedules] = useState([]);
  const [isLoadingAllSchedules, setIsLoadingAllSchedules] = useState(false);
  const [jobHasNew, setJobHasNew] = useState(false);
  const [incomingCallAlert, setIncomingCallAlert] = useState(null);
  const [userAlerts, setUserAlerts] = useState([]);
  const [safeZoneExitAlert, setSafeZoneExitAlert] = useState(null);
  const [todayFallCount, setTodayFallCount] = useState(0);
  const dismissedMedicineAlertIdsRef = useRef(new Set());
  const dismissedInfoAlertIdsRef = useRef(new Set());

  // 위치 관련 state
  const [currentPos, setCurrentPos] = useState(null);
  const [currentAddress, setCurrentAddress] = useState("위치 불러오는 중...");
  const [currentLocationTime, setCurrentLocationTime] = useState("");
  const [isInRange, setIsInRange] = useState(true);
  const [safeZone, setSafeZone] = useState(null);
  const [safeZones, setSafeZones] = useState([]);

  const [medicineAlert, setMedicineAlert] = useState(null);
  const [infoUpdateRequestAlert, setInfoUpdateRequestAlert] = useState(null);
  const [checkInMessageAlert, setCheckInMessageAlert] = useState(null);
  const [guardianEditOpen, setGuardianEditOpen] = useState(false);
  const [guardianEditForm, setGuardianEditForm] = useState({ name: "", relation: "" });
  const [guardianSaving, setGuardianSaving] = useState(false);
  const [checkInReplyMessage, setCheckInReplyMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadActivityCondition = async () => {
      const seniorId = getCurrentSeniorId(initialSenior);
      try {
        const today = await fetchActivityToday(seniorId);
        const [trend, slots, baseline, fallPattern] = await Promise.all([
          fetchActivityTrend(1, seniorId),
          fetchActivitySlots(seniorId),
          fetchActivityBaseline(14, seniorId),
          fetchFallPattern(seniorId),
        ]);
        if (!isMounted) return;
        setActivityToday(today?.status === "ok" && today?.scores ? today : DEFAULT_ACTIVITY_TODAY);
        setDeviceStatus(today?.status === "ok" ? "connected" : "checking");
        setActivityTrend(trend);
        setActivitySlots(slots?.slots ? slots : DEFAULT_ACTIVITY_SLOTS);
        setActivityBaseline(baseline || DEFAULT_ACTIVITY_BASELINE);
        setActivityFallPattern(fallPattern || DEFAULT_FALL_PATTERN);
      } catch {
        if (!isMounted) return;
        setActivityToday(DEFAULT_ACTIVITY_TODAY);
        setDeviceStatus("failed");
        setActivityTrend(null);
        setActivitySlots(DEFAULT_ACTIVITY_SLOTS);
        setActivityBaseline(DEFAULT_ACTIVITY_BASELINE);
        setActivityFallPattern(DEFAULT_FALL_PATTERN);
      }
    };

    loadActivityCondition();
    const intervalId = window.setInterval(loadActivityCondition, 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const pollSensor = async () => {
      try {
        const status = await fetchFallDetectionStatus();
        const s = status?.arduino_status ?? "";
        if (isMounted) setSensorConnected(s === "NORMAL" || s === "FALL");
      } catch {
        if (isMounted) setSensorConnected(false);
      }
    };

    pollSensor();
    const intervalId = window.setInterval(pollSensor, 30 * 1000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const fetchWeather = async (lat, lon) => {
    try {
      const forecast = await fetchTodayForecast(lat, lon);

      setChanged(setWeather, {
        temp: forecast.temp === "--" ? "--" : Math.round(Number(forecast.temp)),
        status: forecast.status,
        icon: forecast.icon,
        region: currentAddress && currentAddress !== "위치 불러오는 중..." ? currentAddress : "현재 위치",
        humid: forecast.humid && forecast.humid !== "--" ? forecast.humid + "%" : "-",
      });
    } catch {
      setWeather({ temp: "--", status: "불러오기 실패", icon: "🌧️", region: "현재 위치" });
    }
  };

  const fetchWeatherAlerts = async () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentTime = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const currentDateTime = `${today} ${currentTime}`;

    try {
      const seniorId = getSavedSeniorId();
      const savedAlerts = seniorId ? await fetchTodayClimateAlerts(seniorId).catch(() => []) : [];
      const envAlerts = [];

      const isReadableAlert = (alert) => {
        const text = `${alert.type || ""} ${alert.message || ""}`;
        return /[가-힣]/.test(text) && !text.includes("???");
      };

      const seenDbAlertKeys = new Set();
      const dbAlerts = savedAlerts.filter(isReadableAlert).filter((alert) => {
        const key = `${alert.type}-${alert.message}-${alert.issuedAt?.slice(0, 13) || ""}`;
        if (seenDbAlertKeys.has(key)) return false;
        seenDbAlertKeys.add(key);
        return true;
      }).map((alert) => {
        const colors = { danger: COLORS.danger, warning: COLORS.danger, caution: "#f0a500", normal: "#4f9cc9", safe: COLORS.green };
        const issuedAt = alert.issuedAt || alert.createdAt || "";
        return {
          type: alert.type || "기후",
          color: colors[alert.level] || COLORS.green,
          msg: alert.message,
          time: issuedAt ? issuedAt.replace("T", " ").slice(0, 16) : "-",
          sortTime: issuedAt ? Date.parse(issuedAt) : 0,
        };
      }).sort((first, second) => second.sortTime - first.sortTime);

      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0);
      const currentHourTime = currentHourStart.getTime();
      const freshDbAlerts = dbAlerts.filter((alert) => alert.sortTime >= currentHourTime);
      const staleDbAlerts = dbAlerts.filter((alert) => alert.sortTime < currentHourTime);

      const currentWeatherAlert = {
        type: "오늘 날씨",
        color: COLORS.green,
        msg: "현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.",
        time: currentDateTime,
        sortTime: now.getTime() - 1,
      };

      const seenAlertKeys = new Set();
      const merged = [...envAlerts, ...freshDbAlerts, currentWeatherAlert, ...staleDbAlerts].filter((alert) => {
        const key = alert.type;
        if (seenAlertKeys.has(key)) return false;
        seenAlertKeys.add(key);
        return true;
      }).sort((first, second) => second.sortTime - first.sortTime);

      const latestTwoAlerts = merged.slice(0, 2);
      if (latestTwoAlerts.length > 0) {
        setChanged(setWeatherAlerts, latestTwoAlerts);
        return;
      }

      setChanged(setWeatherAlerts, [{
        type: "안전",
        color: COLORS.green,
        msg: "현재 확인된 기후 위험 알림이 없습니다.",
        time: currentDateTime,
      }]);
    } catch {
      setChanged(setWeatherAlerts, [{
        type: "안전",
        color: COLORS.green,
        msg: "기후 알림을 확인하는 중입니다.",
        time: currentDateTime,
      }]);
    }
  };

  const updateLocation = async (lat, lon, accuracy) => {
    const capturedAt = new Date();
    setCurrentLocationTime(
      capturedAt.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );

    const lastSavedLocation = lastSavedLocationRef.current;
    const movedMeters = lastSavedLocation
      ? Math.sqrt(
          Math.pow((lat - lastSavedLocation.lat) * 111000, 2) +
            Math.pow(
              (lon - lastSavedLocation.lon) *
                111000 *
                Math.cos((lat * Math.PI) / 180),
              2
            )
        )
      : Infinity;

    if (lastSavedLocation && movedMeters < 35) {
      setChanged(setCurrentPos, { lat, lon, accuracy });
      return;
    }

    setChanged(setCurrentPos, { lat, lon, accuracy });

    const shouldResolveAddress =
      movedMeters >= 50 ||
      !currentAddress ||
      currentAddress === "위치 불러오는 중..." ||
      currentAddress === "현재 위치";

    const resolvedAddress = shouldResolveAddress
      ? await reverseGeocode(lat, lon).catch(() => "현재 위치")
      : currentAddress;

    const displayAddress = resolvedAddress || "현재 위치";
    setChanged(setCurrentAddress, displayAddress);

    try {
      const seniorId = getCurrentSeniorId(initialSenior);

      if (seniorId && movedMeters >= 50) {
        await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seniorId,
            latitude: lat,
            longitude: lon,
            address: displayAddress,
            accuracy,
          }),
        }).catch((error) => {
          console.warn("위치 저장 실패:", error);
        });
      }

      lastSavedLocationRef.current = { lat, lon };
    } catch {
      setChanged(setCurrentAddress, "현재 위치");
    }

    const zones = safeZones.length > 0 ? safeZones : safeZone ? [safeZone] : [];
    if (zones.length > 0) {
      setChanged(setIsInRange, zones.some((zone) => {
        const dist = Math.sqrt(
          Math.pow((lat - zone.centerLatitude) * 111000, 2) +
            Math.pow(
              (lon - zone.centerLongitude) *
                111000 *
                Math.cos((lat * Math.PI) / 180),
              2
            )
        );

        return dist <= getSafeZoneAlertRadius(zone, accuracy);
      }));
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude);
        updateLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => fetchWeather(37.5665, 126.9780),
      options
    );

    locationWatchRef.current = navigator.geolocation.watchPosition(
      pos => updateLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy
      ),
      () => {},
      options
    );

    weatherIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(37.5665, 126.9780),
        options
      );
    }, 10 * 60 * 1000);
  };

  const isSameSafeZones = (prevZones, nextZones) => {
    if (prevZones.length !== nextZones.length) {
      return false;
    }

    return prevZones.every((prevZone, index) => {
      const nextZone = nextZones[index];

      return String(prevZone.id) === String(nextZone.id)
        && prevZone.name === nextZone.name
        && Number(prevZone.centerLatitude) === Number(nextZone.centerLatitude)
        && Number(prevZone.centerLongitude) === Number(nextZone.centerLongitude)
        && Number(prevZone.radiusMeters) === Number(nextZone.radiusMeters)
        && prevZone.address === nextZone.address;
    });
  };

  useEffect(() => {
    fetchWeatherAlerts();
    startLocationTracking();
    weatherAlertIntervalRef.current = setInterval(fetchWeatherAlerts, 10 * 60 * 1000);

    let safeZoneIntervalId;
    let jobsIntervalId;
    let seniorIntervalId;

    const seniorId = getCurrentSeniorId(initialSenior);

    const loadSafeZoneForHome = () => {
      if (!seniorId) return;

      fetch(`/api/safe-zones/senior/${seniorId}?t=${Date.now()}`, {
        cache: "no-store",
      })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          const zones = Array.isArray(data) ? data : data ? [data] : [];
          

          setSafeZones((prevZones) => {
            if (isSameSafeZones(prevZones, zones)) {
              return prevZones;
            }

            return zones;
          });

          setSafeZone((prevZone) => {
            const nextZone = zones[0] || null;

            if (!prevZone && !nextZone) {
              return prevZone;
            }

            if (!prevZone || !nextZone) {
              return nextZone;
            }

            const isSameZone =
              String(prevZone.id) === String(nextZone.id)
              && prevZone.name === nextZone.name
              && Number(prevZone.centerLatitude) === Number(nextZone.centerLatitude)
              && Number(prevZone.centerLongitude) === Number(nextZone.centerLongitude)
              && Number(prevZone.radiusMeters) === Number(nextZone.radiusMeters)
              && prevZone.address === nextZone.address;

            return isSameZone ? prevZone : nextZone;
          });
        })
        .catch(() => {});
    };

    loadSafeZoneForHome();

    if (seniorId) {
      safeZoneIntervalId = setInterval(loadSafeZoneForHome, 10 * 1000);
    }

    const checkNewJobs = async () => {
      const result = await fetchJobList(1, "").catch(() => null);
      const latestJobId = result?.list?.[0]?.jobId;

      if (!latestJobId) return;

      const seenJobId = localStorage.getItem("jobs_last_seen_job_id");
      setJobHasNew(Boolean(seenJobId && seenJobId !== latestJobId));

      if (!seenJobId) {
        localStorage.setItem("jobs_last_seen_job_id", latestJobId);
      }

      localStorage.setItem("jobs_latest_job_id", latestJobId);
    };

    checkNewJobs();
    jobsIntervalId = setInterval(checkNewJobs, 5 * 60 * 1000);

    const updateCareTeam = (profile) => {
      const senior = profile?.senior ?? {};
      const guardian = profile?.guardian ?? profile?.matchedGuardian ?? null;
      const socialWorker = profile?.socialWorker ?? profile?.matchedSocialWorker ?? null;
      const localCareTeam = getLocalCareTeam(senior.id);

      setChanged(setCareTeam, {
        guardianName: guardian?.name || profile?.guardianName || senior.guardianName || localCareTeam?.guardianName || "",
        guardianRelation: profile?.relation || guardian?.relation || senior.guardianRelation || localCareTeam?.guardianRelation || "",
        guardianPhone: guardian?.phone || profile?.guardianPhone || senior.guardianPhone || localCareTeam?.guardianPhone || "",
        socialWorkerName: socialWorker?.name || profile?.socialWorkerName || senior.socialWorkerName || localCareTeam?.socialWorkerName || "",
        socialWorkerPhone: socialWorker?.phone || profile?.socialWorkerPhone || senior.socialWorkerPhone || localCareTeam?.socialWorkerPhone || "",
      });
    };

    const loadMatchedCareTeam = async (seniorId, fallbackProfile) => {
      updateCareTeam(fallbackProfile);
    };

    const loadCurrentSenior = async () => {
      try {
        const saved = sessionStorage.getItem("currentSenior");

        if (saved) {
          const profile = JSON.parse(saved);
          const cachedSeniorId = profile?.senior?.id;
          let canUseCachedProfile = true;

          if (cachedSeniorId) {
            const response = await fetch(`/api/seniors/${cachedSeniorId}`);

            if (response.ok) {
              const freshProfile = await response.json();

              sessionStorage.setItem("currentSenior", JSON.stringify(freshProfile));
              setChanged(setCurrentProfile, freshProfile);
              setChanged(setUserName, freshProfile?.senior?.name || "사용자");
              setChanged(setUserRegion, freshProfile?.senior?.region || freshProfile?.senior?.address || "");
              setChanged(setProfileImageUrl, freshProfile?.senior?.profileImageUrl || "");
              loadMatchedCareTeam(cachedSeniorId, freshProfile);
              setChanged(setHealthScores, getHealthScoresFromProfile(freshProfile));
              return;
            }

            if (response.status === 404) {
              canUseCachedProfile = false;
              sessionStorage.removeItem("currentSenior");
              localStorage.removeItem("current_senior_id");
            }
          }

          if (canUseCachedProfile) {
            setChanged(setUserName, profile?.senior?.name || "사용자");
            setChanged(setCurrentProfile, profile);
            setChanged(setUserRegion, profile?.senior?.region || profile?.senior?.address || "");
            setChanged(setProfileImageUrl, profile?.senior?.profileImageUrl || "");
            loadMatchedCareTeam(cachedSeniorId, profile);
            setChanged(setHealthScores, getHealthScoresFromProfile(profile));
            return;
          }
        }

        const response = await fetch(`${SPRING_API_BASE}/api/seniors`);
        if (!response.ok) return;

        const profiles = await response.json();
        const latest = profiles[profiles.length - 1];

        if (!latest) return;

        sessionStorage.setItem("currentSenior", JSON.stringify(latest));
        localStorage.setItem("current_senior_id", String(latest.senior.id));
        setChanged(setCurrentProfile, latest);
        setChanged(setUserName, latest?.senior?.name || "사용자");
        setChanged(setUserRegion, latest?.senior?.region || latest?.senior?.address || "");
        setChanged(setProfileImageUrl, latest?.senior?.profileImageUrl || "");
        loadMatchedCareTeam(latest?.senior?.id, latest);
        setChanged(setHealthScores, getHealthScoresFromProfile(latest));
      } catch (error) {
        console.error("사용자 정보 조회 실패:", error);
      }
    };

    loadCurrentSenior();
    seniorIntervalId = setInterval(loadCurrentSenior, 60 * 1000);

    const currentDate = new Date();
    const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
     
    setDateStr(
      `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일 (${days[currentDate.getDay()]})`
    );

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (locationWatchRef.current != null) navigator.geolocation.clearWatch(locationWatchRef.current);
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
      if (weatherAlertIntervalRef.current) clearInterval(weatherAlertIntervalRef.current);
      if (safeZoneIntervalId) clearInterval(safeZoneIntervalId);
      if (jobsIntervalId) clearInterval(jobsIntervalId);
      if (seniorIntervalId) clearInterval(seniorIntervalId);
    };
  }, []);

  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return;
    const loadSelectedDateSchedules = () => fetch(`/api/schedules/senior/${seniorId}/date/${selectedScheduleDate}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        const mapped = list.map(scheduleFromApi);
        setChanged(setScheduleList, mapped);
        if (selectedScheduleDate === todayValue()) {
          setChanged(setTodaySchedules, mapped);
        }
      })
      .catch(() => setChanged(setScheduleList, []));
    loadSelectedDateSchedules();
    const scheduleIntervalId = setInterval(loadSelectedDateSchedules, 60 * 1000);
    return () => clearInterval(scheduleIntervalId);
  }, [selectedScheduleDate]);

  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return;
    const today = todayValue();
    const loadTodaySchedules = () => fetch(`/api/schedules/senior/${seniorId}/date/${today}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        setChanged(setTodaySchedules, list.map(scheduleFromApi));
      })
      .catch(() => setChanged(setTodaySchedules, []));
    loadTodaySchedules();
    const todayScheduleIntervalId = setInterval(loadTodaySchedules, 60 * 1000);
    return () => clearInterval(todayScheduleIntervalId);
  }, []);

  useEffect(() => {
    const zones = safeZones.length > 0 ? safeZones : safeZone ? [safeZone] : [];
    if (!currentPos || zones.length === 0) return;

    const distances = zones.map((zone) => ({
      zone,
      distance: Math.sqrt(
        Math.pow((currentPos.lat - zone.centerLatitude) * 111000, 2)
        + Math.pow((currentPos.lon - zone.centerLongitude) * 111000 * Math.cos(currentPos.lat * Math.PI / 180), 2)
      ),
    })).sort((first, second) => first.distance - second.distance);

    if (distances[0]?.zone) {
       
      setSafeZone(distances[0].zone);
    }

    setChanged(
      setIsInRange,
      distances.some(({ zone, distance }) => distance <= getSafeZoneAlertRadius(zone, currentPos.accuracy))
    );
  }, [currentPos, safeZone, safeZones]);

  useEffect(() => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (!seniorId) return undefined;

    let cancelled = false;
    const loadCallRequest = async () => {
      const alerts = await fetchSeniorAlerts(seniorId).catch(() => []);
      if (cancelled) return;
      setUserAlerts(alerts);

      const sosAlerts = alerts.filter(isSosAlert);
      const rawCallAlerts = alerts.filter((alert) => alert.type === "CALL_REQUEST" && !alert.isRead);
      const pendingAt = Number(localStorage.getItem("pending_sos_at") || 0);
      const sosResolvedAt = Number(localStorage.getItem(`sos_resolved_at:${seniorId}`) || 0);
      if (pendingSos && (rawCallAlerts.length > 0 || (pendingAt && sosResolvedAt >= pendingAt) || shouldClearPendingSos(sosAlerts))) {
        clearPendingSosStorage();
        setPendingSos(false);
      }

      const callAlert = rawCallAlerts.find((alert) => !isCallAlertHandled(alert));
      setIncomingCallAlert(callAlert || null);

      const medicineAlert = alerts.find((alert) => (
        alert.type === "MEDICINE"
        && !alert.isRead
        && !dismissedMedicineAlertIdsRef.current.has(String(alert.id))
      ));
      setMedicineAlert(medicineAlert || null);

      const infoRequestAlert = alerts.find((alert) =>
        alert.type === "INFO_UPDATE_REQUEST"
        && !alert.isRead
        && !dismissedInfoAlertIdsRef.current.has(String(alert.id))
      );
      setInfoUpdateRequestAlert(infoRequestAlert || null);

      const checkInAlert = alerts.find((alert) => alert.type === "CHECK_IN_MESSAGE" && !alert.isRead);
      setCheckInMessageAlert(checkInAlert || null);

      const safeExitAlert = alerts.find((alert) => (
        (alert.type === "SAFE_ZONE_EXIT" || alert.type === "SAFE_ZONE") && !alert.isRead
      ));
      setSafeZoneExitAlert(safeExitAlert || null);

      const today = new Date();
      const alertFallCount = alerts.filter((alert) => {
        if (alert.type !== "FALL_DETECTED" && alert.type !== "FALL_RISK") return false;
        const createdAt = new Date(alert.createdAt);
        return (
          createdAt.getFullYear() === today.getFullYear()
          && createdAt.getMonth() === today.getMonth()
          && createdAt.getDate() === today.getDate()
        );
      }).length;

      const fallEvents = await fetchFallEvents(1).catch(() => []);
      const modelFallCount = fallEvents.filter((event) => isTodayDateTime(event.timestamp)).length;
      setTodayFallCount(Math.max(alertFallCount, modelFallCount));
    };

    loadCallRequest();
    const timerId = setInterval(loadCallRequest, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadCallRequest();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleStorageChange = (event) => {
      if (event.key === `woori-local-alerts:${seniorId}`) loadCallRequest();
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      cancelled = true;
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [initialSenior, pendingSos]);

  const confirmSOS = async () => {
    setShowSOS(false);
    const seniorId = getCurrentSeniorId(initialSenior);

    if (!seniorId) {
      alert("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const alertResult = await createSosAlert({
        seniorId: Number(seniorId),
        latitude: currentPos?.lat,
        longitude: currentPos?.lon,
      });
      markPendingSos(alertResult);
      setPendingSos(true);
    } catch (error) {
      console.error("SOS 전송 실패:", error);
      alert("SOS 전송에 실패했습니다. 보호자에게 직접 연락해주세요.");
    }
  };

  const handleSosMistake = async () => {
    const seniorId = getCurrentSeniorId(initialSenior);
    if (seniorId) {
      await createSosCancelAlert({
        seniorId: Number(seniorId),
        latitude: currentPos?.lat,
        longitude: currentPos?.lon,
      }).catch((error) => {
        console.error("SOS 잘못 누름 알림 실패:", error);
      });
    }

    clearPendingSosStorage();
    setPendingSos(false);
    alert("보호자에게 잘못 누름 알림을 보냈어요.");
  };

  const handleReceiveCall = async () => {
    const callAlertIds = userAlerts
      .filter((alert) => alert.type === "CALL_REQUEST" && !alert.isRead)
      .map((alert) => alert.id)
      .filter(Boolean);
    markCallAlertHandled(incomingCallAlert?.id);
    await Promise.all([...new Set(callAlertIds)].map((alertId) => readAlert(alertId).catch(() => {})));

    setIncomingCallAlert(null);

    if (careTeam.guardianPhone) {
      window.location.href = `tel:${careTeam.guardianPhone.replace(/[^0-9]/g, "")}`;
    }
  };

  const handleDismissCallRequest = () => {
    const alertId = incomingCallAlert?.id;
    setIncomingCallAlert(null);
    markCallAlertHandled(alertId);
    if (alertId) readAlert(alertId).catch(() => {});
  };

  const handleReadMedicineAlert = async () => {
    if (medicineAlert?.id) {
      dismissedMedicineAlertIdsRef.current.add(String(medicineAlert.id));
    }

    setMedicineAlert(null);

    if (medicineAlert?.id) {
      await readAlert(medicineAlert.id).catch(() => {});
    }
  };

  const handleGoToInfoUpdateRequest = () => {
    const text = String(infoUpdateRequestAlert?.message || "");
    const alertId = infoUpdateRequestAlert?.id;
    let section = "personal";

    if (/복약|약|medicine/i.test(text)) section = "medication";
    else if (/질환|건강|수술|chronic/i.test(text)) section = "chronic";
    else if (/거동|인지|감각|보행|시력|청력|mobility/i.test(text)) section = "mobility";
    else if (/활동|이동|쉬는|activity/i.test(text)) section = "activity";
    else if (/복지|혜택|welfare/i.test(text)) section = "welfare";
    else if (/일자리|근무|직종|job/i.test(text)) section = "job";

    setInfoUpdateRequestAlert(null);
    navigate(`/profile?section=${section}${alertId ? `&alertId=${alertId}` : ""}`);
  };

  const handleReadCheckInMessageAlert = async () => {
    if (checkInMessageAlert?.id) {
      await readAlert(checkInMessageAlert.id).catch(() => {});
    }

    setCheckInMessageAlert(null);
    setCheckInReplyMessage("");
  };

  const handleReplyCheckInMessageAlert = async () => {
    const reply = checkInReplyMessage.trim();

    if (!reply) {
      alert("답장 내용을 입력해주세요.");
      return;
    }

    const seniorId = getCurrentSeniorId(initialSenior);

    if (!seniorId) {
      alert("사용자 정보를 확인할 수 없습니다.");
      return;
    }

    try {
      await sendCheckInReply({
        seniorId,
        reply,
        originalMessage: checkInMessageAlert?.message || "",
      });

      await handleReadCheckInMessageAlert();
      alert("보호자에게 답장을 보냈습니다.");
    } catch (error) {
      console.error("안부 답장 전송 실패:", error);
      alert("답장 전송에 실패했습니다.");
    }
  };

  const openGuardianEdit = () => {
    setGuardianEditForm({ name: careTeam.guardianName || "", relation: careTeam.guardianRelation || "" });
    setGuardianEditOpen(true);
  };

  const saveGuardianEdit = async () => {
    try {
      setGuardianSaving(true);
      const saved = sessionStorage.getItem("currentSenior");
      if (!saved) return;
      const profile = JSON.parse(saved);
      const seniorId = profile?.senior?.id;
      if (!seniorId) return;

      // PATCH로 guardianName/guardianRelation만 업데이트 (PUT은 전체 덮어써서 데이터 날아감)
      const response = await fetch(`/api/seniors/${seniorId}/requested-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianName: guardianEditForm.name.trim(),
          guardianRelation: guardianEditForm.relation.trim(),
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        sessionStorage.setItem("currentSenior", JSON.stringify(updated));
        setCareTeam((prev) => ({
          ...prev,
          guardianName: guardianEditForm.name.trim(),
          guardianRelation: guardianEditForm.relation.trim(),
        }));
        setGuardianEditOpen(false);
      }
    } catch (error) {
      console.error("보호자 정보 수정 실패:", error);
    } finally {
      setGuardianSaving(false);
    }
  };

  const openAllSchedules = async () => {
    const seniorId = getCurrentSeniorId(initialSenior);
    const today = todayValue();
    setSelectedScheduleDate(today);
    setShowAllSchedules(true);
    if (!seniorId) { setAllSchedules([]); return; }
    setIsLoadingAllSchedules(true);
    try {
      const res = await fetch(`/api/schedules/senior/${seniorId}/date/${today}`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : data?.content ?? [];
      setAllSchedules(list.map(scheduleFromApi));
    } catch {
      setAllSchedules([]);
    } finally {
      setIsLoadingAllSchedules(false);
    }
  };

  const hasUnreadByRoute = (route) => {
    if (route === "/weather") return weatherAlerts.some((alert) => alert.type !== "오늘 날씨");
    if (route === "/fall-history") return userAlerts.some((alert) => (alert.type === "FALL_DETECTED" || alert.type === "FALL_RISK") && !alert.isRead);
    if (route === "/location") return userAlerts.some((alert) => (alert.type === "SAFE_ZONE" || alert.type === "SAFE_ZONE_EXIT") && !alert.isRead);
    if (route === "/profile") return userAlerts.some((alert) => alert.type === "PROFILE_UPDATE" && !alert.isRead);
    return false;
  };

  const climatePreviewAlerts = (() => {
    const list = [...weatherAlerts];
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:00`;

    if (!list.some((alert) => alert.type === "오늘 날씨")) {
      list.push({
        type: "오늘 날씨",
        color: COLORS.green,
        msg: "현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.",
        time,
      });
    }

    if (list.length < 2) {
      list.push({
        type: "환경 지수",
        color: COLORS.green,
        msg: "현재 확인된 환경 위험 알림이 없습니다. 평소처럼 활동하셔도 괜찮습니다.",
        time,
      });
    }

    return list.slice(0, 2);
  })();

  const welfarePerson = buildUserWelfarePerson(currentProfile, userName, userRegion);
  const welfareMatches = findWelfarePrograms({
    question: "내 상황에 맞는 복지 제도를 추천해줘",
    person: welfarePerson,
    limit: 3,
  });

  const currentBenefits = String(currentProfile?.healthInfo?.currentBenefits || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="up-root">
      <UserCommonHeader showSos onSosClick={() => setShowSOS(true)} />

      <div className="up-layout">
        <aside className="up-aside">
          <div className="up-profile-card">
            <div className="up-profile-avatar">
              {profileImageUrl ? (
                <img src={resolveUploadUrl(profileImageUrl)} alt="프로필 사진" />
              ) : (
                "🙂"
              )}
            </div>
            <div className="up-profile-name">{userName}</div>
            <div className="up-profile-sub">우리 돌봄 서비스</div>
            {userRegion && <div className="up-profile-region">📍 {formatDongAddress(userRegion)}</div>}
            <div className="up-dot-wrap">
              <div className={`up-dot ${
                sensorConnected === null ? "pending"
                : sensorConnected ? ""
                : "danger"
              }`} />
              {sensorConnected === null
                ? "센서 확인 중"
                : sensorConnected
                  ? "낙상 센서 연결됨"
                  : "센서 신호 없음"}
            </div>
            <div className="up-care-team">
              <div>
                <span>보호자</span>
                <button className="up-care-edit-btn" type="button" onClick={openGuardianEdit}>
                  {careTeam.guardianName
                    ? `${careTeam.guardianName}${careTeam.guardianRelation ? ` (${careTeam.guardianRelation})` : ""}`
                    : "입력하기"}
                </button>
              </div>
              <div>
                <span>복지사</span>
                {careTeam.socialWorkerName && toTelHref(careTeam.socialWorkerPhone) ? (
                  <a className="up-care-call" href={toTelHref(careTeam.socialWorkerPhone)}>
                    {careTeam.socialWorkerName}
                  </a>
                ) : (
                  <strong>{careTeam.socialWorkerName || "매칭 전"}</strong>
                )}
              </div>
            </div>
          </div>

          <div className="up-card up-location-card" style={{ cursor: "pointer" }} onClick={() => navigate("/location")}>
            <div className="up-card-head">
              <div className="up-card-title">현재 위치</div>
              <span style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>상세 보기</span>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isInRange ? COLORS.green : COLORS.danger,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: "0.82rem",
                fontWeight: "700",
                color: isInRange ? COLORS.green : COLORS.danger,
              }}>
                {isInRange ? "안전 반경 안" : "안전 반경 이탈"}
              </span>
            </div>
            <div style={{
              fontSize: "0.78rem",
              color: COLORS.textMuted,
              lineHeight: "1.5",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {currentAddress}
            </div>
            {currentPos && (
              <div style={{ fontSize: "0.68rem", color: COLORS.textMuted, marginTop: "0.3rem" }}>
                {currentPos.lat.toFixed(4)}, {currentPos.lon.toFixed(4)}
              </div>
            )}
            {currentLocationTime && (
              <div style={{ fontSize: "0.68rem", color: COLORS.textMuted, marginTop: "0.25rem" }}>
                갱신 시간 {currentLocationTime}
              </div>
            )}
            {currentPos && (
              <div className="up-mini-map-wrap" onClick={(event) => event.stopPropagation()}>
                <KakaoMap
                  center={{ lat: currentPos.lat, lng: currentPos.lon }}
                  zoom={5}
                  className="up-mini-map"
                  safeZone={safeZone}
                  safeZones={safeZones}
                  currentLocation={{ lat: currentPos.lat, lng: currentPos.lon }}
                  currentLabel="현재 위치"
                  safeZoneLabel={safeZone ? `${safeZone.name} 안전 반경` : "안전 반경"}
                  autoFit={false}
                />
              </div>
            )}
          </div>

          <div className="up-sidemenu">
            {menus.map((menu, i) => (
              <button
                key={i}
                className="up-sidemenu-item"
                type="button"
                onClick={() => {
                  if (menu.disabled) {
                    alert("AI 챗봇 기능은 준비 중입니다.");
                    return;
                  }
                  if (menu.badgeKey === "jobs") {
                    const latestJobId = localStorage.getItem("jobs_latest_job_id");
                    if (latestJobId) localStorage.setItem("jobs_last_seen_job_id", latestJobId);
                    setJobHasNew(false);
                  }
                  navigate(menu.route);
                }}
              >
                <span className="up-sidemenu-icon">{menu.icon}</span>
                <span className="up-sidemenu-label">{menu.label}</span>
                {(menu.badge || (menu.badgeKey === "jobs" && jobHasNew) || hasUnreadByRoute(menu.route)) && (
                  <span className="up-sidemenu-badge" style={menu.disabled ? { background: "#7a9a7c" } : {}}>
                    {menu.badge || "NEW"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main>
          <div className="up-top-row">
            <div className="up-weather-card" onClick={() => navigate("/weather-graph")}>
              <div className="up-card-label">오늘 날씨</div>
              <div className="up-weather-temp">{weather?.temp ?? "--"}°C</div>
              <div className="up-weather-bot">
                <div className="up-weather-desc">
                  {weather?.status ?? "불러오는 중"} · {weather?.region ?? ""}
                </div>
                <div className="up-weather-icon">{weather?.icon ?? "🌧️"}</div>
              </div>
            </div>

            <div className="up-stat-card" onClick={() => navigate("/fall-history")}>
              <div className="up-card-label">오늘 낙상</div>
              <div className="up-stat-value red">{todayFallCount}건</div>
              <div className="up-stat-sub">
                {todayFallCount > 0 ? "감지 이력을 확인해주세요" : "오늘 감지된 낙상이 없어요"}
              </div>
            </div>

            <div className="up-stat-card" onClick={openAllSchedules}>
              <div className="up-card-label">오늘 일정</div>
              <div className="up-stat-value">{todaySchedules.length}건</div>
              <div className="up-stat-sub">
                {todaySchedules.length > 0
                  ? `다음: ${todaySchedules[0].time} ${todaySchedules[0].text}`
                  : "오늘 등록된 일정이 없어요"}
              </div>
            </div>
          </div>

          <div className="up-content-row">
            <div className="up-card up-schedule-card">
              <div className="up-card-head">
                <div className="up-card-title">일정</div>
                <div className="up-schedule-tools">
                  <input
                    className="up-schedule-date"
                    type="date"
                    value={selectedScheduleDate}
                    onChange={(event) => setSelectedScheduleDate(event.target.value)}
                  />
                  <button
                    type="button"
                    className="up-schedule-create"
                    onClick={() => navigate("/chat?mode=schedule")}
                  >
                    일정 생성
                  </button>
                </div>
              </div>

              <div className="up-schedule-list">
                {scheduleList.length === 0 ? (
                  <div className="up-schedule-empty">
                    등록된 일정이 없어요.
                  </div>
                ) : (
                  scheduleList.map((s, i) => (
                    <div key={i} className="up-schedule-row">
                      <div className="up-schedule-time">{s.time}</div>
                      <div className="up-schedule-dot" />
                      <div className="up-schedule-text">{s.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="up-card up-climate-card">
              <div className="up-card-head">
                <div className="up-card-title">기후 알림</div>
                <button className="up-card-more" type="button" onClick={() => navigate("/weather")}>
                  전체보기
                </button>
              </div>

              {climatePreviewAlerts.map((a, i) => (
                <div key={i} className="up-alert-item">
                  <span className="up-alert-badge" style={{
                    background: a.color,
                    color: "#fff",
                    border: `1px solid ${a.color}`,
                  }}>
                    {a.type}
                  </span>
                  <div>
                    <div className="up-alert-text">{a.msg}</div>
                    <div className="up-alert-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activityToday && (
            <div className="up-content-row">
              <div className="up-card full">
                <div className="up-card-head">
                  <div className="up-card-title">오늘의 활동 컨디션</div>
                  {activityToday.data_quality?.level === "good" && (
                    <button className="up-card-more up-info-chip" type="button" onClick={() => setActivityInfoModal("measured")}>
                      실측 데이터
                    </button>
                  )}
                </div>
                {activityToday.scores ? (
                  <RadarChart
                    scores={activityToday.scores}
                    labels={activityToday.labels}
                    summaryLabel="활동 컨디션 요약"
                    note={activityTrend?.alerts?.[0] || activityToday.overall_note || ""}
                    quality={activityToday.data_quality}
                  />
                ) : (
                  <div className="up-activity-empty">
                    <div className="up-activity-placeholder-score">--</div>
                    <div className="up-activity-empty-title">활동 데이터를 수집하는 중입니다</div>
                    <p>{activityToday.message || activityToday.data_quality?.message || "감지 서버가 충분한 기록을 모으면 활동 지표가 표시됩니다."}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(activitySlots || activityBaseline || activityFallPattern) && (
            <ActivityInsightCards
              slots={activitySlots}
              baseline={activityBaseline}
              fallPattern={activityFallPattern}
              onInfoClick={setActivityInfoModal}
            />
          )}

          <div className="up-content-row">
            <div className="up-card full">
              <div className="up-card-head">
                <div className="up-card-title">복지제도 확인</div>
              </div>
              <div className="up-welfare-check">
                <div className="up-welfare-check-icon">🏛️</div>
                <div className="up-welfare-check-copy">
                  <strong>내 상황에 맞는 복지제도를 확인해보세요.</strong>
                  <p>
                    {currentBenefits.length
                      ? `현재 등록된 혜택: ${currentBenefits.join(" · ")}`
                      : "현재 받고 있는 혜택을 입력하면 중복 신청 여부를 더 쉽게 확인할 수 있어요."}
                  </p>
                </div>
                <button
                  className="up-welfare-check-button"
                  type="button"
                  onClick={() => navigate("/profile?section=welfare")}
                >
                  복지정보 수정
                </button>
              </div>
              <div className="up-welfare-programs">
                {welfareMatches.map(({ program, reasons }) => (
                  <article className="up-welfare-program" key={program.id}>
                    <strong>{program.name}</strong>
                    <p>{program.summary}</p>
                    <span>{reasons[0]}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {showAllSchedules && (
        <div className="up-overlay" onClick={() => setShowAllSchedules(false)}>
          <div
            className="up-modal"
            style={{ maxHeight: "70vh", overflowY: "auto", textAlign: "left", width: "480px" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="up-card-head" style={{ marginBottom: "1rem" }}>
              <div className="up-modal-title" style={{ fontSize: "1.1rem" }}>전체 일정</div>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: COLORS.textMuted }}
                type="button"
                aria-label="닫기"
                onClick={() => setShowAllSchedules(false)}
              >
                X
              </button>
            </div>
            {isLoadingAllSchedules ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>불러오는 중...</div>
            ) : allSchedules.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>등록된 일정이 없어요.</div>
            ) : (
              allSchedules.map((s) => (
                <div key={s.id} className="up-schedule-row">
                  <div className="up-schedule-time" style={{ minWidth: "80px", fontSize: "0.75rem" }}>{s.date}</div>
                  <div className="up-schedule-dot" />
                  <div>
                    <div className="up-schedule-text">{s.text}</div>
                    <div style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>{s.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {incomingCallAlert && (
        <div className="up-overlay" onClick={handleDismissCallRequest}>
          <div className="up-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">📞</div>
            <div className="up-modal-title">보호자가 전화를 요청했습니다.</div>
            <div className="up-modal-desc">
              전화 앱에 수신 화면이 뜨면 통화 버튼을 눌러주세요.
            </div>
            <div className="up-modal-row">
              <button className="up-modal-cancel" type="button" onClick={handleDismissCallRequest}>
                나중에
              </button>
              <button className="up-modal-ok" type="button" onClick={handleReceiveCall}>
                전화 받기
              </button>
            </div>
          </div>
        </div>
      )}

      {medicineAlert && (
        <div className="up-overlay" onClick={handleReadMedicineAlert}>
          <div className="up-modal medicine-alert-user-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">💊</div>
            <div className="up-modal-title">
              {medicineAlert.title || "복약 알림"}
            </div>
            <div className="up-modal-desc">
              {medicineAlert.message || "복용 중인 약을 확인하고 제때 복용해주세요."}
            </div>

            <div className="up-modal-row medicine-alert-modal-row">
              <button
                className="up-modal-ok medicine-alert-confirm-button"
                type="button"
                onClick={handleReadMedicineAlert}
              >
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}

      {infoUpdateRequestAlert && (
        <div className="up-overlay" onClick={() => setInfoUpdateRequestAlert(null)}>
          <div className="up-modal medicine-alert-user-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-title">
              {infoUpdateRequestAlert.title || "정보 수정 요청"}
            </div>
            <div className="up-modal-desc">
              {infoUpdateRequestAlert.message || "복지사가 정보 수정을 요청했습니다."}
            </div>

            <div className="up-modal-row" style={{ marginTop: "2rem" }}>
              <button
                className="up-modal-cancel"
                type="button"
                onClick={() => {
                  if (infoUpdateRequestAlert?.id) {
                    dismissedInfoAlertIdsRef.current.add(String(infoUpdateRequestAlert.id));
                  }
                  setInfoUpdateRequestAlert(null);
                }}
              >
                나중에
              </button>
              <button
                className="up-modal-ok"
                type="button"
                onClick={handleGoToInfoUpdateRequest}
              >
                수정하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {guardianEditOpen && (
        <div className="up-overlay" onClick={() => setGuardianEditOpen(false)}>
          <div className="up-modal up-guardian-modal" onClick={(e) => e.stopPropagation()}>
            <div className="up-modal-title">보호자 정보 수정</div>
            <div className="up-guardian-field">
              <label className="up-guardian-label">보호자 이름</label>
              <input
                className="up-guardian-input"
                value={guardianEditForm.name}
                onChange={(e) => setGuardianEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="이름 입력"
              />
            </div>
            <div className="up-guardian-field">
              <label className="up-guardian-label">관계</label>
              <input
                className="up-guardian-input"
                value={guardianEditForm.relation}
                onChange={(e) => setGuardianEditForm((prev) => ({ ...prev, relation: e.target.value }))}
                placeholder="예: 아들, 딸, 배우자"
              />
            </div>
            <div className="up-modal-row" style={{ marginTop: "1.4rem" }}>
              <button className="up-modal-cancel" type="button" onClick={() => setGuardianEditOpen(false)}>
                취소
              </button>
              <button className="up-modal-ok up-modal-ok-green" type="button" onClick={saveGuardianEdit} disabled={guardianSaving}>
                {guardianSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkInMessageAlert && (
        <div className="up-overlay" onClick={handleReadCheckInMessageAlert}>
          <div className="up-modal checkin-user-modal" onClick={(event) => event.stopPropagation()}>
            <div className="checkin-user-message">
              <strong>{careTeam.guardianName || "보호자"}:</strong>
              <span>{checkInMessageAlert.message || "보호자가 안부 메시지를 보냈습니다."}</span>
            </div>

            <textarea
              className="checkin-user-reply-textarea"
              value={checkInReplyMessage}
              onChange={(event) => setCheckInReplyMessage(event.target.value)}
              placeholder="보호자에게 보낼 답장을 입력해주세요."
              rows={4}
            />

            <div className="up-modal-row single">
              <button
                className="checkin-user-send-button"
                type="button"
                onClick={handleReplyCheckInMessageAlert}
              >
                답장 보내기
              </button>

              <button
                className="up-modal-ok"
                type="button"
                onClick={handleReadCheckInMessageAlert}
              >
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}

      {safeZoneExitAlert && !isInRange && (
        <div className="up-overlay up-safe-zone-overlay">
          <div className="up-modal up-safe-zone-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">📍</div>
            <div className="up-modal-title">안전 반경을 벗어났습니다</div>
            <div className="up-modal-desc">
              보호자에게 이탈 알림을 보냈어요.<br />
              보호자 또는 담당자와 만날 때까지 이 안내가 유지됩니다.
            </div>
            <div className="up-safe-zone-message">
              집 또는 지정된 안전 구역으로 돌아가 주세요.
            </div>
          </div>
        </div>
      )}

      {pendingSos && (
        <div className="up-sos-pending">
          <div>
            <strong>SOS가 보호자에게 전송되었어요.</strong>
            <p>실수로 누르셨다면 아래 버튼을 눌러 표시를 취소해 주세요.</p>
          </div>
          <button type="button" onClick={handleSosMistake}>
            잘못 눌렀어요
          </button>
        </div>
      )}

      {activityInfoModal && (
        <div className="up-overlay" onClick={() => setActivityInfoModal(null)}>
          <div className="up-modal up-info-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">{activityInfoModal === "measured" ? "📷" : "ℹ️"}</div>
            <div className="up-modal-title">
              {activityInfoModal === "measured" ? "실측 데이터" : "참고 지표"}
            </div>
            <div className="up-modal-desc">
              {activityInfoModal === "measured"
                ? "카메라와 낙상 감지 모델이 수집한 자세, 움직임, 정지 시간, 낙상 이벤트를 바탕으로 표시됩니다."
                : "의료 진단이 아닌 활동 패턴 참고용 지표입니다. 평소와 다른 움직임을 확인하는 용도로만 활용해주세요."}
            </div>
            <div className="up-modal-row single">
              <button className="up-modal-ok" type="button" onClick={() => setActivityInfoModal(null)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showSOS && (
        <div className="up-overlay" onClick={() => setShowSOS(false)}>
          <div className="up-modal" onClick={(event) => event.stopPropagation()}>
            <div className="up-modal-ico">🚨</div>
            <div className="up-modal-title">SOS를 보내시겠어요?</div>
            <div className="up-modal-desc">
              보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.
            </div>
            <div className="up-modal-row">
              <button className="up-modal-cancel" type="button" onClick={() => setShowSOS(false)}>취소</button>
              <button className="up-modal-ok" type="button" onClick={confirmSOS}>보내기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

