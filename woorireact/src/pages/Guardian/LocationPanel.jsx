import { useEffect } from "react";
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
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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

          <button className="subtle-button" type="button">
            전체화면
          </button>
        </div>
      </div>

      <div className="real-map-area">
        <MapContainer center={mapCenter} zoom={16} scrollWheelZoom className="leaflet-map">
          <RecenterMap center={mapCenter} />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Circle
            center={[safeZoneForm.centerLatitude, safeZoneForm.centerLongitude]}
            radius={safeZoneForm.radiusMeters}
            pathOptions={{
              color: "#4F6F52",
              fillColor: "#86A788",
              fillOpacity: 0.15,
            }}
          />

          <Marker position={[safeZoneForm.centerLatitude, safeZoneForm.centerLongitude]}>
            <Popup>{safeZoneForm.name} 안전 반경 중심</Popup>
          </Marker>

          {hasCurrentLocation && (
            <Marker position={[location.lat, location.lng]}>
              <Popup>
                {selectedElder.name} 현재 위치
                <br />
                {distance}m 거리
              </Popup>
            </Marker>
          )}

          {isRouteVisible && hasCurrentLocation && (
            <Polyline
              positions={
                routeHistory.length > 1
                  ? routeHistory.map((point) => [point.lat, point.lng])
                  : [
                      [safeZoneForm.centerLatitude, safeZoneForm.centerLongitude],
                      [location.lat, location.lng],
                    ]
              }
              pathOptions={{ color: "#C93A32", weight: 4 }}
            />
          )}
        </MapContainer>
      </div>
    </section>
  );
}

export default LocationPanel;
