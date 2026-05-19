import { useNavigate } from "react-router-dom";
import "../css/common/CommonHeader.css";

function CommonHeader({
  logoText = "우리 woori",
  homePath = "/",
  rightText,
  actions,
  className = "",
}) {
  const navigate = useNavigate();
  const headerClassName = ["common-app-header", className].filter(Boolean).join(" ");

  return (
    <header className={headerClassName}>
      <div className="common-app-header-inner">
        <button
          className="common-app-logo"
          type="button"
          onClick={() => navigate(homePath)}
        >
          {logoText}
        </button>

        <div className="common-app-actions">
          {rightText && <span className="common-app-header-text">{rightText}</span>}
          {actions}
        </div>
      </div>
    </header>
  );
}

export default CommonHeader;
