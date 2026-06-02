import { useEffect, useState } from "react";
import { HelpCircle, Send } from "lucide-react";

import WelfareCommonHeader from "../../components/welfare/WelfareCommonHeader.jsx";
import WelfareSidebar from "../../components/welfare/WelfareSidebar";
import { fetchWelfareSeniors } from "../../api/welfareDashboardApi";
import {
    askWelfarePolicyQuestion,
    fetchWelfarePolicyChatHistory,
    saveWelfarePolicyChatHistory,
} from "../../api/welfarePolicyQaApi";
import { fetchSeniorJobApplications } from "../../api/welfareJobApi";
import { fetchWelfareSeniorDetail } from "../../api/welfareDashboardApi";

import "../../css/welfare/WelfareDashboard.css";
import "../../css/welfare/WelfarePolicyChat.css";

function cleanAnswerText(value) {
    return String(value || "")
        .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function WelfarePolicyChatPage() {
    const [seniors, setSeniors] = useState([]);
    const [selectedSeniorId, setSelectedSeniorId] = useState("");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [jobApplications, setJobApplications] = useState([]);
    const [selectedSeniorDetail, setSelectedSeniorDetail] = useState(null);

    const selectedSenior = seniors.find((senior) => String(senior.id) === selectedSeniorId) || null;

    useEffect(() => {
        const currentWorker = JSON.parse(
            sessionStorage.getItem("currentWelfareWorker") ||
            localStorage.getItem("currentWelfareWorker") ||
            "null"
        );

        const workerId = currentWorker?.id || currentWorker?.worker?.id;

        if (!workerId) {
            setSeniors([]);
            return;
        }

        fetchWelfareSeniors({ page: 0, size: 100, welfareWorkerId: workerId })
            .then((data) => setSeniors(Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []))
            .catch(() => setSeniors([]));
    }, []);

    useEffect(() => {
        if (!selectedSeniorId) {
            setSelectedSeniorDetail(null);
            setJobApplications([]);
            return;
        }

        Promise.all([
            fetchWelfareSeniorDetail(selectedSeniorId),
            fetchSeniorJobApplications(selectedSeniorId),
        ])
            .then(([detail, applications]) => {
                setSelectedSeniorDetail(detail);
                setJobApplications(applications);
            })
            .catch(() => {
                setSelectedSeniorDetail(null);
                setJobApplications([]);
            });
    }, [selectedSeniorId]);

    useEffect(() => {
        if (!selectedSeniorId) {
            setMessages([]);
            return;
        }

        let ignore = false;

        const loadHistory = async () => {
            const histories = await fetchWelfarePolicyChatHistory(selectedSeniorId);

            if (ignore) return;

            setMessages(
                histories.flatMap((history) => [
                    {
                        role: "user",
                        text: history.question,
                    },
                    {
                        role: "assistant",
                        text: history.answer,
                    },
                ])
            );
        };

        loadHistory();

        return () => {
            ignore = true;
        };
    }, [selectedSeniorId]);

    const handleAsk = async () => {
        const trimmed = question.trim();
        if (!trimmed) return;

        setQuestion("");

        setMessages((prev) => [
            ...prev,
            {
                role: "user",
                text: trimmed,
            },
        ]);

        setIsLoading(true);

        try {
            const profileForRag = selectedSenior
                ? {
                    ...selectedSenior,
                    ...(selectedSeniorDetail?.senior || selectedSeniorDetail || {}),
                    healthInfo: selectedSeniorDetail?.healthInfo || selectedSenior?.healthInfo,
                    jobPreference: selectedSeniorDetail?.jobPreference || selectedSenior?.jobPreference,
                    jobApplications,
                }
                : null;

            const data = await askWelfarePolicyQuestion({
                question: trimmed,
                senior: profileForRag,
                audience: "worker",
            });

            const answerText = cleanAnswerText(data.answer) || "확인된 답변이 없습니다.";

            const currentWorker = JSON.parse(
                sessionStorage.getItem("currentWelfareWorker") ||
                localStorage.getItem("currentWelfareWorker") ||
                "null"
            );

            if (profileForRag?.id) {
                await saveWelfarePolicyChatHistory({
                    seniorId: profileForRag.id,
                    workerId: currentWorker?.id || currentWorker?.worker?.id || null,
                    question: trimmed,
                    answer: answerText,
                    evidence: data.evidence || [],
                });
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: answerText,
                },
            ]);

        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="wd-page">
            <WelfareCommonHeader rightText="AI 복지 확인" />

            <div className="wd-layout">
                <WelfareSidebar active="policy-chat" />

                <main className="wd-content">
                    <section className="wpc-panel">
                        <div className="wpc-head">
                            <div>
                                <h1>AI 복지 확인</h1>
                                <p>대상자 정보와 복지 정책 문서를 기준으로 지원 가능 제도를 확인합니다.</p>
                            </div>
                            <HelpCircle size={24} />
                        </div>

                        <select
                            className="wpc-select"
                            value={selectedSeniorId}
                            onChange={(event) => setSelectedSeniorId(event.target.value)}
                        >
                            <option value="">대상자 선택 없이 질문하기</option>
                            {seniors.map((senior) => (
                                <option key={senior.id} value={senior.id}>
                                    {senior.name}
                                </option>
                            ))}
                        </select>

                        <div className="wpc-history">
                            {messages.map((message, index) => (
                                <article key={index} className={`wpc-message ${message.role}`}>
                                    {message.role === "assistant" ? cleanAnswerText(message.text) : message.text}
                                </article>
                            ))}

                            {isLoading && (
                                <article className="wpc-message assistant">
                                    확인하는 중입니다...
                                </article>
                            )}
                        </div>

                        <div className="wpc-input-row">
                            <textarea
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder="예: 최순자 대상자가 받을 수 있는 복지제도 알려줘"
                            />
                            <button type="button" onClick={handleAsk} disabled={isLoading}>
                                <Send size={17} />
                                질문
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default WelfarePolicyChatPage;