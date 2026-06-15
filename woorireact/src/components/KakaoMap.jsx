import { useEffect, useMemo, useRef, useState } from "react";

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";

const getKakaoMapKey = () =>
  (
    import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ||
    import.meta.env.VITE_KAKAO_REST_API_KEY ||
    ""
  ).trim();

const loadKakaoMapSdk = () =>
  new Promise((resolve, reject) => {
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
      existingScript.addEventListener(
        "load",
        () => window.kakao.maps.load(() => resolve(window.kakao.maps)),
        { once: true }
      );
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps));
    script.onerror = reject;

    document.head.appendChild(script);
  });

const toLatLng = (maps, point) =>
  new maps.LatLng(Number(point.lat), Number(point.lng));

const clearOverlay = (overlay) => {
  if (!overlay) return;
  if (typeof overlay.setMap === "function") overlay.setMap(null);
  if (typeof overlay.close === "function") overlay.close();
};

const isValidPoint = (point) =>
  point &&
  Number.isFinite(Number(point.lat)) &&
  Number.isFinite(Number(point.lng));

const isValidSafeZone = (zone) =>
  zone &&
  Number.isFinite(Number(zone.centerLatitude)) &&
  Number.isFinite(Number(zone.centerLongitude));

const getSafeZoneBoundsPoints = (maps, zone) => {
  const radius = Number(zone.radiusMeters || 500);
  const lat = Number(zone.centerLatitude);
  const lng = Number(zone.centerLongitude);
  const latOffset = radius / 111000;
  const lngOffset = radius / (111000 * Math.cos((lat * Math.PI) / 180));
  return [
    new maps.LatLng(lat + latOffset, lng),
    new maps.LatLng(lat - latOffset, lng),
    new maps.LatLng(lat, lng + lngOffset),
    new maps.LatLng(lat, lng - lngOffset),
  ];
};

