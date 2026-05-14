import {
    AlertTriangle,
    CheckCircle2,
    ClipboardList,
    Clock,
    Phone,
    UserRoundX,
} from "lucide-react";

const SUMMARY_CARD_CONFIGS = {
    seniors: [
        {
            key: "all",
            label: "전체 대상자",
            valueKey: "totalSeniors",
            unit: "명",
            icon: ClipboardList,
        },
        {
            key: "emergency",
            label: "긴급 확인 필요",
            valueKey: "emergencyRequired",
            unit: "명",
            icon: AlertTriangle,
        },
        {
            key: "missingInfo",
            label: "정보 미입력",
            valueKey: "missingInfo",
            unit: "명",
            icon: UserRoundX,
        },
    ],
    jobs: [
        {
            key: "all",
            label: "전체 신청",
            valueKey: "totalApplications",
            unit: "건",
            icon: ClipboardList,
        },
        {
            key: "pending",
            label: "검토 대기",
            valueKey: "pendingReview",
            unit: "건",
            icon: Clock,
        },
        {
            key: "phone",
            label: "전화 상담 요청",
            valueKey: "phoneConsultationRequests",
            unit: "건",
            icon: Phone,
        },
        {
            key: "completed",
            label: "처리 완료",
            valueKey: "completed",
            unit: "건",
            icon: CheckCircle2,
        },
    ],
};

function WelfareSummaryCards({ mode = "seniors", counts = {}, onFilter }) {
    const cards = SUMMARY_CARD_CONFIGS[mode] || SUMMARY_CARD_CONFIGS.seniors;

    return (
        <section
            className={`wd-summary-grid ${
                mode === "seniors" ? "wd-summary-grid-three" : ""
            }`}
        >
            {cards.map(({ key, label, valueKey, unit, icon: Icon }) => (
                <button
                    key={key}
                    type="button"
                    className="wd-summary-card"
                    onClick={() => onFilter?.(key)}
                >
                    <div>
                        <span>{label}</span>
                        <strong>
                            {counts[valueKey] || 0}
                            {unit}
                        </strong>
                    </div>
                    <Icon size={22} />
                </button>
            ))}
        </section>
    );
}

export default WelfareSummaryCards;