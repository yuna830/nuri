import { useState } from "react";

const formatPoliceOccurredDate = (value) => {
  if (!value) {
    return "실종 일시 정보 없음";
  }

  const digits = String(value).replace(/\D/g, "");

  if (digits.length >= 12) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
  }

  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }

  return value;
};

function EmergencyPanel({
  selectedElder,
  displayedAlerts,
  policeAlerts,
  routeHistory,
  lastNormalLocation,
  safeZoneForm,
  distance,
  isAlertPanelOpen,
  isMissingReportOpen,
  missingDescription,
  selectedRouteDate,
  onRouteDateChange,
  setMissingDescription,
  missingImagePreview,
  isSubmittingMissingReport,
  onOpenAlertPanel,
  onCloseAlertPanel,
  onReadAlert,
  onCallAlert,
  onOpenEmergencyReport,
  onCloseMissingReport,
  onMissingImageChange,
  onCreateMissingReport,
  isCallResultOpen,
  onCallResolved,
  onCallNeedsReport,
  onCloseCallResult,
}) {

  const [policeIndex, setPoliceIndex] = useState(0);

  const isTodayRoute = selectedRouteDate === new Date().toISOString().slice(0, 10);
  const lastSeenAddress = selectedElder.lastNormalLocation
    ? lastNormalLocation.address
    : "기록 없음";

  const getRouteTimeParts = (receivedAt) => {
    const date = new Date(receivedAt);

    return {
      period: date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        hour12: true,
      }).includes("오전")
        ? "오전"
        : "오후",
      time: date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
  };

  const visiblePoliceAlert = policeAlerts?.[policeIndex] ?? null;

  const handlePrevPoliceAlert = () => {
    if (!policeAlerts?.length) return;

    setPoliceIndex((prev) =>
      prev === 0 ? policeAlerts.length - 1 : prev - 1
    );
  };

  const handleNextPoliceAlert = () => {
    if (!policeAlerts?.length) return;

    setPoliceIndex((prev) =>
      prev === policeAlerts.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <>
      <aside className="right-panel">
        <section className="card route-card">
          <div className="card-header">
            <h2>{isTodayRoute ? "오늘 이동 경로" : "선택 날짜 이동 경로"}</h2>
            <input
              className="route-date-input"
              type="date"
              value={selectedRouteDate}
              onChange={(event) => onRouteDateChange(event.target.value)}
              aria-label="이동 경로 날짜 선택"
            />
          </div>

          <ol className="route-list">
            {routeHistory.length === 0 ? (
              <li>
                <span>이동 경로가 없습니다.</span>
              </li>
            ) : (
              routeHistory
                .slice()
                .reverse()
                .map((point, index) => (
                  <li key={`${point.receivedAt}-${index}`}>
                    <div className="route-time">
                      <span>
                        {new Date(point.receivedAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          hour12: true,
                        }).replace(/\s?\d+시/, "")}
                      </span>

                      <strong className="route-address">{point.address}</strong>

                      <span>
                        {new Date(point.receivedAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        }).replace(/오전|오후/g, "").trim()}
                      </span>
                    </div>
                  </li>
                ))
            )}
          </ol>
        </section>

        <section className="card safe182-card">
          <div className="card-header">
            <h2>안전드림 연계</h2>
          </div>

          <div className="safe182-body">
            <p>
              현재 위치와 보호 대상자 정보를 바탕으로 안전드림 신고에 사용할 내용을 준비합니다.
            </p>

            <div className="safe182-actions">
              <button
                type="button"
                onClick={() => window.open("https://www.safe182.go.kr", "_blank")}
              >
                안전드림 열기
              </button>

              <button
                type="button"
                onClick={() => {
                  const reportText = [
                    "[안전드림 신고 참고 정보]",
                    `대상자: ${selectedElder.name} (${selectedElder.relation})`,
                    `나이/성별: ${selectedElder.age}세 / ${selectedElder.gender}`,
                    `연락처: ${selectedElder.phone || "없음"}`,
                    `현재 위치: ${selectedElder.currentLocation?.address || "위치 미수신"}`,
                    `마지막 정상 위치: ${lastNormalLocation?.address || "기록 없음"}`,
                    `안전 반경 중심: ${safeZoneForm?.address || selectedElder.address || "기록 없음"}`,
                    `안전 반경: ${safeZoneForm?.radiusMeters ?? selectedElder.radius ?? 0}m`,
                    `현재 상태: ${
                      selectedElder.currentLocation
                        ? `안전 반경 이탈 감지 (${distance}m)`
                        : "위치 미수신"
                    }`,
                    `주요 질환: ${selectedElder.condition || "등록 없음"}`,
                    `복약 정보: ${selectedElder.medicineCount || "없음"}`,
                    "",
                    "위 정보는 보호자 앱에서 자동 정리한 신고 참고 정보입니다.",
                  ].join("\n");

                  navigator.clipboard.writeText(reportText);
                  alert("안전드림 신고 참고 정보가 복사되었습니다.");
                }}
              >
                신고 정보 복사
              </button>
            </div>
          </div>
        </section>

        <section className="card police-missing-card">
          <div className="card-header">
            <h2>경찰청 실종정보</h2>
          </div>

          <div className="police-missing-list">
            {!visiblePoliceAlert ? (
              <p className="alert-empty">등록된 경찰청 실종정보가 없습니다.</p>
            ) : (
              <div className="police-missing-slider">
                {policeAlerts?.length > 1 && (
                  <button
                    type="button"
                    className="police-slide-button prev"
                    onClick={handlePrevPoliceAlert}
                    aria-label="이전 실종정보"
                  >
                    ‹
                  </button>
                )}

                <article className="police-missing-item">
                  {visiblePoliceAlert.id && (
                    <img
                      src={`http://localhost:8181/api/police-missing-alerts/${visiblePoliceAlert.id}/photo`}
                      alt={`${visiblePoliceAlert.name} 실종정보 사진`}
                    />
                  )}

                  <div>
                    <strong>{visiblePoliceAlert.name}</strong>
                    <span>
                      {visiblePoliceAlert.gender}
                      {visiblePoliceAlert.ageNow ? ` · 현재 ${visiblePoliceAlert.ageNow}세` : ""}
                    </span>
                    <em>실종 일시: {formatPoliceOccurredDate(visiblePoliceAlert.occurredDate)}</em>
                    <em>{visiblePoliceAlert.occurredAddress || "실종 장소 정보 없음"}</em>
                    <small>자료 출처: 경찰청</small>
                  </div>
                </article>

                {policeAlerts?.length > 1 && (
                  <button
                    type="button"
                    className="police-slide-button next"
                    onClick={handleNextPoliceAlert}
                    aria-label="다음 실종정보"
                  >
                    ›
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </aside>

      {isAlertPanelOpen && (
        <div className="alert-panel-backdrop" onClick={onCloseAlertPanel}>
          <section className="alert-panel" onClick={(event) => event.stopPropagation()}>
            <div className="alert-panel-header">
              <div>
                <h2>전체 알림</h2>
              </div>

              <button className="alert-panel-close" type="button" onClick={onCloseAlertPanel}>
                닫기
              </button>
            </div>

            <div className="alert-panel-list">
              {displayedAlerts.length === 0 ? (
                <p className="alert-empty">도착한 알림이 없습니다.</p>
              ) : (
                displayedAlerts.map((alert) => (
                  <article key={alert.id} className={`alert-panel-item ${alert.isSafeZone ? "danger" : ""}`}>
                    <div>
                      <strong>{alert.message}</strong>
                      <span>{alert.time}</span>
                    </div>

                    {alert.status === "미확인" ? (
                      alert.isSos ? (
                        <div className="alert-actions">
                          <button
                            className="alert-call-button"
                            type="button"
                            onClick={() => onCallAlert(alert)}
                          >
                            전화
                          </button>

                          <button
                            className="alert-emergency-button"
                            type="button"
                            onClick={() => onOpenEmergencyReport(alert)}
                          >
                            긴급 신고
                          </button>
                        </div>
                      ) : alert.isSafeZone ? (
                        <button
                          className="alert-meet-button"
                          type="button"
                          onClick={() => onReadAlert(alert.id)}
                        >
                          만남 완료
                        </button>
                      ) : (
                        <button
                          className="alert-confirm-button"
                          type="button"
                          onClick={() => onReadAlert(alert.id)}
                        >
                          확인
                        </button>
                      )
                    ) : (
                      <em className={alert.status === "신고 완료" ? "reported" : "read"}>
                        {alert.status}
                      </em>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {isCallResultOpen && (
        <div className="call-result-backdrop" onClick={onCloseCallResult}>
          <section className="call-result-modal" onClick={(event) => event.stopPropagation()}>
            <div className="call-result-header">
              <h2>통화 후 상태 선택</h2>
              <button type="button" onClick={onCloseCallResult}>
                닫기
              </button>
            </div>

            <p className="call-result-text">
              보호 대상자와 연락이 되었나요?
              <br />
              추가 조치가 필요 없다면 확인됨으로 처리하고, 연락이 닿지 않거나 위험 상황이면 긴급 신고를 진행하세요.
            </p>

            <div className="call-result-actions">
              <button className="call-resolved-button" type="button" onClick={onCallResolved}>
                확인됨
              </button>

              <button className="call-report-button" type="button" onClick={onCallNeedsReport}>
                긴급 신고
              </button>
            </div>
          </section>
        </div>
      )}

      {isMissingReportOpen && (
        <div className="missing-modal-backdrop" onClick={onCloseMissingReport}>
          <section className="missing-modal" onClick={(event) => event.stopPropagation()}>
            <div className="missing-modal-header">
              <div>
                <h2>실종 신고 상세 입력</h2>
                <p>마지막 위치와 보호자 메모를 함께 등록합니다.</p>
              </div>

              <button className="missing-modal-close" type="button" onClick={onCloseMissingReport}>
                닫기
              </button>
            </div>

            <div className="missing-report-form">
              <label>
                대상자
                <input value={`${selectedElder.name} (${selectedElder.relation})`} readOnly />
              </label>

              <label>
                마지막 목격 위치
                <input value={lastSeenAddress} readOnly />
              </label>

              <label>
                실종자 사진
                <div className="missing-image-upload">
                  {missingImagePreview ? (
                    <img src={missingImagePreview} alt="실종 신고 사진 미리보기" />
                  ) : (
                    <span>사진을 선택하세요</span>
                  )}

                  <input type="file" accept="image/*" onChange={onMissingImageChange} />
                </div>
              </label>

              <label>
                상세 설명
                <textarea
                  value={missingDescription}
                  onChange={(event) => setMissingDescription(event.target.value)}
                  placeholder="착의, 마지막 목격 상황, 특이사항을 입력하세요."
                  rows={6}
                />
              </label>

              <div className="missing-modal-actions">
                <button className="missing-cancel-button" type="button" onClick={onCloseMissingReport}>
                  취소
                </button>

                <button
                  className="missing-submit-button"
                  type="button"
                  onClick={onCreateMissingReport}
                  disabled={isSubmittingMissingReport}
                >
                  {isSubmittingMissingReport ? "등록 중..." : "실종 신고 등록"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default EmergencyPanel;
