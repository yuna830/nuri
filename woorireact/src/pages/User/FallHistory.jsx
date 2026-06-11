import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserCommonHeader } from "../../components/UserCommonHeader.jsx";
import {
  createFallAlert,
  fetchFallCaptures,
  fetchFallDetectionStatus,
  fetchFallEvents,
  fetchSeniorAlerts,
  fetchStoredFallEvents,
  getCurrentSeniorId,
  getFallCaptureUrl,
  getFallVideoUrl,
  reverseGeocode,
} from "../../api/userPageApi.js";
import "../../css/user/FallHistory.css";

const FALL_ALERT_TYPES = new Set(["FALL_DETECTED", "FALL_RISK"]);
const PAGE_SIZE = 5;

const isToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
};

const getPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, address: "" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        let address = "";

        try {
          address = await reverseGeocode(latitude, longitude);
        } catch {
          // address stays empty
        }

        resolve({ latitude, longitude, address });
      },
      () => resolve({ latitude: null, longitude: null, address: "" }),
      { enableHighAccuracy: true, timeout: 2500, maximumAge: 15000 }
    );
  });

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
};

const normalizeCaptureName = (value) => {
  if (!value) return "";
  return String(value).replace(/^captures[\\/]/, "");
};

const resolveFallImageUrl = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (/^https?:\/\//i.test(text) || text.startsWith("/")) return text;
  return getFallCaptureUrl(normalizeCaptureName(text));
};

const getCaptureNameFromStatus = (status) =>
  normalizeCaptureName(status?.last_capture || status?.lastCapture || status?.capture || "");

const getCaptureNameFromAlert = (alert) =>
  normalizeCaptureName(alert.imageUrl || alert.captureImage || alert.capture || "");

const getCaptureNameFromCapture = (capture) =>
  normalizeCaptureName(capture?.image || capture?.filename || capture?.file || "");

const getFallSituationText = (source = {}) => {
  const posture = String(source.posture || source.pose || "").toLowerCase();

  if (posture.includes("standing") || posture.includes("stand") || posture.includes("서")) {
    return "서 있던 중 낙상 의심";
  }

  if (posture.includes("sitting") || posture.includes("sit") || posture.includes("앉")) {
    return "앉아 있던 중 낙상 의심";
  }

  if (posture.includes("lying") || posture.includes("lie") || posture.includes("누")) {
    return "바닥에 누운 상태 감지";
  }

  return "낙상 의심 상황 감지";
};

const toFallLog = (alert, captureMap) => {
  const captureName = getCaptureNameFromAlert(alert);
  const capture = captureName ? captureMap.get(captureName) : null;
  const imageUrl = resolveFallImageUrl(captureName);
  const location = alert.message?.match(/현재 위치:\s*(.+?)(?:\.|$)/)?.[1] || "위치 확인 필요";

  return {
    id: alert.id,
    timestamp: alert.createdAt,
    date: formatDate(alert.createdAt),
    time: formatTime(alert.createdAt),
    location,
    status: alert.isRead ? "보호자 확인 완료" : "보호자 확인 대기",
    confirmed: true,
    imageUrl,
    capture,
    detail: getFallSituationText(alert.fallDetails || alert),
  };
};

const toFallEventLog = (event, index = 0) => {
  const captureName = normalizeCaptureName(event.capture_filename || event.captureFilename || "");
  const timestamp = event.timestamp || event.createdAt;

  return {
    id: `event-${event.id || timestamp || index}`,
    timestamp,
    date: formatDate(timestamp),
    time: formatTime(timestamp),
    location: event.message?.match(/현재 위치:\s*(.+?)(?:\.|$)/)?.[1] || "낙상 감지 위치",
    status: event.confirmed ? "보호자 확인 완료" : "보호자 확인 대기",
    confirmed: Boolean(event.confirmed),
    imageUrl: resolveFallImageUrl(captureName),
    capture: event,
    detail: getFallSituationText(event),
  };
};

