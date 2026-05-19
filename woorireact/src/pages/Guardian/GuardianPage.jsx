import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  getGuardianAlerts,
  readAlert,
  createMissingReport,
  uploadImage,
  getPoliceMissingAlerts,
  createCallRequestAlert,
  getSeniorProfile,
  getGuardianSeniors,
  searchSeniorExact,
  connectSeniorToGuardian,
  createAndConnectSenior,
  deleteGuardianSenior,
  sendMedicineAlert,
} from "../../api/guardianApi";
import { mapSeniorProfileToElder } from "../../utils/guardian/guardianProfile";
import { getCurrentGuardian, getCurrentGuardianId } from "../../utils/guardian/guardianSession";
import { getDistanceMeters, formatShortAddress, formatSafeZoneAddress } from "../../utils/guardian/location";
import {
  getDateValue,
  fetchLatestLocation,
  fetchRouteHistoryByDate,
  appendLatestLocationToElder,
} from "../../utils/guardian/guardianLocation";
import {
  getDefaultSafeZone,
  loadSafeZone,
  saveSafeZone,
} from "../../utils/guardian/guardianSafeZone";
import { buildDisplayedAlerts } from "../../utils/guardian/guardianAlert";

import CommonHeader from "../../components/CommonHeader.jsx";
import UserPanel from "./UserPanel";
import LocationPanel from "./LocationPanel";
import EmergencyPanel from "./EmergencyPanel";

import "leaflet/dist/leaflet.css";
import "../../css/guardian/GuardianPage.css";
import "../../css/guardian/GuardianMap.css";
import "../../css/guardian/GuardianSidebar.css";
import "../../css/guardian/GuardianModal.css";

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
    // localStorage is only a display cache.
  }
};

