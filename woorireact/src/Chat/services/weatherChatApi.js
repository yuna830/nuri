import { fetchForecastForDay, reverseGeocode } from "../../api/userPageApi";

export async function getWeatherChatAnswer(text) {
  if (!isWeatherQuestion(text)) return "";

  const dayOffset = /내일|낼/.test(text) ? 1 : 0;
  const dayText = dayOffset === 1 ? "내일" : "오늘";

  try {
    const { lat, lon } = await getCurrentPosition();
    const [forecast, region] = await Promise.all([
      fetchForecastForDay(lat, lon, dayOffset),
      reverseGeocode(lat, lon),
    ]);

    if (!forecast || forecast.temp === "--") {
      return `${dayText} 날씨 정보를 가져오지 못했어요. 잠시 후 다시 확인해 주세요.`;
    }

    const temp = Math.round(Number(forecast.temp));
    const rainProb = forecast.rainProb ?? "0";
    const humid = forecast.humid && forecast.humid !== "--" ? `${forecast.humid}%` : "-";
    const timeText = forecast.time ? ` ${forecast.time} 기준` : "";

    return `${region}${timeText} ${dayText} 날씨는 ${forecast.status}, 기온은 ${temp}도입니다. 강수확률은 ${rainProb}%, 습도는 ${humid}예요.`;
  } catch (error) {
    console.error("채팅 날씨 조회 오류:", error);
    return "날씨를 확인하려면 위치 권한이 필요해요. 브라우저 위치 권한을 허용한 뒤 다시 말씀해 주세요.";
  }
}

function isWeatherQuestion(text) {
  return /(오늘|내일|낼|지금|현재)?\s*(날씨|기온|비\s*와|비\s*와요|비\s*올|춥|더워|습도)/.test(text);
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
