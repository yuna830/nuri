export const askWelfareBenefitAi = async ({ seniorId, question }) => {
    const response = await fetch("/api/welfare/rag/benefits/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            seniorId,
            question,
        }),
    });

    if (!response.ok) {
        throw new Error("복지 제도 Q&A 요청 실패");
    }

    return response.json();
};
