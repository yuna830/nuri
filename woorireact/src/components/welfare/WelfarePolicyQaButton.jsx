import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

import {
    askWelfarePolicyQuestion,
    fetchWelfarePolicyChatHistory,
    saveWelfarePolicyChatHistory,
} from "../../api/welfarePolicyQaApi";

import "../../css/welfare/WelfarePolicyQaButton.css";

const PDF_SOURCE_LABELS = {
    "Welfare_System_Guidebook.pdf": {
        organization: "보건복지부",
        title: "복지제도 안내서",
    },
};

function getEvidenceDisplay(item) {
    if (item.source_type === "public_api") {
        return {
            organization: item.department || "공공데이터포털",
            title: item.service_name || "복지 서비스",
        };
    }

    const fileSource = PDF_SOURCE_LABELS[item.filename] || {
        organization: "복지 자료",
        title: item.filename ? item.filename.replace(/\.pdf$/i, "") : "참고 문서",
    };

    return fileSource;
}

function getUniqueEvidenceItems(evidence = []) {
    const seen = new Set();

    return evidence.filter((item) => {
        const display = getEvidenceDisplay(item);
        const key = `${display.organization}-${display.title}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function parseEvidenceJson(value) {
    try {
        return JSON.parse(value || "[]");
    } catch {
        return [];
    }
}

function WelfarePolicyQaButton({ senior = null, seniorOptions = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState("");
    const [selectedSeniorId, setSelectedSeniorId] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const availableSeniors = Array.isArray(seniorOptions) ? seniorOptions : [];
    const selectedSenior = senior || availableSeniors.find((item) => String(item.id) === selectedSeniorId) || null;

    const resolveSeniorForQuestion = (trimmedQuestion) => {
        if (selectedSenior) {
            return selectedSenior;
        }

        return availableSeniors.find((item) => {
            const name = String(item.name || "").trim();
            return name && trimmedQuestion.includes(name);
        }) || null;
    };

    const handleClose = () => {
        setIsOpen(false);
        setErrorMessage("");
    };

    useEffect(() => {
        if (!selectedSenior?.id) {
            setMessages([]);
            return;
        }

        let ignore = false;

        const loadHistory = async () => {
            const histories = await fetchWelfarePolicyChatHistory(selectedSenior.id);

            if (ignore) return;

            setMessages(
                histories.flatMap((history) => [
                    {
                        id: `${history.id}-user`,
                        role: "user",
                        text: history.question,
                        targetName: selectedSenior.name,
                    },
                    {
                        id: `${history.id}-assistant`,
                        role: "assistant",
                        text: history.answer,
                        evidence: parseEvidenceJson(history.evidenceJson),
                    },
                ])
            );
        };

        loadHistory();

        return () => {
            ignore = true;
        };
    }, [selectedSenior?.id]);

    const handleAsk = async () => {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            setErrorMessage("질문을 입력해 주세요.");
            return;
        }

        const targetSenior = resolveSeniorForQuestion(trimmedQuestion);

        if (!targetSenior && availableSeniors.length > 0) {
            setErrorMessage("대상자를 선택하거나 질문에 대상자 이름을 포함해 주세요.");
            return;
        }

        const askedAt = Date.now();
        const targetName = targetSenior?.name || "전체 제도";

        setMessages((previous) => [
            ...previous,
            {
                id: `${askedAt}-user`,
                role: "user",
                text: trimmedQuestion,
                targetName,
            },
        ]);
        setQuestion("");

        try {
            setIsLoading(true);
            setErrorMessage("");

            const recentMessages = messages.slice(-6).map((message) => ({
                role: message.role,
                text: message.text,
            }));

            const data = await askWelfarePolicyQuestion({
                question: trimmedQuestion,
                senior: targetSenior,
                history: recentMessages,
            });

            const currentWorker = JSON.parse(sessionStorage.getItem("currentWelfareWorker") || "null");

            if (targetSenior?.id) {
                await saveWelfarePolicyChatHistory({
                    seniorId: targetSenior.id,
                    workerId: currentWorker?.id,
                    question: trimmedQuestion,
                    answer: data.answer || "",
                    evidence: data.evidence || [],
                });
            }

            setMessages((previous) => [
                ...previous,
                {
                    id: `${askedAt}-assistant`,
                    role: "assistant",
                    text: data.answer || "답변을 찾지 못했습니다.",
                    evidence: Array.isArray(data.evidence) ? data.evidence : [],
                },
            ]);
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
                                    {selectedSenior?.name
                                        ? `${selectedSenior.name} 대상자 정보를 기준으로 복지 제도를 질문할 수 있습니다.`
                                        : "대상자를 먼저 선택하거나 질문에 대상자 이름을 포함해 주세요."}
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

                        {!senior && availableSeniors.length > 0 && (
                            <label className="wpq-target-field">
                                <span>대상자</span>
                                <select
                                    value={selectedSeniorId}
                                    onChange={(event) => setSelectedSeniorId(event.target.value)}
                                >
                                    <option value="">질문 속 이름으로 찾기 또는 직접 선택</option>
                                    {availableSeniors.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                            {item.gender || item.age ? ` (${[item.gender, item.age].filter(Boolean).join(", ")})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <div className="wpq-chat-history" aria-live="polite">
                            {messages.length === 0 ? (
                                <p className="wpq-chat-empty">아직 대화 내역이 없습니다.</p>
                            ) : (
                                messages.map((message) => (
                                    <article key={message.id} className={`wpq-chat-message ${message.role}`}>
                                        {message.role === "user" && (
                                            <span className="wpq-message-target">{message.targetName}</span>
                                        )}
                                        <p>{message.text}</p>

                                        {message.evidence?.length > 0 && (
                                            <div className="wpq-evidence">
                                                <strong>출처</strong>

                                                <ul>
                                                    {getUniqueEvidenceItems(message.evidence).map((item, index) => {
                                                        const display = getEvidenceDisplay(item);

                                                        return (
                                                            <li key={`${message.id}-${display.organization}-${display.title}-${index}`}>
                                                                <span>{display.organization}</span>{" "}
                                                                <strong>{display.title}</strong>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </article>
                                ))
                            )}

                            {isLoading && (
                                <article className="wpq-chat-message assistant">
                                    <p>확인하는 중입니다...</p>
                                </article>
                            )}
                        </div>

                        <textarea
                            className="wpq-question-input"
                            value={question}
                            onChange={(event) => setQuestion(event.target.value)}
                            placeholder="예: 김나리 대상자가 받을 수 있는 복지 제도를 알려줘"
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
                    </section>
                </div>
            )}
        </>
    );
}

export default WelfarePolicyQaButton;
