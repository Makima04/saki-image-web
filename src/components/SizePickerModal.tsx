import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateImageSize, normalizeImageSize, parseRatio, type SizeTier } from '../lib/size'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import ViewportTooltip from './ViewportTooltip'

const TIERS: SizeTier[] = ['1K', '2K', '4K']
const SIZE_LIMIT_TEXT = '由于模型限制，最终输出会自动规整到合法尺寸：\n宽高均为 16 的倍数，最大边长 3840px，宽高比不超过 3:1，总像素限制为 655360-8294400。'
const RATIOS = [
  { label: '1:1', value: '1:1' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9', value: '21:9' },
]

interface Props {
  currentSize: string
  onSelect: (size: string) => void
  onClose: () => void
  allowAuto?: boolean
}

type Mode = 'auto' | 'ratio' | 'resolution'

function parseSize(size: string) {
  const match = size.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/)
  if (!match) return null
  return { width: match[1], height: match[2] }
}

function findPresetForSize(size: string) {
  const normalized = normalizeImageSize(size)
  for (const tier of TIERS) {
    for (const ratio of RATIOS) {
      if (calculateImageSize(tier, ratio.value) === normalized) {
        return { tier, ratio: ratio.value }
      }
    }
  }
  return null
}

export default function SizePickerModal({ currentSize, onSelect, onClose, allowAuto = true }: Props) {
  usePreventBackgroundScroll(true)

  const currentPreset = findPresetForSize(currentSize)
  const currentParsedSize = parseSize(currentSize)
  const [mode, setMode] = useState<Mode>(() => {
    if (!currentSize || currentSize === 'auto') return allowAuto ? 'auto' : 'ratio'
    if (currentPreset) return 'ratio'
    return 'resolution'
  })

  // Ratio mode state
  const [tier, setTier] = useState<SizeTier>(currentPreset?.tier ?? '1K')
  const [ratio, setRatio] = useState(currentPreset?.ratio ?? (allowAuto ? '1:1' : '4:3'))
  const [customRatio, setCustomRatio] = useState('16:9')

  // Resolution mode state
  const [customW, setCustomW] = useState(currentParsedSize?.width ?? '1024')
  const [customH, setCustomH] = useState(currentParsedSize?.height ?? '1024')

  const [hintVisible, setHintVisible] = useState(false)
  const hintTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current)
  }, [])

  const activeRatio = ratio === 'custom' ? customRatio : ratio
  const parsedCustomRatio = parseRatio(customRatio)
  const customRatioValid = ratio !== 'custom' || Boolean(parsedCustomRatio)
  const customRatioClamped = Boolean(
    ratio === 'custom' &&
    parsedCustomRatio &&
    Math.max(parsedCustomRatio.width, parsedCustomRatio.height) / Math.min(parsedCustomRatio.width, parsedCustomRatio.height) > 3,
  )

  const previewSize = useMemo(() => {
    if (mode === 'auto') return 'auto'
    
    if (mode === 'ratio') {
      const size = calculateImageSize(tier, activeRatio)
      return size ? normalizeImageSize(size) : ''
    }
    
    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return normalizeImageSize(`${w}x${h}`)
      }
      return ''
    }
    
    return ''
  }, [mode, tier, activeRatio, customW, customH])

  const isClamped = useMemo(() => {
    if (!previewSize || previewSize === 'auto') return false
    if (mode === 'ratio' && ratio === 'custom') return customRatioClamped
    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return `${w}x${h}` !== previewSize
      }
    }
    return false
  }, [mode, ratio, customRatioClamped, customW, customH, previewSize])

  const showHint = () => setHintVisible(true)
  const hideHint = () => {
    setHintVisible(false)
    clearHintTimer()
  }
  const clearHintTimer = () => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }
  const startHintTouch = () => {
    hintTimerRef.current = window.setTimeout(() => {
      setHintVisible(true)
      hintTimerRef.current = null
    }, 450)
  }

  const applySize = () => {
    if (!previewSize) return
    onSelect(previewSize)
    onClose()
  }

  const buttonClass = (active: boolean) => {
    return `rounded-xl border px-3 py-2 text-sm transition ${active
      ? 'border-[#19c8b9] bg-[#e6f9f6] text-[#19c8b9] '
      : 'border-2 border-[#c4b89e] bg-[rgb(247,243,223)] text-[#725d42] hover:bg-[#ede8d5] '
    }`
  }

  return (
    <div data-no-drag-select className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(121,79,39,0.15)] animate-overlay-in" />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-[rgb(247,243,223)] p-5   animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#794f27]">设置图像尺寸</h3>
            <p className="mt-1 text-xs text-[#9f927d]">当前：{currentSize || 'auto'}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#9f927d] transition hover:bg-[#ede8d5] hover:text-[#725d42]  "
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex rounded-xl bg-[#ede8d5]/80 p-1">
            {allowAuto && (
              <button
                onClick={() => setMode('auto')}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${mode === 'auto' ? 'bg-white text-[#794f27] ' : 'text-[#8a7b66] hover:text-[#725d42] '}`}
              >
                自动
              </button>
            )}
            <button
              onClick={() => setMode('ratio')}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${mode === 'ratio' ? 'bg-white text-[#794f27] ' : 'text-[#8a7b66] hover:text-[#725d42] '}`}
            >
              按比例
            </button>
            <button
              onClick={() => setMode('resolution')}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${mode === 'resolution' ? 'bg-white text-[#794f27] ' : 'text-[#8a7b66] hover:text-[#725d42] '}`}
            >
              自定义宽高
            </button>
          </div>

          <div className="h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200  pr-1 -mr-1">
            {mode === 'auto' && (
              <div className="flex h-full animate-fade-in items-center justify-center pt-8 pb-4 text-center">
                <div>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f9f6] text-[#19c8b9]">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-medium text-[#794f27]">自动尺寸</h4>
                  <p className="mt-1 text-xs text-[#9f927d]">不向模型传递具体的分辨率参数<br/>由模型自己决定生成尺寸</p>
                </div>
              </div>
            )}

            {mode === 'ratio' && (
              <div className="space-y-5 animate-fade-in">
                <section>
                  <div className="mb-2 text-xs font-medium text-[#9f927d]">基准分辨率</div>
                  <div className="grid grid-cols-3 gap-2">
                    {TIERS.map((item) => (
                      <button key={item} className={buttonClass(tier === item)} onClick={() => setTier(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-xs font-medium text-[#9f927d]">图像比例</div>
                  <div className="grid grid-cols-4 gap-2">
                    {RATIOS.map((item) => (
                      <button key={item.value} className={buttonClass(ratio === item.value)} onClick={() => setRatio(item.value)}>
                        {item.label}
                      </button>
                    ))}
                    <button className={`${buttonClass(ratio === 'custom')} col-span-4`} onClick={() => setRatio('custom')}>
                      自定义比例
                    </button>
                  </div>
                </section>

                {ratio === 'custom' && (
                  <label className="block animate-fade-in">
                    <span className="mb-2 block text-xs font-medium text-[#9f927d]">输入自定义比例</span>
                    <input
                      value={customRatio}
                      onChange={(e) => setCustomRatio(e.target.value)}
                      placeholder="例如 5:4 / 2.39:1"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                        customRatioValid
                          ? 'border-2 border-[#c4b89e] bg-[rgb(247,243,223)] text-[#725d42] focus:border-[#3dd4c6] '
                          : 'border-2 border-[#e05a5a] bg-[rgb(247,243,223)] text-[#725d42] focus:border-red-400 '
                      }`}
                    />
                  </label>
                )}
              </div>
            )}

            {mode === 'resolution' && (
              <div className="space-y-5 animate-fade-in">
                <section>
                  <div className="mb-4 text-xs font-medium text-[#9f927d]">输入具体像素值</div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <span className="mb-1.5 block text-xs text-[#8a7b66]">宽度 (Width)</span>
                      <input
                        type="number"
                        value={customW}
                        onChange={(e) => setCustomW(e.target.value)}
                        className="w-full rounded-xl border border-2 border-[#c4b89e] bg-[rgb(247,243,223)] px-3 py-2 text-sm text-[#725d42] outline-none transition focus:border-[#3dd4c6] "
                        placeholder="例如 1024"
                      />
                    </label>
                    <div className="mt-5 text-[#c4b89e]">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <label className="flex-1">
                      <span className="mb-1.5 block text-xs text-[#8a7b66]">高度 (Height)</span>
                      <input
                        type="number"
                        value={customH}
                        onChange={(e) => setCustomH(e.target.value)}
                        className="w-full rounded-xl border border-2 border-[#c4b89e] bg-[rgb(247,243,223)] px-3 py-2 text-sm text-[#725d42] outline-none transition focus:border-[#3dd4c6] "
                        placeholder="例如 1024"
                      />
                    </label>
                  </div>
                </section>
                <div className="rounded-xl border border-2 border-[#c4b89e] bg-[rgb(247,243,223)] p-3 text-xs text-[#725d42] ">
                  <div className="flex items-start gap-2">
                    <svg className="mt-[2px] h-4 w-4 flex-shrink-0 text-[#19c8b9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="whitespace-pre-line leading-relaxed">{SIZE_LIMIT_TEXT}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[rgb(247,243,223)] px-4 py-3">
            <div className="text-xs text-[#9f927d]">将使用</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-[#794f27]">
                {previewSize || '尺寸无效'}
              </span>
              {isClamped && (
                <div
                  className="relative flex items-center"
                  onMouseEnter={showHint}
                  onMouseLeave={hideHint}
                  onTouchStart={startHintTouch}
                  onTouchEnd={clearHintTimer}
                  onTouchCancel={hideHint}
                  onClick={showHint}
                >
                  <svg className="w-5 h-5 text-[#f5c31c] cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <ViewportTooltip visible={hintVisible} className="w-56 whitespace-pre-line text-center">
                    {SIZE_LIMIT_TEXT}
                  </ViewportTooltip>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#ede8d5] px-4 py-2.5 text-sm text-[#725d42] transition hover:bg-[#c4b89e] "
          >
            取消
          </button>
          <button
            onClick={applySize}
            disabled={!previewSize}
            className="flex-1 rounded-xl bg-[#e6f9f6]0 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#11a89b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
