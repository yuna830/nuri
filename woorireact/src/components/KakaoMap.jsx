import { useEffect, useMemo, useRef, useState } from "react";

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";

const getKakaoMapKey = () =>
  (
    import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ||
    import.meta.env.VITE_KAKAO_REST_API_KEY ||
    ""
  ).trim();

const loadKakaoMapSdk = () => new Promise((resolve, reject) => {
  if (window.kakao?.maps) {
    window.kakao.maps.load(() => resolve(window.kakao.maps));
    return;
  }

  const appKey = getKakaoMapKey();
  if (!appKey) {
    reject(new Error("KAKAO_MAP_KEY_MISSING"));
    return;
  }

  const existingScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);
  if (existingScript) {
    existingScript.addEventListener("load", () => window.kakao.maps.load(() => resolve(window.kakao.maps)), { once: true });
    existingScript.addEventListener("error", reject, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = KAKAO_MAP_SCRIPT_ID;
  script.async = true;
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
  script.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps));
  script.onerror = reject;
  document.head.appendChild(script);
});

const toLatLng = (maps, point) => new maps.LatLng(point.lat, point.lng);

const clearOverlay = (overlay) => {
  if (typeof overlay.setMap === "function") overlay.setMap(null);
  if (typeof overlay.close === "function") overlay.close();
};

export default function KakaoMap({
  center,
  zoom = 4,
  className = "",
  style,
  safeZone,
  currentLocation,
  route = [],
  showRoute = true,
  currentLabel = "현재 위치",
  safeZoneLabel = "안전 반경 중심",
  fallback = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [failed, setFailed] = useState(false);

  const normalizedCenter = useMemo(() => {
    if (Array.isArray(center)) return { lat: center[0], lng: center[1] };
    return center;
  }, [center]);

  useEffect(() => {
    let cancelled = false;

    loadKakaoMapSdk()
      .then((maps) => {
        if (cancelled || !containerRef.current || !normalizedCenter) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: toLatLng(maps, normalizedCenter),
            level: zoom,
          });
        }

        setFailed(false);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [normalizedCenter, zoom]);

  useEffect(() => {
    if (failed || !mapRef.current || !window.kakao?.maps) return;

    const maps = window.kakao.maps;
    overlaysRef.current.forEach(clearOverlay);
    overlaysRef.current = [];

    if (safeZone) {
      const safeZoneCenter = toLatLng(maps, {
        lat: safeZone.centerLatitude,
        lng: safeZone.centerLongitude,
      });
      const circle = new maps.Circle({
        center: safeZoneCenter,
        radius: safeZone.radiusMeters,
        strokeWeight: 2,
        strokeColor: "#4F6F52",
        strokeOpacity: 0.85,
        fillColor: "#86A788",
        fillOpacity: 0.18,
      });
      const marker = new maps.Marker({ position: safeZoneCenter });
      const info = new maps.InfoWindow({ content: `<div style="padding:6px 10px;font-size:12px;">${safeZoneLabel}</div>` });

      circle.setMap(mapRef.current);
      marker.setMap(mapRef.current);
      maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      overlaysRef.current.push(circle, marker, info);
    }

    if (currentLocation) {
      const position = toLatLng(maps, currentLocation);
      const marker = new maps.Marker({ position });
      const info = new maps.InfoWindow({ content: `<div style="padding:6px 10px;font-size:12px;">${currentLabel}</div>` });

      marker.setMap(mapRef.current);
      maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      overlaysRef.current.push(marker, info);
    }

    if (showRoute && route.length > 1) {
      const polyline = new maps.Polyline({
        path: route.map((point) => toLatLng(maps, point)),
        strokeWeight: 4,
        strokeColor: "#C93A32",
        strokeOpacity: 0.85,
      });
      polyline.setMap(mapRef.current);
      overlaysRef.current.push(polyline);
    }
  }, [currentLabel, currentLocation, failed, route, safeZone, safeZoneLabel, showRoute]);

  if (failed && fallback) return fallback;

  return <div ref={containerRef} className={className} style={style} />;
}
