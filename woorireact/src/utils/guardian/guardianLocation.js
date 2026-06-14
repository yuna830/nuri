import { SPRING_API_BASE } from "../../config/api.js";

export const getDateValue = (date = new Date()) => {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

export const fetchFullRoadAddress = async (lat, lng, fallbackAddress) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`
    );

    if (!response.ok) return fallbackAddress;

    const data = await response.json();
    const addr = data?.address;

    const fullRoadAddress = [
      addr?.province,
      addr?.city,
      addr?.borough || addr?.city_district,
      addr?.suburb || addr?.neighbourhood,
      addr?.road,
      addr?.house_number,
    ]
      .filter(Boolean)
      .join(" ");

    return fullRoadAddress || data?.display_name || fallbackAddress;
  } catch {
    return fallbackAddress;
  }
};

export const fetchLatestLocation = async (seniorId, fallbackAddress) => {
  const response = await fetch(`${SPRING_API_BASE}/api/locations/senior/${seniorId}/latest`);

  if (!response.ok || response.status === 204) return null;

  const latestLocation = await response.json();

  if (!latestLocation?.latitude || !latestLocation?.longitude) return null;

  return {
    lat: latestLocation.latitude,
    lng: latestLocation.longitude,
    address: latestLocation.address || fallbackAddress,
    receivedAt: latestLocation.receivedAt || new Date().toISOString(),
    accuracy: latestLocation.accuracy,
  };
};

export const fetchRouteHistoryByDate = async (seniorId, dateValue, fallbackAddress) => {
  const response = await fetch(
    `${SPRING_API_BASE}/api/locations/senior/${seniorId}/date?date=${dateValue}`
  );

  if (!response.ok || response.status === 204) return [];

  const locations = await response.json();

  if (!Array.isArray(locations)) return [];

  const filtered = locations.filter((l) => l?.latitude && l?.longitude);
  const routeHistory = [];
  for (const location of filtered) {
    const address = await fetchFullRoadAddress(
      location.latitude,
      location.longitude,
      location.address || fallbackAddress
    );
    routeHistory.push({
      lat: location.latitude,
      lng: location.longitude,
      address,
      receivedAt: location.receivedAt || new Date().toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  return routeHistory.filter((point, index, list) => {
    if (index === 0) return true;

    const previous = list[index - 1];
    const movedMeters = Math.sqrt(
      Math.pow((point.lat - previous.lat) * 111000, 2) +
        Math.pow(
          (point.lng - previous.lng) *
            111000 *
            Math.cos((point.lat * Math.PI) / 180),
          2
        )
    );

    return movedMeters >= 50;
  });
};

export const appendLatestLocationToElder = async (elder, { appendToRoute = true } = {}) => {
  const realLocation = await fetchLatestLocation(elder.id, elder.address);

  if (!realLocation) return elder;

  // 동선에 추가하지 않는 경우: 현재 위치(지도 마커)만 갱신
  if (!appendToRoute) {
    return {
      ...elder,
      currentLocation: realLocation,
      lastNormalLocation: realLocation,
      routeHistory: elder.routeHistory || [],
    };
  }

  const lastRoutePoint = elder.routeHistory?.[elder.routeHistory.length - 1];

  const movedMeters = lastRoutePoint
    ? Math.sqrt(
        Math.pow((realLocation.lat - lastRoutePoint.lat) * 111000, 2) +
          Math.pow(
            (realLocation.lng - lastRoutePoint.lng) *
              111000 *
              Math.cos((realLocation.lat * Math.PI) / 180),
            2
          )
      )
    : Infinity;

  const isSameLocation = movedMeters < 50;

  return {
    ...elder,
    currentLocation: realLocation,
    lastNormalLocation: realLocation,
    routeHistory: isSameLocation
      ? elder.routeHistory || []
      : [...(elder.routeHistory || []), realLocation],
  };
};
