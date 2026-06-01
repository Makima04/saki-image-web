import { useEffect, useState, useRef } from 'react'
import type { TaskRecord } from '../types'
import { useStore, ensureImageThumbnailCached, subscribeImageThumbnail, updateTaskInStore, retryTask } from '../store'
import { formatImageRatio } from '../lib/size'
import { getParamDisplay, ActualValueBadge } from '../lib/paramDisplay'
import { DEFAULT_IMAGES_MODEL } from '../lib/apiProfiles'
import { CodeIcon } from './icons'

interface Props {
  task: TaskRecord
  onReuse: () => void
  onEditOutputs: () => void
  onDelete: () => void
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  isSelected?: boolean
}

export default function TaskCard({
  task,
  onReuse,
  onEditOutputs,
  onDelete,
  onClick,
  isSelected,
}: Props) {
  const [thumbSrc, setThumbSrc] = useState<string>('')
  const [coverRatio, setCoverRatio] = useState<string>('')
  const [coverSize, setCoverSize] = useState<string>('')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartedSelected, setSwipeStartedSelected] = useState(false)
  const [swipeActionActive, setSwipeActionActive] = useState(false)
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const settings = useStore((s) => s.settings)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeResetTimerRef = useRef<number | null>(null)
  const suppressClickUntilRef = useRef(0)
  const horizontalSwipeRef = useRef(false)

  const isTagScrollTarget = (target: EventTarget | null) => {
    return target instanceof Element && Boolean(target.closest('[data-tag-scroll-area]'))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTagScrollTarget(e.target)) {
      touchStartRef.current = null
      horizontalSwipeRef.current = false
      setIsSwiping(false)
      setSwipeOffset(0)
      setSwipeActionActive(false)
      return
    }

    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = null
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontalSwipeRef.current = false
    setSwipeStartedSelected(Boolean(isSelected))
    setSwipeActionActive(false)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTagScrollTarget(e.target)) return
    if (!touchStartRef.current) return
    const deltaX = e.touches[0].clientX - touchStartRef.current.x
    const deltaY = e.touches[0].clientY - touchStartRef.current.y

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      horizontalSwipeRef.current = true
      e.preventDefault()
      const boundedOffset = Math.max(-60, Math.min(60, deltaX))
      setSwipeOffset(boundedOffset)
      setSwipeActionActive(Math.abs(deltaX) >= 40)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTagScrollTarget(e.target)) {
      touchStartRef.current = null
      horizontalSwipeRef.current = false
      setIsSwiping(false)
      setSwipeOffset(0)
      setSwipeActionActive(false)
      return
    }

    setIsSwiping(false)
    setSwipeOffset(0)

    if (!touchStartRef.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    touchStartRef.current = null
    const isSwipeAction = horizontalSwipeRef.current && Math.abs(deltaX) > 40
    horizontalSwipeRef.current = false
    setSwipeActionActive(isSwipeAction)
    swipeResetTimerRef.current = window.setTimeout(() => {
      setSwipeActionActive(false)
      swipeResetTimerRef.current = null
    }, 220)

    if (isSwipeAction) {
      suppressClickUntilRef.current = Date.now() + 350
      e.preventDefault()
      e.stopPropagation()
      toggleTaskSelection(task.id)
    }
  }

  const handleTouchCancel = () => {
    touchStartRef.current = null
    horizontalSwipeRef.current = false
    setIsSwiping(false)
    setSwipeOffset(0)
    setSwipeActionActive(false)
  }

  useEffect(() => () => {
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (task.status !== 'running' && !(task.status === 'error' && (task.falRecoverable || task.customRecoverable))) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    return () => clearInterval(id)
  }, [task.customRecoverable, task.falRecoverable, task.status])

  useEffect(() => {
    setCoverRatio('')
    setCoverSize('')
    setThumbSrc('')
    setImageLoaded(false)

    // 优先使用流式预览 URL（绕过缩略图异步生成）
    const preview = task.streamPreviewUrl
    if (preview) {
      setThumbSrc(preview)
      // 下一帧触发渐显
      requestAnimationFrame(() => requestAnimationFrame(() => setImageLoaded(true)))
      return
    }

    let cancelled = false
    const imageId = task.outputImages?.[0]
    let unsubscribe: (() => void) | undefined

    const applyThumbnail = (thumbnail: { dataUrl: string; width?: number; height?: number }) => {
      if (cancelled) return
      setThumbSrc(thumbnail.dataUrl)
      requestAnimationFrame(() => requestAnimationFrame(() => setImageLoaded(true)))
      if (thumbnail.width && thumbnail.height) {
        setCoverRatio(formatImageRatio(thumbnail.width, thumbnail.height))
        setCoverSize(`${thumbnail.width}×${thumbnail.height}`)
      }
    }

    if (imageId) {
      unsubscribe = subscribeImageThumbnail(imageId, applyThumbnail)
      ensureImageThumbnailCached(imageId).then((thumbnail) => {
        if (cancelled || !thumbnail) return
        applyThumbnail(thumbnail)
      }).catch(() => {
        if (!cancelled) setThumbSrc('')
      })
    }

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.outputImages])

  const duration = (() => {
    let seconds: number
    if (task.status === 'running' || task.falRecoverable || task.customRecoverable) {
      seconds = Math.floor((now - task.createdAt) / 1000)
    } else if (task.elapsed != null) {
      seconds = Math.floor(task.elapsed / 1000)
    } else {
      return '00:00'
    }
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()
  const isSwipeReady = Math.abs(swipeOffset) >= 40
  const showSwipeAction = isSwipeReady || swipeActionActive
  const isFalReconnecting = task.status === 'error' && task.falRecoverable
  const isCustomReconnecting = task.status === 'error' && task.customRecoverable
  const showRunningTimer = task.status === 'running' || isFalReconnecting || isCustomReconnecting
  const swipeBgClass = showSwipeAction
    ? swipeStartedSelected
      ? 'bg-[var(--ai-text-secondary)]'
      : 'bg-[var(--ai-accent)]'
    : 'bg-[var(--ai-border)]'

  const qualityDisplay = getParamDisplay(task, 'quality')
  const showQuality = task.params.quality !== 'auto' || qualityDisplay.isMismatch

  const sizeDisplay = getParamDisplay(task, 'size')
  const showSize = task.params.size !== 'auto' || sizeDisplay.isMismatch

  const formatDisplay = getParamDisplay(task, 'output_format')
  const showFormat = task.params.output_format !== 'png' || formatDisplay.isMismatch

  const nDisplay = getParamDisplay(task, 'n')
  const showN = task.params.n > 1 || nDisplay.isMismatch

  const defaultModelForProvider = DEFAULT_IMAGES_MODEL
  const showModel = task.apiModel && task.apiModel !== defaultModelForProvider

  const getStatusColor = () => {
    if (task.status === 'running') return 'var(--ai-accent)'
    if (task.status === 'error') return isFalReconnecting ? 'var(--ai-warning)' : 'var(--ai-error)'
    return '#6fba2c'
  }

  return (
    <div className="relative rounded-[20px]">
      {/* 侧滑底图 */}
      <div
        className={`absolute inset-0 rounded-[20px] flex items-center transition-opacity duration-200 pointer-events-none ${
          isSwiping || swipeOffset || swipeActionActive ? 'opacity-100' : 'opacity-0'
        } ${swipeBgClass} ${
          swipeOffset > 0 ? 'justify-start pl-6' : 'justify-end pr-6'
        }`}
      >
        <svg className={`w-8 h-8 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {swipeStartedSelected && showSwipeAction ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          )}
        </svg>
      </div>

      <div
        className="ai-card relative overflow-hidden cursor-pointer duration-200"
        style={{
          borderRadius: '20px',
          backgroundColor: 'var(--ai-card-bg)',
          border: `2px solid ${task.status === 'running' ? 'var(--ai-accent)' : isSelected ? 'var(--ai-accent)' : 'var(--ai-border)'}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(0, 229, 195, 0.25)' : '0 4px 10px rgba(0, 0, 0, 0.3)',
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
          transition: !isSwiping ? 'box-shadow 0.2s, border-color 0.2s, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'box-shadow 0.2s, border-color 0.2s',
        }}
        onClick={(e) => {
          if (Date.now() < suppressClickUntilRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          onClick(e)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div className="cp-hud-bl"></div><div className="cp-hud-br"></div>
        {task.status === 'error' && !isFalReconnecting && !isCustomReconnecting && (
          <div className="cp-caution-stripe-pink" />
        )}
        {/* 选中时的角标 */}
        {isSelected && (
          <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--ai-accent)' }}>
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        <div className="flex h-40">
          {/* 左侧图片区域 */}
          <div className="w-40 min-w-[10rem] h-full relative flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--ai-surface)' }}>
            {task.status === 'running' && (
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-8 h-8 animate-spin"
                  style={{ color: 'var(--ai-accent)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-xs" style={{ color: 'var(--ai-text-secondary)' }}>生成中...</span>
              </div>
            )}
            {task.status === 'error' && isFalReconnecting && !thumbSrc && (
              <div className="flex flex-col items-center gap-1 px-2">
                <svg
                  className="w-7 h-7"
                  style={{ color: 'var(--ai-warning)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-xs text-center leading-tight" style={{ color: 'var(--ai-focus-dark)' }}>
                  重连中
                </span>
              </div>
            )}
            {task.status === 'error' && !isFalReconnecting && !thumbSrc && (
              <div className="flex flex-col items-center gap-1 px-2">
                <svg
                  className="w-7 h-7"
                  style={{ color: 'var(--ai-error)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs text-center leading-tight" style={{ color: 'var(--ai-error)' }}>
                  失败
                </span>
              </div>
            )}
            {thumbSrc && (
              <>
                <img
                  src={thumbSrc}
                  data-image-id={task.outputImages[0]}
                  className="saveable-image w-full h-full object-cover"
                  loading="lazy"
                  alt=""
                  style={{
                    filter: imageLoaded ? 'blur(0px)' : 'blur(12px)',
                    opacity: imageLoaded ? 1 : 0.6,
                    transition: 'filter 0.5s ease-out, opacity 0.5s ease-out',
                  }}
                />
                {task.outputImages.length > 1 && (
                  <span className="absolute bottom-1 right-1 text-white text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(10, 10, 18, 0.7)' }}>
                    {task.outputImages.length}
                  </span>
                )}
                {task.status === 'error' && !isFalReconnecting && (
                  <span
                    className="absolute left-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: 'rgba(224, 90, 90, 0.9)' }}
                    title={task.error || '生成失败'}
                  >
                    失败
                  </span>
                )}
              </>
            )}
            {!thumbSrc && (
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--ai-border)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            {/* 运行中显示耗时，完成后显示封面图比例与分辨率标签 */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
              {showRunningTimer || task.status !== 'done' || !coverRatio || !coverSize ? (
                <span className="flex items-center gap-1 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'rgba(10, 10, 18, 0.7)' }}>
                  <div className={`cp-status-dot ${task.status === 'running' ? 'cp-status-dot-active' : isFalReconnecting ? 'cp-status-dot-warning' : isCustomReconnecting ? 'cp-status-dot-warning' : task.status === 'error' ? 'cp-status-dot-error' : 'cp-status-dot-idle'}`} />
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {duration}
                </span>
              ) : (
                <>
                  <span className="text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'rgba(10, 10, 18, 0.7)' }}>
                    {coverRatio}
                  </span>
                  <span className="text-white/90 text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(10, 10, 18, 0.7)' }}>
                    {coverSize}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 右侧信息区域 */}
          <div className="flex-1 p-3 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 mb-2 overflow-hidden">
              <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--ai-text)' }}>
                {task.prompt || '(无提示词)'}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-1.5">
              {/* 参数与信息：横向滚动 */}
              <div
                data-tag-scroll-area
                className="flex overflow-x-auto hide-scrollbar pt-0.5 gap-1.5 whitespace-nowrap mask-edge-r min-w-0 pr-2"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onTouchCancel={(e) => e.stopPropagation()}
              >
                {/* API Name */}
                {(task.apiProfileName || task.apiProvider) && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                    style={{ backgroundColor: 'var(--ai-surface)', color: 'var(--ai-text)' }}
                    title={task.apiProfileName || task.apiProvider}
                  >
                    <CodeIcon className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ai-text-secondary)' }} />
                    <span className="truncate max-w-[8rem]">
                      {task.apiProfileName || task.apiProvider}
                    </span>
                  </span>
                )}
                {/* Model */}
                {showModel && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                    style={{ backgroundColor: 'var(--ai-surface)', color: 'var(--ai-text)' }}
                    title={task.apiModel}
                  >
                    <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ai-text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="truncate max-w-[8rem]">
                      {task.apiModel}
                    </span>
                  </span>
                )}
                {/* Mask */}
                {task.maskImageId && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ backgroundColor: 'var(--ai-accent-dim)', color: 'var(--ai-accent)' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    局部重绘
                  </span>
                )}
                {/* Params */}
                {showQuality && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ backgroundColor: 'var(--ai-surface)' }}>
                    <span style={{ color: 'var(--ai-text-secondary)' }}>质量</span>
                    {qualityDisplay.isMismatch ? <ActualValueBadge value={qualityDisplay.displayValue} className="px-1 rounded-sm" /> : <span style={{ color: 'var(--ai-text)' }}>{qualityDisplay.displayValue}</span>}
                  </span>
                )}
                {showSize && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ backgroundColor: 'var(--ai-surface)' }}>
                    <span style={{ color: 'var(--ai-text-secondary)' }}>尺寸</span>
                    {sizeDisplay.isMismatch ? <ActualValueBadge value={sizeDisplay.displayValue} className="px-1 rounded-sm" /> : <span style={{ color: 'var(--ai-text)' }}>{sizeDisplay.displayValue}</span>}
                  </span>
                )}
                {showFormat && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ backgroundColor: 'var(--ai-surface)' }}>
                    <span style={{ color: 'var(--ai-text-secondary)' }}>格式</span>
                    {formatDisplay.isMismatch ? <ActualValueBadge value={formatDisplay.displayValue} className="px-1 rounded-sm" /> : <span style={{ color: 'var(--ai-text)' }}>{formatDisplay.displayValue}</span>}
                  </span>
                )}
                {showN && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ backgroundColor: 'var(--ai-surface)' }}>
                    <span style={{ color: 'var(--ai-text-secondary)' }}>数量</span>
                    {nDisplay.isMismatch ? <ActualValueBadge value={nDisplay.displayValue} className="px-1 rounded-sm" /> : <span style={{ color: 'var(--ai-text)' }}>{nDisplay.displayValue}</span>}
                  </span>
                )}
              </div>
              {/* 流式进度条 */}
              {task.streamProgress != null && task.streamProgress > 0 && task.streamProgress < 100 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ai-surface)' }}>
                    <div
                      className="cp-energy-bar"
                      style={{ width: `${task.streamProgress}%`, height: '100%' }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--ai-accent)] tabular-nums min-w-[28px]">
                    {task.streamProgress}%
                  </span>
                </div>
              )}
              {/* 数据格式标识 */}
              {task.imageSourceFormat && (
                <div className="flex items-center gap-1 px-1">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      task.imageSourceFormat === 'base64'
                        ? 'bg-[var(--ai-accent-dim)] text-[var(--ai-accent)]'
                        : 'bg-[var(--ai-accent-dim)] text-[var(--ai-focus-dark)]'
                    }`}
                  >
                    {task.imageSourceFormat === 'base64' ? 'base64' : 'URL'}
                  </span>
                </div>
              )}
              {/* 操作按钮 */}
              <div
                className="flex w-full items-center justify-between flex-shrink-0 mt-0.5 sm:w-auto sm:justify-end sm:gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {((task.status === 'error' && !isFalReconnecting) || settings.alwaysShowRetryButton) && (
                  <button
                    onClick={() => retryTask(task)}
                    className="p-1.5 rounded-md transition"
                    style={{ color: 'var(--ai-text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ai-accent)'; e.currentTarget.style.backgroundColor = 'var(--ai-accent-dim)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ai-text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                    title="重试任务"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() =>
                    updateTaskInStore(task.id, { isFavorite: !task.isFavorite })
                  }
                  className="p-1.5 rounded-md transition"
                  style={{ color: task.isFavorite ? 'var(--ai-warning)' : 'var(--ai-text-secondary)' }}
                  onMouseEnter={(e) => { if (!task.isFavorite) e.currentTarget.style.color = 'var(--ai-warning)' }}
                  onMouseLeave={(e) => { if (!task.isFavorite) e.currentTarget.style.color = 'var(--ai-text-secondary)' }}
                  title={task.isFavorite ? '取消收藏' : '收藏记录'}
                >
                  <svg
                    className="w-4 h-4"
                    fill={task.isFavorite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>
                <button
                  onClick={onReuse}
                  className="p-1.5 rounded-md transition"
                  style={{ color: 'var(--ai-text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ai-accent)'; e.currentTarget.style.backgroundColor = 'var(--ai-accent-dim)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ai-text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="复用配置"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                <button
                  onClick={onEditOutputs}
                  className="p-1.5 rounded-md transition disabled:opacity-30"
                  style={{ color: 'var(--ai-text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#6fba2c'; e.currentTarget.style.backgroundColor = 'var(--ai-accent-dim)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ai-text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="编辑输出"
                  disabled={!task.outputImages?.length}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-md transition"
                  style={{ color: 'var(--ai-text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ai-error)'; e.currentTarget.style.backgroundColor = 'var(--ai-danger-bg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ai-text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="删除记录"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
