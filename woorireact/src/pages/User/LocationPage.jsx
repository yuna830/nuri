import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { RefreshCw, MapPin, Clock, Shield } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const customIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 36px; height: 36px;
      background: #86A788;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 12px; height: 12px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      "></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const C = {
  cream: "#FFFDEC",
  green: "#86A788",
  greenDark: "#5f7d61",
  greenLight: "#b8d4ba",
  greenPale: "#eef6ef",
  white: "#ffffff",
  danger: "#e05252",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

const SAFE_RADIUS = 500;

const getNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const getAddress = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    );
    const data = await res.json();
    const addr = data.address;
    const parts = [
      addr.city || addr.province || addr.state,
      addr.city_district || addr.suburb || addr.borough,
      addr.road || addr.neighbourhood,
    ].filter(Boolean);
    return parts.join(" ") || data.display_name;
  } catch {
    return "주소 불러오기 실패";
  }
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .lp-root {
    background: ${C.cream};
    min-height: 100vh;
    font-family: 'Noto Sans KR', sans-serif;
    color: ${C.text};
  }

  /* 네비바 */
  .lp-nav {
    background: ${C.white};
    border-bottom: 1px solid ${C.border};
    padding: 0 2rem;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .lp-nav-back {
    background: transparent;
    border: 1px solid ${C.border};
    border-radius: 8px;
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    color: ${C.textMuted};
    cursor: pointer;
    font-family: 'Noto Sans KR', sans-serif;
    transition: all 0.13s;
  }
  .lp-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .lp-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .lp-nav-right { display: flex; align-items: center; gap: 0.7rem; }
  .lp-refresh-btn {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 8px;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: ${C.greenDark};
    font-family: 'Noto Sans KR', sans-serif;
    font-weight: 500;
    transition: all 0.13s;
  }
  .lp-refresh-btn:hover { background: ${C.greenLight}; }

  /* 레이아웃 */
  .lp-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1.5rem;
    align-items: start;
  }

  /* 왼쪽 지도 섹션 */
  .lp-map-section {}

  /* 현재 위치 상태 카드 */
  .lp-status-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.3rem 1.6rem;
    margin-bottom: 1rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .lp-status-left { display: flex; align-items: center; gap: 0.9rem; flex: 1; min-width: 0; }
  .lp-status-dot-wrap {
    position: relative;
    width: 40px; height: 40px;
    flex-shrink: 0;
  }
  .lp-status-dot {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: ${C.greenPale};
    border: 2px solid ${C.greenLight};
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem;
  }
  .lp-status-dot.danger {
    background: #fdf0f0;
    border-color: #f5c6c6;
  }
  .lp-pulse {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 50%;
    border: 2px solid ${C.green};
    animation: pulse 2s ease-out infinite;
  }
  .lp-pulse.danger { border-color: ${C.danger}; }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  .lp-status-info {}
  .lp-status-label { font-size: 0.75rem; color: ${C.textMuted}; margin-bottom: 0.2rem; }
  .lp-status-addr {
    font-size: 0.95rem;
    font-weight: 700;
    color: ${C.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 360px;
  }
  .lp-status-right { display: flex; align-items: center; gap: 0.7rem; flex-shrink: 0; }
  .lp-range-badge {
    padding: 0.35rem 1rem;
    border-radius: 99px;
    font-size: 0.82rem;
    font-weight: 700;
  }
  .lp-range-badge.safe { background: ${C.green}; color: #fff; }
  .lp-range-badge.out { background: ${C.danger}; color: #fff; }

  /* 지도 */
  .lp-map-wrap {
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 16px rgba(134,167,136,0.1);
    height: 500px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${C.white};
  }
  .lp-map-placeholder {
    text-align: center;
    color: ${C.textMuted};
    padding: 2rem;
  }
  .lp-map-placeholder-icon { font-size: 2.5rem; margin-bottom: 0.7rem; }
  .lp-map-placeholder-text { font-size: 0.95rem; }

  /* 오른쪽 사이드바 */
  .lp-sidebar {}

  /* 정보 카드 */
  .lp-info-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
  }
  .lp-card-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 1rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .lp-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0;
    border-bottom: 1px solid ${C.border};
  }
  .lp-info-row:last-child { border-bottom: none; }
  .lp-info-key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    color: ${C.textMuted};
  }
  .lp-info-val { font-size: 0.88rem; font-weight: 700; color: ${C.text}; }
  .lp-info-val.green { color: ${C.green}; }
  .lp-info-val.red { color: ${C.danger}; }

  /* 안전 반경 카드 */
  .lp-range-card {
    background: ${C.greenPale};
    border: 1px solid ${C.greenLight};
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    margin-bottom: 1rem;
  }
  .lp-range-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.6rem;
  }
  .lp-range-val { font-size: 2.2rem; font-weight: 700; color: ${C.green}; line-height: 1; }
  .lp-range-unit { font-size: 0.82rem; color: ${C.textMuted}; margin-top: 0.2rem; }
  .lp-range-desc { font-size: 0.78rem; color: ${C.textMuted}; margin-top: 0.8rem; line-height: 1.5; }

  /* 이동 이력 */
  .lp-history-card {
    background: ${C.white};
    border-radius: 18px;
    padding: 1.4rem 1.5rem;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(134,167,136,0.08);
  }
  .lp-clear-btn {
    background: transparent;
    border: 1px solid ${C.border};
    border-radius: 6px;
    padding: 0.15rem 0.55rem;
    font-size: 0.72rem;
    color: ${C.textMuted};
    cursor: pointer;
    font-family: 'Noto Sans KR', sans-serif;
    transition: all 0.12s;
  }
  .lp-clear-btn:hover { border-color: ${C.danger}; color: ${C.danger}; }
  .lp-history-list { max-height: 280px; overflow-y: auto; }
  .lp-history-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid ${C.border};
  }
  .lp-history-row:last-child { border-bottom: none; }
  .lp-history-time {
    font-size: 0.75rem;
    font-weight: 700;
    color: ${C.greenDark};
    min-width: 44px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .lp-history-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${C.green};
    flex-shrink: 0;
    margin-top: 5px;
  }
  .lp-history-place { font-size: 0.85rem; color: ${C.text}; line-height: 1.45; }
  .lp-history-empty {
    text-align: center;
    padding: 1.8rem;
    color: ${C.textMuted};
    font-size: 0.85rem;
  }
