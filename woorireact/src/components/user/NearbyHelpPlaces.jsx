import { useEffect, useMemo, useState } from "react";
import { MapPin, Phone, Route } from "lucide-react";
import { searchPlacesByKakao } from "../../api/kakaoLocalApi.js";
import "../../css/user/NearbyHelpPlaces.css";

const PLACE_TYPES = [
  { id: "welfare", label: "복지관", keyword: "복지관" },
  { id: "center", label: "주민센터", keyword: "주민센터" },
  { id: "shelter", label: "대피소", keyword: "대피소" },
];

const formatDistance = (value) => {
  const meters = Number(value);
  if (!Number.isFinite(meters)) return "";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters}m`;
};

const openKakaoRoute = (place) => {
  const url = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lon}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

export default function NearbyHelpPlaces({ lat, lon, address = "", compact = false }) {
  const [activeType, setActiveType] = useState(PLACE_TYPES[0].id);
  const [placesByType, setPlacesByType] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeConfig = useMemo(
    () => PLACE_TYPES.find((item) => item.id === activeType) || PLACE_TYPES[0],
    [activeType],
  );
  const places = placesByType[activeType] || [];

  useEffect(() => {
    if (!lat || !lon || placesByType[activeType]) return;

    let ignore = false;
    const loadPlaces = async () => {
      setLoading(true);
      setError("");
      try {
        const results = await searchPlacesByKakao(activeConfig.keyword, {
          size: 5,
          x: lon,
          y: lat,
          radius: 5000,
        });
        if (!ignore) {
          setPlacesByType((prev) => ({ ...prev, [activeType]: results }));
        }
      } catch {
        if (!ignore) setError("주변 기관을 불러오지 못했어요.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadPlaces();
    return () => {
      ignore = true;
    };
  }, [activeConfig.keyword, activeType, lat, lon, placesByType]);

  return (
    <section className={`nhp-card ${compact ? "compact" : ""}`}>
      <div className="nhp-head">
        <div>
          <h2>주변 도움기관</h2>
          <p>{address ? "현재 위치 기준으로 가까운 곳을 찾아요." : "위치를 불러오면 가까운 곳을 보여줘요."}</p>
        </div>
      </div>

      <div className="nhp-tabs" role="tablist" aria-label="주변 도움기관 종류">
        {PLACE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            className={activeType === type.id ? "active" : ""}
            onClick={() => setActiveType(type.id)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {!lat || !lon ? (
        <div className="nhp-empty">현재 위치를 확인하는 중입니다.</div>
      ) : loading ? (
        <div className="nhp-empty">{activeConfig.label}을 찾는 중입니다.</div>
      ) : error ? (
        <div className="nhp-empty danger">{error}</div>
      ) : places.length === 0 ? (
        <div className="nhp-empty">5km 안에서 찾은 {activeConfig.label}이 없어요.</div>
      ) : (
        <div className="nhp-list">
          {places.map((place) => (
            <article key={place.place_id} className="nhp-item">
              <div className="nhp-item-main">
                <strong>{place.name}</strong>
                <span><MapPin size={13} /> {place.display_name}</span>
                {place.distance && <em>{formatDistance(place.distance)} 거리</em>}
              </div>
              <div className="nhp-actions">
                {place.phone && (
                  <a href={`tel:${place.phone.replace(/[^0-9]/g, "")}`} aria-label={`${place.name} 전화`}>
                    <Phone size={15} />
                  </a>
                )}
                <button type="button" onClick={() => openKakaoRoute(place)} aria-label={`${place.name} 길찾기`}>
                  <Route size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
