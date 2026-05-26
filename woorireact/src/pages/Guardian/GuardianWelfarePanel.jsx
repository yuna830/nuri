import { useEffect, useMemo, useState } from "react";
import {
  getGuardianAlerts,
  getSeniorJobInterests,
  respondWelfareConsultation,
} from "../../api/guardianApi";
import { getCurrentGuardianId } from "../../utils/guardian/guardianSession";
import {
  askWelfarePolicyQuestion,
  fetchWelfarePolicyChatHistory,
} from "../../api/welfarePolicyQaApi";

const CONSULTATION_ALERT_TYPES = new Set([
  "WELFARE_CONSULT_REQUEST",
  "WELFARE_CONSULTATION",
  "CONSULT_REQUEST",
  "CONSULTATION_REQUEST",
]);

function normalizeElderForWelfare(elder) {
  if (!elder) return null;

  return {
    id: elder.id,
    name: elder.name,
    age: String(elder.age || "").replace(/[^0-9]/g, ""),
    gender: elder.gender === "-" ? "" : elder.gender,
    region: elder.address,
    healthStatus: elder.condition,
    medicationInfo: elder.medications?.map((item) => item.name).filter(Boolean).join(", "),
    welfareDecision: elder.welfareDecision,
    welfareDecisionReason: elder.welfareDecisionReason,
  };
}

