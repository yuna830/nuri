export const COLORS = {
  cream: "#FFFDEC",
  green: "#86A788",
  greenDark: "#5f7d61",
  greenLight: "#b8d4ba",
  greenPale: "#eef6ef",
  white: "#ffffff",
  danger: "#e05252",
  text: "#1e2a1f",
  textMuted: "#7a9a7c",
  border: "#d4e8d6",
};

export const schedules = [
  { time: "10:00", text: "혈압약 복용" },
  { time: "14:00", text: "병원 진료 예약" },
  { time: "16:30", text: "공원 산책" },
];

export const menus = [
  { icon: "🌡", label: "기후 알림",    desc: "위험 기후 안내",       route: "/weather" },
  { icon: "📋", label: "낙상 기록",    desc: "감지 이력 확인",       route: "/fall-history" },
  { icon: "💼", label: "일자리 찾기",  desc: "맞춤 일자리 추천",     route: "/jobs", badge: "NEW" },
  { icon: "📍", label: "내 위치",      desc: "실시간 위치 공유",     route: "/location" },
  { icon: "👤", label: "내 정보 수정", desc: "신체정보 및 인적사항", route: "/profile" },
  { icon: "💬", label: "AI 챗봇", desc: "준비 중", route: "/chat", disabled: false, hideQuick: true },
];

export const calcHealthScore = (profile) => {
  const score = (value) => {
    if (
      !value ||
      value === "없음" ||
      value === "없음 (스스로 보행 가능)" ||
      value === "없음 (비흡연)" ||
      value === "없음 (금주)"
    ) return 100;
    if (
      value.includes("경증") || value.includes("경도") || value.includes("초기") ||
      value.includes("가끔") || value.includes("과거") || value.includes("완치") ||
      value.includes("1회")
    ) return 65;
    return 25;
  };

  const chronic = Math.round(
    (score(profile.diabetes) + score(profile.hypertension) + score(profile.heart) +
     score(profile.kidney) + score(profile.cancer)) / 5
  );
  const fallPenalty = profile.recentFall === "4회 이상" ? 20 : profile.recentFall === "2~3회" ? 15 : profile.recentFall === "1회" ? 5 : 0;
  const mobility = Math.max(0, Math.round((score(profile.joint) + score(profile.stroke) + score(profile.walkingAid)) / 3) - fallPenalty);
  const cognition = score(profile.dementia);
  const sensory = Math.round((score(profile.vision) + score(profile.hearing)) / 2);
  const respiratory = score(profile.lung);
  const smokePenalty = profile.smoking === "흡연 중" ? 25 : profile.smoking === "과거 흡연 (현재 금연)" ? 10 : 0;
  const drinkPenalty = profile.drinking === "자주 (주 1회 이상)" ? 20 : profile.drinking === "가끔 (월 1~2회)" ? 5 : 0;
  const medPenalty = profile.medicineCount === "6개 이상" ? 15 : profile.medicineCount === "3~5개" ? 8 : 0;
  const lifestyle = Math.max(0, 100 - smokePenalty - drinkPenalty - medPenalty);

  return {
    만성질환: chronic,
    "관절·거동": mobility,
    "인지·정신": cognition,
    "시력·청력": sensory,
    "호흡·폐": respiratory,
    생활습관: lifestyle,
  };
};