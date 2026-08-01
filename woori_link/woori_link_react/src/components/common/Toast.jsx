import { useEffect } from 'react'
import '../../css/common/Toast.css'

export default function Toast({
  open,
  type = 'success',
  message = '',
  duration = 2800,
  onClose,
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      onClose?.()
    }, duration)

    return () => {
      window.clearTimeout(timer)
    }
  }, [open, duration, onClose])

  if (!open || !message) {
    return null
  }

  const icon =
    type === 'error'
      ? '!'
      : type === 'warning'
        ? '!'
        : '✓'

  return (
    <div
      className={`app-toast app-toast--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={
        type === 'error' ? 'assertive' : 'polite'
      }
    >
      <span
        className="app-toast__icon"
        aria-hidden="true"
      >
        {icon}
      </span>

      <p className="app-toast__message">
        {message}
      </p>

      <button
        type="button"
        className="app-toast__close"
        aria-label="알림 닫기"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}