function cleanKoreanAnswer(value) {
  return String(value || "")
    .replaceAll("さん", "님")
    .replaceAll("氏", "님")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatConsultationTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GuardianWelfarePanel({ selectedElder }) {
  const [histories, setHistories] = useState([]);
  const [jobApplications, setJobApplications] = useState([]);
  const [consultationItems, setConsultationItems] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [isConfirmingConsultation, setIsConfirmingConsultation] = useState(false);
  const [consultationResponseType, setConsultationResponseType] = useState("now");
  const [consultationScheduleAt, setConsultationScheduleAt] = useState("");

  const senior = useMemo(
    () => normalizeElderForWelfare(selectedElder),
    [selectedElder]
  );

  useEffect(() => {
    if (!selectedElder?.id) {
      setHistories([]);
      setJobApplications([]);
      setConsultationItems([]);
      return;
    }

    let ignore = false;

    const loadPanelData = async () => {
      const guardianId = getCurrentGuardianId();

      setIsLoadingJobs(true);
      setIsLoadingConsultations(Boolean(guardianId));

      const [historyData, jobData, alertData] = await Promise.all([
        fetchWelfarePolicyChatHistory(selectedElder.id),
        getSeniorJobInterests(selectedElder.id),
        guardianId ? getGuardianAlerts(guardianId) : Promise.resolve([]),
      ]);

      if (!ignore) {
        setHistories(Array.isArray(historyData) ? historyData : []);
        setJobApplications(Array.isArray(jobData) ? jobData : []);
        setConsultationItems(
          Array.isArray(alertData)
            ? alertData.filter((item) => (
                String(item.seniorId) === String(selectedElder.id)
                && CONSULTATION_ALERT_TYPES.has(item.type)
              ))
            : []
        );
        setIsLoadingJobs(false);
        setIsLoadingConsultations(false);
      }
    };

    loadPanelData().catch(() => {
      if (!ignore) {
        setHistories([]);
        setJobApplications([]);
        setConsultationItems([]);
        setIsLoadingJobs(false);
        setIsLoadingConsultations(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [selectedElder?.id]);

  const latestSharedGuide = histories
    .filter((item) => item.answer)
    .slice()
    .reverse()
    .find((item) => item.answer);

  const latestConsultationItem = consultationItems
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

  const handleAsk = async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setErrorMessage("질문을 입력해주세요.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      const data = await askWelfarePolicyQuestion({
        question: trimmedQuestion,
        senior,
        audience: "guardian",
        history: latestSharedGuide
          ? [
              {
                role: "assistant",
                text: cleanKoreanAnswer(latestSharedGuide.answer),
              },
            ]
          : [],
      });

      setAnswer(cleanKoreanAnswer(data.answer));
      setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
    } catch (error) {
      setErrorMessage(error.message || "복지 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmConsultation = async () => {
    if (!selectedConsultation?.id) return;

    try {
        setIsConfirmingConsultation(true);
        setErrorMessage("");

        const updatedAlert = await respondWelfareConsultation(selectedConsultation.id, {
        responseType: consultationResponseType,
        scheduleAt: consultationResponseType === "schedule" ? consultationScheduleAt : "",
        });

        setConsultationItems((prev) =>
        prev.map((item) =>
            item.id === selectedConsultation.id ? updatedAlert : item
        )
        );

        setSelectedConsultation(null);
        setConsultationResponseType("now");
        setConsultationScheduleAt("");
    } catch (error) {
        console.error("상담 요청 응답 저장 실패:", error);
        setErrorMessage("상담 요청 응답 저장에 실패했습니다.");
    } finally {
        setIsConfirmingConsultation(false);
    }
};

  return (
    <section className="card guardian-welfare-card">
      <div className="card-header guardian-welfare-header">
        <h2>복지 확인</h2>

        <button type="button" className="guardian-welfare-contact-button">
          복지사에게 문의
        </button>
      </div>

      <div className="guardian-welfare-body">
        <section className="guardian-welfare-section">
          <strong>일자리 신청 현황</strong>

          {isLoadingJobs ? (
            <p>일자리 신청 현황을 불러오는 중입니다.</p>
          ) : jobApplications.length === 0 ? (
            <p>신청 또는 추천된 일자리 내역이 없습니다.</p>
          ) : (
            <div className="guardian-job-list">
              {jobApplications.map((job) => (
                <article key={job.id} className="guardian-job-item">
                  <div>
                    <strong>{job.jobTitle || "일자리 정보 없음"}</strong>
                    <span>{job.organization || "기관 정보 없음"}</span>
                  </div>

                  <em>{job.status || "확인 대기"}</em>

                  <small>
                    {[job.location, job.requestedAt].filter(Boolean).join(" · ")}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="guardian-welfare-section">
          <strong>복지사 상담</strong>

          {isLoadingConsultations ? (
            <p>복지사 상담 요청을 불러오는 중입니다.</p>
          ) : !latestConsultationItem ? (
            <p>복지사가 보낸 상담 요청이나 상담 내역이 없습니다.</p>
          ) : (
            <div className="guardian-consult-list">
                <article key={latestConsultationItem.id} className="guardian-consult-item">
                  <div>
                    <strong>{latestConsultationItem.title || "상담 요청"}</strong>
                    <span>{formatConsultationTime(latestConsultationItem.createdAt)}</span>
                  </div>

                  <p>{latestConsultationItem.message || "복지사가 상담 확인을 요청했습니다."}</p>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConsultation(latestConsultationItem);
                      setConsultationResponseType(latestConsultationItem.guardianResponseType || "now");
                      setConsultationScheduleAt(latestConsultationItem.guardianScheduleAt || "");
                    }}
                  >
                    상담 선택
                  </button>
                </article>
            </div>
          )}
        </section>

        <div className="guardian-welfare-question">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={`${selectedElder?.name || "보호 대상자"}님이 받을 수 있는 복지를 물어보세요.`}
          />

          {answer && (
            <article className="guardian-welfare-answer">
              <strong>AI 확인 결과</strong>
              <p>{answer}</p>

              {evidence.length > 0 && (
                <span>
                  복지 문서와 공공 데이터 근거를 참고했습니다. 실제 신청 전 주민센터 또는 복지로에서 최종 확인이 필요합니다.
                </span>
              )}
            </article>
          )}

          {errorMessage && (
            <p className="guardian-welfare-error">{errorMessage}</p>
          )}

          <button type="button" onClick={handleAsk} disabled={isLoading}>
            {isLoading ? "확인 중..." : "AI로 확인"}
          </button>
        </div>
      </div>

      {selectedConsultation && (
        <div className="guardian-consult-modal-backdrop">
            <section className="guardian-consult-modal">
            <div className="guardian-consult-modal-header">
                <h3>복지사 상담 요청</h3>

                <button
                type="button"
                onClick={() => setSelectedConsultation(null)}
                >
                닫기
                </button>
            </div>

            <div className="guardian-consult-modal-body">
                <strong>
                {selectedConsultation.title || "복지사 상담 요청"}
                </strong>

                <p>
                {selectedConsultation.message ||
                    "복지사가 보호자 상담 확인을 요청했습니다."}
                </p>

                <div className="guardian-consult-choice-heading">
                    상담 방식을 선택해 주세요
                </div>

                <div className="guardian-consult-choice-group">
                    <button
                    type="button"
                    className={consultationResponseType === "now" ? "active" : ""}
                    onClick={() => setConsultationResponseType("now")}
                    >
                    <strong>지금 바로 상담 가능</strong>
                    <span>복지사 확인 후 연락 가능</span>
                    </button>

                    <button
                    type="button"
                    className={consultationResponseType === "schedule" ? "active" : ""}
                    onClick={() => setConsultationResponseType("schedule")}
                    >
                    <strong>상담 날짜 정하기</strong>
                    <span>가능한 날짜와 시간을 선택 후 전달</span>
                    </button>
                </div>

                {consultationResponseType === "schedule" && (
                    <label className="guardian-consult-schedule-field">
                    상담 희망 일시
                    <input
                        type="datetime-local"
                        value={consultationScheduleAt}
                        onChange={(event) => setConsultationScheduleAt(event.target.value)}
                    />
                    </label>
                )}

                <small>
                선택 내용을 확인하면 복지사 화면에 보호자 확인 완료 상태로 표시됩니다.
                </small>
            </div>

            <div className="guardian-consult-modal-actions">
                <button
                type="button"
                onClick={handleConfirmConsultation}
                disabled={
                    isConfirmingConsultation
                    || selectedConsultation.guardianResponseType
                    || (consultationResponseType === "schedule" && !consultationScheduleAt)
                }
                >
                {selectedConsultation.guardianResponseType
                    ? "이미 응답함"
                    : isConfirmingConsultation
                    ? "응답 저장 중..."
                    : "응답 완료"}
                </button>
            </div>
            </section>
        </div>
    )}
    </section>
  );
}

export default GuardianWelfarePanel;
