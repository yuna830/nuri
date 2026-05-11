import { RefreshCw } from "lucide-react";
import KakaoMap from "../../components/KakaoMap.jsx";

function LocationPanel({
  selectedElder,
  safeZoneForm,
  hasCurrentLocation,
  location,
  routeHistory,
  mapCenter,
  distance,
  isRouteVisible,
  isRefreshingLocation,
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

  return (
    <section className="card map-card">
      <div className="card-header">
        <h2>실시간 위치</h2>

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
          currentLocation={hasCurrentLocation ? location : null}
          currentLabel={`${selectedElder.name} 현재 위치<br />${distance}m 거리`}
          safeZoneLabel={`${safeZoneForm.name} 안전 반경 중심`}
          route={route}
          showRoute={isRouteVisible && hasCurrentLocation}
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
    </section>
  );
}

export default LocationPanel;
