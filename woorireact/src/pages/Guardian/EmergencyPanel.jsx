import { useState } from "react";
import GuardianWelfarePanel from "./GuardianWelfarePanel";

import { searchPlacesByKakao } from "../../api/kakaoLocalApi.js";

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
  onSafeZoneChange,
  onSaveSafeZone,
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
  const [activePanelTab, setActivePanelTab] = useState("today");
  const [isSafeZoneEditorOpen, setIsSafeZoneEditorOpen] = useState(false);
  const [safeZoneKeyword, setSafeZoneKeyword] = useState("");
  const [safeZoneResults, setSafeZoneResults] = useState([]);
  const [isSearchingSafeZone, setIsSearchingSafeZone] = useState(false);

  const medicineLabel = selectedElder.medications?.length
    ? selectedElder.medications.map((medicine) => medicine.name).join(" · ")
    : "등록된 복약 정보 없음";

  const firstMedicine = selectedElder.medications?.[0];

  const defaultMedicationMessage = firstMedicine
    ? `${selectedElder.name}님, ${firstMedicine.name} 복용 시간입니다. 약을 확인하고 제때 복용해주세요.`
    : `${selectedElder.name}님, 오늘 복약 여부를 확인해주세요.`;

  const [isMedicationReminderOpen, setIsMedicationReminderOpen] = useState(false);
  const [medicationReminderMessage, setMedicationReminderMessage] = useState(defaultMedicationMessage);
  const [medicationReminderStatus, setMedicationReminderStatus] = useState("ready");

  const openMedicationReminder = () => {
    setMedicationReminderMessage(defaultMedicationMessage);
    setMedicationReminderStatus("ready");
    setIsMedicationReminderOpen(true);
  };

  const closeMedicationReminder = () => {
    setIsMedicationReminderOpen(false);
  };

  const handleSendMedicationReminder = () => {
    if (!medicationReminderMessage.trim()) {
      alert("알림 내용을 입력해주세요.");
      return;
    }

    setMedicationReminderStatus("sent");
  };

  const handleMedicationConfirmed = () => {
    setMedicationReminderStatus("taken");
  };

  const handleMedicationNotConfirmed = () => {
    setMedicationReminderStatus("not-taken");
  };

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

  const handleSearchSafeZone = async () => {
    const keyword = safeZoneKeyword.trim();

    if (!keyword) {
      alert("검색할 주소를 입력해주세요.");
      return;
    }

    setIsSearchingSafeZone(true);

    try {
      const results = await searchPlacesByKakao(keyword, { size: 5 });
      setSafeZoneResults(results);
    } catch (error) {
      alert("주소 검색에 실패했습니다.");
      setSafeZoneResults([]);
    } finally {
      setIsSearchingSafeZone(false);
    }
  };

  const handleSelectSafeZone = (place) => {
    const address =
      place.road_address_name ||
      place.address_name ||
      place.display_name ||
      "";

    onSafeZoneChange({
      target: {
        name: "address",
        value: address,
      },
    });

    onSafeZoneChange({
      target: {
        name: "centerLatitude",
        value: place.y || place.lat,
      },
    });

    onSafeZoneChange({
      target: {
        name: "centerLongitude",
        value: place.x || place.lon,
      },
    });

    setSafeZoneKeyword(address);
    setSafeZoneResults([]);
  };


  return (
    <>
      <aside className="right-panel">
        <section className="card guardian-side-tabs-card">
          <div className="guardian-side-tabs" role="tablist" aria-label="보호자 기능">
            <button
              type="button"
              className={activePanelTab === "today" ? "active" : ""}
              onClick={() => setActivePanelTab("today")}
            >
              오늘
            </button>


            <button
              type="button"
              className={activePanelTab === "welfare" ? "active" : ""}
              onClick={() => setActivePanelTab("welfare")}
            >
              복지
            </button>

            <button
              type="button"
              className={activePanelTab === "safety" ? "active" : ""}
              onClick={() => setActivePanelTab("safety")}
            >
              안전
            </button>
          </div>
        </section>

        {activePanelTab === "today" && (
          <>
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
                            {new Date(point.receivedAt)
                              .toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                hour12: true,
                              })
                              .replace(/\s?\d+시/, "")}
                          </span>

                          <strong className="route-address">{point.address}</strong>

                          <span>
                            {new Date(point.receivedAt)
                              .toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                              .replace(/오전|오후/g, "")
                              .trim()}
                          </span>
                        </div>
                      </li>
                    ))
                )}
              </ol>
            </section>

            <section className="card guardian-today-summary">

              <div className="guardian-today-body">
                <div>
                  <span>마지막 정상 위치</span>
                  <strong>
                    {selectedElder.lastNormalLocation
                      ? lastNormalLocation.address
                      : "기록 없음"}
                  </strong>
                </div>

                <div className="guardian-safe-zone-summary">
                  <button
                    type="button"
                    className="guardian-safe-zone-text-button"
                    onClick={() => setIsSafeZoneEditorOpen((prev) => !prev)}
                  >
                    <span>안전 반경</span>
                    <strong>
                      {safeZoneForm?.name || "집"} · {safeZoneForm?.radiusMeters ?? 500}m
                    </strong>
                    <small>{safeZoneForm?.address || "주소 정보 없음"}</small>
                  </button>

                  {isSafeZoneEditorOpen && (
                    <div className="guardian-safe-zone-editor">
                      <label>
                        중심 이름
                        <input
                          name="name"
                          value={safeZoneForm?.name || ""}
                          onChange={onSafeZoneChange}
                          placeholder="예: 집"
                        />
                      </label>

                      <label>
                        주소 검색
                        <div className="guardian-safe-zone-search">
                          <input
                            value={safeZoneKeyword}
                            onChange={(event) => setSafeZoneKeyword(event.target.value)}
                            placeholder={safeZoneForm?.address || "주소를 검색하세요"}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleSearchSafeZone();
                              }
                            }}
                          />

                          <button type="button" onClick={handleSearchSafeZone}>
                            {isSearchingSafeZone ? "검색 중" : "검색"}
                          </button>
                        </div>
                      </label>

                      {safeZoneResults.length > 0 && (
                        <div className="guardian-safe-zone-results">
                          {safeZoneResults.map((place, index) => (
                            <button
                              key={`${place.place_id || place.id || index}-${place.x || place.lon}`}
                              type="button"
                              onClick={() => handleSelectSafeZone(place)}
                            >
                              {place.place_name ||
                                place.road_address_name ||
                                place.address_name ||
                                place.display_name}
                            </button>
                          ))}
                        </div>
                      )}

                      <label>
                        반경
                        <select
                          name="radiusMeters"
                          value={safeZoneForm?.radiusMeters ?? 500}
                          onChange={onSafeZoneChange}
                        >
                          <option value={300}>300m</option>
                          <option value={500}>500m</option>
                          <option value={1000}>1km</option>
                          <option value={1500}>1.5km</option>
                          <option value={2000}>2km</option>
                        </select>
                      </label>

                      <button type="button" onClick={onSaveSafeZone}>
                        안전 반경 저장
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="card guardian-medication-card">
              <button
                type="button"
                className="guardian-medication-button"
                onClick={openMedicationReminder}
              >
                <span>오늘 먹어야 하는 약</span>
                <strong>{medicineLabel}</strong>
                <p>오늘 복약 여부를 확인해 주세요.</p>
              </button>
            </section>

            {isMedicationReminderOpen && (
              <div className="medication-reminder-backdrop" onClick={closeMedicationReminder}>
                <section
                  className="medication-reminder-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="medication-reminder-header">
                    <div>
                      <h2>복약 알림 보내기</h2>
                      <p>{selectedElder.name}님에게 복용 약 관련 알림을 보냅니다.</p>
                    </div>

                    <button type="button" onClick={closeMedicationReminder}>
                      닫기
                    </button>
                  </div>

                  {medicationReminderStatus === "ready" && (
                    <div className="medication-reminder-form">
                      <label>
                        알림 보낼 약
                        <select defaultValue={firstMedicine?.name || ""}>
                          {selectedElder.medications?.length ? (
                            selectedElder.medications.map((medicine, index) => (
                              <option key={`${medicine.name}-${index}`} value={medicine.name}>
                                {medicine.name}
                                {medicine.interval ? ` / ${medicine.interval}` : ""}
                              </option>
                            ))
                          ) : (
                            <option value="">등록된 복약 정보 없음</option>
                          )}
                        </select>
                      </label>

                      <label>
                        알림 내용
                        <textarea
                          value={medicationReminderMessage}
                          onChange={(event) => setMedicationReminderMessage(event.target.value)}
                          rows={5}
                        />
                      </label>

                      <div className="medication-reminder-actions">
                        <button type="button" onClick={closeMedicationReminder}>
                          취소
                        </button>

                        <button type="button" onClick={handleSendMedicationReminder}>
                          알림 보내기
                        </button>
                      </div>
                    </div>
                  )}

                  {medicationReminderStatus === "sent" && (
                    <div className="medication-reminder-form">
                      <p className="medication-reminder-result">
                        복약 알림을 보냈습니다. 대상자가 복약 여부를 확인하면 이곳에서 상태를 볼 수 있습니다.
                      </p>

                      <div className="medication-reminder-actions">
                        <button type="button" onClick={() => setMedicationReminderStatus("ready")}>
                          다시 보내기
                        </button>

                        <button type="button" onClick={closeMedicationReminder}>
                          확인
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            <section className="card guardian-checkin-card">
              <div className="guardian-checkin-body">
                <span>안부 묻기</span>
                <strong>오늘 컨디션이나 식사 여부를 확인해 보세요.</strong>
                <p>가까이 있지 않아도 짧게 연락해서 상태를 확인할 수 있습니다.</p>

                <div className="guardian-checkin-actions">
                  <button type="button" onClick={() => window.location.href = `tel:${selectedElder.phone}`}>
                    전화하기
                  </button>

                  <button type="button">
                    메시지 보내기
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {activePanelTab === "welfare" && (
          <GuardianWelfarePanel selectedElder={selectedElder} />
        )}

        {activePanelTab === "safety" && (
          <>
            <section className="card safe182-card">
              <div className="card-header">
                <h2>실종 정보 확인</h2>
              </div>

              <div className="safe182-body">
                <p>
                  연락이 되지 않거나 실종이 의심되는 경우 최근 위치를 먼저 확인하고,
                  경찰청 공공데이터로 실종 경보와 검색 정보를 참고할 수 있습니다. <br />
                  긴급 상황에서는 즉시 112 신고가 필요합니다.
                </p>

                <div className="safe182-actions">
                  <button
                    type="button"
                    onClick={() => window.open("https://www.safe182.go.kr", "_blank")}
                  >
                    112 신고 안내
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
                <h2>최근 실종 경보</h2>
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

                <small className="police-missing-report-hint">
                  목격 정보가 있다면 112로 신고해주세요.
                </small>
              </div>
            </section>
          </>
        )}
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
                      title={[
                        alert.name || "이름 정보 없음",
                        alert.gender || "",
                        alert.ageNow ? `현재 ${alert.ageNow}세` : "",
                        alert.occurredAddress || "",
                      ].filter(Boolean).join(" · ")}
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
                          alt={`${alert.name || "실종자"} 실종정보 사진`}
                        />
                      )}
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
