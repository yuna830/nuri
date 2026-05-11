import { useState } from "react";
import {
  createSosAlert,
  createSosCancelAlert,
  getCurrentSeniorId,
} from "../api/userPageApi.js";
import "../css/user/UserCommonHeader.css";

const formatKoreanDate = () => {
  const now = new Date();
  return now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
};

const getCurrentPosition = () => new Promise((resolve) => {
  if (!navigator.geolocation) {
    resolve(null);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
  );
});

export function UserCommonHeader({ showSos = true, onSosClick }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingSos, setPendingSos] = useState(() => localStorage.getItem("pending_sos") === "true");

  const openSos = () => {
    if (onSosClick) {
      onSosClick();
      return;
    }
    setShowModal(true);
  };

  const confirmSos = async () => {
    setShowModal(false);
    const seniorId = getCurrentSeniorId();

    if (!seniorId) {
      alert("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const position = await getCurrentPosition();
      await createSosAlert({
        seniorId: Number(seniorId),
        latitude: position?.latitude,
        longitude: position?.longitude,
      });
      localStorage.setItem("pending_sos", "true");
      setPendingSos(true);
    } catch (error) {
      console.error("SOS 전송 실패:", error);
      alert("SOS 전송에 실패했습니다. 보호자에게 직접 연락해주세요.");
    }
  };

  const cancelPendingSos = async () => {
    const seniorId = getCurrentSeniorId();

    if (seniorId) {
      const position = await getCurrentPosition();
      await createSosCancelAlert({
        seniorId: Number(seniorId),
        latitude: position?.latitude,
        longitude: position?.longitude,
      }).catch((error) => {
        console.error("SOS 잘못 누름 알림 실패:", error);
      });
    }

    localStorage.removeItem("pending_sos");
    setPendingSos(false);
    alert("보호자에게 잘못 누름 알림을 보냈어요.");
  };

  return (
    <>
      <header className="uch-header">
        <div className="uch-header-inner">
          <div className="uch-logo">우리 woori</div>
          <div className="uch-actions">
            <span className="uch-date">{formatKoreanDate()}</span>
            {showSos && (
              <button className="uch-sos" type="button" onClick={openSos}>
                🚨 SOS 알림 요청
              </button>
            )}
          </div>
        </div>
      </header>

      {!onSosClick && pendingSos && (
        <div className="uch-sos-pending">
          <div>
            <strong>SOS가 보호자에게 전송되었어요.</strong>
            <p>실수로 누르셨다면 아래 버튼을 눌러 표시를 취소해 주세요.</p>
          </div>
          <button type="button" onClick={cancelPendingSos}>
            잘못 눌렀어요
          </button>
        </div>
      )}

      {!onSosClick && showModal && (
        <div className="uch-overlay" onClick={() => setShowModal(false)}>
          <div className="uch-modal" onClick={(event) => event.stopPropagation()}>
            <div className="uch-modal-ico">🚨</div>
            <div className="uch-modal-title">SOS를 보내시겠어요?</div>
            <div className="uch-modal-desc">
              보호자와 담당 복지사에게<br />즉시 알림이 전송됩니다.
            </div>
            <div className="uch-modal-row">
              <button className="uch-modal-cancel" type="button" onClick={() => setShowModal(false)}>취소</button>
              <button className="uch-modal-ok" type="button" onClick={confirmSos}>보내기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function UserSubHeader({
  title,
  right,
  onBack,
  backLabel = "← 돌아가기",
  maxWidth = 1280,
}) {
  return (
    <div className="uch-sub">
      <div className="uch-sub-inner" style={{ "--uch-sub-max": `${maxWidth}px` }}>
        {onBack && (
          <button className="uch-back" type="button" onClick={onBack}>
            {backLabel}
          </button>
        )}
        <div className="uch-title">{title}</div>
        {right && <div className="uch-sub-right">{right}</div>}
      </div>
    </div>
  );
}
