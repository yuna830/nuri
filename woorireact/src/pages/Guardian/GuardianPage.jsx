import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
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
  updateSeniorRequestedInfo,
  sendCheckInReply,
} from "../../api/guardianApi";
import { mapSeniorProfileToElder } from "../../utils/guardian/guardianProfile";
import { getCurrentGuardian, getCurrentGuardianId } from "../../utils/guardian/guardianSession";
import { getDistanceMeters, formatShortAddress } from "../../utils/guardian/location";
import {
  getDateValue,
  fetchLatestLocation,
  fetchRouteHistoryByDate,
  appendLatestLocationToElder,
} from "../../utils/guardian/guardianLocation";
import {
  getDefaultSafeZones,
  loadSafeZones,
  saveSafeZone,
  deleteSafeZone,
} from "../../utils/guardian/guardianSafeZone";
import { buildDisplayedAlerts } from "../../utils/guardian/guardianAlert";
import { fetchActivityTrend, fetchFallPattern } from "../../api/userPageApi";
import { fetchUnreadChatCount } from "../../api/chatApi";

import CommonHeader from "../../components/CommonHeader.jsx";
import TripartiteChatModal from "../../components/TripartiteChatModal.jsx";
import UserPanel from "./UserPanel";
import LocationPanel from "./LocationPanel";
import EmergencyPanel from "./EmergencyPanel";

import "leaflet/dist/leaflet.css";
import "../../css/guardian/GuardianPage.css";
import "../../css/guardian/GuardianMap.css";
import "../../css/guardian/GuardianSidebar.css";
import "../../css/guardian/GuardianModal.css";
import "../../css/user/UserCommonHeader.css";

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

const INFO_REQUEST_FIELDS = [
  {
    key: "gender",
    label: "성별",
    aliases: ["성별"],
    type: "select",
    options: ["남성", "여성"],
  },
  {
    key: "phone",
    label: "연락처",
    aliases: ["연락처", "전화번호"],
    type: "tel",
    placeholder: "01012345678",
  },
  {
    key: "birthDate",
    label: "생년월일",
    aliases: ["생년월일", "나이"],
    type: "date",
  },
  {
    key: "region",
    label: "주소",
    aliases: ["주소", "거주 지역"],
    type: "text",
    placeholder: "서울 광진구 자양동 794-10",
  },
];

const isEmptyInfoValue = (value) => {
  const text = String(value ?? "").trim();
  return !text || text === "-" || text.includes("미등록") || text.includes("없음");
};

const getInfoRequestFieldKeys = (alert, elder) => {
  const message = `${alert?.message ?? ""} ${alert?.title ?? ""}`;
  const requestedKeys = INFO_REQUEST_FIELDS
    .filter((field) => field.aliases.some((alias) => message.includes(alias)))
    .map((field) => field.key);

  if (requestedKeys.length > 0) {
    return requestedKeys;
  }

  return INFO_REQUEST_FIELDS
    .filter((field) => {
      if (field.key === "region") return isEmptyInfoValue(elder?.address);
      if (field.key === "birthDate") return isEmptyInfoValue(elder?.birthDate) && isEmptyInfoValue(elder?.age);
      return isEmptyInfoValue(elder?.[field.key]);
    })
    .map((field) => field.key);
};

const buildInfoRequestForm = (elder) => ({
  gender: isEmptyInfoValue(elder?.gender) ? "" : elder.gender,
  phone: elder?.phone || "",
  birthDate: elder?.birthDate || "",
  region: isEmptyInfoValue(elder?.address) ? "" : elder.address,
});

