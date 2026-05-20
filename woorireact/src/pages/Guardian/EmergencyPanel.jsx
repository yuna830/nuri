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
  isMissingReportOpen,
  missingDescription,
  selectedRouteDate,
  onRouteDateChange,
  setMissingDescription,
  missingImagePreview,
  isSubmittingMissingReport,
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
  const [isPoliceSearchOpen, setIsPoliceSearchOpen] = useState(false);
  const [policeSearchKeyword, setPoliceSearchKeyword] = useState("");

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
  const filteredPoliceAlerts = (policeAlerts ?? []).filter((alert) => {
    const keyword = policeSearchKeyword.trim();

    if (!keyword) {
      return true;
    }

    return [
      alert.name,
      alert.gender,
      alert.age,
      alert.ageNow,
      alert.occurredDate,
      alert.occurredAddress,
      alert.feature,
      alert.clothing,
    ]
      .filter(Boolean)
      .some((value) => String(value).includes(keyword));
  });

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
                onClick={() => setIsPoliceSearchOpen(true)}
              >
                실종자 검색
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

      {isPoliceSearchOpen && (
        <div className="police-search-backdrop" onClick={() => setIsPoliceSearchOpen(false)}>
          <section className="police-search-modal" onClick={(event) => event.stopPropagation()}>
            <div className="police-search-header">
              <div>
                <h2>경찰청 실종자 검색</h2>
                <p>이름, 성별, 나이, 지역, 특징으로 검색할 수 있습니다.</p>
              </div>

              <button type="button" onClick={() => setIsPoliceSearchOpen(false)}>
                닫기
              </button>
            </div>

            <label className="police-search-field">
              검색어
              <input
                value={policeSearchKeyword}
                onChange={(event) => setPoliceSearchKeyword(event.target.value)}
                placeholder="예: 서울, 여자, 44, 정희택"
                autoFocus
              />
            </label>

            <div className="police-search-results">
              {filteredPoliceAlerts.length === 0 ? (
                <p className="police-search-empty">검색 결과가 없습니다.</p>
              ) : (
                filteredPoliceAlerts.map((alert) => {
                  const originalIndex = policeAlerts.findIndex((item) => item.id === alert.id);

                  return (
                    <button
                      type="button"
                      key={alert.id}
                      className="police-search-result"
                      onClick={() => {
                        if (originalIndex >= 0) {
                          setPoliceIndex(originalIndex);
                        }

                        setIsPoliceSearchOpen(false);
                      }}
                    >
                      {alert.id && (
                        <img
                          src={`http://localhost:8181/api/police-missing-alerts/${alert.id}/photo`}
                          alt={`${alert.name} 실종정보 사진`}
                        />
                      )}

                      <span>
                        <strong>{alert.name || "이름 정보 없음"}</strong>
                        <em>
                          {alert.gender || "성별 정보 없음"}
                          {alert.ageNow ? ` · 현재 ${alert.ageNow}세` : ""}
                        </em>
                        <small>{formatPoliceOccurredDate(alert.occurredDate)}</small>
                        <small>{alert.occurredAddress || "실종 장소 정보 없음"}</small>
                      </span>
                    </button>
                  );
                })
              )}
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
