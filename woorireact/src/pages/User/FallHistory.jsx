import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DUMMY_FALL_LOGS } from "../../utils/user/fallHistoryData";
import "../../css/user/FallHistory.css";

export default function FallHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLogs(DUMMY_FALL_LOGS);
  }, []);

  const fallCount = logs.filter((log) => log.confirmed).length;
  const falseCount = logs.filter((log) => !log.confirmed).length;

  return (
    <div className="fh-root">
      <nav className="fh-nav">
        <button className="fh-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>

        <div className="fh-nav-title">📋 낙상 기록</div>
        <div className="fh-nav-sub">YOLOv8-pose · MediaPipe 감지 이력</div>
      </nav>

      <div className="fh-layout">
        <div className="fh-summary">
          <div className="fh-stat fh-stat-fall">
            <div>
              <div className="fh-stat-label">이번 달 낙상</div>
              <div className="fh-stat-value">{fallCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">최근: 2026.05.04 거실</div>
          </div>

          <div className="fh-stat fh-stat-false">
            <div>
              <div className="fh-stat-label">오탐지</div>
              <div className="fh-stat-value">{falseCount}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">AI 정확도 향상 중</div>
          </div>

          <div className="fh-stat fh-stat-total">
            <div>
              <div className="fh-stat-label">전체 기록</div>
              <div className="fh-stat-value">{logs.length}</div>
              <div className="fh-stat-unit">건</div>
            </div>
            <div className="fh-stat-sub">누적 감지 이력</div>
          </div>
        </div>

        <div className="fh-ai-card">
          <div className="fh-ai-icon">🤖</div>
          <div>
            <div className="fh-ai-title">YOLOv8-pose 낙상 감지 시스템</div>
            <div className="fh-ai-desc">
              카메라를 통해 실시간으로 자세를 분석하여 낙상을 감지합니다.
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
            <div className="fh-empty-icon">😊</div>
            <div className="fh-empty-text">낙상 기록이 없습니다</div>
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
                        🕐 {log.date} {log.time}
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
