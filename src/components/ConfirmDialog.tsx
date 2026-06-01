import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { CopyIcon } from './icons'

function renderMessage(message: string) {
  return message.split(/(`[^`]+`|「[^」]+」)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-[var(--ai-surface)] px-1 py-0.5 text-[0.85em] text-[var(--ai-text)]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('「') && part.endsWith('」')) {
      return (
        <strong key={index} className="font-semibold text-[var(--ai-text)]">
          {part}
        </strong>
      )
    }

    return part
  })
}

export default function ConfirmDialog() {
  const confirmDialog = useStore((s) => s.confirmDialog)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const [canConfirm, setCanConfirm] = useState(true)

  useEffect(() => {
    const delay = confirmDialog?.minConfirmDelayMs ?? 0
    if (!confirmDialog || delay <= 0) {
      setCanConfirm(true)
      return
    }

    setCanConfirm(false)
    const timer = window.setTimeout(() => setCanConfirm(true), delay)
    return () => window.clearTimeout(timer)
  }, [confirmDialog])

  const handleClose = () => {
    if (!canConfirm) return
    setConfirmDialog(null)
  }

  const handleCancel = () => {
    confirmDialog?.cancelAction?.()
    handleClose()
  }

  useCloseOnEscape(Boolean(confirmDialog) && canConfirm, handleClose)
  usePreventBackgroundScroll(Boolean(confirmDialog))

  if (!confirmDialog) return null
  const isDestructive = confirmDialog.title.includes('删除') || confirmDialog.title.includes('清空')
  const confirmTone = confirmDialog.tone ?? (isDestructive ? 'danger' : undefined)
  const confirmClassName =
    confirmTone === 'warning'
      ? 'bg-orange-500 hover:bg-orange-600'
      : confirmTone === 'danger'
      ? 'bg-[var(--ai-error)] hover:bg-[#ff2a6d]'
      : 'bg-[var(--ai-accent-dim)]0 hover:bg-[var(--ai-accent-active)]'
  const confirmText = confirmDialog.confirmText ?? (isDestructive ? '确认删除' : '确认')
  const cancelText = confirmDialog.cancelText ?? '取消'

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-[var(--ai-overlay)] animate-overlay-in" />
      <div
        className="relative ai-card bg-[var(--ai-card-bg)] border-2 border-[var(--ai-border)] rounded-[20px] shadow-[0_4px_16px_rgba(107,92,67,0.15)] max-w-sm w-full p-6 z-10  animate-confirm-in"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmTone === 'danger' && <div className="cp-caution-stripe-pink h-[5px] absolute top-0 left-0 right-0 rounded-t-[20px]" />}
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-[var(--ai-text-header)]">
          {confirmDialog.icon === 'info' && (
            <svg className="h-5 w-5 shrink-0 text-[var(--ai-accent)]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          )}
          {confirmDialog.icon === 'copy' && (
            <CopyIcon className="h-5 w-5 shrink-0 text-[var(--ai-accent)]" />
          )}
          {confirmDialog.title}
        </h3>
        <p className={`text-sm text-[var(--ai-text-muted)] mb-6 leading-relaxed whitespace-pre-line ${confirmDialog.messageAlign === 'center' ? 'text-center' : ''}`}>
          {renderMessage(confirmDialog.message)}
        </p>
        <div className="flex gap-2">
          {confirmDialog.showCancel !== false && (
            <button
              onClick={handleCancel}
              className="flex-1 py-2 rounded-full border-2 border-[var(--ai-border)] text-sm text-[var(--ai-text)] hover:bg-[var(--ai-surface)]  transition"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (!canConfirm) return
              confirmDialog.action()
              setConfirmDialog(null)
            }}
            disabled={!canConfirm}
            className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
