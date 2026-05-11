import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const fetchFullRoadAddress = async (lat, lng, fallbackAddress) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`
    );

    if (!response.ok) {
      return fallbackAddress;
    }

    const data = await response.json();
    const addr = data?.address;

    const fullRoadAddress = [
      addr?.province,
      addr?.city,
      addr?.borough || addr?.city_district,
      addr?.suburb || addr?.neighbourhood,
      addr?.road,
      addr?.house_number,
    ]
      .filter(Boolean)
      .join(" ");

    return fullRoadAddress || data?.display_name || fallbackAddress;
  } catch {
    return fallbackAddress;
  }
};

const fetchRouteHistoryByDate = async (seniorId, dateValue, fallbackAddress) => {
  const response = await fetch(
    `http://localhost:8080/api/locations/senior/${seniorId}/date?date=${dateValue}`
  );

  if (!response.ok || response.status === 204) {
    return [];
  }

  const locations = await response.json();

  if (!Array.isArray(locations)) {
    return [];
  }

  const routeHistory = await Promise.all(
    locations
      .filter((location) => location?.latitude && location?.longitude)
      .map(async (location) => ({
        lat: location.latitude,
        lng: location.longitude,
        address: await fetchFullRoadAddress(
          location.latitude,
          location.longitude,
          location.address || fallbackAddress
        ),
        receivedAt: location.receivedAt || new Date().toISOString(),
      }))
  );

  return routeHistory.filter((point, index, list) => {
    if (index === 0) {
      return true;
    }

    const previous = list[index - 1];
    const movedMeters = Math.sqrt(
      Math.pow((point.lat - previous.lat) * 111000, 2) +
        Math.pow(
          (point.lng - previous.lng) *
            111000 *
            Math.cos(point.lat * Math.PI / 180),
          2
        )
    );

    return movedMeters >= 50;
  });
};

const getDefaultSafeZone = (elder) => ({
  name: "기본구역",
  address: elder.address,
  centerLatitude: elder.center.lat,
  centerLongitude: elder.center.lng,
  radiusMeters: elder.radius,
});

const fetchLatestLocation = async (seniorId, fallbackAddress) => {
  const response = await fetch(`http://localhost:8080/api/locations/senior/${seniorId}/latest`);

  if (!response.ok || response.status === 204) {
    return null;
  }

  const latestLocation = await response.json();

  if (!latestLocation?.latitude || !latestLocation?.longitude) {
    return null;
  }

  return {
    lat: latestLocation.latitude,
    lng: latestLocation.longitude,
    address: latestLocation.address || fallbackAddress,
    receivedAt: latestLocation.receivedAt || new Date().toISOString(),
  };
};

const loadSafeZone = async (elder) => {
  const cacheKey = `guardian-safe-zone:${elder.id}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.savedAt < 60 * 1000) {
      return cached.data;
    }
  } catch {
    // Cache is optional.
  }

  const response = await fetch(`http://localhost:8080/api/safe-zones/senior/${elder.id}`);

  if (!response.ok || response.status === 204) {
    return getDefaultSafeZone(elder);
  }

  const safeZone = await response.json();

  const normalizedSafeZone = {
    name: safeZone.name || "기본구역",
    address: safeZone.address || elder.address,
    centerLatitude: safeZone.centerLatitude ?? elder.center.lat,
    centerLongitude: safeZone.centerLongitude ?? elder.center.lng,
    radiusMeters: safeZone.radiusMeters ?? elder.radius,
  };

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: normalizedSafeZone }));
  } catch {
    // Ignore storage failure.
  }

  return normalizedSafeZone;
};