`;

export default function LocationPage() {
  const navigate = useNavigate();
  const [currentPos, setCurrentPos] = useState(null);
  const [address, setAddress] = useState("불러오는 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInRange, setIsInRange] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("--:--");
  const [coords, setCoords] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("location_history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const lastAddressRef = useRef("");

  const updateLocation = async (lat, lon) => {
    setCurrentPos([lat, lon]);
    setCoords({ lat: lat.toFixed(5), lon: lon.toFixed(5) });
    setLastUpdate(getNow());

    const addr = await getAddress(lat, lon);
    setAddress(addr);

    if (addr !== lastAddressRef.current) {
      lastAddressRef.current = addr;
      const timeStr = getNow();
      setHistory(prev => {
        const updated = [{ time: timeStr, place: addr }, ...prev].slice(0, 20);
        localStorage.setItem("location_history", JSON.stringify(updated));
        return updated;
      });
    }
    setLoading(false);
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError("위치 서비스를 지원하지 않는 브라우저예요.");
      setLoading(false);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => updateLocation(pos.coords.latitude, pos.coords.longitude),
      () => { setError("위치 권한을 허용해주세요."); setLoading(false); }
    );
  };

  useEffect(() => { getLocation(); }, []);
  useEffect(() => {
    const t = setInterval(getLocation, 30000);
    return () => clearInterval(t);
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("location_history");
    setHistory([]);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="lp-root">

        {/* 네비바 */}
        <nav className="lp-nav">
          <button className="lp-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="lp-nav-title">📍 내 위치</div>
          <div className="lp-nav-right">
            <button className="lp-refresh-btn" onClick={getLocation}>
              <RefreshCw size={13} /> 새로고침
            </button>
          </div>
        </nav>

        <div className="lp-layout">

          {/* 왼쪽 지도 */}
          <div className="lp-map-section">

            {/* 현재 위치 상태 */}
            <div className="lp-status-card">
              <div className="lp-status-left">
                <div className="lp-status-dot-wrap">
                  <div className={`lp-status-dot ${isInRange ? "" : "danger"}`}>
                    <MapPin size={16} color={isInRange ? C.green : C.danger} />
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
                  <div className="lp-map-placeholder-text" style={{ color: C.danger }}>{error}</div>
                </div>
              )}
              {!loading && !error && currentPos && (
                <MapContainer
                  center={currentPos}
                  zoom={15}
                  style={{ width: "100%", height: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Circle
                    center={currentPos}
                    radius={SAFE_RADIUS}
                    pathOptions={{
                      color: C.green,
                      fillColor: C.green,
                      fillOpacity: 0.08,
                      weight: 2,
                      dashArray: "6 4",
                    }}
                  />
                  <Marker position={currentPos} icon={customIcon}>
                    <Popup>
                      <div style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "0.85rem" }}>
                        <strong>현재 위치</strong><br />{address}
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              )}
            </div>
          </div>

          {/* 오른쪽 사이드바 */}
          <aside className="lp-sidebar">

            {/* 위치 정보 */}
            <div className="lp-info-card">
              <div className="lp-card-title">
                <span>📡 위치 정보</span>
              </div>
              <div className="lp-info-row">
                <div className="lp-info-key"><Clock size={13} /> 마지막 갱신</div>
                <div className="lp-info-val">{lastUpdate}</div>
              </div>
              <div className="lp-info-row">
                <div className="lp-info-key"><MapPin size={13} /> 현재 주소</div>
                <div className="lp-info-val" style={{ maxWidth: "160px", textAlign: "right", fontSize: "0.8rem" }}>
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

            {/* 이동 이력 */}
            <div className="lp-history-card">
              <div className="lp-card-title">
                <span>🗺 이동 이력</span>
                <button className="lp-clear-btn" onClick={clearHistory}>초기화</button>
              </div>
              <div className="lp-history-list">
                {history.length === 0 ? (
                  <div className="lp-history-empty">이동 이력이 없습니다</div>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="lp-history-row">
                      <div className="lp-history-time">{h.time}</div>
                      <div className="lp-history-dot" />
                      <div className="lp-history-place">{h.place}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </>
  );
}