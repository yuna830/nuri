import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, MapPin, Clock, Shield } from "lucide-react";
import "leaflet/dist/leaflet.css";
import KakaoMap from "../../components/KakaoMap.jsx";
import { UserCommonHeader, UserSubHeader } from "../../components/UserCommonHeader.jsx";

import {
  SAFE_RADIUS,
  getAddress,
  getNow,
} from "../../utils/user/locationPageUtils";
import { getDistanceMeters } from "../../utils/guardian/location";
import { createSafeZoneAlert } from "../../api/userPageApi.js";
import "../../css/user/LocationPage.css";

const DEFAULT_SAFE_ZONE = {
  name: "자택",
  address: "안전 반경 주소 미설정",
  centerLatitude: 37.4979,
  centerLongitude: 127.0276,
  radiusMeters: SAFE_RADIUS,
};

const getCurrentSeniorId = () => {
  try {
    const savedSenior = sessionStorage.getItem("currentSenior");
    return savedSenior ? JSON.parse(savedSenior)?.senior?.id ?? null : null;
  } catch {
    return null;
  }
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const toHistoryItem = (item) => ({
  time: item.receivedAt ? item.receivedAt.slice(11, 16) : "--:--",
  place: item.address || "현재 위치",
});

const SAFE_ZONE_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

const shouldSendSafeZoneAlert = (seniorId, safeZone, lat, lon) => {
  if (!seniorId || !safeZone) return false;

  const roundedLat = Math.round(lat * 1000);
  const roundedLon = Math.round(lon * 1000);
  const key = `safe-zone-alert:${seniorId}:${safeZone.radiusMeters}:${roundedLat}:${roundedLon}`;
  const lastSentAt = Number(localStorage.getItem(key) || 0);

  if (Date.now() - lastSentAt < SAFE_ZONE_ALERT_COOLDOWN_MS) {
    return false;
  }

  localStorage.setItem(key, String(Date.now()));
  return true;
};

export default function LocationPage() {
  const navigate = useNavigate();
  const [currentPos, setCurrentPos] = useState(null);
  const [safeZone, setSafeZone] = useState(DEFAULT_SAFE_ZONE);
  const [address, setAddress] = useState("불러오는 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState("--:--");
  const [coords, setCoords] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [historyByDate, setHistoryByDate] = useState({});

  const isInRange = currentPos
    ? getDistanceMeters(
        { lat: safeZone.centerLatitude, lng: safeZone.centerLongitude },
        { lat: currentPos[0], lng: currentPos[1] }
      ) <= safeZone.radiusMeters
    : true;

  const distance = currentPos
    ? Math.round(getDistanceMeters(
        { lat: safeZone.centerLatitude, lng: safeZone.centerLongitude },
        { lat: currentPos[0], lng: currentPos[1] }
      ))
    : 0;

  const saveCurrentLocation = async ({ lat, lon, nextAddress }) => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    await fetch("http://localhost:8080/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seniorId, latitude: lat, longitude: lon, address: nextAddress }),
    }).catch(() => {});
  };

  const loadLocationHistory = useCallback(async (date) => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    try {
      const response = await fetch(`http://localhost:8080/api/locations/senior/${seniorId}/date?date=${date}`);
      const data = response.ok ? await response.json() : [];
      const list = Array.isArray(data) ? data : [];
      setHistoryByDate(prev => ({
        ...prev,
        [date]: list.map(toHistoryItem).reverse(),
      }));
    } catch {
      setHistoryByDate(prev => ({ ...prev, [date]: [] }));
    }
  }, []);

  const loadSafeZone = useCallback(async () => {
    const seniorId = getCurrentSeniorId();
    if (!seniorId) return;
    try {
      const response = await fetch(`http://localhost:8080/api/safe-zones/senior/${seniorId}`);
      if (!response.ok || response.status === 204) return;
      const nextSafeZone = await response.json();
      setSafeZone({
        name: nextSafeZone.name || "자택",
        address: nextSafeZone.address || "안전 반경 주소 미설정",
        centerLatitude: nextSafeZone.centerLatitude ?? DEFAULT_SAFE_ZONE.centerLatitude,
        centerLongitude: nextSafeZone.centerLongitude ?? DEFAULT_SAFE_ZONE.centerLongitude,
        radiusMeters: nextSafeZone.radiusMeters ?? SAFE_RADIUS,
      });
    } catch (e) {
      console.error("안전 반경 조회 실패:", e);
    }
  }, []);

  const updateLocation = useCallback(async (lat, lon) => {
    setCurrentPos([lat, lon]);
    setCoords({ lat: lat.toFixed(5), lon: lon.toFixed(5) });
    setLastUpdate(getNow());

    const nextAddress = await getAddress(lat, lon);
    setAddress(nextAddress);

    try {
      await saveCurrentLocation({ lat, lon, nextAddress });
      await loadLocationHistory(todayStr());
    } catch {}

    const seniorId = getCurrentSeniorId();
    const currentDistance = Math.round(getDistanceMeters(
      { lat: safeZone.centerLatitude, lng: safeZone.centerLongitude },
      { lat, lng: lon }
    ));

    if (
      currentDistance > safeZone.radiusMeters &&
      shouldSendSafeZoneAlert(seniorId, safeZone, lat, lon)
    ) {
      createSafeZoneAlert({
        seniorId,
        latitude: lat,
        longitude: lon,
        address: nextAddress,
      }).catch(() => {});
    }

    setLoading(false);
  }, [loadLocationHistory, safeZone]);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("위치 서비스를 지원하지 않는 브라우저예요.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => updateLocation(position.coords.latitude, position.coords.longitude),
      () => { setError("위치 권한을 허용해주세요."); setLoading(false); }
    );
  }, [updateLocation]);

  useEffect(() => { loadSafeZone(); }, [loadSafeZone]);
  useEffect(() => { getLocation(); }, [getLocation]);
  useEffect(() => { loadLocationHistory(selectedDate); }, [loadLocationHistory, selectedDate]);
  useEffect(() => {
    const timerId = setInterval(getLocation, 30000);
    return () => clearInterval(timerId);
  }, [getLocation]);

  const currentHistory = historyByDate[selectedDate] || [];
  const mapCenter = currentPos
    ? { lat: currentPos[0], lng: currentPos[1] }
    : { lat: safeZone.centerLatitude, lng: safeZone.centerLongitude };
  const currentLocationMarker = currentPos
    ? { lat: currentPos[0], lng: currentPos[1] }
    : null;
  const routeToCurrentLocation = currentPos
    ? [
        { lat: safeZone.centerLatitude, lng: safeZone.centerLongitude },
        { lat: currentPos[0], lng: currentPos[1] },
      ]
    : [];

  return (
    <div className="lp-root">
      <UserCommonHeader />
      <UserSubHeader
        maxWidth={1280}
        title="📍 내 위치"
        onBack={() => navigate("/user")}
        right={(
          <button className="lp-refresh-btn" type="button" onClick={getLocation}>
            <RefreshCw size={13} /> 새로고침
          </button>
        )}
      />

      <div className="lp-layout">
        <div className="lp-map-section">
          {/* 상태 카드 */}
          <div className="lp-status-card">
            <div className="lp-status-left">
              <div className="lp-status-dot-wrap">
                <div className={`lp-status-dot ${isInRange ? "" : "danger"}`}>
                  <MapPin size={16} color={isInRange ? "#86A788" : "#e05252"} />
                </div>
                <div className={`lp-pulse ${isInRange ? "" : "danger"}`} />
              </div>
              <div className="lp-status-info">
                <div className="lp-status-label">마지막 업데이트 {lastUpdate}</div>
                <div className="lp-status-addr">
                  {loading ? "위치 불러오는 중..." : error ? "위치를 불러올 수 없습니다" : address}
                </div>
              </div>
            </div>
            <div className="lp-status-right">
              <div className={`lp-range-badge ${isInRange ? "safe" : "out"}`}>
                {isInRange ? "안전 반경 내" : "반경 이탈"}
              </div>
            </div>
          </div>

          {/* 지도 */}
          <div className="lp-map-wrap">
            {loading && (
              <div className="lp-map-placeholder">
                <div className="lp-map-placeholder-icon">📍</div>
                <div className="lp-map-placeholder-text">위치 불러오는 중...</div>
              </div>
            )}
            {error && (
              <div className="lp-map-placeholder">
                <div className="lp-map-placeholder-icon">⚠️</div>
                <div className="lp-map-placeholder-text danger">{error}</div>
              </div>
            )}
            {!loading && (
              <KakaoMap
                center={mapCenter}
                zoom={4}
                className="lp-map"
                style={{ zIndex: 0 }}
                safeZone={safeZone}
                currentLocation={currentLocationMarker}
                currentLabel={currentPos ? `현재 위치<br />${address}<br />안전 반경까지 ${distance}m` : "현재 위치"}
                safeZoneLabel={`${safeZone.name} 안전 반경 중심`}
                route={routeToCurrentLocation}
                showRoute={currentPos !== null}
                fallback={
                  <div className="lp-map-placeholder">
                    <div className="lp-map-placeholder-icon">🗺️</div>
                    <div className="lp-map-placeholder-text">
                      카카오맵을 불러오지 못했습니다. JavaScript 키와 Web 플랫폼 도메인을 확인해주세요.
                    </div>
                  </div>
                }
              />
            )}
          </div>

          {/* 거리 카드 */}
          {currentPos && (
            <div style={{
              background: isInRange ? "#eef6ef" : "#fdf0f0",
              border: `1px solid ${isInRange ? "#b8d4ba" : "#f5c6c6"}`,
              borderRadius: "12px",
              padding: "0.8rem 1.2rem",
              marginTop: "0.8rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ fontSize: "0.85rem", color: "#7a9a7c" }}>
                🏠 {safeZone.name}까지 거리
              </div>
              <div style={{
                fontSize: "1.1rem", fontWeight: "700",
                color: isInRange ? "#5f7d61" : "#e05252",
              }}>
                {distance}m
                <span style={{ fontSize: "0.75rem", fontWeight: "400", marginLeft: "0.4rem" }}>
                  {isInRange
                    ? `(반경 ${safeZone.radiusMeters}m 내)`
                    : `(반경 ${safeZone.radiusMeters}m 초과)`}
                </span>
              </div>
            </div>
          )}

          <div className="lp-history-card lp-history-card-wide">
            <div className="lp-card-title">
              <span>이동 이력</span>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d4e8d6",
                  borderRadius: "8px",
                  padding: "0.4rem 0.7rem",
                  fontSize: "0.82rem",
                  fontFamily: "Noto Sans KR, sans-serif",
                  color: "#1e2a1f",
                  background: "#fff",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>

            <div className="lp-history-list">
              {currentHistory.length === 0 ? (
                <div className="lp-history-empty">
                  {selectedDate === todayStr()
                    ? "오늘 이동 이력이 없습니다"
                    : "해당 날짜 이동 이력이 없습니다"}
                </div>
              ) : (
                currentHistory.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="lp-history-row">
                    <div className="lp-history-time">{item.time}</div>
                    <div className="lp-history-dot" />
                    <div className="lp-history-place">{item.place}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="lp-sidebar">
          {/* 위치 정보 */}
          <div className="lp-info-card">
            <div className="lp-card-title"><span>위치 정보</span></div>
            <div className="lp-info-row">
              <div className="lp-info-key"><Clock size={13} /> 마지막 갱신</div>
              <div className="lp-info-val">{lastUpdate}</div>
            </div>
            <div className="lp-info-row">
              <div className="lp-info-key"><MapPin size={13} /> 현재 주소</div>
              <div className="lp-info-val lp-address-val">
                {loading ? "불러오는 중..." : error ? "오류" : address}
              </div>
            </div>
            {coords && (
              <>
                <div className="lp-info-row">
                  <div className="lp-info-key">위도</div>
                  <div className="lp-info-val">{coords.lat}</div>
                </div>
                <div className="lp-info-row">
                  <div className="lp-info-key">경도</div>
                  <div className="lp-info-val">{coords.lon}</div>
                </div>
              </>
            )}
            <div className="lp-info-row">
              <div className="lp-info-key"><Shield size={13} /> 안전 상태</div>
              <div className={`lp-info-val ${isInRange ? "green" : "red"}`}>
                {isInRange ? "반경 내 안전" : "반경 이탈"}
              </div>
            </div>
          </div>

          {/* 안전 반경 */}
          <div className="lp-range-card">
            <div className="lp-card-title"><span>안전 반경 설정</span></div>
            <div className="lp-safe-zone-place">
              <strong>{safeZone.name}</strong>
              <span>{safeZone.address}</span>
            </div>
            <div className="lp-range-main">
              <div>
                <div className="lp-range-val">{safeZone.radiusMeters}</div>
                <div className="lp-range-unit">미터 (m)</div>
              </div>
              <div className={`lp-range-badge ${isInRange ? "safe" : "out"}`}>
                {isInRange ? "반경 내" : "이탈"}
              </div>
            </div>
            <div className="lp-range-desc">
              보호자가 설정한 안전 반경입니다. 이 범위를 벗어나면 보호자에게 즉시 알림이 전송됩니다.
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
