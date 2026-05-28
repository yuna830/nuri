const LOCATION_TOKEN_PATTERN = /([가-힣A-Za-z0-9·.-]{2,24}(?:시|군|구|동|읍|면|역|아파트|마을|단지|센터|학교))/;
const REGION_PAIR_PATTERN = /((?:서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|대전|대구|부산|울산|광주|세종|제주|서울특별시|경기도|인천광역시|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|대전광역시|대구광역시|부산광역시|울산광역시|광주광역시|세종특별자치시|제주특별자치도)\s*[가-힣A-Za-z0-9·.-]{1,16}(?:시|군|구|동|읍|면))/;

const cleanLocation = (value) =>
  String(value || "")
    .replace(/^\d{5}\s*/, "")
    .replace(/[★◆]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const compactTitleLocation = (value) =>
  cleanLocation(value)
    .replace(/채용대행|긴급|모집|채용|구인|공고/g, "")
    .replace(/\s+/g, " ")
    .trim();

const extractFromAddress = (value) => {
  const text = cleanLocation(value);
  if (!text) return "";

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return text;

  const locationTokens = [];
  for (const token of tokens) {
    locationTokens.push(token);
    if (locationTokens.length >= 3 || /(?:시|군|구|동|읍|면)$/.test(token)) {
      if (locationTokens.length >= 2) break;
    }
  }

  return locationTokens.slice(0, 3).join(" ");
};

const extractFromTitle = (value) => {
  const text = cleanLocation(value);
  if (!text) return "";

  const bracketMatch = text.match(/[\[［【(（]\s*([^\]］】)）]{2,36})[\]］】)）]/);
  if (bracketMatch?.[1]) {
    const candidate = compactTitleLocation(bracketMatch[1]);
    if (LOCATION_TOKEN_PATTERN.test(candidate)) return candidate;
  }

  const regionMatch = text.match(REGION_PAIR_PATTERN);
  if (regionMatch?.[1]) return cleanLocation(regionMatch[1]);

  const tokenMatch = text.match(LOCATION_TOKEN_PATTERN);
  if (tokenMatch?.[1]) return compactTitleLocation(tokenMatch[1]);

  return "";
};

export const getJobLocation = (job) => {
  const listedLocation = cleanLocation(job?.workPlcNm);
  if (listedLocation) return listedLocation;

  const detailLocation = extractFromAddress(job?.plDetAddr);
  if (detailLocation) return detailLocation;

  return extractFromTitle(job?.recrtTitle || job?.wantedTitle);
};