function GuardianPage() {
  const navigate = useNavigate();

  const [guardian, setGuardian] = useState(null);
  const [elders, setElders] = useState([]);
  const [selectedElderId, setSelectedElderId] = useState(null);
  const [isAddElderOpen, setIsAddElderOpen] = useState(false);
  const [deleteModeElderId, setDeleteModeElderId] = useState(null);

  const [seniorSearch, setSeniorSearch] = useState({ name: "", phone: "" });
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

  const [isMedicineAlertOpen, setIsMedicineAlertOpen] = useState(false);
  const [medicineMessage, setMedicineMessage] = useState("");
  const [selectedMedicineIndex, setSelectedMedicineIndex] = useState("");
  const [isSendingMedicineAlert, setIsSendingMedicineAlert] = useState(false);

  const [policeAlerts, setPoliceAlerts] = useState([]);

  const selectedElder = useMemo(
    () => elders.find((elder) => elder.id === selectedElderId) ?? elders[0] ?? null,
    [elders, selectedElderId]
  );

  const activeElderId = selectedElderId ?? selectedElder?.id ?? null;

  const displayedAlerts = useMemo(
    () => buildDisplayedAlerts(apiAlerts, reportedAlertIds),
    [apiAlerts, reportedAlertIds]
  );

  const unreadAlertCount = displayedAlerts.filter((alert) => alert.status === "미확인").length;

  const mergeElderProfile = (freshElder, previousElder) => ({
    ...freshElder,
    relation: previousElder?.relation || freshElder.relation,
    currentLocation: previousElder?.currentLocation ?? freshElder.currentLocation,
    lastNormalLocation: previousElder?.lastNormalLocation ?? freshElder.lastNormalLocation,
    routeHistory: previousElder?.routeHistory ?? freshElder.routeHistory,
    alerts: previousElder?.alerts ?? freshElder.alerts,
    battery: previousElder?.battery ?? freshElder.battery,
    status: previousElder?.status ?? freshElder.status,
  });

  const fetchSeniorProfile = async (seniorId) => {
    const profile = await getSeniorProfile(seniorId);
    return mapSeniorProfileToElder(profile);
  };

  const refreshSeniorProfile = useCallback(async (seniorId) => {
    const freshElder = await fetchSeniorProfile(seniorId);

    setElders((prev) =>
      prev.map((elder) =>
        elder.id === seniorId ? mergeElderProfile(freshElder, elder) : elder
      )
    );

    return freshElder;
  }, []);

  const attachLatestLocation = async (profile) => {
    const elder = mapSeniorProfileToElder(profile);

    try {
      const realLocation = await fetchLatestLocation(elder.id, elder.address);

      if (!realLocation) return elder;

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

    const profiles = await getGuardianSeniors(currentGuardian.id);

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
      elders.map((elder) => appendLatestLocationToElder(elder))
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
          (alert) => !previousIds.has(String(alert.id)) && alert.isRead !== true
        );

        knownAlertIdsRef.current = new Set(nextAlerts.map((alert) => String(alert.id)));
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
    if (elders.length === 0) return;

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

  useEffect(() => {
    getPoliceMissingAlerts()
      .then((alerts) => {
        setPoliceAlerts(Array.isArray(alerts) ? alerts : []);
      })
      .catch((error) => {
        console.error("경찰청 실종경보 조회 실패:", error);
      });
  }, []);

  useEffect(() => {
    if (!activeElderId) return;

    const profileRefreshIntervalId = setInterval(() => {
      refreshSeniorProfile(activeElderId).catch((error) => {
        console.error("사용자 정보 자동 갱신 실패:", error);
      });
    }, 30000);

    return () => clearInterval(profileRefreshIntervalId);
  }, [activeElderId, refreshSeniorProfile]);

  if (isLoadingElders) {
    return (
      <main className="guardian-page">
        <GuardianHeader
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

    if (!elder.currentLocation) return "unknown";

    const elderDistance = getDistanceMeters(
      { lat: form.centerLatitude, lng: form.centerLongitude },
      elder.currentLocation
    );

    return elderDistance > form.radiusMeters ? "danger" : "normal";
  };

  const handleRouteDateChange = async (dateValue) => {
    if (!activeElderId) return;

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
            ? { ...elder, routeHistory: nextRouteHistory }
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

    if (!activeElderId) return;

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
    if (!activeElderId) return;

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
      const savedSafeZone = await saveSafeZone(seniorId, safeZoneForm);

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
    const searchName = seniorSearch.name.trim();
    const searchPhone = seniorSearch.phone.replace(/[^0-9]/g, "");

    if (!searchName || !searchPhone) {
      setHasSearchedSenior(false);
      setSeniorSearchResults([]);
      alert("이름과 전화번호를 모두 입력해주세요.");
      return;
    }

    try {
      setHasSearchedSenior(true);
      setIsSearchingSenior(true);

      const profiles = await searchSeniorExact({
        name: searchName,
        phone: searchPhone,
      });

      const connectedIds = elders.map((elder) => elder.id);

      const results = profiles.filter((profile) => {
        const senior = profile.senior;

        if (!senior) return false;
        if (connectedIds.includes(senior.id)) return false;

        return true;
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

      await connectSeniorToGuardian(guardianId, {
        seniorId,
        relation: relation.trim() || "보호 대상자",
      });

      await reloadGuardianSeniors();

      setIsAddElderOpen(false);
      setSeniorSearch({ name: "", phone: "" });
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

      await createAndConnectSenior(guardianId, newSeniorForm);

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

    if (!targetElderId) return;

    const confirmed = window.confirm(`${targetElder.name}과의 연결을 해제할까요?`);

    if (!confirmed) return;

    try {
      const guardianId = getCurrentGuardianId();

      if (!guardianId) {
        navigate("/glogin");
        return;
      }

      await deleteGuardianSenior(guardianId, targetElderId);

      setSafeZoneForms((prev) => {
        const next = { ...prev };
        delete next[targetElderId];
        return next;
      });

      await reloadGuardianSeniors();

      alert("보호 대상자의 연결이 해제되었습니다.");
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

  const handleCallAlert = async (targetAlert) => {
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

    if (targetElder?.id) {
      await createCallRequestAlert({
        seniorId: targetElder.id,
        latitude: targetElder.currentLocation?.lat,
        longitude: targetElder.currentLocation?.lng,
      }).catch(() => {});
    }

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
    const targetElder = alert?.seniorId
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

  const markAlertReported = (alertId) => {
    if (!alertId) return;

    setReportedAlertIds((prev) => {
      const id = String(alertId);
      const next = prev.includes(id) ? prev : [...prev, id];

      sessionStorage.setItem("reportedAlertIds", JSON.stringify(next));
      return next;
    });
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

  const isMedicineActiveToday = (medicine) => {
    if (!medicine?.name?.trim()) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = medicine.startDate ? new Date(medicine.startDate) : null;
    const endDate = medicine.endDate ? new Date(medicine.endDate) : null;

    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    if (startDate && today < startDate) return false;
    if (!medicine.ongoing && endDate && today > endDate) return false;

    return true;
  };

  const getActiveMedicines = (elder) => {
    return (elder?.medications || []).filter(isMedicineActiveToday);
  };

  const getMedicineScheduleText = (medicine) => {
    return [
      medicine.interval ? `${medicine.interval}시간마다` : "",
      medicine.dailyCount ? `하루 ${medicine.dailyCount}회` : "",
    ].filter(Boolean).join(", ");
  };

  const makeMedicineMessage = (elder, medicine) => {
    if (!medicine) {
      return `${elder.name}님, 복용 중인 약을 확인하고 제때 복용해주세요.`;
    }

    const scheduleText = getMedicineScheduleText(medicine);

    return `${elder.name}님, ${medicine.name}${scheduleText ? `(${scheduleText})` : ""} 복용 시간입니다. 약을 확인하고 제때 복용해주세요.`;
  };

  const handleOpenMedicineAlert = () => {
    const activeMedicines = getActiveMedicines(selectedElder);
    const firstMedicine = activeMedicines[0] || null;

    setSelectedMedicineIndex(firstMedicine ? "0" : "");
    setMedicineMessage(makeMedicineMessage(selectedElder, firstMedicine));
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

      await sendMedicineAlert({
        seniorId: activeElderId,
        guardianId,
        message: medicineMessage.trim() || "복용 중인 약을 확인하고 제때 복용해주세요.",
      });

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

  const activeMedicines = getActiveMedicines(selectedElder);

  return (
    <main className="guardian-page">
      <GuardianHeader
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

                  refreshSeniorProfile(elder.id).catch((error) => {
                    console.error("최신 사용자 정보 조회 실패:", error);
                  });
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
            setSeniorSearch({ name: "", phone: "" });
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
          safeZoneForm={safeZoneForm}
          lastNormalLocation={lastNormalLocation}
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
          formatShortAddress={formatShortAddress}
          onRefreshLocation={handleRefreshLocation}
        />

        <EmergencyPanel
          selectedElder={selectedElder}
          displayedAlerts={displayedAlerts}
          policeAlerts={policeAlerts}
          routeHistory={routeHistory}
          selectedRouteDate={selectedRouteDate}
          safeZoneForm={safeZoneForm}
          onRouteDateChange={handleRouteDateChange}
          distance={distance}
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

            {activeMedicines.length > 0 ? (
              <label className="medicine-alert-field">
                알림 보낼 약
                <select
                  value={selectedMedicineIndex}
                  onChange={(event) => {
                    const nextIndex = event.target.value;
                    const nextMedicine = activeMedicines[Number(nextIndex)];

                    setSelectedMedicineIndex(nextIndex);
                    setMedicineMessage(makeMedicineMessage(selectedElder, nextMedicine));
                  }}
                >
                  {activeMedicines.map((medicine, index) => (
                    <option key={`${medicine.name}-${index}`} value={String(index)}>
                      {[medicine.name, getMedicineScheduleText(medicine)]
                        .filter(Boolean)
                        .join(" / ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="medicine-alert-empty">
                등록된 복용약이 없어 기본 복약 알림을 보냅니다.
              </p>
            )}

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

function GuardianHeader({ unreadAlertCount, onOpenAlertPanel, onOpenEmergencyReport }) {
  return (
    <CommonHeader
      homePath="/guardian"
      actions={
        <>
          <button
            className="common-app-icon-button"
            type="button"
            onClick={onOpenAlertPanel}
            aria-label="알림"
          >
            <Bell size={18} />
            {unreadAlertCount > 0 && (
              <span className="common-app-badge">{unreadAlertCount}</span>
            )}
          </button>

          <button className="common-app-danger-button" type="button" onClick={onOpenEmergencyReport}>
            긴급 신고
          </button>
        </>
      }
    />
  );
}

export default GuardianPage;
