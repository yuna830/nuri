import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { RefreshCw, MapPin, Clock, Shield } from "lucide-react";
import "leaflet/dist/leaflet.css";

import {
  SAFE_RADIUS,
  customLocationIcon,
  getAddress,
  getNow,
  loadLocationHistory,
  saveLocationHistory,
} from "../../utils/user/locationPageUtils";
import "../../css/user/LocationPage.css";

export default function LocationPage() {
  const navigate = useNavigate();
  const [currentPos, setCurrentPos] = useState(null);
  const [address, setAddress] = useState("불러오는 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInRange] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("--:--");
  const [coords, setCoords] = useState(null);
  const [history, setHistory] = useState(loadLocationHistory);
  const lastAddressRef = useRef("");

  const updateLocation = useCallback(async (lat, lon) => {
    setCurrentPos([lat, lon]);
    setCoords({ lat: lat.toFixed(5), lon: lon.toFixed(5) });
    setLastUpdate(getNow());

    const nextAddress = await getAddress(lat, lon);
    setAddress(nextAddress);

    if (nextAddress !== lastAddressRef.current) {
      lastAddressRef.current = nextAddress;
      const timeStr = getNow();

      setHistory((prev) => {
        const updated = [{ time: timeStr, place: nextAddress }, ...prev].slice(0, 20);
        saveLocationHistory(updated);
        return updated;
      });
    }

    setLoading(false);
  }, []);

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
      () => {
        setError("위치 권한을 허용해주세요.");
        setLoading(false);
      }
    );
  }, [updateLocation]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    const timerId = setInterval(getLocation, 30000);
    return () => clearInterval(timerId);
  }, [getLocation]);

  const clearHistory = () => {
    localStorage.removeItem("location_history");
    setHistory([]);
  };

  return (
    <div className="lp-root">
      <nav className="lp-nav">
        <button className="lp-nav-back" type="button" onClick={() => navigate("/user")}>
          ← 돌아가기
        </button>

        <div className="lp-nav-title">📍 내 위치</div>

        <div className="lp-nav-right">
          <button className="lp-refresh-btn" type="button" onClick={getLocation}>
            <RefreshCw size={13} /> 새로고침
          </button>
        </div>
      </nav>

      <div className="lp-layout">
        <div className="lp-map-section">
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
                {isInRange ? "✅ 안전 반경 내" : "🚨 반경 이탈"}
              </div>
            </div>
          </div>

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

            {!loading && !error && currentPos && (
              <MapContainer center={currentPos} zoom={15} className="lp-map">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />

                <Circle
                  center={currentPos}
                  radius={SAFE_RADIUS}
                  pathOptions={{
                    color: "#86A788",
                    fillColor: "#86A788",
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: "6 4",
                  }}
                />

                <Marker position={currentPos} icon={customLocationIcon}>
                  <Popup>
                    <div className="lp-popup">
                      <strong>현재 위치</strong>
                      <br />
                      {address}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            )}
          </div>
        </div>

        <aside className="lp-sidebar">
          <div className="lp-info-card">
            <div className="lp-card-title">
              <span>📡 위치 정보</span>
            </div>

            <div className="lp-info-row">
              <div className="lp-info-key">
                <Clock size={13} /> 마지막 갱신
              </div>
              <div className="lp-info-val">{lastUpdate}</div>
            </div>

            <div className="lp-info-row">
              <div className="lp-info-key">
                <MapPin size={13} /> 현재 주소
              </div>
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
              <div className="lp-info-key">
                <Shield size={13} /> 안전 상태
              </div>
              <div className={`lp-info-val ${isInRange ? "green" : "red"}`}>
                {isInRange ? "반경 내 안전" : "반경 이탈"}
              </div>
            </div>
          </div>

          <div className="lp-range-card">
            <div className="lp-card-title">
              <span>🛡 안전 반경 설정</span>
            </div>

            <div className="lp-range-main">
              <div>
                <div className="lp-range-val">{SAFE_RADIUS}</div>
                <div className="lp-range-unit">미터 (m)</div>
              </div>

              <div className={`lp-range-badge ${isInRange ? "safe" : "out"}`}>
                {isInRange ? "✅ 반경 내" : "🚨 이탈"}
              </div>
            </div>

            <div className="lp-range-desc">
              보호자가 설정한 안전 반경입니다. 이 범위를 벗어나면 보호자에게 즉시 알림이 전송됩니다.
            </div>
          </div>

          <div className="lp-history-card">
            <div className="lp-card-title">
              <span>🗺 이동 이력</span>
              <button className="lp-clear-btn" type="button" onClick={clearHistory}>
                초기화
              </button>
            </div>

            <div className="lp-history-list">
              {history.length === 0 ? (
                <div className="lp-history-empty">이동 이력이 없습니다</div>
              ) : (
                history.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="lp-history-row">
                    <div className="lp-history-time">{item.time}</div>
                    <div className="lp-history-dot" />
                    <div className="lp-history-place">{item.place}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
