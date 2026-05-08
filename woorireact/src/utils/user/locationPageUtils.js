import L from "leaflet";

export const SAFE_RADIUS = 500;

export const customLocationIcon = L.divIcon({
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

export const getNow = () => {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

export const getAddress = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    );
    const data = await response.json();
    const address = data.address ?? {};

    const parts = [
      address.city || address.province || address.state,
      address.city_district || address.suburb || address.borough,
      address.road || address.neighbourhood,
    ].filter(Boolean);

    return parts.join(" ") || data.display_name || "주소 정보 없음";
  } catch {
    return "주소 불러오기 실패";
  }
};

export const loadLocationHistory = () => {
  try {
    const saved = localStorage.getItem("location_history");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveLocationHistory = (history) => {
  localStorage.setItem("location_history", JSON.stringify(history));
};
