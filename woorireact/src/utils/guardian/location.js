export function getDistanceMeters(from, to) {
  const earthRadius = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const formatCityAddress = (address) => {
  if (!address) {
    return "주소 없음";
  }

  return address
    .replaceAll("서울특별시", "서울시")
    .replaceAll("부산광역시", "부산시")
    .replaceAll("대구광역시", "대구시")
    .replaceAll("인천광역시", "인천시")
    .replaceAll("광주광역시", "광주시")
    .replaceAll("대전광역시", "대전시")
    .replaceAll("울산광역시", "울산시")
    .replaceAll("세종특별자치시", "세종시");
};

export const formatSafeZoneAddress = (address) => {
  if (!address) {
    return "주소 없음";
  }

  return formatCityAddress(address)
    .replace(/\b서울시\b/g, "")
    .replace(/\b부산시\b/g, "")
    .replace(/\b대구시\b/g, "")
    .replace(/\b인천시\b/g, "")
    .replace(/\b광주시\b/g, "")
    .replace(/\b대전시\b/g, "")
    .replace(/\b울산시\b/g, "")
    .replace(/\b세종시\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const formatShortAddress = (address) => {
  if (!address) {
    return "주소 없음";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return formatCityAddress(address);
  }

  const countryRemoved = parts.filter((part) => part !== "대한민국");

  const building = countryRemoved.find((part) =>
    /대학교|병원|아파트|센터|공원|역|시장|도서관|복지관|주민센터|초등학교|중학교|고등학교/.test(part)
  );

  const cityDistrict = countryRemoved.filter((part) =>
    /서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원|충청|전라|경상|제주|구$|군$|동$|읍$|면$/.test(part)
  );

  if (building && cityDistrict.length > 0) {
    return formatCityAddress([...cityDistrict.slice(-2), building].join(" "));
  }

  if (building) {
    return formatCityAddress(building);
  }

  const usefulParts = countryRemoved.filter(
    (part) => !/^\d+$/.test(part) && !/^\d{5}$/.test(part)
  );

  return formatCityAddress(usefulParts.slice(0, 3).join(" "));
};