const uniqueLogs = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.date}-${item.time}-${item.imageUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function FallHistory() {
  const seniorId = getCurrentSeniorId();
  const videoUrl = useMemo(() => getFallVideoUrl(), []);
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [detector, setDetector] = useState({ fall_detected: false, score: 0 });
  const [serverOnline, setServerOnline] = useState(false);
  const [activeFallAlert, setActiveFallAlert] = useState(null);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const sentCaptureRef = useRef(new Set(JSON.parse(localStorage.getItem("fall_sent_captures") || "[]")));
  const fallServerRetryAtRef = useRef(0);


  const loadCaptures = useCallback(async () => {
    if (Date.now() < fallServerRetryAtRef.current) return [];
    const nextCaptures = await fetchFallCaptures().catch(() => []);
    return nextCaptures;
  }, []);

  const loadFallLogs = useCallback(async () => {
    if (!seniorId) {
      setLogs([]);
      setActiveFallAlert(null);
      return [];
    }

    const shouldSkipFallServer = Date.now() < fallServerRetryAtRef.current;
    const [events, alerts, storedEvents, nextCaptures] = await Promise.all([
      shouldSkipFallServer ? Promise.resolve([]) : fetchFallEvents(1).catch(() => []),
      fetchSeniorAlerts(seniorId).catch(() => []),
      fetchStoredFallEvents({ size: 100 }).catch(() => []),
      shouldSkipFallServer ? Promise.resolve([]) : loadCaptures(),
    ]);
    const nextCaptureMap = new Map();
    nextCaptures.forEach((capture) => {
      const name = getCaptureNameFromCapture(capture);
      if (name) nextCaptureMap.set(name, capture);
    });

    const fallAlerts = alerts
      .filter((alert) => FALL_ALERT_TYPES.has(alert.type))
      .filter((alert) => isToday(alert.createdAt))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    const eventLogs = events
      .filter((event) => isToday(event.timestamp))
      .map((event, index) => toFallEventLog(event, index));

    const storedEventLogs = storedEvents
      .filter((event) => String(event.seniorId) === String(seniorId))
      .filter((event) => isToday(event.timestamp || event.createdAt))
      .map((event, index) => toFallEventLog(event, index));

    const alertLogs = fallAlerts.map((alert) => toFallLog(alert, nextCaptureMap));
    const nextLogs = uniqueLogs([...storedEventLogs, ...eventLogs, ...alertLogs])
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

    setLogs(nextLogs);
    setActiveFallAlert(fallAlerts.find((alert) => !alert.isRead) || null);
    return fallAlerts;
  }, [loadCaptures, seniorId]);

  const rememberCapture = (captureName) => {
    if (!captureName) return;
    sentCaptureRef.current.add(captureName);
    localStorage.setItem("fall_sent_captures", JSON.stringify([...sentCaptureRef.current].slice(-50)));
  };

  const sendFallAlert = useCallback(
    async (status) => {
      if (!seniorId || isSendingAlert || activeFallAlert) return;

      const captureName = getCaptureNameFromStatus(status) || `status-${Date.now()}`;
      if (sentCaptureRef.current.has(captureName)) return;

      setIsSendingAlert(true);

      try {
        const position = await getPosition();
        const detectedAt = new Date().toISOString();
        const captureFromStatus = getCaptureNameFromStatus(status);
        const captureUrl = captureFromStatus ? getFallCaptureUrl(captureFromStatus) : "";
        const score = Number(status.score) || 0;
        const fallDetails = {
          detectedAt,
          score,
          posture: status.posture || status.pose || "",
          ensembleMode: status.ensemble_mode || status.ensembleMode || "",
          captureName: captureFromStatus,
          captureUrl,
          locationText: position.address || "위치 확인 필요",
        };

        const result = await createFallAlert({
          seniorId,
          latitude: position.latitude,
          longitude: position.longitude,
          address: position.address,
          score,
          imageUrl: captureFromStatus,
          imageAccessUrl: captureUrl,
          fallDetails,
          notifyGuardian: true,
          notifyWelfare: true,
          escalationRequired: true,
          escalationMessage: "보호자 확인 또는 대처 답변이 없으면 담당 복지사가 신고 조치를 검토합니다.",
        });
        const createdId = Array.isArray(result) ? result[0]?.id : result?.id;
        if (createdId) rememberCapture(captureName);
        const createdAlert = Array.isArray(result) ? result[0] : null;
        if (createdAlert && !createdAlert.isRead) {
          setActiveFallAlert(createdAlert);
        }
        await loadFallLogs();
      } catch (error) {
        console.error("낙상 알림 전송 실패:", error);
      } finally {
        setIsSendingAlert(false);
      }
    },
    [activeFallAlert, isSendingAlert, loadFallLogs, seniorId]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    loadFallLogs();
  }, [loadFallLogs]);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (Date.now() < fallServerRetryAtRef.current) return;

      try {
        const status = await fetchFallDetectionStatus();
        if (!isMounted) return;

        fallServerRetryAtRef.current = 0;
        setServerOnline(true);
        setDetector(status);

        if (status.fall_detected) {
          sendFallAlert(status);
        }
      } catch {
        if (!isMounted) return;
        fallServerRetryAtRef.current = Date.now() + 30 * 1000;
        setServerOnline(false);
        setDetector({ fall_detected: false, score: 0 });
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, 1000);
    const logsIntervalId = window.setInterval(loadFallLogs, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.clearInterval(logsIntervalId);
    };
  }, [loadFallLogs, sendFallAlert]);

  useEffect(() => {
    if (!activeFallAlert?.isRead) return;
    setActiveFallAlert(null);
  }, [activeFallAlert]);

  const fallCount = logs.length;
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const visibleLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="fh-root">
      <UserCommonHeader />

      <div className="fh-layout">
        <div className={`fh-live-card ${detector.fall_detected ? "danger" : ""}`}>
          <div className="fh-live-head">
            <div>
              <div className="fh-live-kicker">실시간 낙상 감지</div>
              <div className="fh-live-title">
                {detector.fall_detected ? "낙상 감지됨" : serverOnline ? "정상 감지 중" : "감지 서버 연결 대기"}
              </div>
            </div>
            <div className={`fh-live-badge ${detector.fall_detected ? "danger" : serverOnline ? "ok" : ""}`}>
              {detector.fall_detected ? "위험" : serverOnline ? "정상" : "대기"}
            </div>
          </div>

          <div className="fh-video-wrap">
            {serverOnline ? (
              <img
                className="fh-video"
                src={videoUrl}
                alt="낙상 감지 카메라 영상"
                onError={() => setServerOnline(false)}
              />
            ) : (
              <div className="fh-video-placeholder">
                <div className="fh-video-icon">📷</div>
                <div>FastAPI 서버를 실행하면 영상이 표시됩니다.</div>
                <code>python -m uvicorn main:app --host 0.0.0.0 --port 8010</code>
              </div>
            )}
          </div>

          <div className="fh-live-foot">
            <div>{detector.fall_detected ? "낙상 신호 확인" : "카메라 감지 대기"}</div>
            <div>{activeFallAlert ? "보호자 확인을 기다리는 중" : "감지 대기 중"}</div>
          </div>
        </div>

        <div className="fh-summary fh-summary-compact">
          <div className="fh-stat fh-stat-fall">
            <div>
              <div className="fh-stat-label">오늘 낙상</div>
              <div className="fh-stat-value">{fallCount}<span className="fh-stat-unit">건</span></div>
            </div>
            <div className="fh-stat-sub">오늘 감지된 기록만 표시</div>
          </div>

          <div className="fh-stat fh-stat-total">
            <div>
              <div className="fh-stat-label">처리 상태</div>
              <div className="fh-stat-value small">{activeFallAlert ? "대기" : "완료"}</div>
            </div>
            <div className="fh-stat-sub">보호자가 확인하면 팝업이 닫힙니다</div>
          </div>
        </div>

        <div className="fh-section-head">
          <div className="fh-section-label">오늘 감지 이력</div>
          <div className="fh-section-count">{logs.length}건</div>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="fh-empty">
            <div className="fh-empty-icon">📭</div>
            <div className="fh-empty-text">오늘 낙상 기록이 없습니다</div>
          </div>
        ) : (
          visibleLogs.map((log) => {
            const isExpanded = expanded === log.id;

            return (
              <div
                key={log.id}
                className="fh-log"
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isExpanded ? null : log.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setExpanded(isExpanded ? null : log.id);
                  }
                }}
              >
                <div className="fh-log-header">
                  <div className="fh-log-bar fall" />

                  <div className="fh-log-main">
                    <div className="fh-log-top">
                      <div className="fh-log-location">📍 {log.location}</div>
                      <div className="fh-log-badge fall">🚨 낙상</div>
                    </div>

                    <div className="fh-log-meta">
                      <div className="fh-log-datetime">🕒 {log.date} {log.time}</div>
                      <div className="fh-log-status">처리: {log.status}</div>
                    </div>

                    {isExpanded && (
                      <div className="fh-log-detail fall">
                        {log.imageUrl && (
                          <img className="fh-capture" src={log.imageUrl} alt="낙상 감지 캡처" />
                        )}
                        <div>📝 {log.detail}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {logs.length > PAGE_SIZE && (
          <div className="fh-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              이전
            </button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              다음
            </button>
          </div>
        )}
      </div>

      {activeFallAlert && (
        <div className="fh-popup-overlay">
          <div className="fh-popup">
            <div className="fh-popup-icon">🚨</div>
            <div className="fh-popup-title">낙상이 감지되었습니다</div>
            <p>보호자에게 알림을 보냈어요. 보호자가 확인하면 이 창은 자동으로 닫힙니다.</p>
            <div className="fh-popup-wait">보호자 확인 대기 중</div>
          </div>
        </div>
      )}
    </div>
  );
}
