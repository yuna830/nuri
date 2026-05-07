import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { RefreshCw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const customIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;background:#86A788;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);"><div style="width:10px;height:10px;background:white;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div></div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
});

const C = {
  cream: "#FFFDEC", green: "#86A788", greenDark: "#5f7d61",
  greenLight: "#b8d4ba", greenPale: "#eef6ef", white: "#ffffff",
  danger: "#e05252", text: "#1e2a1f", textMuted: "#7a9a7c", border: "#d4e8d6",
};
const SAFE_RADIUS = 500;

const getNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };

const getAddress = async (lat, lon) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`);
    const data = await res.json();
    const addr = data.address;
    const parts = [addr.city||addr.province||addr.state, addr.city_district||addr.suburb||addr.borough, addr.road||addr.neighbourhood].filter(Boolean);
    return parts.join(" ") || data.display_name;
  } catch { return "주소 불러오기 실패"; }
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .lp-root { background: ${C.cream}; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; color: ${C.text}; }
  .lp-nav {
    background: ${C.white}; border-bottom: 1px solid ${C.border};
    padding: 0 2rem; height: 60px; display: flex; align-items: center;
    gap: 1rem; position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 8px rgba(134,167,136,0.08);
  }
  .lp-nav-back {
    background: transparent; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 0.4rem 0.9rem; font-size: 0.85rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
  .lp-nav-back:hover { border-color: ${C.green}; color: ${C.green}; }
  .lp-nav-title { font-size: 1.1rem; font-weight: 700; color: ${C.text}; flex: 1; }
  .lp-nav-right { display: flex; align-items: center; gap: 0.8rem; }
  .lp-refresh-btn {
    background: ${C.greenPale}; border: 1px solid ${C.greenLight}; border-radius: 8px;
    padding: 0.4rem 0.9rem; cursor: pointer; display: flex; align-items: center;
    gap: 0.3rem; font-size: 0.82rem; color: ${C.greenDark};
    font-family: 'Noto Sans KR', sans-serif;
  }

  .lp-layout { max-width: 1100px; margin: 0 auto; padding: 2rem; display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: start; }

  /* 지도 */
  .lp-map-section {}
  .lp-status-card {
    background: ${C.white}; border-radius: 16px; padding: 1.2rem 1.5rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08);
    margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;
  }
  .lp-status-left { display: flex; align-items: center; gap: 0.75rem; }
  .lp-status-dot {
    width: 10px; height: 10px; border-radius: 50%; background: ${C.green};
    animation: blink 2s ease-in-out infinite; flex-shrink: 0;
  }
  .lp-status-dot.danger { background: ${C.danger}; }
  @keyframes blink { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } }
  .lp-status-label { font-size: 0.78rem; color: ${C.textMuted}; }
  .lp-status-addr { font-size: 1rem; font-weight: 700; color: ${C.text}; margin-top: 0.1rem; }
  .lp-range-badge { padding: 0.3rem 0.9rem; border-radius: 99px; font-size: 0.82rem; font-weight: 700; }
  .lp-range-badge.safe { background: ${C.green}; color: #fff; }
  .lp-range-badge.out { background: ${C.danger}; color: #fff; }

  .lp-map-wrap {
    border-radius: 16px; overflow: hidden; border: 1px solid ${C.border};
    box-shadow: 0 2px 16px rgba(134,167,136,0.1); height: 480px;
    display: flex; align-items: center; justify-content: center;
  }

  /* 사이드 */
  .lp-sidebar {}
  .lp-info-card {
    background: ${C.white}; border-radius: 16px; padding: 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08); margin-bottom: 1rem;
  }
  .lp-info-title { font-size: 0.78rem; font-weight: 700; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1rem; }
  .lp-info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0; border-bottom: 1px solid ${C.border}; }
  .lp-info-row:last-child { border-bottom: none; }
  .lp-info-key { font-size: 0.82rem; color: ${C.textMuted}; }
  .lp-info-val { font-size: 0.88rem; font-weight: 700; color: ${C.text}; }

  .lp-history-card {
    background: ${C.white}; border-radius: 16px; padding: 1.4rem;
    border: 1px solid ${C.border}; box-shadow: 0 2px 10px rgba(134,167,136,0.08);
  }
  .lp-history-row { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.55rem 0; border-bottom: 1px solid ${C.border}; }
  .lp-history-row:last-child { border-bottom: none; }
  .lp-history-time { font-size: 0.75rem; font-weight: 700; color: ${C.greenDark}; min-width: 44px; flex-shrink: 0; margin-top: 2px; }
  .lp-history-dot { width: 7px; height: 7px; border-radius: 50%; background: ${C.green}; flex-shrink: 0; margin-top: 5px; }
  .lp-history-place { font-size: 0.85rem; color: ${C.text}; line-height: 1.4; }
  .lp-empty { text-align: center; padding: 1.5rem; color: ${C.textMuted}; font-size: 0.85rem; }

  .lp-clear-btn {
    background: transparent; border: 1px solid ${C.border}; border-radius: 6px;
    padding: 0.2rem 0.6rem; font-size: 0.72rem; color: ${C.textMuted};
    cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
  }
`;

