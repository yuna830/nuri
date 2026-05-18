import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Send, X } from "lucide-react";
import { askWelfareBenefitAi } from "../../api/welfareAiApi";

import "../../css/welfare/WelfareBenefitQa.css";

function WelfareBenefitQa({ seniors = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [selectedSeniorId, setSelectedSeniorId] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const messagesRef = useRef(null);

    const selectedSenior = useMemo(() => {
        return (
            seniors.find((senior) => String(senior.id) === String(selectedSeniorId)) ||
            seniors[0] ||
            null
        );
    }, [seniors, selectedSeniorId]);

    useEffect(() => {
        messagesRef.current?.scrollTo({
            top: messagesRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, isLoading]);

    const openModal = () => {
        if (!selectedSeniorId && seniors[0]?.id) {
            setSelectedSeniorId(String(seniors[0].id));
        }

        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
        setError("");
    };

    const handleAsk = async () => {
        const question = input.trim();

        if (!selectedSenior?.id) {
            setError("질문할 대상자를 선택해주세요.");
            return;
        }

        if (!question) {
            setError("질문을 입력해주세요.");
            return;
        }

        const userMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: question,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError("");

        try {
            setIsLoading(true);

            const result = await askWelfareBenefitAi({
                seniorId: selectedSenior.id,
                question,
            });

            const assistantMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: result.answer || "답변을 생성하지 못했습니다.",
                sources: result.sources || [],
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "답변을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
                    isError: true,
                    sources: [],
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleAsk();
        }
    };

    return (
        <>
            <button
                type="button"
                className="welfare-qa-fab"
                onClick={openModal}
                aria-label="제도 Q&A 열기"
            >
                <CircleHelp size={28} />
            </button>

            {isOpen && (
                <div className="welfare-qa-overlay" onClick={closeModal}>
                    <section
                        className="welfare-qa-panel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="welfare-qa-header">
                            <div>
                                <h2>제도 Q&amp;A</h2>
                                <p>공공데이터 기반으로 복지 제도와 신청 기준을 확인합니다.</p>
                            </div>

                            <button
                                type="button"
                                className="welfare-qa-close"
                                onClick={closeModal}
                                aria-label="닫기"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {seniors.length > 0 && (
                            <label className="welfare-qa-select-label">
                                대상자
                                <select
                                    value={selectedSenior?.id || ""}
                                    onChange={(event) => {
                                        setSelectedSeniorId(event.target.value);
                                        setMessages([]);
                                        setError("");
                                    }}
                                >
                                    {seniors.map((senior) => (
                                        <option key={senior.id} value={senior.id}>
                                            {senior.name} · ID {String(senior.id).padStart(4, "0")}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <div ref={messagesRef} className="welfare-qa-messages">
                            {messages.length === 0 && (
                                <div className="welfare-qa-empty">
                                    <strong>무엇을 확인할까요?</strong>
                                    <p>
                                        대상자 정보와 지자체 복지서비스 문서를 함께 보고 답변합니다.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setInput("이 대상자가 받을 수 있는 복지 제도를 알려줘")
                                        }
                                    >
                                        받을 수 있는 제도 찾기
                                    </button>
                                </div>
                            )}

                            {messages.map((message) => (
                                <article
                                    key={message.id}
                                    className={`welfare-qa-message ${message.role} ${
                                        message.isError ? "error" : ""
                                    }`}
                                >
                                    <p>{message.content}</p>

                                    {message.sources?.length > 0 && (
                                        <div className="welfare-qa-sources">
                                            <span>참고 문서</span>
                                            {message.sources.map((source, index) => (
                                                <em key={`${source.title}-${index}`}>
                                                    {source.title}
                                                </em>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            ))}

                            {isLoading && (
                                <div className="welfare-qa-message assistant loading">
                                    답변을 생성하는 중입니다.
                                </div>
                            )}
                        </div>

                        {error && <p className="welfare-qa-error">{error}</p>}

                        <div className="welfare-qa-input-row">
                            <textarea
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="예: 이 대상자가 받을 수 있는 복지 제도를 알려줘"
                                className="welfare-qa-input"
                            />

                            <button
                                type="button"
                                onClick={handleAsk}
                                disabled={isLoading}
                                aria-label="질문하기"
                            >
                                <Send size={18} />
                                질문
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

export default WelfareBenefitQa;