const isInfoRequestStillNeeded = (alert, elders) => {
  const targetElder = elders.find(
    (elder) => String(elder.id) === String(alert?.seniorId)
  );

  if (!targetElder) {
    return true;
  }

  return getInfoRequestFieldKeys(alert, targetElder).some((key) => {
    if (key === "region") return isEmptyInfoValue(targetElder.address);
    if (key === "birthDate") return isEmptyInfoValue(targetElder.birthDate) && isEmptyInfoValue(targetElder.age);
    return isEmptyInfoValue(targetElder[key]);
  });
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
  const [selectedSafeZoneIds, setSelectedSafeZoneIds] = useState({});
  const [mapFocusVersion, setMapFocusVersion] = useState(0);

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
  const [missingFallbackImageUrl, setMissingFallbackImageUrl] = useState("");
  const [isSubmittingMissingReport, setIsSubmittingMissingReport] = useState(false);

  const [isLoadingElders, setIsLoadingElders] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [selectedRouteDate, setSelectedRouteDate] = useState(getDateValue());

  const [isMedicineAlertOpen, setIsMedicineAlertOpen] = useState(false);
  const [medicineMessage, setMedicineMessage] = useState("");
  const [selectedMedicineIndex, setSelectedMedicineIndex] = useState("");
  const [isSendingMedicineAlert, setIsSendingMedicineAlert] = useState(false);

  const [policeAlerts, setPoliceAlerts] = useState([]);
  const [activityReport, setActivityReport] = useState({
    isLoading: false,
    trend: null,
    fallPattern: null,
    error: "",
    updatedAt: "",
  });

  const [infoRequestAlert, setInfoRequestAlert] = useState(null);
  const [isElderEditOpen, setIsElderEditOpen] = useState(false);
  const [editingElder, setEditingElder] = useState(null);
  const [dismissedInfoRequestIds, setDismissedInfoRequestIds] = useState([]);

  const [infoRequestFormAlert, setInfoRequestFormAlert] = useState(null);
  const [infoRequestFieldKeys, setInfoRequestFieldKeys] = useState([]);
  const [infoRequestForm, setInfoRequestForm] = useState({
    gender: "",
    phone: "",
    birthDate: "",
    region: "",
    diabetes: "",
    hypertension: "",
    heartDisease: "",
    jointDisease: "",
    dementia: "",
    walkingAid: "",
    recentFall: "",
    hasSurgery: "",
    surgeryDetail: "",
    otherDisease: "",
    medications: [
      {
        name: "",
        startDate: "",
        interval: "",
        dailyCount: "",
        ongoing: true,
      },
    ],
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialRoomType, setChatInitialRoomType] = useState("");
  const [unreadChatCountsByElder, setUnreadChatCountsByElder] = useState({});

  const selectedElder = useMemo(
    () => elders.find((elder) => elder.id === selectedElderId) ?? elders[0] ?? null,
    [elders, selectedElderId]
  );

  const activeElderId = selectedElderId ?? selectedElder?.id ?? null;

  const unreadChatCount = useMemo(
    () => unreadChatCountsByElder[activeElderId] || 0,
    [activeElderId, unreadChatCountsByElder]
  );

  const loadUnreadChatCount = useCallback(async () => {
    if (elders.length === 0) {
      setUnreadChatCountsByElder({});
      return;
    }

    const entries = await Promise.all(
      elders.map(async (elder) => {
        const count = await fetchUnreadChatCount({
          viewerRole: "GUARDIAN",
          seniorId: elder.id,
        }).catch(() => 0);

        return [elder.id, count];
      })
    );

    setUnreadChatCountsByElder(Object.fromEntries(entries));
  }, [elders]);

  useEffect(() => {
    loadUnreadChatCount();
    const timerId = window.setInterval(loadUnreadChatCount, 5000);
    return () => window.clearInterval(timerId);
  }, [loadUnreadChatCount]);

  useEffect(() => {
    if (!activeElderId) {
      setActivityReport({ isLoading: false, trend: null, fallPattern: null, error: "", updatedAt: "" });
      return;
    }

    let isMounted = true;

    const loadActivityReport = async () => {
      setActivityReport((prev) => ({ ...prev, isLoading: true, error: "" }));

      try {
        const [trend, fallPattern] = await Promise.all([
          fetchActivityTrend(1),
          fetchFallPattern(),
        ]);

        if (!isMounted) return;

        setActivityReport({
          isLoading: false,
          trend,
          fallPattern,
          error: "",
          updatedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        });
      } catch {
        if (!isMounted) return;

        setActivityReport({
          isLoading: false,
          trend: null,
          fallPattern: null,
          error: "활동 리포트를 불러오지 못했습니다.",
          updatedAt: "",
        });
      }
    };

    loadActivityReport();
    const intervalId = window.setInterval(loadActivityReport, 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [activeElderId]);

  const displayedAlerts = useMemo(() => {
    const elderNameById = new Map(
      elders.map((elder) => [String(elder.id), elder.name])
    );

    return buildDisplayedAlerts(apiAlerts, reportedAlertIds)
      .filter((alert) => {
        if (!activeElderId) return true;
        return String(alert.seniorId) === String(activeElderId);
      })
      .map((alert) => ({
        ...alert,
        seniorName:
          alert.seniorName ||
          elderNameById.get(String(alert.seniorId)) ||
          selectedElder?.name ||
          "사용자",
      }));
  }, [apiAlerts, reportedAlertIds, activeElderId, elders, selectedElder?.name]);

  const unreadAlertsByElder = useMemo(() => {
    const map = {};
    buildDisplayedAlerts(apiAlerts, reportedAlertIds).forEach((alert) => {
      if (!alert.seniorId) return;
      const id = String(alert.seniorId);
      map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [apiAlerts, reportedAlertIds]);

  const mergeElderProfile = (freshElder, previousElder) => ({
    ...freshElder,
    relation: freshElder.relation || previousElder?.relation,
    currentLocation: previousElder?.currentLocation ?? freshElder.currentLocation,
    lastNormalLocation: previousElder?.lastNormalLocation ?? freshElder.lastNormalLocation,
    routeHistory: previousElder?.routeHistory ?? freshElder.routeHistory,
    alerts: previousElder?.alerts ?? freshElder.alerts,
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
      nextElders.map(async (elder) => [elder.id, await loadSafeZones(elder)])
    );

    const nextSafeZoneForms = Object.fromEntries(safeZoneEntries);
    setSafeZoneForms(nextSafeZoneForms);

    setSelectedSafeZoneIds((prev) => {
      const next = { ...prev };

      nextElders.forEach((elder) => {
        const zones = nextSafeZoneForms[elder.id] || [];
        const savedId = localStorage.getItem(`guardian-selected-safe-zone:${elder.id}`);

        if (savedId && zones.some((zone) => String(zone.id) === savedId)) {
          next[elder.id] = savedId;
          return;
        }

        next[elder.id] = zones[zones.length - 1]?.id || zones[0]?.id;
      });

      return next;
    });

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

        const nextInfoRequestAlert = nextAlerts.find((alert) =>
          alert.type === "INFO_UPDATE_REQUEST"
          && alert.isRead !== true
          && !dismissedInfoRequestIds.includes(String(alert.id))
          && isInfoRequestStillNeeded(alert, elders)
        );

        if (nextInfoRequestAlert) {
          setInfoRequestAlert(nextInfoRequestAlert);
        }

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
  }, [navigate, dismissedInfoRequestIds, elders]);

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
          displayedAlerts={displayedAlerts}
          onReadAlert={() => { }}
          onOpenEmergencyReport={() => { }}
        />

        <div className="guardian-loading-backdrop" role="status" aria-live="polite">
          <section className="guardian-loading-modal">
            <div className="guardian-loading-spinner" />
            <strong>보호 대상자 정보를 불러오는 중입니다</strong>
            <span>잠시만 기다려주세요.</span>
          </section>
        </div>
      </main>
    );
  }

  if (!selectedElder) {
    return (
      <main className="guardian-page">
        <GuardianHeader
          displayedAlerts={displayedAlerts}
          onReadAlert={() => { }}
          onOpenEmergencyReport={() => { }}
        />

        <section className="guardian-empty-state">
          <div className="guardian-empty-modal">
            <div className="guardian-empty-icon">!</div>

            <h2>등록된 보호 대상자가 없습니다</h2>

            <p>
              보호 대상자를 추가하면 위치 확인, 안전 반경 관리,
              긴급 알림 기능을 사용할 수 있습니다.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const selectedSafeZoneId = selectedSafeZoneIds[activeElderId];
  const safeZones = safeZoneForms[activeElderId] ?? getDefaultSafeZones(selectedElder);
  const safeZoneForm = safeZones.find((zone) => String(zone.id) === String(selectedSafeZoneId))
    ?? safeZones[0]
    ?? getDefaultSafeZones(selectedElder)[0];

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
    const form = safeZoneForms[elder.id] ?? getDefaultSafeZones(elder);

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
      const currentZones = prev[activeElderId] ?? getDefaultSafeZones(selectedElder);
      const currentZoneId = safeZoneForm.id;

      return {
        ...prev,
        [activeElderId]: currentZones.map((zone) =>
          String(zone.id) === String(currentZoneId)
            ? {
              ...zone,
              [name]: ["name", "address"].includes(name) ? value : Number(value),
            }
            : zone
        ),
      };
    });
  };

  const handleAddSafeZoneForm = () => {
    if (!activeElderId) return;

    setSafeZoneForms((prev) => {
      const currentZones = prev[activeElderId] ?? getDefaultSafeZones(selectedElder);

      if (currentZones.length >= 3) {
        alert("안전 반경은 최대 3개까지 등록할 수 있습니다.");
        return prev;
      }

      const newZone = {
        id: `new-${Date.now()}`,
        name: "",
        address: selectedElder.address || "",
        centerLatitude: selectedElder.center.lat,
        centerLongitude: selectedElder.center.lng,
        radiusMeters: 500,
      };

      setSelectedSafeZoneIds((ids) => ({
        ...ids,
        [activeElderId]: newZone.id,
      }));

      return {
        ...prev,
        [activeElderId]: [...currentZones, newZone],
      };
    });
  };

  const handleSelectSafeZoneForm = (safeZoneId) => {
    if (!activeElderId) return;

    localStorage.setItem(`guardian-selected-safe-zone:${activeElderId}`, String(safeZoneId));

    setSelectedSafeZoneIds((prev) => ({
      ...prev,
      [activeElderId]: safeZoneId,
    }));
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
      return false;
    }

    try {
      const currentZones = safeZoneForms[seniorId] ?? getDefaultSafeZones(selectedElder);
      const exists = currentZones.some((zone) => String(zone.id) === String(safeZoneForm.id));

      if (!exists && currentZones.length >= 3) {
        alert("안전 반경은 최대 3개까지 등록할 수 있습니다.");
        return false;
      }

      const savedSafeZone = await saveSafeZone(seniorId, safeZoneForm);

      setSafeZoneForms((prev) => {
        const latestZones = prev[seniorId] ?? getDefaultSafeZones(selectedElder);
        const hasSameZone = latestZones.some((zone) => String(zone.id) === String(safeZoneForm.id));

        return {
          ...prev,
          [seniorId]: hasSameZone
            ? latestZones.map((zone) =>
              String(zone.id) === String(safeZoneForm.id) ? savedSafeZone : zone
            )
            : [...latestZones, savedSafeZone],
        };
      });

      localStorage.setItem(`guardian-selected-safe-zone:${seniorId}`, String(savedSafeZone.id));

      setSelectedSafeZoneIds((prev) => ({
        ...prev,
        [seniorId]: savedSafeZone.id,
      }));

      alert("안전 반경이 저장되었습니다.");
      return true;
    } catch (error) {
      console.error("안전 반경 저장 실패:", error);
      alert("안전 반경 저장에 실패했습니다.");
      return false;
    }
  };

  const handleDeleteSafeZone = async (safeZoneId) => {
    const seniorId = activeElderId;

    if (!seniorId || !safeZoneId) return;

    const currentZones = safeZoneForms[seniorId] ?? getDefaultSafeZones(selectedElder);

    if (currentZones.length <= 1) {
      alert("안전 반경은 최소 1개 이상 필요합니다.");
      return;
    }

    try {
      const idText = String(safeZoneId);
      const isSavedZone = /^\d+$/.test(idText);

      if (isSavedZone) {
        await deleteSafeZone(seniorId, safeZoneId);
      }

      const nextZones = currentZones.filter(
        (zone) => String(zone.id) !== idText
      );

      setSafeZoneForms((prev) => ({
        ...prev,
        [seniorId]: nextZones,
      }));

      setSelectedSafeZoneIds((prev) => ({
        ...prev,
        [seniorId]: nextZones[0]?.id,
      }));

      alert("안전 반경이 삭제되었습니다.");
    } catch (error) {
      console.error("안전 반경 삭제 실패:", error);
      alert("안전 반경 삭제에 실패했습니다.");
    }
  };

  const handleRefreshLocation = async () => {
    try {
      setIsRefreshingLocation(true);
      await reloadGuardianSeniors();
      setSelectedRouteDate(getDateValue());
      setIsRouteVisible(true);
      setMapFocusVersion((value) => value + 1);
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
      setSelectedElderId(seniorId);

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

      const connectedSenior = await createAndConnectSenior(guardianId, newSeniorForm);

      await reloadGuardianSeniors();
      if (connectedSenior?.seniorId) {
        setSelectedElderId(connectedSenior.seniorId);
      }

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
        prev.map((alert) => (String(alert.id) === String(alertId) ? updatedAlert : alert))
      );

      setInfoRequestAlert((currentAlert) =>
        String(currentAlert?.id) === String(alertId) ? null : currentAlert
      );
    } catch (error) {
      console.error("알림 확인 처리 실패:", error);
    }
  };

  const openInfoRequestForm = (alert) => {
    const targetElder = elders.find(
      (elder) => String(elder.id) === String(alert.seniorId)
    );

    if (!targetElder) {
      window.alert("정보를 입력할 보호 대상자를 찾을 수 없습니다.");
      return;
    }

    const requestedKeys = getInfoRequestFieldKeys(alert, targetElder);

    setSelectedElderId(targetElder.id);
    setEditingElder(targetElder);
    setInfoRequestFormAlert(alert);
    setInfoRequestFieldKeys(requestedKeys.length > 0 ? requestedKeys : ["gender"]);
    setInfoRequestForm((prev) => ({
      ...prev,
      ...buildInfoRequestForm(targetElder),
    }));
    setIsElderEditOpen(true);
    setInfoRequestAlert(null);
  };

  const handleInfoRequestFormChange = (key, value) => {
    setInfoRequestForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmitInfoRequestForm = async () => {
    if (!editingElder?.id) return;

    const payload = infoRequestFieldKeys.reduce((nextPayload, key) => {
      const value = String(infoRequestForm[key] ?? "").trim();

      if (value) {
        nextPayload[key] = value;
      }

      return nextPayload;
    }, {});

    if (Object.keys(payload).length === 0) {
      window.alert("입력할 정보를 작성해주세요.");
      return;
    }

    try {
      await updateSeniorRequestedInfo(editingElder.id, payload);

      if (infoRequestFormAlert?.id) {
        setDismissedInfoRequestIds((prev) => [
          ...new Set([...prev, String(infoRequestFormAlert.id)]),
        ]);
        await handleReadAlert(infoRequestFormAlert.id);
      }

      await reloadGuardianSeniors();

      setIsElderEditOpen(false);
      setEditingElder(null);
      setInfoRequestFormAlert(null);
      setInfoRequestFieldKeys([]);
      window.alert("보호 대상자 정보가 저장되었습니다.");
    } catch (error) {
      console.error("정보 입력 저장 실패:", error);
      window.alert("정보 저장에 실패했습니다.");
    }
  };

  const handleCallAlert = async (targetAlert) => {
    setCallingAlert(targetAlert);
    setIsCallResultOpen(true);
  };

  const handleCallResolved = async () => {
    const targetElder = callingAlert?.seniorId
      ? elders.find((elder) => String(elder.id) === String(callingAlert.seniorId))
      : selectedElder;
    const phone = targetElder?.phone;

    if (!phone) {
      window.alert("전화번호 정보가 없습니다.");
      return;
    }

    if (targetElder?.id) {
      const guardianId = getCurrentGuardianId();

      const created = await createCallRequestAlert({
        seniorId: targetElder.id,
        guardianId,
        message: `보호자가 ${targetElder.name}님에게 전화를 요청했습니다.`,
        latitude: targetElder.currentLocation?.lat,
        longitude: targetElder.currentLocation?.lng,
      }).catch(() => null);

      if (Array.isArray(created) && created[0]?.id) {
        knownAlertIdsRef.current.add(String(created[0].id));
      }
    }

    if (callingAlert?.id) {
      await handleReadAlert(callingAlert.id);
    }

    setCallingAlert(null);
    setIsCallResultOpen(false);
    window.location.href = `tel:${phone}`;
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
      ? elders.find((elder) => String(elder.id) === String(alert.seniorId)) ?? selectedElder
      : selectedElder;

    if (targetElder?.id) {
      setSelectedElderId(targetElder.id);
    }

    if (alert?.isFall) {
      setMissingDescription(
        `${targetElder?.name ?? selectedElder.name}님의 낙상 감지 후 보호자 확인 또는 대처가 없어 신고합니다. ${alert.message || ""}`
      );
    } else {
      setMissingDescription(
        `${targetElder?.name ?? selectedElder.name}의 SOS 요청 후 연락이 되지 않아 실종 신고합니다.`
      );
    }

    setReportingAlertId(alert?.id ?? null);
    setMissingFallbackImageUrl(alert?.imageUrl || "");
    setMissingImagePreview(alert?.imageUrl || "");
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

      let imageUrl = missingFallbackImageUrl;

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
      setMissingFallbackImageUrl("");
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

  const handleCheckInOk = async (targetAlert) => {
    if (!targetAlert?.seniorId) return;

    const guardianId = getCurrentGuardianId();
    const targetElder = elders.find((elder) => String(elder.id) === String(targetAlert.seniorId));
    const seniorName = targetAlert.seniorName || targetAlert.name || targetElder?.name || "사용자";
    const seniorDisplayName = seniorName.endsWith("님") ? seniorName : `${seniorName}님`;

    try {
      await sendCheckInReply({
        seniorId: targetAlert.seniorId,
        guardianId,
        reply: `${seniorDisplayName}께서 안부 확인 결과 이상 없습니다.`,
        originalMessage: targetAlert.message || targetAlert.detailMessage || "",
      });
    } catch (error) {
      console.error("이상 없음 알림 전송 실패:", error);
      window.alert("이상 없음 알림 전송에 실패했습니다.");
      return;
    }

    if (targetAlert.id) {
      await handleReadAlert(targetAlert.id);
    }

    window.alert("복지사에게 이상 없음 알림을 보냈습니다.");
  };

  const activeMedicines = getActiveMedicines(selectedElder);

  return (
    <main className="guardian-page">
      <GuardianHeader
        displayedAlerts={displayedAlerts}
        onReadAlert={handleReadAlert}
        onCallAlert={handleCallAlert}
        onOpenEmergencyReport={handleOpenEmergencyReport}
        onCheckInOk={handleCheckInOk}
        onOpenChat={() => {
          setChatInitialRoomType("");
          setIsChatOpen(true);
        }}
        onOpenWelfareChat={(alert) => {
          if (alert?.seniorId) {
            setSelectedElderId(alert.seniorId);
          }

          setChatInitialRoomType("GUARDIAN_WELFARE");
          setIsChatOpen(true);
        }}
        unreadChatCount={unreadChatCount}
      />

      <TripartiteChatModal
        isOpen={isChatOpen}
        seniorId={selectedElder?.id}
        seniorName={selectedElder?.name || "사용자"}
        rooms={[
          {
            roomType: "SENIOR_GUARDIAN",
            seniorId: selectedElder?.id,
            title: selectedElder?.name || "사용자",
            subtitle: "사용자와 1:1 대화",
          },
          {
            roomType: "GUARDIAN_WELFARE",
            seniorId: selectedElder?.id,
            title: "복지사",
            subtitle: `${selectedElder?.name || "사용자"}님 담당 복지사와 1:1 대화`,
          },
        ]}
        senderRole="GUARDIAN"
        senderId={guardian?.id || getCurrentGuardianId()}
        senderName={guardian?.name || "보호자"}
        initialRoomType={chatInitialRoomType}
        onReadChange={loadUnreadChatCount}
        onClose={() => {
          setIsChatOpen(false);
          setChatInitialRoomType("");
        }}
      />

      <nav className="elder-tabs" aria-label="보호 대상자 목록">
        {elders.map((elder) => {
          const elderStatus = getElderStatus(elder);
          const statusText =
            elderStatus === "normal" ? "정상" : elderStatus === "danger" ? "이탈" : "미수신";
          const isDeleteMode = deleteModeElderId === elder.id;
          const elderUnreadCount = unreadChatCountsByElder[elder.id] || 0;
          const elderAlertCount = unreadAlertsByElder[String(elder.id)] || 0;
          const hasNotification = elderUnreadCount > 0 || elderAlertCount > 0;

          return (
            <div
              key={elder.id}
              className={`elder-tab ${elder.id === selectedElderId ? "active" : ""} ${isDeleteMode ? "show-delete" : ""
                }`}
              onMouseEnter={() => setDeleteModeElderId(elder.id)}
              onMouseLeave={() => setDeleteModeElderId(null)}
            >
              {hasNotification && (
                <span
                  className="elder-tab-unread-dot"
                  aria-label={`${elder.name} 새 알림 또는 읽지 않은 메시지`}
                  title={[
                    elderAlertCount > 0 ? `알림 ${elderAlertCount}개` : "",
                    elderUnreadCount > 0 ? `채팅 ${elderUnreadCount}개` : "",
                  ].filter(Boolean).join(", ")}
                />
              )}
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
            setNewSeniorForm({
              name: "",
              phone: "",
              region: "",
              relation: "보호 대상자",
            });
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
          safeZones={safeZones}
          safeZoneForm={safeZoneForm}
          lastNormalLocation={lastNormalLocation}
          formatShortAddress={formatShortAddress}
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
          onSelectSafeZoneForm={handleSelectSafeZoneForm}
          onDeleteSafeZone={handleDeleteSafeZone}
          onCloseAddElder={() => setIsAddElderOpen(false)}
          onSearchSenior={handleSearchSenior}
          onConnectSenior={handleConnectSenior}
          onCreateAndConnectSenior={handleCreateAndConnectSenior}
          onDeleteElder={handleDeleteElder}
          onProfileUpdated={reloadGuardianSeniors}
          onOpenMedicineAlert={handleOpenMedicineAlert}
          activityReport={activityReport}
        />

        <LocationPanel
          selectedElder={selectedElder}
          safeZones={safeZones}
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
          mapFocusVersion={mapFocusVersion}
        />

        <EmergencyPanel
          selectedElder={selectedElder}
          displayedAlerts={displayedAlerts}
          policeAlerts={policeAlerts}
          routeHistory={routeHistory}
          selectedRouteDate={selectedRouteDate}
          safeZones={safeZones}
          safeZoneForm={safeZoneForm}
          onRouteDateChange={handleRouteDateChange}
          onSafeZoneChange={handleSafeZoneChange}
          onSaveSafeZone={handleSaveSafeZone}
          onAddSafeZoneForm={handleAddSafeZoneForm}
          distance={distance}
          lastNormalLocation={lastNormalLocation}
          isMissingReportOpen={isMissingReportOpen}
          missingDescription={missingDescription}
          setMissingDescription={setMissingDescription}
          missingImagePreview={missingImagePreview}
          isSubmittingMissingReport={isSubmittingMissingReport}
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
          onOpenChat={() => {
            setChatInitialRoomType("GUARDIAN_WELFARE");
            setIsChatOpen(true);
          }}
          onOpenUserChat={() => {
            setChatInitialRoomType("SENIOR_GUARDIAN");
            setIsChatOpen(true);
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
                placeholder="여기에 작성하세요"
                rows={4}
              />
            </label>

            <div className="medicine-alert-actions">
              <button
                type="button"
                className="medicine-alert-cancel"
                onClick={() => setMedicineMessage("")}
              >
                다시 쓰기
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

      {infoRequestAlert && (
        <div className="guardian-info-request-backdrop">
          <section className="guardian-info-request-modal">
            <h2>보호 대상자 정보 입력 요청</h2>
            <p>{infoRequestAlert.message || "보호 대상자의 미입력 정보를 입력해주세요."}</p>

            <div className="guardian-info-request-actions">
              <button
                type="button"
                onClick={() => {
                  setDismissedInfoRequestIds((prev) => [
                    ...prev,
                    String(infoRequestAlert.id),
                  ]);
                  setInfoRequestAlert(null);
                }}
              >
                나중에
              </button>

              <button
                type="button"
                onClick={() => openInfoRequestForm(infoRequestAlert)}
              >
                정보 입력하기
              </button>
            </div>
          </section>
        </div>
      )}

      {isElderEditOpen && editingElder && (
        <div className="guardian-info-form-backdrop">
          <section className="guardian-info-form-modal">
            <div className="guardian-info-form-header">
              <div>
                <h2>보호 대상자 정보 입력</h2>
                <p>{editingElder.name}님의 미입력 정보를 작성해주세요.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsElderEditOpen(false);
                  setEditingElder(null);
                  setInfoRequestFormAlert(null);
                  setInfoRequestFieldKeys([]);
                }}
              >
                닫기
              </button>
            </div>

            <div className="guardian-info-form-fields">
              {INFO_REQUEST_FIELDS
                .filter((field) => infoRequestFieldKeys.includes(field.key))
                .map((field) => (
                  <label key={field.key} className="guardian-info-form-field">
                    <span>{field.label}</span>

                    {field.type === "select" ? (
                      <select
                        value={infoRequestForm[field.key] || ""}
                        onChange={(event) =>
                          handleInfoRequestFormChange(field.key, event.target.value)
                        }
                      >
                        <option value="">선택해주세요</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={infoRequestForm[field.key] || ""}
                        placeholder={field.placeholder || ""}
                        onChange={(event) =>
                          handleInfoRequestFormChange(field.key, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
            </div>

            <div className="guardian-info-form-actions">
              <button
                type="button"
                className="guardian-info-form-cancel"
                onClick={() => {
                  setIsElderEditOpen(false);
                  setEditingElder(null);
                  setInfoRequestFormAlert(null);
                  setInfoRequestFieldKeys([]);
                }}
              >
                취소
              </button>

              <button
                type="button"
                className="guardian-info-form-submit"
                onClick={handleSubmitInfoRequestForm}
              >
                저장하기
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function GuardianHeader({
  displayedAlerts = [],
  onReadAlert,
  onCallAlert,
  onOpenEmergencyReport,
  onOpenChat,
  onOpenWelfareChat,
  onCheckInOk,
  unreadChatCount = 0,
}) {
  const isCheckInRequestAlert = (alert) => {
    const text = [
      alert?.type,
      alert?.title,
      alert?.message,
      alert?.detailMessage,
    ].filter(Boolean).join(" ");

    return (
      text.includes("CHECK_IN_REQUEST") ||
      text.includes("안부 확인 요청") ||
      text.includes("안부 확인 후")
    );
  };

  const formatSeniorDisplayName = (name) => {
    const value = String(name || "사용자").trim();
    return value.endsWith("님") ? value : `${value}님`;
  };

  const guardianNotifications = displayedAlerts
    .filter((alert) => alert.type !== "CHECK_IN_OK")
    // 안부 확인 요청 알림 중 이미 읽은 알림은 제외
    // .filter((alert) => !(isCheckInRequestAlert(alert) && alert.rawAlert?.isRead === true))
    .map((alert) => {
      const isCheckInRequest = isCheckInRequestAlert(alert);
      const seniorDisplayName = formatSeniorDisplayName(alert.seniorName || alert.name);

      return {
        id: alert.id,
        title: isCheckInRequest
          ? `${seniorDisplayName} 안부 확인 요청`
          : alert.isFall
            ? "낙상 감지 알림"
            : alert.message || `${seniorDisplayName} 알림`,
        message: isCheckInRequest
          ? `${seniorDisplayName}께서 4시간 이상 접속하지 않았습니다. 안부 확인 후 복지사에게 알려주세요.`
          : alert.isFall
            ? [alert.message, alert.detailMessage].filter(Boolean).join(" ")
            : alert.detailMessage || "",
        category: alert.isFall ? "낙상" : alert.isSos ? "긴급" : alert.isSafeZone ? "긴급" : "정보",
        time: alert.time,
        isRead: alert.status !== "미확인",
        danger: alert.isSos || alert.isSafeZone || alert.isFall,
        raw: alert,
      };
    });

    const renderGuardianNotificationActions = (alert, { defaultAction, onRead, isRead }) => {
    if (isCheckInRequestAlert(alert)) {
      if (isRead) return null;
      return (
        <div className="guardian-alert-actions-below two">
          <button
            type="button"
            className="guardian-alert-secondary-action"
            onClick={(event) => {
              event.stopPropagation();
              onCheckInOk?.(alert);
            }}
          >
            이상 없음
          </button>
          <button
            type="button"
            className="guardian-alert-primary-action"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWelfareChat?.(alert);
            }}
          >
            복지사 채팅
          </button>
        </div>
      );
    }

    if (!alert?.isFall && !alert?.isSos && !alert?.isSafeZone) {
      return defaultAction;
    }

    if (isRead) return null;

    return (
      <div className="guardian-alert-actions-below">
        <button
          type="button"
          className="guardian-alert-primary-action"
          onClick={(event) => {
            event.stopPropagation();
            onCallAlert?.(alert);
          }}
        >
          전화
        </button>
      </div>
    );
  };

  return (
    <CommonHeader
      homePath="/guardian"
      showNotificationButton
      notifications={guardianNotifications}
      notificationTabs={["전체", "읽지 않음", "긴급", "정보", "낙상"]}
      onReadNotification={(alert) => {
        if (alert?.id) {
          onReadAlert?.(alert.id);
        }
      }}
      renderNotificationActions={renderGuardianNotificationActions}
      actions={
        <button className="common-app-icon-button" type="button" onClick={onOpenChat} aria-label="메시지">
          <MessageCircle size={19} />
          {unreadChatCount > 0 && <span className="common-app-badge">{unreadChatCount}</span>}
        </button>
      }
      afterActions={
        <button className="common-app-danger-button" type="button" onClick={() => onOpenEmergencyReport?.()}>
          긴급 신고
        </button>
      }
    />
  );
}

export default GuardianPage;
