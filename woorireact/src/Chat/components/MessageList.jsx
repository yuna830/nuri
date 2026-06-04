import { forwardRef, Fragment } from "react";
import { Link } from "react-router-dom";

const FALLBACK_MESSAGE_TIME = Date.now();

function formatMessageTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function parseFoodAnalysis(content) {
  const normalizedContent = String(content || "").replace(/^\d+번째 사진\s*\n/, "");
  if (!normalizedContent.startsWith("성분표 분석이 끝났어요.")) return null;

  const lines = normalizedContent.split("\n").map((line) => line.trim());
  const nutrientsStart = lines.indexOf("영양성분");
  const warningsStart = lines.indexOf("주의사항");
  if (nutrientsStart < 0 || warningsStart < 0) return null;

  const product = lines.find((line) => line.startsWith("제품명:"))?.replace("제품명:", "").trim();
  const nutrients = lines
    .slice(nutrientsStart + 1, warningsStart)
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const [label, ...valueParts] = line.slice(2).split(":");
      return { label: label.trim(), value: valueParts.join(":").trim() };
    });
  const warnings = lines.slice(warningsStart + 1).filter((line) => line.startsWith("- "));
  const allergyStart = Math.max(
    lines.indexOf("개인 알레르기 주의"),
    lines.indexOf("개인 알레르기 경고")
  );
  const noticeStart = lines.indexOf("알레르기 확인 안내");
  const notices = [];

  if (allergyStart >= 0) {
    notices.push({
      type: "danger",
      title: "개인 알레르기 주의",
      lines: lines.slice(allergyStart + 1, noticeStart >= 0 ? noticeStart : nutrientsStart).filter((line) => line.startsWith("- ")),
    });
  }
  if (noticeStart >= 0) {
    notices.push({
      type: "notice",
      title: "알레르기 확인 안내",
      lines: lines.slice(noticeStart + 1, nutrientsStart).filter((line) => line.startsWith("- ")),
    });
  }

  return { product, nutrients, warnings, notices };
}