export default function KakaoMap({
  center,
  zoom = 4,
  className = "",
  style,
  safeZone,
  safeZones = [],
  currentLocation,
  sightingLocation = null,
  sightingLabel = "발견 위치",
  route = [],
  showRoute = true,
  currentLabel = "현재 위치",
  safeZoneLabel = "안전 반경 중심",
  autoFit = true,
  focusLocation = null,
  focusLevel = 4,
  focusKey = "",
  fallback = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const safeZoneOverlaysRef = useRef([]);  // 안전 반경용 오버레이 (드물게 변경)
  const currentMarkerRef = useRef(null);   // 현재 위치 마커 (위치만 업데이트)
  const currentInfoRef = useRef(null);
  const sightingMarkerRef = useRef(null);
  const sightingInfoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const normalizedCenter = useMemo(() => {
    if (Array.isArray(center)) return { lat: center[0], lng: center[1] };
    return center;
  }, [center]);

  // 지도 초기 생성
  useEffect(() => {
    let cancelled = false;

    loadKakaoMapSdk()
      .then((maps) => {
        if (cancelled || !containerRef.current || !isValidPoint(normalizedCenter)) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: toLatLng(maps, normalizedCenter),
            level: zoom,
          });
        }

        setFailed(false);
      })
      .catch(() => setFailed(true));

    return () => { cancelled = true; };
  }, [normalizedCenter, zoom]);

  // 안전 반경 원 + 마커 — safeZone/safeZones 변경 시에만 재렌더
  useEffect(() => {
    if (failed || !mapRef.current || !window.kakao?.maps) return;
    const maps = window.kakao.maps;

    safeZoneOverlaysRef.current.forEach(clearOverlay);
    safeZoneOverlaysRef.current = [];

    const zonesToRender =
      Array.isArray(safeZones) && safeZones.length > 0
        ? safeZones.filter(isValidSafeZone)
        : isValidSafeZone(safeZone)
          ? [safeZone]
          : [];

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    zonesToRender.forEach((zone, index) => {
      const zoneCenter = toLatLng(maps, {
        lat: Number(zone.centerLatitude),
        lng: Number(zone.centerLongitude),
      });
      const radius = Number(zone.radiusMeters || 500);
      const isActive = safeZone && String(zone.id) === String(safeZone.id);

      const circle = new maps.Circle({
        center: zoneCenter,
        radius,
        strokeWeight: isActive ? 3 : 2,
        strokeColor: isActive ? "#2F5D3A" : "#D86F45",
        strokeOpacity: isActive ? 0.9 : 0.8,
        strokeStyle: "solid",
        fillColor: isActive ? "#5F8F65" : "#F4A261",
        fillOpacity: isActive ? 0.14 : 0.11,
      });
      circle.setMap(mapRef.current);
      safeZoneOverlaysRef.current.push(circle);

      const marker = new maps.Marker({ position: zoneCenter });
      const zoneName = zone.name || zone.placeName || safeZoneLabel;
      const suffix = index === 0 && zonesToRender.length === 1 ? "" : " 안전 반경";
      const info = new maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;">${zoneName}${suffix}</div>`,
      });
      marker.setMap(mapRef.current);
      maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      safeZoneOverlaysRef.current.push(marker, info);

      getSafeZoneBoundsPoints(maps, zone).forEach((point) => bounds.extend(point));
      hasBounds = true;
    });

    const validRoute = Array.isArray(route) ? route.filter(isValidPoint) : [];
    if (showRoute && validRoute.length > 1) {
      const polyline = new maps.Polyline({
        path: validRoute.map((point) => toLatLng(maps, point)),
        strokeWeight: 4,
        strokeColor: "#C93A32",
        strokeOpacity: 0.85,
      });
      polyline.setMap(mapRef.current);
      safeZoneOverlaysRef.current.push(polyline);
      validRoute.forEach((point) => bounds.extend(toLatLng(maps, point)));
      hasBounds = true;
    }

    if (autoFit && hasBounds) {
      if (isValidPoint(currentLocation)) bounds.extend(toLatLng(maps, currentLocation));
      mapRef.current.setBounds(bounds);
      if (mapRef.current.getLevel() > 5) mapRef.current.setLevel(5);
    }
  }, [failed, safeZone, safeZones, safeZoneLabel, route, showRoute, autoFit]);

  // 현재 위치 마커 — 위치만 업데이트 (깜빡임 없음)
  useEffect(() => {
    if (failed || !mapRef.current || !window.kakao?.maps) return;
    if (!isValidPoint(currentLocation)) return;
    const maps = window.kakao.maps;
    const position = toLatLng(maps, currentLocation);

    if (currentMarkerRef.current) {
      // 마커가 이미 있으면 위치만 이동 → 깜빡임 없음
      currentMarkerRef.current.setPosition(position);
    } else {
      const marker = new maps.Marker({ position });
      marker.setMap(mapRef.current);
      const info = new maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;">${currentLabel}</div>`,
      });
      maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      currentMarkerRef.current = marker;
      currentInfoRef.current = info;
    }
  }, [failed, currentLocation, currentLabel]);

  // 신고/발견 위치 마커 — 붉은색으로 구분
  useEffect(() => {
    if (failed || !mapRef.current || !window.kakao?.maps) return;
    const maps = window.kakao.maps;

    // 기존 마커 제거
    if (sightingMarkerRef.current) {
      sightingMarkerRef.current.setMap(null);
      sightingMarkerRef.current = null;
    }
    if (sightingInfoRef.current) {
      sightingInfoRef.current.close();
      sightingInfoRef.current = null;
    }

    if (!isValidPoint(sightingLocation)) return;

    const position = toLatLng(maps, sightingLocation);
    const marker = new maps.Marker({
      position,
      image: new maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
        new maps.Size(24, 35),
      ),
    });
    marker.setMap(mapRef.current);

    const info = new maps.InfoWindow({
      content: `<div style="padding:6px 10px;font-size:12px;color:#c0392b;font-weight:bold;">${sightingLabel}</div>`,
    });
    maps.event.addListener(marker, "click", () => info.open(mapRef.current, marker));

    sightingMarkerRef.current = marker;
    sightingInfoRef.current = info;

    // 지도 중심을 신고 위치로 이동
    mapRef.current.setCenter(position);
    mapRef.current.setLevel(4);
  }, [failed, sightingLocation, sightingLabel]);

  // 포커스 이동
  const lastFocusKeyRef = useRef("");
  useEffect(() => {
    if (
      failed ||
      !mapRef.current ||
      !window.kakao?.maps ||
      !isValidPoint(focusLocation) ||
      !focusKey ||
      lastFocusKeyRef.current === focusKey
    ) return;

    const maps = window.kakao.maps;
    mapRef.current.setCenter(toLatLng(maps, focusLocation));
    mapRef.current.setLevel(focusLevel);
    lastFocusKeyRef.current = focusKey;
  }, [failed, focusKey, focusLevel]);

  if (failed && fallback) return fallback;

  return <div ref={containerRef} className={className} style={style} />;
}
