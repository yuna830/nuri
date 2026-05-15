import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCommonHeader, UserSubHeader } from "../../components/UserCommonHeader.jsx";
import {
  createFallAlert,
  fetchFallDetectionStatus,
  fetchSeniorAlerts,
  getCurrentSeniorId,
  getFallVideoUrl,
  reverseGeocode,
} from "../../api/userPageApi.js";
import "../../css/user/FallHistory.css";

const FALL_ALERT_TYPES = new Set(["FALL_DETECTED", "FALL_RISK"]);
const ALERT_COOLDOWN_MS = 30 * 1000;

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
          address = "";
        }

        resolve({ latitude, longitude, address });
      },
      () => resolve({ latitude: null, longitude: null, address: "" }),
      { enableHighAccuracy: true, timeout: 2500, maximumAge: 15000 }
    );
  });

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toFallLog = (alert) => ({
  id: alert.id,
  date: formatDate(alert.createdAt),
  time: formatTime(alert.createdAt),
  location: alert.message?.match(/현재 위치:\s*(.+?)(?:\.|$)/)?.[1] || "위치 확인 필요",
  status: alert.isRead ? "보호자 확인 완료" : "보호자 확인 대기",
  confirmed: true,
  detail: alert.message || "낙상 감지 알림이 전송되었습니다.",
});

export default function FallHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detector, setDetector] = useState({ fall_detected: false, score: 0 });
  const [serverOnline, setServerOnline] = useState(false);
  const [alertState, setAlertState] = useState("대기 중");
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const lastAlertAtRef = useRef(0);
  const seniorId = getCurrentSeniorId();
  const videoUrl = useMemo(() => getFallVideoUrl(), []);

  const loadFallLogs = useCallback(async () => {
    if (!seniorId) {
      setLogs([]);
      return;
    }

    const alerts = await fetchSeniorAlerts(seniorId);
    setLogs(
      alerts
        .filter((alert) => FALL_ALERT_TYPES.has(alert.type))
        .map(toFallLog)
    );
  }, [seniorId]);

  const sendFallAlert = useCallback(
    async (score) => {
      if (!seniorId || isSendingAlert) return;

      const now = Date.now();
      if (now - lastAlertAtRef.current < ALERT_COOLDOWN_MS) return;

      lastAlertAtRef.current = now;
      setIsSendingAlert(true);
      setAlertState("보호자에게 알림 전송 중");

      try {
        const position = await getPosition();
        await createFallAlert({
          seniorId,
          latitude: position.latitude,
          longitude: position.longitude,
          address: position.address,
          score: Number(score) || 0,
        });
        setAlertState("보호자에게 알림 전송 완료");
        await loadFallLogs();
      } catch (error) {
        console.error("낙상 알림 전송 실패:", error);
        setAlertState("알림 전송 실패");
      } finally {
        setIsSendingAlert(false);
      }
    },
    [isSendingAlert, loadFallLogs, seniorId]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    loadFallLogs().catch((error) => {
      console.error("낙상 기록 조회 실패:", error);
    });
  }, [loadFallLogs]);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const status = await fetchFallDetectionStatus();
        if (!isMounted) return;

        setServerOnline(true);
        setDetector(status);

        if (status.fall_detected) {
          sendFallAlert(status.score);
        } else if (!isSendingAlert) {
          setAlertState("대기 중");
        }
      } catch {
        if (!isMounted) return;
        setServerOnline(false);
        setDetector({ fall_detected: false, score: 0 });
        setAlertState("감지 서버 연결 대기");
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isSendingAlert, sendFallAlert]);

  const fallCount = logs.filter((log) => log.confirmed).length;
  const falseCount = logs.filter((log) => !log.confirmed).length;

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

            <div className="fh-live-status">
                <span className="fh-live-tech">YOLOv8 · MediaPipe 실시간 감지</span>

                <div className={`fh-live-badge ${detector.fall_detected ? "danger" : serverOnline ? "ok" : ""}`}>
                    {detector.fall_detected ? "위험" : serverOnline ? "정상" : "대기"}
                </div>
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
                <code>uvicorn main:app --host 127.0.0.1 --port 8000</code>
              </div>
            )}
          </div>

          <div className="fh-live-foot">
            <div>감지 점수 <strong>{detector.score ?? 0}점</strong></div>
            <div>{alertState}</div>
          </div>
        </div>

        <div className="fh-summary">
          <div className="fh-stat fh-stat-fall">
            <div>
              <div className="fh-stat-label">이번 달 낙상</div>
              <div className="fh-stat-value">{fallCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">감지 즉시 보호자 알림 전송</div>
          </div>

          <div className="fh-stat fh-stat-false">
            <div>
              <div className="fh-stat-label">오탐지</div>
              <div className="fh-stat-value">{falseCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">확인 후 정상 처리 가능</div>
          </div>

          <div className="fh-stat fh-stat-total">
            <div>
              <div className="fh-stat-label">전체 기록</div>
              <div className="fh-stat-value">{logs.length}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">Spring 알림 기록 기준</div>
          </div>
        </div>

        <div className="fh-ai-card">
          <div className="fh-ai-icon">🧠</div>
          <div>
            <div className="fh-ai-title">앙상블 낙상 감지 시스템</div>
            <div className="fh-ai-desc">
              MediaPipe 자세 수평 감지와 YOLOv8 파인튜닝 모델 점수를 합산해 실시간으로 낙상을 판단합니다.
              낙상 감지 시 보호자에게 즉시 알림이 전송됩니다.
            </div>
          </div>
        </div>

        <div className="fh-section-head">
          <div className="fh-section-label">감지 이력</div>
          <div className="fh-section-count">총 {logs.length}건</div>
        </div>

        {logs.length === 0 ? (
          <div className="fh-empty">
            <div className="fh-empty-icon">📭</div>
            <div className="fh-empty-text">아직 낙상 기록이 없습니다</div>
          </div>
        ) : (
          logs.map((log) => {
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
                  <div className={`fh-log-bar ${log.confirmed ? "fall" : "false"}`} />

                  <div className="fh-log-main">
                    <div className="fh-log-top">
                      <div className="fh-log-location">📍 {log.location}</div>

                      <div className={`fh-log-badge ${log.confirmed ? "fall" : "false"}`}>
                        {log.confirmed ? "🚨 낙상" : "✓ 오탐지"}
                      </div>
                    </div>

                    <div className="fh-log-meta">
                      <div className="fh-log-datetime">
                        🕒 {log.date} {log.time}
                      </div>
                      <div className="fh-log-status">처리: {log.status}</div>
                    </div>

                    {isExpanded && (
                      <div className={`fh-log-detail ${log.confirmed ? "fall" : ""}`}>
                        📝 {log.detail}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
