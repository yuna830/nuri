import L from "leaflet";
import { reverseGeocode } from "../../api/userPageApi.js";

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

export const getAddress = async (lat, lon) => reverseGeocode(lat, lon);
