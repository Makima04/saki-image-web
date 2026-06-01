import { useStore } from '../store'

export default function Toast() {
  const toast = useStore((s) => s.toast)

  if (!toast) return null

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="cp-status-dot cp-status-dot-active mr-1" />
        )
      case 'error':
        return (
          <div className="cp-status-dot cp-status-dot-error mr-1" />
        )
      default:
        return (
          <div className="cp-status-dot mr-1" style={{ background: 'var(--ai-accent)', boxShadow: '0 0 6px var(--ai-accent)' }} />
        )
    }
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-[120] pointer-events-none toast-enter">
      <div className="flex items-center gap-2.5 w-max max-w-[calc(100vw-32px)] sm:max-w-[min(28rem,60vw)] px-5 py-3.5 bg-[var(--ai-card-bg)] backdrop-blur-xl border border-[var(--ai-border)]/60 rounded-lg cp-neon-border shadow-[0_4px_10px_rgba(0,0,0,0.3)]  text-sm font-medium text-[var(--ai-text)]">
        <span className="flex-shrink-0">{getIcon()}</span>
        <span className="leading-5 whitespace-pre-line text-center">{toast.message}</span>
      </div>
    </div>
  )
}
