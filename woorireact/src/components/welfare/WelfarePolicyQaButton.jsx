import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

import { askWelfarePolicyQuestion } from "../../api/welfarePolicyQaApi";

import "../../css/welfare/WelfarePolicyQaButton.css";

function WelfarePolicyQaButton({ senior = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleClose = () => {
        setIsOpen(false);
        setErrorMessage("");
    };

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
            });

            setAnswer(data);
        } catch (error) {
            setErrorMessage(error.message || "답변을 불러오지 못했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                type="button"
                className="wpq-floating-button"
                onClick={() => setIsOpen(true)}
                aria-label="제도 Q&A 열기"
                title="제도 Q&A"
            >
                <HelpCircle size={25} />
            </button>

            {isOpen && (
                <div className="wpq-overlay" onClick={handleClose}>
                    <section className="wpq-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="wpq-header">
                            <div>
                                <h2>제도 Q&A</h2>
                                <p>
                                    {senior?.name
                                        ? `${senior.name}님 기준으로 복지 제도를 질문할 수 있습니다.`
                                        : "복지 제도와 신청 기준을 질문할 수 있습니다."}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="wpq-close-button"
                                onClick={handleClose}
                                aria-label="닫기"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <textarea
                            className="wpq-question-input"
                            value={question}
                            onChange={(event) => setQuestion(event.target.value)}
                            placeholder="예: 이 대상자가 받을 수 있는 복지 제도를 알려줘"
                        />

                        <div className="wpq-action-row">
                            <button
                                type="button"
                                className="wpq-ask-button"
                                onClick={handleAsk}
                                disabled={isLoading}
                            >
                                {isLoading ? "확인 중..." : "질문하기"}
                            </button>
                        </div>

                        {errorMessage && (
                            <p className="wpq-error-message">{errorMessage}</p>
                        )}

                        {answer?.answer && (
                            <div className="wpq-answer-box">
                                <strong>답변</strong>
                                <p>{answer.answer}</p>

                                {answer.evidence?.length > 0 && (
                                    <div className="wpq-evidence">
                                        <strong>근거 문서</strong>

                                        <ul>
                                            {answer.evidence.map((item, index) => {
                                                const isPublicApi = item.source_type === "public_api";
                                                const title = isPublicApi
                                                    ? item.service_name || "공공데이터 복지 서비스"
                                                    : item.filename || "PDF 문서";

                                                const sourceLabel = isPublicApi ? "공공데이터" : "PDF";

                                                return (
                                                    <li key={`${item.document_id || "source"}-${item.chunk_index ?? index}`}>
                                                        <span>{sourceLabel}</span>{" "}
                                                        <strong>{title}</strong>
                                                        {item.chunk_index != null ? ` #${item.chunk_index}` : ""}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </>
    );
}

export default WelfarePolicyQaButton;
