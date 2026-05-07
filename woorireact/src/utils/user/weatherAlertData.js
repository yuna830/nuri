export const LEVELS = {
  safe: {
    label: "안전",
    bg: "#86A788",
    barColor: "#86A788",
    icon: "✅",
    desc: "외출 가능",
    textColor: "#ffffff",
  },
  caution: {
    label: "주의",
    bg: "#f0a500",
    barColor: "#f0a500",
    icon: "⚠️",
    desc: "주의 필요",
    textColor: "#ffffff",
  },
  warning: {
    label: "경고",
    bg: "#e05252",
    barColor: "#e05252",
    icon: "🚨",
    desc: "외출 자제",
    textColor: "#ffffff",
  },
  danger: {
    label: "위험",
    bg: "#7a1a1a",
    barColor: "#7a1a1a",
    icon: "🆘",
    desc: "외출 금지",
    textColor: "#ffffff",
  },
};

export const DUMMY_ALERTS = [
  {
    id: 1,
    type: "한파",
    level: "warning",
    message:
      "오늘 최저기온이 -12°C 이하로 내려갑니다. 외출을 최대한 삼가주세요. 특히 심혈관 질환자 및 고령자는 각별히 주의하시기 바랍니다.",
    time: "오늘 오전 9:00",
    region: "서울 전역",
  },
  {
    id: 2,
    type: "강풍",
    level: "caution",
    message:
      "순간 풍속 15m/s 이상의 강한 바람이 예상됩니다. 외출 시 낙하물에 주의하시고 우산 사용을 자제해주세요.",
    time: "오늘 오후 2:00",
    region: "서울 전역",
  },
  {
    id: 3,
    type: "오후 날씨",
    level: "safe",
    message: "오후 4시 이후 날씨가 맑아지고 기온이 오릅니다. 저녁 외출은 비교적 안전합니다.",
    time: "오늘 오후 4:00",
    region: "서울 전역",
  },
];

export const COLD_ACTIONS = [
  { icon: "🧥", text: "내복과 두꺼운 외투를 착용하세요" },
  { icon: "📞", text: "외출 전 보호자에게 반드시 알려주세요" },
  { icon: "🏠", text: "손발이 시릴 때는 즉시 따뜻한 곳으로 이동하세요" },
  { icon: "☕", text: "뜨거운 물과 따뜻한 음식을 자주 드세요" },
  { icon: "💊", text: "심혈관 질환자는 약 복용을 거르지 마세요" },
  { icon: "🌡", text: "실내 적정 온도(18~20°C)를 유지하세요" },
];

const LEVEL_ORDER = {
  danger: 0,
  warning: 1,
  caution: 2,
  safe: 3,
};

export const getWorstAlert = (alerts) => {
  return [...alerts].sort(
    (first, second) => LEVEL_ORDER[first.level] - LEVEL_ORDER[second.level]
  )[0];
};

export const hasHighRiskAlert = (alerts) => {
  return alerts.some((alert) => alert.level === "warning" || alert.level === "danger");
};
