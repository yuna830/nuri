/**
 * currentSenior를 sessionStorage에 저장할 때
 * base64 이미지 데이터(data:...)를 제외하고 저장 → 용량 초과 방지
 *
 * 이미지는 API에서 직접 불러오므로 캐시에 넣을 필요 없음
 */
const stripBase64Images = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.startsWith("data:")) {
      result[key] = ""; // base64는 sessionStorage에 저장하지 않음
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = stripBase64Images(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const saveCurrentSenior = (profile) => {
  try {
    const slim = stripBase64Images(profile);
    sessionStorage.setItem("currentSenior", JSON.stringify(slim));
  } catch (e) {
    // QuotaExceededError 등 예외 발생 시 최소 정보만 저장
    try {
      const senior = profile?.senior ?? {};
      sessionStorage.setItem("currentSenior", JSON.stringify({
        senior: {
          id: senior.id,
          name: senior.name,
          phone: senior.phone,
        },
      }));
    } catch {
      // 그래도 실패하면 기존 캐시 삭제
      sessionStorage.removeItem("currentSenior");
    }
  }
};
