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

export const formatShortAddress = (address) => {
  if (!address) {
    return "주소 없음";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return address;
  }

  const countryRemoved = parts.filter((part) => part !== "대한민국");

  const building = countryRemoved.find((part) =>
    /대학교|병원|아파트|센터|공원|역|시장|도서관|복지관|주민센터|초등학교|중학교|고등학교/.test(part)
  );

  const cityDistrict = countryRemoved.filter((part) =>
    /서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원|충청|전라|경상|제주|구$|군$|동$|읍$|면$/.test(part)
  );

  if (building && cityDistrict.length > 0) {
    return [...cityDistrict.slice(-2), building].join(" ");
  }

  if (building) {
    return building;
  }

  const usefulParts = countryRemoved.filter(
    (part) => !/^\d+$/.test(part) && !/^\d{5}$/.test(part)
  );

  return usefulParts.slice(0, 3).join(" ");
};
