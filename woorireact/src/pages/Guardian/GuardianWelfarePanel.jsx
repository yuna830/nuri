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
    address: elder.address,
    healthStatus: elder.condition,
    medicationInfo: elder.medications?.map((item) => item.name).filter(Boolean).join(", "),
    incomeLevel: elder.incomeLevel,
    householdType: elder.householdType,
    welfareDecision: elder.welfareDecision,
    welfareDecisionReason: elder.welfareDecisionReason,
  };
}

function cleanKoreanAnswer(value) {
  return String(value || "")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatWelfareAnswer(value) {
  return cleanKoreanAnswer(value)
    .replace(/\s+(\d+\.\s)/g, "\n\n$1")
    .replace(/\s+-\s*(추천 이유|지원 내용|신청 방법|확인 필요|근거):/g, "\n- $1:")
    .trim();
}

function summarizeWelfareAnswer(value) {
  const text = cleanKoreanAnswer(value);

  if (!text) {
    return "";
  }

  const matches = [...text.matchAll(/\d+\.\s*([^-:\n]+)/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 3);

  if (matches.length > 0) {
    return `${matches.join(", ")} 등 신청 가능성이 있습니다.`;
  }

  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
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

function GuardianWelfarePanel({ selectedElder, onOpenChat }) {
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
  const [jobPage, setJobPage] = useState(0);
  const [welfareMessages, setWelfareMessages] = useState([]);
  const [isWelfareModalOpen, setIsWelfareModalOpen] = useState(false);

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
        setJobPage(0);
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
  const jobPageSize = 2;
  const totalJobPages = Math.max(1, Math.ceil(jobApplications.length / jobPageSize));
  const pagedJobApplications = jobApplications.slice(
    jobPage * jobPageSize,
    jobPage * jobPageSize + jobPageSize
  );

  const handleAsk = async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setErrorMessage("질문을 입력해 주세요.");
      return;
    }

    const userMessage = {
      role: "user",
      text: trimmedQuestion,
    };

    setWelfareMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      setIsLoading(true);
      setErrorMessage("");

      const data = await askWelfarePolicyQuestion({
        question: trimmedQuestion,
        senior,
        audience: "guardian",
        history: welfareMessages.slice(-6),
      });

      const cleanedAnswer = cleanKoreanAnswer(data.answer);

      setAnswer(cleanedAnswer);
      setEvidence(Array.isArray(data.evidence) ? data.evidence : []);

      setWelfareMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: cleanedAnswer || "확인된 답변이 없습니다.",
        },
      ]);
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

        <button type="button" className="guardian-welfare-contact-button" onClick={onOpenChat}>
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
              {pagedJobApplications.map((job) => (
                <article key={job.id} className="guardian-job-item">
                  <div>
                    <div className="guardian-job-title-row">
                      <strong>{job.jobTitle || "일자리 정보 없음"}</strong>
                      <em>{job.status || "확인 대기"}</em>
                    </div>

                    <span>{job.organization || "기관 정보 없음"}</span>
                  </div>

                  <small>
                    {[job.location, job.requestedAt].filter(Boolean).join(" · ")}
                  </small>
                </article>
              ))}
              {jobApplications.length > jobPageSize && (
                <div className="guardian-job-pager">
                  <button type="button" onClick={() => setJobPage((page) => Math.max(0, page - 1))} disabled={jobPage === 0}>
                    &lt;
                  </button>
                  <span>{jobPage + 1} / {totalJobPages}</span>
                  <button type="button" onClick={() => setJobPage((page) => Math.min(totalJobPages - 1, page + 1))} disabled={jobPage >= totalJobPages - 1}>
                    &gt;
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="guardian-welfare-section">
          {isLoadingConsultations ? (
            <p>복지사 상담 요청을 불러오는 중입니다.</p>
          ) : !latestConsultationItem ? (
            <p>복지사가 보낸 상담 요청이나 상담 내역이 없습니다.</p>
          ) : (
            <>
              <div className="guardian-consult-section-head">
                <strong>복지사 상담 요청</strong>
                <span>{formatConsultationTime(latestConsultationItem.createdAt)}</span>
              </div>

              <div className="guardian-consult-list">
                <article key={latestConsultationItem.id} className="guardian-consult-item">
                  <p>{latestConsultationItem.message || "복지사와 상담이 필요합니다."}</p>

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
            </>
          )}
        </section>

        <div className="guardian-welfare-summary-box">
          <strong>최근 AI 확인 결과</strong>

          {answer ? (
            <p>{summarizeWelfareAnswer(answer)}</p>
          ) : latestSharedGuide?.answer ? (
            <p>{summarizeWelfareAnswer(latestSharedGuide.answer)}</p>
          ) : (
            <p>아직 확인한 복지 추천 결과가 없습니다.</p>
          )}

          <button type="button" onClick={() => setIsWelfareModalOpen(true)}>
            받을 수 있는 복지 확인
          </button>
        </div>
      </div>

      {isWelfareModalOpen && (
        <div className="guardian-welfare-modal-backdrop" onClick={() => setIsWelfareModalOpen(false)}>
          <section className="guardian-welfare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guardian-welfare-modal-header">
              <div>
                <h3>AI 복지 확인</h3>
                <p>{selectedElder?.name || "보호 대상자"}님 기준으로 받을 수 있는 복지를 확인합니다.</p>
              </div>

              <button type="button" onClick={() => setIsWelfareModalOpen(false)}>
                닫기
              </button>
            </div>

            <div className="guardian-welfare-modal-body">
              <div className="guardian-welfare-chat-list">
                {welfareMessages.length === 0 && latestSharedGuide?.answer && (
                  <article className="guardian-welfare-chat-message assistant">
                    <p>{formatWelfareAnswer(latestSharedGuide.answer)}</p>
                  </article>
                )}

                {welfareMessages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`guardian-welfare-chat-message ${message.role}`}
                  >
                    <p>
                      {message.role === "assistant"
                        ? formatWelfareAnswer(message.text)
                        : message.text}
                    </p>

                    {/* 마지막 assistant 메시지에만 출처 표시 */}
                    {message.role === "assistant" &&
                      index === welfareMessages.length - 1 &&
                      evidence.length > 0 && (
                        <div className="guardian-welfare-sources">
                          <span className="guardian-welfare-sources-label">출처</span>
                          {evidence.map((src, i) => (
                            <span key={i} className="guardian-welfare-source-tag">
                              {src.service_name || src.filename || "복지 문서"}
                              {src.department ? ` · ${src.department}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                  </article>
                ))}

                {isLoading && (
                  <article className="guardian-welfare-chat-message assistant">
                    <p>확인 중입니다...</p>
                  </article>
                )}
              </div>

              {errorMessage && (
                <p className="guardian-welfare-error">{errorMessage}</p>
              )}

              <div className="guardian-welfare-modal-compose">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={`${selectedElder?.name || "보호 대상자"}님이 받을 수 있는 복지 제도를 알려줘`}
                />

                <button type="button" onClick={handleAsk} disabled={isLoading}>
                  {isLoading ? "확인 중" : "질문"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

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
                상담 방식을 선택해 주세요.
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
                  <strong>상담 일정 정하기</strong>
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
                선택 내용을 확인하면 복지사 화면에 보호자 응답 상태로 표시됩니다.
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
                  ? "이미 응답됨"
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
