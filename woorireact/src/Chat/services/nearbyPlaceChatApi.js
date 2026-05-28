const DEFAULT_RADIUS_METERS = 2000;

export async function getNearbyPlaceChatAnswer(text) {
  const request = parseNearbyPlaceRequest(text);
  if (!request) return "";

  try {
    const { lat, lon } = await getCurrentPosition();
    const places = await searchNearbyPlaces(request.keyword, {
      lat,
      lon,
      radius: DEFAULT_RADIUS_METERS,
      size: 3,
      sort: "distance",
    });

    if (places.length === 0) {
      return `근처에서 ${request.label}을 찾지 못했어요. 다른 검색어로 다시 말씀해 주세요.`;
    }

    return `${request.label} 가까운 곳입니다.\n${places.map(formatPlace).join("\n")}`;
  } catch (error) {
    console.error("주변 장소 검색 오류:", error);

    if (error.message === "KAKAO_KEY_MISSING") {
      return "장소 검색을 하려면 카카오 REST API 키 설정이 필요해요.";
    }
    if (error.message === "KAKAO_RATE_LIMIT" || error.message === "KAKAO_COOLDOWN") {
      return "장소 검색 요청이 잠시 많아요. 조금 뒤 다시 말씀해 주세요.";
    }

    return "현재 위치 권한이 필요해요. 브라우저 위치 권한을 허용한 뒤 다시 말씀해 주세요.";
  }
}

async function searchNearbyPlaces(keyword, { lat, lon, radius, size }) {
  const params = new URLSearchParams({
    query: keyword,
    x: String(lon),
    y: String(lat),
    radius: String(radius),
    size: String(size),
    sort: "distance",
  });
  const response = await fetch(`/kakao-local/v2/local/search/keyword.json?${params}`);

  if (response.status === 401 || response.status === 403) {
    throw new Error("KAKAO_KEY_MISSING");
  }
  if (response.status === 429) {
    throw new Error("KAKAO_RATE_LIMIT");
  }
  if (!response.ok) {
    throw new Error("KAKAO_FAILED");
  }

  const data = await response.json();
  return (data?.documents || []).map((place) => ({
    place_id: place.id,
    display_name: place.road_address_name || place.address_name || place.place_name,
    name: place.place_name,
    distance: place.distance,
    phone: place.phone,
    lat: place.y,
    lon: place.x,
  })).filter((place) => place.name && place.lat && place.lon);
}

function parseNearbyPlaceRequest(text) {
  const normalized = String(text || "").trim();
  if (!/(추천|찾아|찾아줘|근처|가까운|주변)/.test(normalized)) return null;
  if (isCasualAdviceQuestion(normalized) && !hasPlaceSearchSignal(normalized)) return null;

  const directKeyword = normalized
    .replace(/배고픈데|배고파|근처|가까운|주변|추천해줘|추천|찾아줘|찾아|알려줘|가게|장소/g, " ")
    .replace(/[,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const keyword = inferKeyword(directKeyword || normalized);
  if (!keyword) return null;

  return {
    keyword,
    label: keyword,
  };
}

function hasPlaceSearchSignal(text) {
  return /(근처|가까운|주변|찾아|찾아줘|어디|식당|밥집|맛집|카페|커피|약국|병원|의원|편의점)/.test(text);
}

function isCasualAdviceQuestion(text) {
  return /(뭐\s*하지|뭐\s*할지|뭘\s*하지|뭐\s*할까|뭐\s*먹을까|뭘\s*먹을까|메뉴\s*추천|추천해\s*줘|추천해줘)/.test(text);
}

function inferKeyword(text) {
  if (/짜장|짜장면|중국|중식/.test(text)) return "중국집";
  if (/식당|밥|밥집|음식|맛집|배고/.test(text)) return "식당";
  if (/카페|커피/.test(text)) return "카페";
  if (/약국|약/.test(text)) return "약국";
  if (/병원|의원|진료/.test(text)) return "병원";
  if (/편의점/.test(text)) return "편의점";

  return text.length >= 2 ? text : "";
}

function formatPlace(place, index) {
  const distance = formatDistance(place.distance);
  const address = place.display_name ? ` - ${place.display_name}` : "";
  const phone = place.phone ? `, ${place.phone}` : "";
  return `${index + 1}. ${place.name}${distance}${address}${phone}`;
}

function formatDistance(distance) {
  const meters = Number(distance);
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters >= 1000) return ` - 약 ${(meters / 1000).toFixed(1)}km`;
  return ` - 약 ${Math.round(meters)}m`;
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
