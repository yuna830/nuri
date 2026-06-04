import { RefreshCw } from "lucide-react";
import KakaoMap from "../../components/KakaoMap.jsx";

function LocationPanel({
  selectedElder,
  safeZones = [],
  safeZoneForm,
  hasCurrentLocation,
  location,
  routeHistory,
  mapCenter,
  distance,
  isRouteVisible,
  isRefreshingLocation,
  formatShortAddress,
  onRefreshLocation,
}) {
  const center = { lat: mapCenter[0], lng: mapCenter[1] };
  const route = routeHistory.length > 1
    ? routeHistory
    : hasCurrentLocation
      ? [
          { lat: safeZoneForm.centerLatitude, lng: safeZoneForm.centerLongitude },
          { lat: location.lat, lng: location.lng },
        ]
      : [];

  const formatReceivedAgo = (receivedAt) => {
    if (!receivedAt) return "수신 기록 없음";

    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 1000));

    if (diffSeconds < 60) {
      return `${diffSeconds}초 전`;
    }

    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}시간 전`;
  };

  const formatLocationMeta = (location) => {
    if (!location?.receivedAt) {
      return "위치 수신 대기 중 · 휴대폰 GPS";
    }
    
    // 실제 위치가 현재 좌표를 중심으로 대략 반경 안에 있을 가능성
    const accuracyText = location.accuracy != null
      ? `정확도 ±${Math.round(location.accuracy)}m`
      : "정확도 확인 중";

    return `마지막 수신 ${formatReceivedAgo(location.receivedAt)} · ${accuracyText} · 휴대폰 GPS`;
  };    

  const currentLocationText = hasCurrentLocation
    ? formatShortAddress(location.address)
    : "위치 미수신";

  return (
    <section className="card map-card">
      <div className="card-header">
        <div className="map-title-group">
          <h2>실시간 위치</h2>
          <span className="map-current-address">
            현재 위치 · {currentLocationText}
          </span>
        </div>

        <div className="map-actions">
          <button
            className={`map-icon-button ${isRefreshingLocation ? "spinning" : ""}`}
            type="button"
            aria-label="위치 새로고침"
            onClick={onRefreshLocation}
            disabled={isRefreshingLocation}
          >
            <RefreshCw size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="real-map-area">
        <KakaoMap
          center={center}
          zoom={4}
          className="leaflet-map"
          safeZone={safeZoneForm}
          safeZones={safeZones}
          currentLocation={hasCurrentLocation ? location : null}
          currentLabel={`${selectedElder.name} 현재 위치<br />${distance}m 거리`}
          safeZoneLabel={`${safeZoneForm.name} 안전 반경 중심`}
          route={route}
          showRoute={isRouteVisible && hasCurrentLocation}
          autoFit={false}
          focusLocation={hasCurrentLocation ? location : center}
          focusKey={`elder-${selectedElder.id}`}
          focusLevel={4}
          fallback={(
            <div className="leaflet-map" style={{
              display: "grid",
              placeItems: "center",
              background: "#eef6ef",
              color: "#5f7d61",
              fontWeight: 700,
            }}>
              카카오맵 JavaScript 키를 확인해 주세요.
            </div>
          )}
        />
      </div>

      <div className="map-location-meta">
        {formatLocationMeta(hasCurrentLocation ? location : null)}
      </div>
    </section>
  );
}

export default LocationPanel;
