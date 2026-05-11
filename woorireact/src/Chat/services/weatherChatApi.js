import { fetchForecastForDay, reverseGeocode } from "../../api/userPageApi";

const DEFAULT_LOCATION = {
  lat: 37.5665,
  lon: 126.978,
  label: "서울 기준",
};

export async function getWeatherChatAnswer(text) {
  if (!isWeatherQuestion(text)) return "";

  const dayOffset = /내일|낼/.test(text) ? 1 : 0;
  const dayText = dayOffset === 1 ? "내일" : "오늘";

  try {
    const location = await getCurrentPositionWithFallback();
    const [forecast, region] = await Promise.all([
      fetchForecastForDay(location.lat, location.lon, dayOffset),
      location.fallback ? Promise.resolve(location.label) : safeReverseGeocode(location.lat, location.lon),
    ]);

    if (!forecast || forecast.temp === "--") {
      return `${dayText} 날씨 정보를 아직 가져오지 못했어요. 잠시 후 다시 확인해 주세요.`;
    }

    const temp = Math.round(Number(forecast.temp));
    const rainProb = forecast.rainProb ?? "0";
    const humid = forecast.humid && forecast.humid !== "--" ? `${forecast.humid}%` : "-";
    const timeText = forecast.time ? ` ${forecast.time} 기준` : "";

    return `${region}${timeText} ${dayText} 날씨는 ${forecast.status}, 기온은 ${temp}도입니다. 강수확률은 ${rainProb}%, 습도는 ${humid}예요.`;
  } catch (error) {
    console.error("채팅 날씨 조회 오류:", error);
    return `${dayText} 날씨 정보를 가져오지 못했어요. 날씨 서버나 네트워크를 확인해 주세요.`;
  }
}

function isWeatherQuestion(text) {
  return /(오늘|내일|낼|지금|현재)?\s*(날씨|기온|비\s*와|비\s*와요|비\s*올까|춥|더워|습도)/.test(text);
}

async function safeReverseGeocode(lat, lon) {
  try {
    return await reverseGeocode(lat, lon);
  } catch {
    return "현재 위치";
  }
}

async function getCurrentPositionWithFallback() {
  try {
    return await getCurrentPosition();
  } catch {
    return { ...DEFAULT_LOCATION, fallback: true };
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          fallback: false,
        });
      },
      reject,
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });
}
