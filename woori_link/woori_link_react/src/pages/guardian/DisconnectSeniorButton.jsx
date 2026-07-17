import {
  useEffect,
  useState,
} from 'react';

import {
  createPortal,
} from 'react-dom';

import {
  disconnectGuardianSenior,
} from '../../api/guardianRelationshipApi.js';

import '../../css/guardian/DisconnectSeniorButton.css';


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


export default function DisconnectSeniorButton({
  senior,
  onDisconnected,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');


  /*
   * 모달이 열렸을 때 배경 스크롤을 막고
   * ESC 키로 닫을 수 있도록 처리한다.
   */
  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape'
        && !disconnecting
      ) {
        setModalOpen(false);
        setError('');
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    disconnecting,
    modalOpen,
  ]);


  const openModal = () => {
    if (!senior?.id) {
      return;
    }

    setError('');
    setModalOpen(true);
  };


  const closeModal = () => {
    if (disconnecting) {
      return;
    }

    setError('');
    setModalOpen(false);
  };


  /*
   * 보호자 ID를 별도로 전달하지 않는다.
   *
   * guardianRelationshipApi.js에서 로그인 정보의
   * userId와 token을 가져와 연결 해제를 요청한다.
   */
  const handleDisconnect = async () => {
    if (
      !senior?.id
      || disconnecting
    ) {
      return;
    }

    setDisconnecting(true);
    setError('');

    try {
      await disconnectGuardianSenior(
        senior.id,
      );

      setModalOpen(false);

      if (typeof onDisconnected === 'function') {
        onDisconnected(senior.id);
      }
    } catch (requestError) {
      setError(
        requestError.message
        || '연결을 해제하지 못했습니다.',
      );
    } finally {
      setDisconnecting(false);
    }
  };


  const modalContent = modalOpen
    ? createPortal(
      <>
        <button
          type="button"
          className="guardian-disconnect-overlay"
          onClick={closeModal}
          aria-label="연결 해제 창 닫기"
          disabled={disconnecting}
        />

        <section
          className="guardian-disconnect-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guardian-disconnect-title"
          aria-describedby="guardian-disconnect-description"
        >
          <header className="guardian-disconnect-modal__header">
            <div>
              <span className="guardian-disconnect-modal__eyebrow">
                보호자 연결 관리
              </span>

              <h2 id="guardian-disconnect-title">
                {senior?.name || '선택한 대상'}과의 연결을 해제할까요?
              </h2>
            </div>

            <button
              type="button"
              className="guardian-disconnect-modal__close"
              onClick={closeModal}
              disabled={disconnecting}
              aria-label="연결 해제 창 닫기"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="guardian-disconnect-modal__content">
            <div className="guardian-disconnect-modal__notice">
              <strong>
                어르신의 계정과 기존 정보는 삭제되지 않습니다.
              </strong>

              <p id="guardian-disconnect-description">
                현재 로그인한 보호자와 어르신 사이의 연결만
                해제됩니다. 연결을 해제하면 보호자 화면에서
                해당 어르신의 위치, 안부, 알림과 등록 제품을
                더 이상 확인할 수 없습니다.
              </p>
            </div>

            <dl className="guardian-disconnect-modal__information">
              <div>
                <dt>연결 해제 대상</dt>

                <dd>
                  {senior?.name || '이름 미확인'}
                </dd>
              </div>

              <div>
                <dt>유지되는 정보</dt>

                <dd>
                  어르신 계정, 위치 기록, 안부 기록,
                  알림, 복약 정보, 등록 제품
                </dd>
              </div>

              <div>
                <dt>삭제되는 정보</dt>

                <dd>
                  현재 보호자와 어르신 사이의 연결 관계
                </dd>
              </div>
            </dl>

            {error && (
              <div className="guardian-disconnect-modal__error">
                {error}
              </div>
            )}
          </div>

          <footer className="guardian-disconnect-modal__footer">
            <button
              type="button"
              className="guardian-disconnect-modal__cancel"
              onClick={closeModal}
              disabled={disconnecting}
            >
              취소
            </button>

            <button
              type="button"
              className="guardian-disconnect-modal__confirm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting
                ? '연결 해제 중...'
                : '연결 해제'}
            </button>
          </footer>
        </section>
      </>,
      document.body,
    )
    : null;


  return (
    <>
      <button
        type="button"
        className="
          guardian-action-button
          guardian-action-button--disconnect
        "
        onClick={openModal}
        disabled={!senior?.id}
      >
        연결 해제
      </button>

      {modalContent}
    </>
  );
}
