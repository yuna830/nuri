import { useEffect, useMemo, useState } from "react";
import {
  askWelfarePolicyQuestion,
  fetchWelfarePolicyChatHistory,
} from "../../api/welfarePolicyQaApi";

function parseEvidenceJson(value) {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

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

function GuardianWelfarePanel({ selectedElder }) {
  const [histories, setHistories] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const senior = useMemo(
    () => normalizeElderForWelfare(selectedElder),
    [selectedElder]
  );

  useEffect(() => {
    if (!selectedElder?.id) {
      setHistories([]);
      return;
    }

    let ignore = false;

    const loadHistories = async () => {
      const data = await fetchWelfarePolicyChatHistory(selectedElder.id);

      if (!ignore) {
        setHistories(Array.isArray(data) ? data : []);
      }
    };

    loadHistories();

    return () => {
      ignore = true;
    };
  }, [selectedElder?.id]);

  const latestWorkerGuides = histories
    .filter((item) => item.answer)
    .slice(-3)
    .reverse();

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
        history: latestWorkerGuides.slice(0, 3).map((item) => ({
          role: "assistant",
          text: item.answer,
        })),
      });

      setAnswer(data.answer || "");
      setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
      setQuestion("");
    } catch (error) {
      setErrorMessage(error.message || "복지 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="card guardian-welfare-card">
      <div className="card-header">
        <h2>복지 확인</h2>
      </div>

      <div className="guardian-welfare-body">
        {latestWorkerGuides.length > 0 && (
          <div className="guardian-worker-guide">
            <strong>복지사가 확인한 안내</strong>

            {latestWorkerGuides.map((guide) => (
              <article key={guide.id} className="guardian-worker-guide-item">
                <span>{guide.question}</span>
                <p>{guide.answer}</p>

                {parseEvidenceJson(guide.evidenceJson).length > 0 && (
                  <em>근거 자료가 함께 확인되었습니다.</em>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="guardian-welfare-list">
          <div>
            <strong>기초연금</strong>
            <span>65세 이상 대상자라면 우선 확인</span>
          </div>

          <div>
            <strong>노인 일자리 및 사회활동 지원</strong>
            <span>활동 가능 여부와 기초연금 수급 여부 확인</span>
          </div>

          <div>
            <strong>노인맞춤돌봄서비스</strong>
            <span>독거 여부, 돌봄 필요도 확인</span>
          </div>
        </div>

        <div className="guardian-welfare-question">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={`${selectedElder?.name || "보호 대상자"}님이 받을 수 있는 복지를 물어보세요.`}
          />

          <button type="button" onClick={handleAsk} disabled={isLoading}>
            {isLoading ? "확인 중..." : "AI로 확인"}
          </button>
        </div>

        {answer && (
          <article className="guardian-welfare-answer">
            <strong>AI 확인 결과</strong>
            <p>{answer}</p>

            {evidence.length > 0 && (
              <span>복지 문서와 공공 데이터 근거를 참고했습니다.</span>
            )}
          </article>
        )}

        {errorMessage && (
          <p className="guardian-welfare-error">{errorMessage}</p>
        )}

        <button type="button" className="guardian-welfare-button">
          복지사에게 문의
        </button>
      </div>
    </section>
  );
}

export default GuardianWelfarePanel;