import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGuardianAlerts, readAlert, createMissingReport, uploadImage } from "../../api/guardianApi";
import { mapSeniorProfileToElder } from "../../utils/guardian/guardianProfile";
import { getCurrentGuardian, getCurrentGuardianId } from "../../utils/guardian/guardianSession";
import { getDistanceMeters, formatShortAddress, formatSafeZoneAddress } from "../../utils/guardian/location";

import UserPanel from "./UserPanel";
import LocationPanel from "./LocationPanel";
import EmergencyPanel from "./EmergencyPanel";

import "leaflet/dist/leaflet.css";
import "../../css/guardian/GuardianPage.css";
import "../../css/guardian/GuardianMap.css";
import "../../css/guardian/GuardianSidebar.css";
import "../../css/guardian/GuardianModal.css";

const getDateValue = (date = new Date()) => {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const fetchRouteHistoryByDate = async (seniorId, dateValue, fallbackAddress) => {
  const response = await fetch(
    `http://localhost:8181/api/locations/senior/${seniorId}/date?date=${dateValue}`
  );

  if (!response.ok || response.status === 204) {
    return [];
  }

  const locations = await response.json();

  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .filter((location) => location?.latitude && location?.longitude)
    .map((location) => ({
      lat: location.latitude,
      lng: location.longitude,
      address: location.address || fallbackAddress,
      receivedAt: location.receivedAt || new Date().toISOString(),
    }));
};

const getDefaultSafeZone = (elder) => ({
  name: "자택",
  address: elder.address,
  centerLatitude: elder.center.lat,
  centerLongitude: elder.center.lng,
  radiusMeters: elder.radius,
});

const loadSafeZone = async (elder) => {
  const response = await fetch(`http://localhost:8181/api/safe-zones/senior/${elder.id}`);

  if (!response.ok || response.status === 204) {
    return getDefaultSafeZone(elder);
  }

  const safeZone = await response.json();

  return {
    name: safeZone.name || "자택",
    address: safeZone.address || elder.address,
    centerLatitude: safeZone.centerLatitude ?? elder.center.lat,
    centerLongitude: safeZone.centerLongitude ?? elder.center.lng,
    radiusMeters: safeZone.radiusMeters ?? elder.radius,
  };
};

function GuardianPage() {
  const navigate = useNavigate();

  const [guardian, setGuardian] = useState(null);
  const [elders, setElders] = useState([]);
  const [selectedElderId, setSelectedElderId] = useState(null);
  const [isAddElderOpen, setIsAddElderOpen] = useState(false);
  const [deleteModeElderId, setDeleteModeElderId] = useState(null);

  const [seniorSearch, setSeniorSearch] = useState("");
  const [seniorSearchResults, setSeniorSearchResults] = useState([]);
  const [isSearchingSenior, setIsSearchingSenior] = useState(false);
  const [hasSearchedSenior, setHasSearchedSenior] = useState(false);

  const [newSeniorForm, setNewSeniorForm] = useState({
    name: "",
    phone: "",
    region: "",
    relation: "보호 대상자",
  });

  const [safeZoneForms, setSafeZoneForms] = useState({});
  const [isSafeZoneOpen, setIsSafeZoneOpen] = useState(false);
  const [isRouteVisible, setIsRouteVisible] = useState(true);

  const [apiAlerts, setApiAlerts] = useState([]);
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [isMissingReportOpen, setIsMissingReportOpen] = useState(false);
  const [missingDescription, setMissingDescription] = useState("");
  const [missingImageFile, setMissingImageFile] = useState(null);
  const [missingImagePreview, setMissingImagePreview] = useState("");
  const [isSubmittingMissingReport, setIsSubmittingMissingReport] = useState(false);

  const [isLoadingElders, setIsLoadingElders] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [selectedRouteDate, setSelectedRouteDate] = useState(getDateValue());

  const selectedElder = useMemo(
    () => elders.find((elder) => elder.id === selectedElderId) ?? elders[0] ?? null,
    [elders, selectedElderId]
  );

  const activeElderId = selectedElderId ?? selectedElder?.id ?? null;

  const attachLatestLocation = async (profile) => {
    const elder = mapSeniorProfileToElder(profile);

    try {
      const routeHistory = await fetchRouteHistoryByDate(
        elder.id,
        getDateValue(),
        elder.address
      );

      if (routeHistory.length === 0) {
        return elder;
      }

      const realLocation = routeHistory[routeHistory.length - 1];

      return {
        ...elder,
        currentLocation: realLocation,
        lastNormalLocation: realLocation,
        routeHistory,
      };
    } catch (error) {
      console.error("오늘 위치 경로 조회 실패:", error);
      return elder;
    }
  };

  const loadGuardianSeniorsWithLocation = useCallback(async () => {
    const currentGuardian = getCurrentGuardian();

    if (!currentGuardian) {
      navigate("/glogin");
      return [];
    }

    setGuardian(currentGuardian);

    const response = await fetch(
      `http://localhost:8181/api/seniors/guardian/${currentGuardian.id}`
    );

    if (!response.ok) {
      throw new Error("보호 대상자 조회 실패");
    }

    const profiles = await response.json();
    return Promise.all(profiles.map(attachLatestLocation));
  }, [navigate]);

  const reloadGuardianSeniors = useCallback(async () => {
    const nextElders = await loadGuardianSeniorsWithLocation();

    setElders(nextElders);

    const safeZoneEntries = await Promise.all(
      nextElders.map(async (elder) => [elder.id, await loadSafeZone(elder)])
    );

    setSafeZoneForms(Object.fromEntries(safeZoneEntries));

    if (nextElders.length > 0) {
      setSelectedElderId((prev) => {
        if (prev && nextElders.some((elder) => elder.id === prev)) {
          return prev;
        }

        return nextElders[0].id;
      });
    }
  }, [loadGuardianSeniorsWithLocation]);

  const loadGuardianAlerts = useCallback(() => {
    const guardianId = getCurrentGuardianId();

    if (!guardianId) {
      navigate("/glogin");
      return;
    }

    getGuardianAlerts(guardianId)
      .then(setApiAlerts)
      .catch((error) => {
        console.error("알림 조회 실패:", error);
      });
  }, [navigate]);

  useEffect(() => {
    const loadSeniors = async () => {
      try {
        setIsLoadingElders(true);
        await reloadGuardianSeniors();
      } catch (error) {
        console.error("보호 대상자 조회 실패:", error);
      } finally {
        setIsLoadingElders(false);
      }
    };

    loadSeniors();
  }, [reloadGuardianSeniors]);

  useEffect(() => {
    loadGuardianAlerts();
  }, [loadGuardianAlerts]);

  useEffect(() => {
    setIsSafeZoneOpen(false);
    setIsRouteVisible(true);
    setSelectedRouteDate(getDateValue());
  }, [selectedElderId]);

  const displayedAlerts = apiAlerts.map((alert) => ({
    id: alert.id,
    seniorId: alert.seniorId,
    type: alert.type,
    latitude: alert.latitude,
    longitude: alert.longitude,
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
    isSos: alert.type === "SOS",
  }));

  const unreadAlertCount = displayedAlerts.filter(
    (alert) => alert.status === "미확인"
  ).length;

  if (isLoadingElders) {
    return (
      <main className="guardian-page">
        <GuardianHeader
          guardian={guardian}
          unreadAlertCount={unreadAlertCount}
          onOpenAlertPanel={() => setIsAlertPanelOpen(true)}
          onOpenEmergencyReport={() => {}}
        />

        <section className="guardian-loading">
          <div className="guardian-loading-card">
            <div className="guardian-loading-spinner" />
            <strong>보호 대상자 정보를 불러오는 중입니다.</strong>
            <span>잠시만 기다려주세요.</span>
          </div>
        </section>
      </main>
    );
  }

  if (!selectedElder) {
    return (
      <main className="guardian-page">
        <GuardianHeader
          guardian={guardian}
          unreadAlertCount={unreadAlertCount}
          onOpenAlertPanel={() => setIsAlertPanelOpen(true)}
          onOpenEmergencyReport={() => {}}
        />
        <section className="guardian-empty">등록된 보호 대상자가 없습니다.</section>
      </main>
    );
  }

  const safeZoneForm = safeZoneForms[activeElderId] ?? getDefaultSafeZone(selectedElder);

  const safeZoneCenter = {
    lat: safeZoneForm.centerLatitude,
    lng: safeZoneForm.centerLongitude,
  };

  const hasCurrentLocation = Boolean(selectedElder.currentLocation);
  const location = selectedElder.currentLocation ?? selectedElder.center;
  const routeHistory = selectedElder.routeHistory ?? [];
  const lastNormalLocation = selectedElder.lastNormalLocation ?? selectedElder.center;

  const mapCenter = hasCurrentLocation
    ? [location.lat, location.lng]
    : [safeZoneCenter.lat, safeZoneCenter.lng];

  const distance = hasCurrentLocation ? getDistanceMeters(safeZoneCenter, location) : 0;
  const isOutsideSafeZone = hasCurrentLocation && distance > safeZoneForm.radiusMeters;

  const getElderStatus = (elder) => {
    const form = safeZoneForms[elder.id] ?? getDefaultSafeZone(elder);

    if (!elder.currentLocation) {
      return "unknown";
    }

    const elderDistance = getDistanceMeters(
      { lat: form.centerLatitude, lng: form.centerLongitude },
      elder.currentLocation
    );

    return elderDistance > form.radiusMeters ? "danger" : "normal";
  };

  const handleRouteDateChange = async (dateValue) => {
    if (!activeElderId) {
      return;
    }

    try {
      setSelectedRouteDate(dateValue);

      const nextRouteHistory = await fetchRouteHistoryByDate(
        activeElderId,
        dateValue,
        selectedElder.address
      );

      setElders((prev) =>
        prev.map((elder) =>
          elder.id === activeElderId
            ? {
                ...elder,
                routeHistory: nextRouteHistory,
              }
            : elder
        )
      );

      setIsRouteVisible(true);
    } catch (error) {
      console.error("날짜별 이동 경로 조회 실패:", error);
      alert("선택한 날짜의 이동 경로를 불러오지 못했습니다.");
    }
  };

  const handleSafeZoneChange = (event) => {
    const { name, value } = event.target;

    if (!activeElderId) {
      return;
    }

    setSafeZoneForms((prev) => {
      const currentSafeZone = prev[activeElderId] ?? safeZoneForm;

      return {
        ...prev,
        [activeElderId]: {
          ...currentSafeZone,
          [name]: ["name", "address"].includes(name) ? value : Number(value),
        },
      };
    });
  };

  const handleSelectSafeZonePlace = (place) => {
    if (!activeElderId) {
      return;
    }

    setSafeZoneForms((prev) => {
      const currentSafeZone = prev[activeElderId] ?? safeZoneForm;

      return {
        ...prev,
        [activeElderId]: {
          ...currentSafeZone,
          address: place.display_name,
          centerLatitude: Number(place.lat),
          centerLongitude: Number(place.lon),
        },
      };
    });
  };

  const handleSaveSafeZone = async () => {
    const seniorId = activeElderId;

    if (!seniorId) {
      alert("보호 대상자를 먼저 선택해주세요.");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8181/api/safe-zones/senior/${seniorId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: safeZoneForm.name,
            address: safeZoneForm.address,
            centerLatitude: safeZoneForm.centerLatitude,
            centerLongitude: safeZoneForm.centerLongitude,
            radiusMeters: safeZoneForm.radiusMeters,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("안전 반경 저장 실패");
      }

      const savedSafeZone = await response.json();

      setSafeZoneForms((prev) => ({
        ...prev,
        [seniorId]: {
          name: savedSafeZone.name || safeZoneForm.name,
          address: savedSafeZone.address || safeZoneForm.address,
          centerLatitude: savedSafeZone.centerLatitude ?? safeZoneForm.centerLatitude,
          centerLongitude: savedSafeZone.centerLongitude ?? safeZoneForm.centerLongitude,
          radiusMeters: savedSafeZone.radiusMeters ?? safeZoneForm.radiusMeters,
        },
      }));

      alert("안전 반경이 저장되었습니다.");
      setIsSafeZoneOpen(false);
    } catch (error) {
      console.error("안전 반경 저장 실패:", error);
      alert("안전 반경 저장에 실패했습니다.");
    }
  };

  const handleRefreshLocation = async () => {
    try {
      setIsRefreshingLocation(true);
      await reloadGuardianSeniors();
      setSelectedRouteDate(getDateValue());
      setIsRouteVisible(true);
    } finally {
      setIsRefreshingLocation(false);
    }
  };

  const handleSearchSenior = async () => {
    const keyword = seniorSearch.trim();

    if (keyword.length < 2) {
      setHasSearchedSenior(false);
      setSeniorSearchResults([]);
      alert("이름이나 연락처를 2글자 이상 입력해주세요.");
      return;
    }

    try {
      setHasSearchedSenior(true);
      setIsSearchingSenior(true);

      const response = await fetch("http://localhost:8181/api/seniors");

      if (!response.ok) {
        throw new Error("사용자 조회 실패");
      }

      const profiles = await response.json();
      const connectedIds = elders.map((elder) => elder.id);

      const results = profiles.filter((profile) => {
        const senior = profile.senior;

        if (!senior) return false;
        if (connectedIds.includes(senior.id)) return false;

        return senior.name?.includes(keyword) || senior.phone?.includes(keyword);
      });

      setSeniorSearchResults(results);
    } catch (error) {
      console.error("사용자 검색 실패:", error);
      alert("사용자 검색에 실패했습니다.");
    } finally {
      setIsSearchingSenior(false);
    }
  };

  const handleConnectSenior = async (seniorId, relation = "보호 대상자") => {
    try {
      const guardianId = getCurrentGuardianId();

      if (!guardianId) {
        navigate("/glogin");
        return;
      }

      const response = await fetch(
        `http://localhost:8181/api/guardians/${guardianId}/seniors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seniorId,
            relation: relation.trim() || "보호 대상자",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("보호 대상자 연결 실패");
      }

      await reloadGuardianSeniors();

      setIsAddElderOpen(false);
      setSeniorSearch("");
      setSeniorSearchResults([]);
      setHasSearchedSenior(false);

      alert("보호 대상자가 추가되었습니다.");
    } catch (error) {
      console.error("보호 대상자 연결 실패:", error);
      alert("보호 대상자 추가에 실패했습니다.");
    }
  };

  const handleCreateAndConnectSenior = async () => {
    try {
      if (!newSeniorForm.name.trim()) {
        alert("이름을 입력해주세요.");
        return;
      }

      const guardianId = getCurrentGuardianId();

      if (!guardianId) {
        navigate("/glogin");
        return;
      }

      const response = await fetch(
        `http://localhost:8181/api/guardians/${guardianId}/seniors/new`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSeniorForm),
        }
      );

      if (!response.ok) {
        throw new Error("신규 보호 대상자 등록 실패");
      }

      await reloadGuardianSeniors();

      setIsAddElderOpen(false);
      setNewSeniorForm({
        name: "",
        phone: "",
        region: "",
        relation: "보호 대상자",
      });

      alert("신규 보호 대상자가 추가되었습니다.");
    } catch (error) {
      console.error("신규 보호 대상자 등록 실패:", error);
      alert("신규 보호 대상자 등록에 실패했습니다.");
    }
  };

  const handleDeleteElder = async (targetElder = selectedElder) => {
    const targetElderId = targetElder?.id;

    if (!targetElderId) {
      return;
    }

    const confirmed = window.confirm(
      `${targetElder.name}님과 연결을 해제할까요?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const guardianId = getCurrentGuardianId();

      if (!guardianId) {
        navigate("/glogin");
        return;
      }

      const response = await fetch(
        `http://localhost:8181/api/guardians/${guardianId}/seniors/${targetElderId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("보호 대상자 연결 해제 실패");
      }

      setSafeZoneForms((prev) => {
        const next = { ...prev };
        delete next[targetElderId];
        return next;
      });

      await reloadGuardianSeniors();

      alert("보호 대상자와 연결이 해제되었습니다.");
    } catch (error) {
      console.error("연결 해제 실패:", error);
      alert("해제에 실패했습니다.");
    }
  };

  const handleReadAlert = async (alertId) => {
    try {
      const updatedAlert = await readAlert(alertId);

      setApiAlerts((prev) =>
        prev.map((alert) => (alert.id === alertId ? updatedAlert : alert))
      );
    } catch (error) {
      console.error("알림 확인 처리 실패:", error);
    }
  };

  const handleOpenEmergencyReport = (alert = null) => {
    const targetElder =
      alert?.seniorId
        ? elders.find((elder) => elder.id === alert.seniorId) ?? selectedElder
        : selectedElder;

    if (targetElder?.id) {
      setSelectedElderId(targetElder.id);
    }

    setMissingDescription(
      `${targetElder?.name ?? selectedElder.name}님 SOS 요청 후 연락이 닿지 않아 긴급 신고합니다.`
    );

    setIsAlertPanelOpen(false);
    setIsMissingReportOpen(true);
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

      const guardianId = getCurrentGuardianId();

      if (!guardianId) {
        navigate("/glogin");
        return;
      }

      let imageUrl = "";

      if (missingImageFile) {
        const uploadResult = await uploadImage("missing-reports", missingImageFile);
        imageUrl = uploadResult.imageUrl;
      }

      await createMissingReport({
        seniorId: activeElderId,
        guardianId,
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
      <GuardianHeader
        guardian={guardian}
        unreadAlertCount={unreadAlertCount}
        onOpenAlertPanel={() => setIsAlertPanelOpen(true)}
        onOpenEmergencyReport={() => handleOpenEmergencyReport()}
      />

      <nav className="elder-tabs" aria-label="보호 대상자 목록">
        {elders.map((elder) => {
          const elderStatus = getElderStatus(elder);
          const statusText =
            elderStatus === "normal" ? "정상" : elderStatus === "danger" ? "이탈" : "미수신";
          const isDeleteMode = deleteModeElderId === elder.id;

          return (
            <div
              key={elder.id}
              className={`elder-tab ${elder.id === selectedElderId ? "active" : ""} ${
                isDeleteMode ? "show-delete" : ""
              }`}
              onMouseEnter={() => setDeleteModeElderId(elder.id)}
              onMouseLeave={() => setDeleteModeElderId(null)}
            >
              <button
                className="elder-tab-main"
                type="button"
                onClick={() => {
                  setSelectedElderId(elder.id);
                  setDeleteModeElderId(elder.id);
                }}
              >
                <span className="elder-tab-label">
                  {elder.name} ({elder.relation})
                </span>

                <span className={`status-badge ${elderStatus}`}>
                  {statusText}
                </span>
              </button>

              <button
                className="elder-delete-button"
                type="button"
                aria-label={`${elder.name} 보호 대상 연결 해제`}
                title="연결 해제"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteElder(elder);
                }}
              >
                X
              </button>
            </div>
          );
        })}

        <button
          className="elder-add-button"
          type="button"
          onClick={() => {
            setIsAddElderOpen(true);
            setSeniorSearch("");
            setSeniorSearchResults([]);
            setHasSearchedSenior(false);
          }}
        >
          + 보호 대상 추가
        </button>
      </nav>

      <section className="guardian-dashboard">
        <UserPanel
          selectedElder={selectedElder}
          selectedElderId={activeElderId}
          hasCurrentLocation={hasCurrentLocation}
          isOutsideSafeZone={isOutsideSafeZone}
          distance={distance}
          location={location}
          lastNormalLocation={lastNormalLocation}
          safeZoneForm={safeZoneForm}
          formatShortAddress={formatShortAddress}
          formatSafeZoneAddress={formatSafeZoneAddress}
          isSafeZoneOpen={isSafeZoneOpen}
          isAddElderOpen={isAddElderOpen}
          seniorSearch={seniorSearch}
          setSeniorSearch={setSeniorSearch}
          seniorSearchResults={seniorSearchResults}
          isSearchingSenior={isSearchingSenior}
          hasSearchedSenior={hasSearchedSenior}
          newSeniorForm={newSeniorForm}
          setNewSeniorForm={setNewSeniorForm}
          onToggleSafeZone={() => setIsSafeZoneOpen((prev) => !prev)}
          onSafeZoneChange={handleSafeZoneChange}
          onSelectSafeZonePlace={handleSelectSafeZonePlace}
          onSaveSafeZone={handleSaveSafeZone}
          onCloseAddElder={() => setIsAddElderOpen(false)}
          onSearchSenior={handleSearchSenior}
          onConnectSenior={handleConnectSenior}
          onCreateAndConnectSenior={handleCreateAndConnectSenior}
          onDeleteElder={handleDeleteElder}
        />

        <LocationPanel
          selectedElder={selectedElder}
          safeZoneForm={safeZoneForm}
          hasCurrentLocation={hasCurrentLocation}
          location={location}
          routeHistory={routeHistory}
          mapCenter={mapCenter}
          distance={distance}
          isRouteVisible={isRouteVisible}
          isRefreshingLocation={isRefreshingLocation}
          onRefreshLocation={handleRefreshLocation}
        />

        <EmergencyPanel
          selectedElder={selectedElder}
          displayedAlerts={displayedAlerts}
          routeHistory={routeHistory}
          selectedRouteDate={selectedRouteDate}
          onRouteDateChange={handleRouteDateChange}
          lastNormalLocation={lastNormalLocation}
          isAlertPanelOpen={isAlertPanelOpen}
          isMissingReportOpen={isMissingReportOpen}
          missingDescription={missingDescription}
          setMissingDescription={setMissingDescription}
          missingImagePreview={missingImagePreview}
          isSubmittingMissingReport={isSubmittingMissingReport}
          onOpenAlertPanel={() => setIsAlertPanelOpen(true)}
          onCloseAlertPanel={() => setIsAlertPanelOpen(false)}
          onReadAlert={handleReadAlert}
          onOpenEmergencyReport={handleOpenEmergencyReport}
          onOpenMissingReport={() => setIsMissingReportOpen(true)}
          onCloseMissingReport={() => setIsMissingReportOpen(false)}
          onMissingImageChange={handleMissingImageChange}
          onCreateMissingReport={handleCreateMissingReport}
        />
      </section>
    </main>
  );
}

function GuardianHeader({ guardian, unreadAlertCount, onOpenAlertPanel, onOpenEmergencyReport }) {
  return (
    <header className="guardian-header">
      <div className="brand-area">
        <div className="logo-box">우리</div>
        <strong className="service-name">우리</strong>
        <span className="guardian-name">
          보호자{guardian?.name ? `: ${guardian.name}` : ""}
        </span>
      </div>

      <div className="header-actions">
        <button className="icon-button" type="button" onClick={onOpenAlertPanel}>
          알림
          <span className="alarm-count">{unreadAlertCount}</span>
        </button>

        <button className="danger-button" type="button" onClick={onOpenEmergencyReport}>
          긴급 신고
        </button>
      </div>
    </header>
  );
}

export default GuardianPage;