const saveLocalCareTeamMap = (profiles, guardian) => {
  if (!guardian || !Array.isArray(profiles)) return;

  try {
    const previousMap = JSON.parse(localStorage.getItem("seniorCareTeamMap") || "{}");
    const nextMap = { ...previousMap };

    profiles.forEach((profile) => {
      const senior = profile?.senior;
      if (!senior?.id) return;

      nextMap[String(senior.id)] = {
        guardianName: guardian.name || "",
        guardianRelation: profile?.relation || senior.guardianRelation || "",
        socialWorkerName: profile?.socialWorker?.name || profile?.socialWorkerName || senior.socialWorkerName || "",
      };
    });

    localStorage.setItem("seniorCareTeamMap", JSON.stringify(nextMap));
  } catch {
    // localStorage is only a display cache; backend data remains the source of truth.
  }
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
  const knownAlertIdsRef = useRef(new Set());
  const didLoadAlertsRef = useRef(false);
  const [guardianToast, setGuardianToast] = useState(null);
  const [reportingAlertId, setReportingAlertId] = useState(null);
  const [reportedAlertIds, setReportedAlertIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("reportedAlertIds") || "[]");
    } catch {
      return [];
    }
  });
  const [callingAlert, setCallingAlert] = useState(null);
  const [isCallResultOpen, setIsCallResultOpen] = useState(false);  

  const [isMissingReportOpen, setIsMissingReportOpen] = useState(false);
  const [missingDescription, setMissingDescription] = useState("");
  const [missingImageFile, setMissingImageFile] = useState(null);
  const [missingImagePreview, setMissingImagePreview] = useState("");
  const [isSubmittingMissingReport, setIsSubmittingMissingReport] = useState(false);

  const [isLoadingElders, setIsLoadingElders] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [selectedRouteDate, setSelectedRouteDate] = useState(getDateValue());
  const [safeZoneAlertedKeys, setSafeZoneAlertedKeys] = useState([]);

  const [isMedicineAlertOpen, setIsMedicineAlertOpen] = useState(false);
  const [medicineMessage, setMedicineMessage] = useState("");
  const [isSendingMedicineAlert, setIsSendingMedicineAlert] = useState(false);

  const selectedElder = useMemo(
    () => elders.find((elder) => elder.id === selectedElderId) ?? elders[0] ?? null,
    [elders, selectedElderId]
  );

  const activeElderId = selectedElderId ?? selectedElder?.id ?? null;

  const attachLatestLocation = async (profile) => {
    const elder = mapSeniorProfileToElder(profile);

    try {
      const realLocation = await fetchLatestLocation(elder.id, elder.address);

      if (!realLocation) {
        return elder;
      }

      return {
        ...elder,
        currentLocation: realLocation,
        lastNormalLocation: realLocation,
        routeHistory: [realLocation],
      };
    } catch (error) {
      console.error("최신 위치 경로 조회 실패:", error);
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
      `http://localhost:8080/api/seniors/guardian/${currentGuardian.id}`
    );

    if (!response.ok) {
      throw new Error("보호 대상자 조회 실패");
    }

    const profiles = await response.json();
    saveLocalCareTeamMap(profiles, currentGuardian);
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

  const refreshLatestLocations = useCallback(async () => {
  const nextElders = await Promise.all(
    elders.map(async (elder) => {
      const realLocation = await fetchLatestLocation(elder.id, elder.address);

      if (!realLocation) {
        return elder;
      }

      const lastRoutePoint = elder.routeHistory?.[elder.routeHistory.length - 1];

      const movedMeters = lastRoutePoint
        ? Math.sqrt(
            Math.pow((realLocation.lat - lastRoutePoint.lat) * 111000, 2) +
              Math.pow(
                (realLocation.lng - lastRoutePoint.lng) *
                  111000 *
                  Math.cos((realLocation.lat * Math.PI) / 180),
                2
              )
          )
        : Infinity;

      const isSameLocation = movedMeters < 50;

      return {
        ...elder,
        currentLocation: realLocation,
        lastNormalLocation: realLocation,
        routeHistory: isSameLocation
          ? elder.routeHistory || []
          : [...(elder.routeHistory || []), realLocation],
      };
    })
  );

  setElders(nextElders);
}, [elders]);

  const loadGuardianAlerts = useCallback(() => {
    const guardianId = getCurrentGuardianId();

    if (!guardianId) {
      navigate("/glogin");
      return;
    }

    getGuardianAlerts(guardianId)
      .then((alerts) => {
        const nextAlerts = Array.isArray(alerts) ? alerts : [];
        const previousIds = knownAlertIdsRef.current;

        const newAlerts = nextAlerts.filter(
          (alert) =>
            !previousIds.has(String(alert.id)) &&
            alert.isRead !== true
        );

        knownAlertIdsRef.current = new Set(
          nextAlerts.map((alert) => String(alert.id))
        );

        setApiAlerts(nextAlerts);

        if (didLoadAlertsRef.current && newAlerts.length > 0) {
          const latestAlert = newAlerts[0];

          setGuardianToast({
            id: latestAlert.id,
            type: latestAlert.type,
            title: latestAlert.title || "새 알림이 도착했어요",
            message: latestAlert.message || "보호 대상자의 새 알림을 확인해주세요.",
          });
        }

        didLoadAlertsRef.current = true;
      })
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
    if (elders.length === 0) {
      return;
    }

    const locationRefreshIntervalId = setInterval(() => {
      refreshLatestLocations().catch((error) => {
        console.error("최신 위치 자동 갱신 실패:", error);
      });
    }, 10000);

    return () => clearInterval(locationRefreshIntervalId);
  }, [elders.length, refreshLatestLocations]);

  useEffect(() => {
    loadGuardianAlerts();

    const alertIntervalId = setInterval(() => {
      loadGuardianAlerts();
    }, 5000);

    return () => clearInterval(alertIntervalId);
  }, [loadGuardianAlerts]);

  useEffect(() => {
    setIsSafeZoneOpen(false);
    setIsRouteVisible(true);
    setSelectedRouteDate(getDateValue());
  }, [selectedElderId]);

  const formatAlertMessage = (alert) => {
    const originalMessage = alert.message ?? alert.title ?? "";

    if (!originalMessage) {
      return "알림 내용이 없습니다.";
    }

    const nameMatch = originalMessage.match(/^(.+?)(?:님|이|가|은|는)/);
    const seniorName = nameMatch?.[1] || alert.seniorName || alert.name || "보호 대상자";

    const isSosCancel =
      originalMessage.includes("취소") ||
      originalMessage.includes("해제") ||
      originalMessage.includes("수신");

    if (isSosCancel) {
      return `${seniorName}의 SOS 해제 알림`;
    }

    const isSosRequest =
      alert.type === "SOS" ||
      originalMessage.includes("SOS 요청") ||
      originalMessage.includes("SOS를 보냄") ||
      originalMessage.includes("SOS 보냄");

    if (isSosRequest) {
      return `${seniorName}의 SOS 요청`;
    }

    return originalMessage;
  };

  const isSameDate = (left, right) => {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  };

  const today = new Date();

  const displayedAlerts = apiAlerts
    .filter((alert) => {
      if (!alert.createdAt) return false;

      const createdAt = new Date(alert.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      return isSameDate(createdAt, today);
    })
    .map((alert) => {
      const isReported = reportedAlertIds.includes(String(alert.id));

      return {
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
        message: formatAlertMessage(alert),
        status: isReported ? "신고 완료" : alert.isRead ? "확인됨" : "미확인",
        isSos: alert.type === "SOS",
      };
    });

  const unreadAlertCount = displayedAlerts.filter(
    (alert) => alert.status === "미확인"
  ).length;

  useEffect(() => {
    if (!selectedElder?.currentLocation) {
      return;
    }

    const form = safeZoneForms[selectedElder.id] ?? getDefaultSafeZone(selectedElder);
    const currentLocation = selectedElder.currentLocation;
    const currentDistance = getDistanceMeters(
      { lat: form.centerLatitude, lng: form.centerLongitude },
      currentLocation
    );

    if (currentDistance <= form.radiusMeters) {
      return;
    }

    const alertKey = [
      selectedElder.id,
      form.radiusMeters,
      Math.round(currentLocation.lat * 10000),
      Math.round(currentLocation.lng * 10000),
    ].join("-");
    if (safeZoneAlertedKeys.includes(alertKey)) {
      return;
    }

    const message = `${selectedElder.name}이 안전 구역을 벗어났습니다. 현재 위치: ${currentLocation.address}`;
    const localAlert = {
      id: `safe-zone-${Date.now()}`,
      seniorId: selectedElder.id,
      type: "SAFE_ZONE",
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      message,
      title: message,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    setApiAlerts((prev) => [localAlert, ...prev]);
    setSafeZoneAlertedKeys((prev) => [...prev, alertKey]);
  }, [safeZoneAlertedKeys, safeZoneForms, selectedElder]);

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
      console.error("날짜별 동선 경로 조회 실패:", error);
      alert("선택한 날짜의 동선 경로를 불러오지 못했습니다.");
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
        `http://localhost:8080/api/safe-zones/senior/${seniorId}`,
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
        throw new Error("안전 구역 저장 실패");
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

      alert("안전 구역이 저장되었습니다.");
      setIsSafeZoneOpen(false);
    } catch (error) {
      console.error("안전 구역 저장 실패:", error);
      alert("안전 구역 저장에 실패했습니다.");
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
      alert("이름이나 전화번호를 2자 이상 입력해주세요.");
      return;
    }

    try {
      setHasSearchedSenior(true);
      setIsSearchingSenior(true);

      const response = await fetch("http://localhost:8080/api/seniors");

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
        `http://localhost:8080/api/guardians/${guardianId}/seniors`,
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
        `http://localhost:8080/api/guardians/${guardianId}/seniors/new`,
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
      `${targetElder.name}과의 연결을 삭제할까요?`
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
        `http://localhost:8080/api/guardians/${guardianId}/seniors/${targetElderId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("보호 대상자 연결 삭제 실패");
      }

      setSafeZoneForms((prev) => {
        const next = { ...prev };
        delete next[targetElderId];
        return next;
      });

      await reloadGuardianSeniors();

      alert("보호 대상자의 연결이 삭제되었습니다.");
    } catch (error) {
      console.error("연결 삭제 실패:", error);
      alert("삭제에 실패했습니다.");
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

  const handleCallAlert = (targetAlert) => {
    const targetElder = targetAlert?.seniorId
      ? elders.find((elder) => String(elder.id) === String(targetAlert.seniorId))
      : selectedElder;

    const phone = targetElder?.phone;

    if (!phone) {
      window.alert("전화번호 정보가 없습니다.");
      return;
    }

    setCallingAlert(targetAlert);
    setIsCallResultOpen(true);
    window.location.href = `tel:${phone}`;
  };

  const handleCallResolved = async () => {
    if (callingAlert?.id) {
      await handleReadAlert(callingAlert.id);
    }

    setCallingAlert(null);
    setIsCallResultOpen(false);
  };

  const handleCallNeedsReport = () => {
    const targetAlert = callingAlert;

    setCallingAlert(null);
    setIsCallResultOpen(false);

    if (targetAlert) {
      handleOpenEmergencyReport(targetAlert);
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
      `${targetElder?.name ?? selectedElder.name}의 SOS 요청 후 연락이 되지 않아 실종 신고합니다.`
    );

    setIsAlertPanelOpen(false);
    setReportingAlertId(alert?.id ?? null);
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

      if (reportingAlertId) {
        markAlertReported(reportingAlertId);
        await handleReadAlert(reportingAlertId);
        setReportingAlertId(null);
      }

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

  const markAlertReported = (alertId) => {
    if (!alertId) return;

    setReportedAlertIds((prev) => {
      const id = String(alertId);
      const next = prev.includes(id) ? prev : [...prev, id];

      sessionStorage.setItem("reportedAlertIds", JSON.stringify(next));
      return next;
    });
  };

  const handleOpenMedicineAlert = () => {
    setMedicineMessage(`${selectedElder.name}님, 복용 중인 약을 확인하고 제때 복용해주세요.`);
    setIsMedicineAlertOpen(true);
  };

  const handleSendMedicineAlert = async () => {
    if (!activeElderId) {
      alert("보호 대상자를 먼저 선택해주세요.");
      return;
    }

    const guardianId = getCurrentGuardianId();

    if (!guardianId) {
      navigate("/glogin");
      return;
    }

    try {
      setIsSendingMedicineAlert(true);

      const response = await fetch("http://localhost:8080/api/alerts/medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seniorId: activeElderId,
          guardianId,
          message: medicineMessage.trim() || "복용 중인 약을 확인하고 제때 복용해주세요.",
        }),
      });

      if (!response.ok) {
        throw new Error("복약 알림 전송 실패");
      }

      alert("복약 알림을 보냈습니다.");
      setIsMedicineAlertOpen(false);
      setMedicineMessage("");
    } catch (error) {
      console.error("복약 알림 전송 실패:", error);
      alert("복약 알림 전송에 실패했습니다.");
    } finally {
      setIsSendingMedicineAlert(false);
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
                aria-label={`${elder.name} 보호 대상자 연결 삭제`}
                title="연결 삭제"
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
          + 보호 대상자 추가
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
          onOpenMedicineAlert={handleOpenMedicineAlert}
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
          onCallAlert={handleCallAlert}
          onOpenEmergencyReport={handleOpenEmergencyReport}
          onOpenMissingReport={() => setIsMissingReportOpen(true)}
          onCloseMissingReport={() => setIsMissingReportOpen(false)}
          onMissingImageChange={handleMissingImageChange}
          onCreateMissingReport={handleCreateMissingReport}
          isCallResultOpen={isCallResultOpen}
          onCallResolved={handleCallResolved}
          onCallNeedsReport={handleCallNeedsReport}
          onCloseCallResult={() => {
            setCallingAlert(null);
            setIsCallResultOpen(false);
          }}
        />
      </section>

      {isMedicineAlertOpen && (
        <div className="medicine-alert-backdrop" onClick={() => setIsMedicineAlertOpen(false)}>
          <section className="medicine-alert-modal" onClick={(event) => event.stopPropagation()}>
            <div className="medicine-alert-header">
              <div>
                <h2>복약 알림 보내기</h2>
                <p>{selectedElder.name}님에게 복용 약 관련 알림을 보냅니다.</p>
              </div>

              <button
                type="button"
                className="medicine-alert-close"
                onClick={() => setIsMedicineAlertOpen(false)}
              >
                닫기
              </button>
            </div>

            <label className="medicine-alert-field">
              알림 내용
              <textarea
                value={medicineMessage}
                onChange={(event) => setMedicineMessage(event.target.value)}
                rows={4}
              />
            </label>

            <div className="medicine-alert-actions">
              <button
                type="button"
                className="medicine-alert-cancel"
                onClick={() => setIsMedicineAlertOpen(false)}
              >
                취소
              </button>

              <button
                type="button"
                className="medicine-alert-submit"
                onClick={handleSendMedicineAlert}
                disabled={isSendingMedicineAlert}
              >
                {isSendingMedicineAlert ? "전송 중..." : "알림 보내기"}
              </button>
            </div>
          </section>
        </div>
      )}

      {guardianToast && (
        <div className={`guardian-toast ${guardianToast.type === "SOS" ? "danger" : "normal"}`}>
          <div>
            <strong>{guardianToast.title}</strong>
            <p>{guardianToast.message}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAlertPanelOpen(true);
              setGuardianToast(null);
            }}
          >
            확인
          </button>

          <button
            type="button"
            className="guardian-toast-close"
            onClick={() => setGuardianToast(null)}
          >
            닫기
          </button>
        </div>
      )}
    </main>
  );
}

// ✅ 버그 수정: guardian?.name 으로 통일하여 guardian이 null일 때 에러 방지
function GuardianHeader({ guardian, unreadAlertCount, onOpenAlertPanel, onOpenEmergencyReport }) {
  return (
    <header className="guardian-header">
      <div className="brand-area">
        <div className="logo-box">?곕━</div>
        <strong className="service-name">?곕━</strong>
        <span className="guardian-name">
          {guardian?.name ? `보호자: ${guardian.name}` : ""}
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