export default function LocationPage() {
  const navigate = useNavigate();
  const [currentPos, setCurrentPos] = useState(null);
  const [address, setAddress] = useState("불러오는 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInRange, setIsInRange] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("불러오는 중...");
  const [history, setHistory] = useState(() => {
    try { const s = localStorage.getItem("location_history"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const lastAddressRef = useRef("");

  const updateLocation = async (lat, lon) => {
    setCurrentPos([lat, lon]);
    setLastUpdate(getNow() + " 업데이트");
    const addr = await getAddress(lat, lon);
    setAddress(addr);
    if (addr !== lastAddressRef.current) {
      lastAddressRef.current = addr;
      setHistory(prev => {
        const updated = [{ time: getNow(), place: addr }, ...prev].slice(0, 20);
        localStorage.setItem("location_history", JSON.stringify(updated));
        return updated;
      });
    }
    setLoading(false);
  };

  const getLocation = () => {
    if (!navigator.geolocation) { setError("위치 서비스를 지원하지 않는 브라우저예요."); setLoading(false); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
      () => { setError("위치 권한을 허용해주세요."); setLoading(false); }
    );
  };

  useEffect(() => { getLocation(); }, []);
  useEffect(() => { const t = setInterval(getLocation, 30000); return () => clearInterval(t); }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="lp-root">
        <nav className="lp-nav">
          <button className="lp-nav-back" onClick={() => navigate("/user")}>← 돌아가기</button>
          <div className="lp-nav-title">📍 내 위치</div>
          <div className="lp-nav-right">
            <button className="lp-refresh-btn" onClick={getLocation}><RefreshCw size={13} /> 새로고침</button>
          </div>
        </nav>

        <div className="lp-layout">

          {/* 지도 섹션 */}
          <div className="lp-map-section">
            <div className="lp-status-card">
              <div className="lp-status-left">
                <div className={`lp-status-dot ${isInRange ? "" : "danger"}`} />
                <div>
                  <div className="lp-status-label">{lastUpdate}</div>
                  <div className="lp-status-addr">{loading ? "위치 불러오는 중..." : error ? "위치 오류" : address}</div>
                </div>
              </div>
              <div className={`lp-range-badge ${isInRange ? "safe" : "out"}`}>
                {isInRange ? "✅ 반경 내" : "🚨 이탈"}
              </div>
            </div>

            <div className="lp-map-wrap">
              {loading && <div style={{ color: C.textMuted }}>📍 위치 불러오는 중...</div>}
              {error && <div style={{ color: C.danger, textAlign: "center", padding: "1rem" }}>{error}</div>}
              {!loading && !error && currentPos && (
                <MapContainer center={currentPos} zoom={15} style={{ width: "100%", height: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                  <Circle center={currentPos} radius={SAFE_RADIUS} pathOptions={{ color: "#86A788", fillColor: "#86A788", fillOpacity: 0.1, weight: 2 }} />
                  <Marker position={currentPos} icon={customIcon}><Popup>{address}</Popup></Marker>
                </MapContainer>
              )}
            </div>
          </div>

          {/* 사이드바 */}
          <aside className="lp-sidebar">
            <div className="lp-info-card">
              <div className="lp-info-title">안전 반경 정보</div>
              <div className="lp-info-row"><span className="lp-info-key">설정 반경</span><span className="lp-info-val">{SAFE_RADIUS}m</span></div>
              <div className="lp-info-row"><span className="lp-info-key">현재 상태</span><span className="lp-info-val" style={{ color: isInRange ? C.green : C.danger }}>{isInRange ? "반경 내" : "이탈"}</span></div>
              <div className="lp-info-row"><span className="lp-info-key">마지막 갱신</span><span className="lp-info-val">{lastUpdate}</span></div>
            </div>

            <div className="lp-history-card">
              <div className="lp-info-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>이동 이력</span>
                <button className="lp-clear-btn" onClick={() => { localStorage.removeItem("location_history"); setHistory([]); }}>초기화</button>
              </div>
              {history.length === 0 ? (
                <div className="lp-empty">이동 이력이 없습니다</div>
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
          </aside>
        </div>
      </div>
    </>
  );
}