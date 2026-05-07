import { useEffect, useMemo, useRef, useState } from "react";
import { getGuardianAlerts, readAlert, createMissingReport, uploadImage, } from "../../api/guardianApi";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import { RefreshCw } from "lucide-react";
import { elders } from "../../data/mockElders";
import { getDistanceMeters } from "../../utils/location";

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import "leaflet/dist/leaflet.css";
import "./GuardianPage.css";
import "./GuardianMap.css";
import "./GuardianSidebar.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

function GuardianPage() {
  const [selectedElderId, setSelectedElderId] = useState(1);
  const [isSafeZoneOpen, setIsSafeZoneOpen] = useState(false);
  const [isRouteVisible, setIsRouteVisible] = useState(true);
  const [profileImages, setProfileImages] = useState(() => {
    const savedImages = localStorage.getItem("guardianProfileImages");
    return savedImages ? JSON.parse(savedImages) : {};
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [safeZoneForms, setSafeZoneForms] = useState({});
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [apiAlerts, setApiAlerts] = useState([]);
  const profileMenuRef = useRef(null);

  const [isMissingReportOpen, setIsMissingReportOpen] = useState(false);
  const [missingDescription, setMissingDescription] = useState("");
  const [missingImageFile, setMissingImageFile] = useState(null);
  const [missingImagePreview, setMissingImagePreview] = useState("");
  const [isSubmittingMissingReport, setIsSubmittingMissingReport] = useState(false);

  const selectedElder = useMemo(
    () => elders.find((elder) => elder.id === selectedElderId) ?? elders[0],
    [selectedElderId]
  );

  const profileImage = profileImages[selectedElderId] ?? null;
  const location = selectedElder.currentLocation;
  const routeHistory = selectedElder.routeHistory;
  const lastNormalLocation = selectedElder.lastNormalLocation;

  const safeZoneForm = safeZoneForms[selectedElderId] ?? {
    name: "자택",
    centerLatitude: selectedElder.center.lat,
    centerLongitude: selectedElder.center.lng,
    radiusMeters: selectedElder.radius,
  };

  const displayedAlerts = apiAlerts.map((alert) => ({
    id: alert.id,
    time: alert.createdAt
      ? new Date(alert.createdAt).toLocaleString("ko-KR", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    message: alert.message ?? alert.title ?? "알림 내용이 없습니다.",
    status: alert.isRead ? "확인됨" : "미확인",
  }));

  const unreadAlertCount = displayedAlerts.filter(
    (alert) => alert.status === "미확인"
  ).length;

  const safeZoneCenter = useMemo(
    () => ({
      lat: safeZoneForm.centerLatitude,
      lng: safeZoneForm.centerLongitude,
    }),
    [safeZoneForm.centerLatitude, safeZoneForm.centerLongitude]
  );

  const distance = useMemo(
    () => getDistanceMeters(safeZoneCenter, location),
    [safeZoneCenter, location]
  );

  const isOutsideSafeZone = distance > safeZoneForm.radiusMeters;

  useEffect(() => {
    setIsSafeZoneOpen(false);
    setIsRouteVisible(true);
    setIsProfileMenuOpen(false);
  }, [selectedElderId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    getGuardianAlerts(1)
      .then(setApiAlerts)
      .catch((error) => {
        console.error("알림 조회 실패:", error);
      });
  }, []);

  const handleReadAlert = async (alertId) => {
    try {
      const updatedAlert = await readAlert(alertId);

      setApiAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? updatedAlert : alert
        )
      );
    } catch (error) {
      console.error("알림 확인 처리 실패:", error);
    }
  };

  const loadGuardianAlerts = () => {
    getGuardianAlerts(1)
      .then(setApiAlerts)
      .catch((error) => {
        console.error("알림 조회 실패:", error);
      });
  };

  useEffect(() => {
    loadGuardianAlerts();
  }, []);

  const handleSafeZoneChange = (event) => {
    const { name, value } = event.target;

    setSafeZoneForms((prev) => ({
      ...prev,
      [selectedElderId]: {
        ...safeZoneForm,
        [name]: name === "name" ? value : Number(value),
      },
    }));
  };

  const handleSaveSafeZone = () => {
    alert("안전 반경이 저장되었습니다.");
    setIsSafeZoneOpen(false);
  };

  const handleRefreshLocation = () => {
    setIsRouteVisible(true);
  };

  const handleProfileClick = () => {
    if (profileImage) {
      setIsProfileMenuOpen((prev) => !prev);
      return;
    }

    document.getElementById("profileImageInput").click();
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const imageUrl = reader.result;

      setProfileImages((prev) => {
        const next = {
          ...prev,
          [selectedElderId]: imageUrl,
        };

        localStorage.setItem("guardianProfileImages", JSON.stringify(next));
        return next;
      });

      setIsProfileMenuOpen(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleChangeProfileImage = () => {
    document.getElementById("profileImageInput").click();
  };

  const handleDeleteProfileImage = () => {
    setProfileImages((prev) => {
      const next = { ...prev };
      delete next[selectedElderId];

      localStorage.setItem("guardianProfileImages", JSON.stringify(next));
      return next;
    });

    setIsProfileMenuOpen(false);
  };

  const handleMissingImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setMissingImageFile(file);
    setMissingImagePreview(URL.createObjectURL(file));
  };

  const handleCreateMissingReport = async () => {
    try {
      setIsSubmittingMissingReport(true);

      let imageUrl = "";

      if (missingImageFile) {
        const uploadResult = await uploadImage("missing-reports", missingImageFile);
        imageUrl = uploadResult.imageUrl;
      }

      await createMissingReport({
        seniorId: selectedElderId,
        guardianId: 1,
        lastSeenLatitude: lastNormalLocation.lat,
        lastSeenLongitude: lastNormalLocation.lng,
        lastSeenAddress: lastNormalLocation.address,
        description: missingDescription || `${selectedElder.name} 실종 신고`,
        imageUrl,
      });

      loadGuardianAlerts();

      alert("실종 신고가 등록되었습니다.");
      setMissingDescription("");
      setMissingImageFile(null);
      setMissingImagePreview("");
      setIsMissingReportOpen(false);
    } catch (error) {
      console.error("실종 신고 등록 실패:", error);
      alert("실종 신고 등록에 실패했습니다.");
    } finally {
      setIsSubmittingMissingReport(false);
    }
  };

  return (
    <main className="guardian-page">
      <header className="guardian-header">
        <div className="brand-area">
          <div className="logo-box">우리</div>
          <strong className="service-name">우리</strong>
          <span className="guardian-name">보호자: 김민지</span>
        </div>

        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setIsAlertPanelOpen(true)}
          >
            알림
            <span className="alarm-count">{unreadAlertCount}</span>
          </button>

          <button className="danger-button" type="button">
            긴급 신고
          </button>
        </div>
      </header>

      <nav className="elder-tabs" aria-label="보호 대상자 목록">
        {elders.map((elder) => (
          <button
            key={elder.id}
            className={`elder-tab ${elder.id === selectedElderId ? "active" : ""}`}
            type="button"
            onClick={() => setSelectedElderId(elder.id)}
          >
            {elder.name} ({elder.relation})
            <span className={`status-badge ${elder.status}`}>
              {elder.status === "normal" ? "정상" : elder.status === "danger" ? "이탈" : "미수신"}
            </span>
          </button>
        ))}
      </nav>

      <section className="guardian-dashboard">
        <aside className="left-panel">
          <section className="card status-overview profile-status-card">
            <div className="profile-image-area" ref={profileMenuRef}>
              <button
                className={`profile-image-button ${profileImage ? "has-image" : ""}`}
                type="button"
                onClick={handleProfileClick}
              >
                {profileImage ? (
                  <img src={profileImage} alt={`${selectedElder.name} 프로필`} />
                ) : (
                  <span>이미지 선택</span>
                )}
              </button>

              <input
                id="profileImageInput"
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                hidden
              />

              {profileImage && isProfileMenuOpen && (
                <div className="profile-image-menu">
                  <button type="button" onClick={handleChangeProfileImage}>
                    변경
                  </button>
                  <button type="button" onClick={handleDeleteProfileImage}>
                    삭제
                  </button>
                </div>
              )}
            </div>

            <div className="status-profile-head">
              <strong>
                {selectedElder.name} ({selectedElder.relation})
              </strong>
              <p className="status-line">
                <span />
                {isOutsideSafeZone ? "이탈" : "정상"}
              </p>
            </div>

            <p className="status-message">
              {isOutsideSafeZone ? "안전 반경 밖에 있습니다" : "현재 안전 반경 안에 있습니다"}
            </p>
            <small>{distance}m 거리</small>

            <dl className="status-profile-list">
              <div>
                <dt>나이</dt>
                <dd>{selectedElder.age}</dd>
              </div>
              <div>
                <dt>성별</dt>
                <dd>{selectedElder.gender}</dd>
              </div>
              <div>
                <dt>주소</dt>
                <dd>{selectedElder.address}</dd>
              </div>
              <div>
                <dt>주요 질환</dt>
                <dd>{selectedElder.condition}</dd>
              </div>
            </dl>

            <div className="battery-box">
              <div className="battery-title-row">
                <span>GPS 배터리</span>
                <strong>{selectedElder.battery}%</strong>
              </div>
              <div className="battery-row">
                <div className="battery-bar">
                  <div style={{ width: `${selectedElder.battery}%` }} />
                </div>
              </div>
            </div>
          </section>

          <section className="card location-summary">
            <div className="summary-row">
              <span>현재 위치</span>
              <strong>{location.address}</strong>
              <p>
                위도 {location.lat}, 경도 {location.lng}
              </p>
            </div>

            <div className="summary-row">
              <span>마지막 정상 위치</span>
              <strong>{lastNormalLocation.address}</strong>
              <p>
                위도 {lastNormalLocation.lat}, 경도 {lastNormalLocation.lng}
              </p>
            </div>

            <div className="summary-row safe-zone-summary">
              <span>안전 반경 중심</span>
              <button
                className={`safe-zone-trigger ${isSafeZoneOpen ? "active" : ""}`}
                type="button"
                onClick={() => setIsSafeZoneOpen((prev) => !prev)}
              >
                <span className="safe-zone-top">
                  <span className="safe-zone-name">{safeZoneForm.name}</span>
                  <span className="safe-zone-edit">수정</span>
                </span>
                <span className="safe-zone-radius">
                  반경 {safeZoneForm.radiusMeters}m 설정
                </span>
              </button>
            </div>
          </section>

          {isSafeZoneOpen && (
            <section className="card safe-zone-card">
              <h2>안전 반경 설정</h2>

              <label>
                장소 이름
                <input
                  name="name"
                  value={safeZoneForm.name}
                  onChange={handleSafeZoneChange}
                />
              </label>

              <div className="safe-zone-grid">
                <label>
                  중심 위도
                  <input
                    name="centerLatitude"
                    type="number"
                    step="0.0001"
                    value={safeZoneForm.centerLatitude}
                    onChange={handleSafeZoneChange}
                  />
                </label>

                <label>
                  중심 경도
                  <input
                    name="centerLongitude"
                    type="number"
                    step="0.0001"
                    value={safeZoneForm.centerLongitude}
                    onChange={handleSafeZoneChange}
                  />
                </label>
              </div>

              <label>
                반경
                <select
                  name="radiusMeters"
                  value={safeZoneForm.radiusMeters}
                  onChange={handleSafeZoneChange}
                >
                  <option value={300}>300m</option>
                  <option value={500}>500m</option>
                  <option value={1000}>1km</option>
                  <option value={1500}>1.5km</option>
                </select>
              </label>

              <button className="primary-button" type="button" onClick={handleSaveSafeZone}>
                저장
              </button>
            </section>
          )}
        </aside>

        <section className="card map-card">
          <div className="card-header">
            <h2>실시간 위치</h2>

            <div className="map-actions">
              <button
                className="map-icon-button"
                type="button"
                aria-label="위치 새로고침"
                onClick={handleRefreshLocation}
              >
                <RefreshCw size={18} strokeWidth={2.2} />
              </button>

              <button className="subtle-button" type="button">
                전체화면
              </button>
            </div>
          </div>

          <div className="real-map-area">
            <MapContainer
              center={[location.lat, location.lng]}
              zoom={16}
              scrollWheelZoom
              className="leaflet-map"
            >
              <RecenterMap center={[location.lat, location.lng]} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Circle
                center={[safeZoneForm.centerLatitude, safeZoneForm.centerLongitude]}
                radius={safeZoneForm.radiusMeters}
                pathOptions={{ color: "#4F6F52", fillColor: "#86A788", fillOpacity: 0.15 }}
              />

              <Marker position={[safeZoneForm.centerLatitude, safeZoneForm.centerLongitude]}>
                <Popup>{safeZoneForm.name} 안전 반경 중심</Popup>
              </Marker>

              <Marker position={[location.lat, location.lng]}>
                <Popup>
                  {selectedElder.name} 현재 위치
                  <br />
                  {distance}m 거리
                </Popup>
              </Marker>

              {isRouteVisible && (
                <Polyline
                  positions={routeHistory.map((point) => [point.lat, point.lng])}
                  pathOptions={{ color: "#C93A32", weight: 4 }}
                />
              )}
            </MapContainer>
          </div>
        </section>

        <aside className="right-panel">
          <section className="card recent-alerts">
            <div className="card-header">
              <h2>최근 알림</h2>
              <button
                className="text-button"
                type="button"
                onClick={() => setIsAlertPanelOpen(true)}
              >
                전체보기
              </button>
            </div>

            <div className="alert-list">
              {displayedAlerts.length === 0 ? (
                <p className="alert-empty">최근 알림이 없습니다.</p>
              ) : (
                displayedAlerts.slice(0, 3).map((alert) => (
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
              <h2>오늘 이동 경로</h2>
              <button className="text-button" type="button">
                날짜 선택
              </button>
            </div>

            <ol className="route-list">
              {routeHistory.slice(-4).reverse().map((point, index) => (
                <li key={`${point.receivedAt}-${index}`}>
                  <time>
                    {new Date(point.receivedAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span>{point.address}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card report-card">
            <div className="report-header">
              <h2>실종 신고</h2>
              <button
                className="outline-danger-button"
                type="button"
                onClick={() => setIsMissingReportOpen(true)}
              >
                상세 입력
              </button>
            </div>

            <p className="last-seen-label">마지막 목격</p>
            <strong className="last-seen-place">
              {lastNormalLocation.address}
            </strong>
            <button
              className="report-button"
              type="button"
              onClick={async () => {
                await handleCreateMissingReport();
                window.open("https://www.safe182.go.kr", "_blank");
              }}
            >
              안전드림 연계 신고
            </button>
          </section>
        </aside>
      </section>

      {isAlertPanelOpen && (
        <div className="alert-panel-backdrop" onClick={() => setIsAlertPanelOpen(false)}>
          <section className="alert-panel" onClick={(event) => event.stopPropagation()}>
            <div className="alert-panel-header">
              <div>
                <h2>전체 알림</h2>
                <p>그동안 도착한 보호자 알림입니다.</p>
              </div>

              <button
                className="alert-panel-close"
                type="button"
                onClick={() => setIsAlertPanelOpen(false)}
              >
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
                      <button
                        className="alert-read-button"
                        type="button"
                        onClick={() => handleReadAlert(alert.id)}
                      >
                        확인
                      </button>
                    ) : (
                      <em className="read">확인됨</em>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
      {isMissingReportOpen && (
        <div className="missing-modal-backdrop" onClick={() => setIsMissingReportOpen(false)}>
          <section className="missing-modal" onClick={(event) => event.stopPropagation()}>
            <div className="missing-modal-header">
              <div>
                <h2>실종 신고 상세 입력</h2>
                <p>마지막 위치와 보호자 메모를 함께 등록합니다.</p>
              </div>

              <button
                className="missing-modal-close"
                type="button"
                onClick={() => setIsMissingReportOpen(false)}
              >
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
                <input value={lastNormalLocation.address} readOnly />
              </label>

              <label>
                실종자 사진
                <div className="missing-image-upload">
                  {missingImagePreview ? (
                    <img src={missingImagePreview} alt="실종 신고 사진 미리보기" />
                  ) : (
                    <span>사진을 선택하세요</span>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMissingImageChange}
                  />
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
                <button
                  className="missing-cancel-button"
                  type="button"
                  onClick={() => setIsMissingReportOpen(false)}
                >
                  취소
                </button>

                <button
                  className="missing-submit-button"
                  type="button"
                  onClick={handleCreateMissingReport}
                  disabled={isSubmittingMissingReport}
                >
                  {isSubmittingMissingReport ? "등록 중..." : "실종 신고 등록"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default GuardianPage;
