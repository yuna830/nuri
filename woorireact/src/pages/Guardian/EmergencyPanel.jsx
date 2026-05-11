import { formatCityAddress } from "../../utils/guardian/location";


function EmergencyPanel({
  selectedElder,
  displayedAlerts,
  routeHistory,
  lastNormalLocation,
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
  onOpenMissingReport,
  onCloseMissingReport,
  onMissingImageChange,
  onCreateMissingReport,
  isCallResultOpen,
  onCallResolved,
  onCallNeedsReport,
  onCloseCallResult,
}) {
  return (
    <>
      <aside className="right-panel">
        <section className="card recent-alerts">
          <div className="card-header">
            <h2>최근 알림</h2>
            <button className="text-button" type="button" onClick={onOpenAlertPanel}>
              전체보기
            </button>
          </div>

          <div className="alert-list">
            {displayedAlerts.length === 0 ? (
              <p className="alert-empty">최근 알림이 없습니다.</p>
            ) : (
              displayedAlerts.map((alert) => (
                <article key={alert.id} className="alert-item warning">
                  <strong>{alert.time}</strong>
                  <span>{alert.message}</span>
                  <em>{alert.status}</em>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card route-card">
          <div className="card-header">
            <h2>
              {selectedRouteDate === new Date().toISOString().slice(0, 10)
                ? "오늘 이동 경로"
                : "선택 날짜 이동 경로"}
            </h2>

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
                    <time>
                      {new Date(point.receivedAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span>{point.address}</span>
                  </li>
                ))
            )}
          </ol>
        </section>

        <section className="card report-card">
          <div className="report-header">
            <h2>실종 신고</h2>
            <button className="outline-danger-button" type="button" onClick={onOpenMissingReport}>
              상세 입력
            </button>
          </div>

          <p className="last-seen-label">마지막 목격</p>
          <strong className="last-seen-place">
            {selectedElder.lastNormalLocation ? lastNormalLocation.address : "기록 없음"}
          </strong>

          <button
            className="report-button"
            type="button"
            onClick={async () => {
              await onCreateMissingReport();
              window.open("https://www.safe182.go.kr", "_blank");
            }}
          >
            안전드림 연계 신고
          </button>
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
                  <article key={alert.id} className="alert-panel-item">
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
                <input
                  value={selectedElder.lastNormalLocation ? lastNormalLocation.address : "기록 없음"}
                  readOnly
                />
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