function FoodAnalysisMessage({ analysis }) {
  return (
    <div className="food-analysis-card">
      <strong className="food-analysis-title">성분표 분석 결과</strong>
      <p className="food-analysis-product">제품명: {analysis.product || "확인 필요"}</p>

      <table className="food-nutrient-table">
        <caption>영양성분</caption>
        <tbody>
          {analysis.nutrients.map((nutrient) => (
            <tr key={nutrient.label}>
              <th scope="row">{nutrient.label}</th>
              <td>{nutrient.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {analysis.notices.map((notice) => (
        <div className={`food-analysis-notice ${notice.type}`} key={notice.title}>
          <strong>{notice.title}</strong>
          {notice.lines.map((line) => <p key={line}>{line.slice(2)}</p>)}
        </div>
      ))}

      {analysis.warnings.length > 0 && (
        <div className="food-warning-box">
          <strong>주의사항</strong>
          {analysis.warnings.map((warning) => <p key={warning}>{warning.slice(2)}</p>)}
        </div>
      )}
    </div>
  );
}

function parseFoodSafetyAdvice(content) {
  const lines = String(content || "").replace(/^\d+번째 사진\s*\n/, "").split("\n").map((line) => line.trim());
  const cautionStart = lines.indexOf("주의할 점");
  if (cautionStart < 0) return null;

  const eatingStart = lines.indexOf("드실 때");
  const title = lines.slice(0, cautionStart).find(Boolean) || "섭취 안내";
  const cautionEnd = eatingStart >= 0 ? eatingStart : lines.length;
  const cautions = lines
    .slice(cautionStart + 1, cautionEnd)
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const [label, ...descriptionParts] = line.slice(2).split(":");
      return {
        label: label.trim(),
        description: descriptionParts.join(":").trim() || line.slice(2).trim(),
      };
    });
  const tips = eatingStart >= 0
    ? lines.slice(eatingStart + 1).filter((line) => line.startsWith("- ")).map((line) => line.slice(2))
    : [];

  return cautions.length ? { title, cautions, tips } : null;
}

function parseActionCard(content) {
  const text = String(content || "");
  const match = text.match(/\[WOORI_ACTION_CARD\]([\s\S]*?)\[\/WOORI_ACTION_CARD\]/);
  if (!match) return null;

  try {
    return {
      intro: text.replace(match[0], "").trim(),
      action: JSON.parse(match[1]),
    };
  } catch {
    return null;
  }
}

function ActionCardMessage({ card }) {
  return (
    <div className="chat-action-card">
      {card.intro && <p className="chat-action-card-intro">{card.intro}</p>}
      <div className="chat-action-card-box">
        <strong>{card.action.title}</strong>
        {card.action.description && <span>{card.action.description}</span>}
        <Link className="chat-action-card-button" to={card.action.href || "/"}>
          {card.action.buttonLabel || "바로가기"}
        </Link>
      </div>
    </div>
  );
}

function FoodSafetyAdviceMessage({ advice }) {
  return (
    <div className="food-safety-card">
      <strong className="food-safety-title">{advice.title}</strong>

      <table className="food-caution-table">
        <caption>주의할 점</caption>
        <tbody>
          {advice.cautions.map((item) => (
            <tr key={`${item.label}-${item.description}`}>
              <th scope="row">{item.label}</th>
              <td>{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {advice.tips.length > 0 && (
        <div className="food-eating-tip-box">
          <strong>드실 때</strong>
          {advice.tips.map((tip) => <p key={tip}>{tip}</p>)}
        </div>
      )}
    </div>
  );
}

const MessageList = forwardRef(function MessageList(
  { messages, isLoading },
  messagesEndRef
) {
  return (
    <div className="chatbot-messages" aria-live="polite">
      {messages.filter((message) => !message.hidden).map((message, index) => {
        const messageKey = `${message.role}-${index}`;
        const formattedTime = formatMessageTime(message.createdAt || FALLBACK_MESSAGE_TIME);
        const hasVisibleContent = message.content && message.content !== "사진을 보냈어요.";
        const imageUrls = message.imageUrls || (message.imageUrl ? [message.imageUrl] : []);
        const foodAnalysis = parseFoodAnalysis(message.content);
        const foodSafetyAdvice = foodAnalysis ? null : parseFoodSafetyAdvice(message.content);
        const actionCard = foodAnalysis || foodSafetyAdvice ? null : parseActionCard(message.content);
        const specialMessageClass = foodAnalysis || foodSafetyAdvice
          ? "food-analysis"
          : actionCard
            ? "action-card-message"
            : "";

        return (
          <Fragment key={messageKey}>
            {imageUrls.length > 0 && (
              <div className={`chat-message-row image ${message.role}`}>
                <div className="chat-message-images">
                  {imageUrls.map((imageUrl, imageIndex) => (
                    <img
                      className="chat-message-image"
                      src={imageUrl}
                      alt={`첨부한 사진 ${imageIndex + 1}`}
                      key={imageUrl}
                    />
                  ))}
                </div>
                {!hasVisibleContent && <time className="chat-message-time">{formattedTime}</time>}
              </div>
            )}
            {hasVisibleContent && (
              <div className={`chat-message-row ${message.role}`}>
                <div className={`chat-message ${message.role} ${specialMessageClass}`}>
                  {foodAnalysis ? (
                    <FoodAnalysisMessage analysis={foodAnalysis} />
                  ) : foodSafetyAdvice ? (
                    <FoodSafetyAdviceMessage advice={foodSafetyAdvice} />
                  ) : actionCard ? (
                    <ActionCardMessage card={actionCard} />
                  ) : (
                    message.content
                  )}
                </div>
                <time className="chat-message-time">{formattedTime}</time>
              </div>
            )}
          </Fragment>
        );
      })}

      {isLoading && (
        <div className="chat-message-row assistant">
          <div className="chat-message assistant chat-typing-indicator" role="status">
            <span className="chat-typing-label">답변을 확인하고 있어요.</span>
            <span className="chat-typing-dot" aria-hidden="true" />
            <span className="chat-typing-dot" aria-hidden="true" />
            <span className="chat-typing-dot" aria-hidden="true" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});

export default MessageList;
