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
  safeZones = [],
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

    const zonesToRender = Array.isArray(safeZones) && safeZones.length > 0
      ? safeZones
      : safeZone
        ? [safeZone]
        : [];
    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    zonesToRender.forEach((zone, index) => {
      if (zone?.centerLatitude == null || zone?.centerLongitude == null) return;

      const safeZoneCenter = toLatLng(maps, {
        lat: zone.centerLatitude,
        lng: zone.centerLongitude,
      });
      const radius = Number(zone.radiusMeters || 500);
      const latOffset = radius / 111000;
      const lngOffset = radius / (111000 * Math.cos((zone.centerLatitude * Math.PI) / 180));

      bounds.extend(new maps.LatLng(zone.centerLatitude + latOffset, zone.centerLongitude));
      bounds.extend(new maps.LatLng(zone.centerLatitude - latOffset, zone.centerLongitude));
      bounds.extend(new maps.LatLng(zone.centerLatitude, zone.centerLongitude + lngOffset));
      bounds.extend(new maps.LatLng(zone.centerLatitude, zone.centerLongitude - lngOffset));
      hasBounds = true;

      const circle = new maps.Circle({
        center: safeZoneCenter,
        radius,
        strokeWeight: 2,
        strokeColor: "#4F6F52",
        strokeOpacity: 0.85,
        fillColor: "#86A788",
        fillOpacity: 0.18,
      });

      const marker = new maps.Marker({ position: safeZoneCenter });
      const info = new maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;">${zone.name || zone.placeName || safeZoneLabel}${index === 0 && zonesToRender.length === 1 ? "" : " 안전 반경"}</div>`,
      });

      circle.setMap(mapRef.current);
      marker.setMap(mapRef.current);
      maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      overlaysRef.current.push(circle, marker, info);
    });

    if (currentLocation) {
      const position = toLatLng(maps, currentLocation);
      bounds.extend(position);
      hasBounds = true;
      const marker = new maps.Marker({ position });
      const info = new maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;">${currentLabel}</div>`,
      });

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

    if (hasBounds) {
      mapRef.current.setBounds(bounds);
    }
  }, [currentLabel, currentLocation, failed, route, safeZone, safeZones, safeZoneLabel, showRoute]);

  if (failed && fallback) return fallback;

  return <div ref={containerRef} className={className} style={style} />;
}
