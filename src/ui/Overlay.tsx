import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { SPEED_TIMING, letterOf, useBingo, useVisibleHistory, type Speed } from '../store/useBingo'
import { pressKey } from '../useController'

const LETTER_CLASS: Record<string, string> = {
  B: 'bg-[#1e6bff]',
  I: 'bg-[#e5243b]',
  N: 'bg-[#e9e9f0] text-[#7a0b1c]',
  G: 'bg-[#18a957]',
  O: 'bg-[#ffb400] text-[#4a2a00]',
}

/** 画面中央の超特大番号 */
function MainNumber() {
  const history = useVisibleHistory()
  const phase = useBingo((s) => s.phase)
  const jackpot = useBingo((s) => s.jackpot)
  const burstId = useBingo((s) => s.burstId)
  const ref = useRef<HTMLDivElement>(null)
  const n = history.length ? history[history.length - 1] : null
  const visible = !jackpot && n !== null && (phase === 'shown' || phase === 'reveal')

  useLayoutEffect(() => {
    if (!ref.current) return
    if (visible) {
      gsap.fromTo(
        ref.current,
        { scale: 0.3, opacity: 0, rotate: -8 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.55)' },
      )
    } else {
      gsap.to(ref.current, { opacity: 0, scale: 0.8, duration: 0.25 })
    }
  }, [visible, burstId])

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div ref={ref} className="flex flex-col items-center opacity-0" style={{ marginTop: '-2vh' }}>
        {n !== null && (
          <>
            <div className={`main-letter ${LETTER_CLASS[letterOf(n)]}`}>{letterOf(n)}</div>
            <div className="main-number">{n}</div>
          </>
        )}
      </div>
    </div>
  )
}

/** 直近 5 件のチップ（右下） */
function RecentChips() {
  const history = useVisibleHistory()
  const jackpot = useBingo((s) => s.jackpot)
  const recent = history.slice(-5)
  return (
    <div className={`absolute right-[2vw] bottom-[3vh] flex items-end gap-[1vw] transition-opacity duration-500 ${jackpot ? 'opacity-0' : ''}`}>
      {recent.length > 0 && <div className="recent-label">RECENT</div>}
      {recent.map((n, i) => {
        const latest = i === recent.length - 1
        return (
          <div key={`${n}-${history.length}`} className="flex items-center gap-[1vw]">
            <div className={`chip ${latest ? 'chip-latest' : ''}`} style={{ opacity: 0.55 + (i / Math.max(1, recent.length - 1)) * 0.45 }}>
              <span className="chip-letter">{letterOf(n)}</span>
              <span>{n}</span>
            </div>
            {!latest && <span className="chip-arrow">›</span>}
          </div>
        )
      })}
    </div>
  )
}

/** B-I-N-G-O 75 マス表（左下） */
function HistoryBoard() {
  const history = useVisibleHistory()
  const show = useBingo((s) => s.settings.showBoard)
  const jackpot = useBingo((s) => s.jackpot)
  const drawn = new Set(history)
  const latest = history[history.length - 1]
  return (
    <div className={`board ${show && !jackpot ? '' : 'board-hidden'}`}>
      {'BINGO'.split('').map((L, row) => (
        <div key={L} className="flex items-center gap-[0.25vw]">
          <div className={`board-letter ${LETTER_CLASS[L]}`}>{L}</div>
          {Array.from({ length: 15 }, (_, c) => {
            const n = row * 15 + c + 1
            const on = drawn.has(n)
            return (
              <div key={n} className={`cell ${on ? 'cell-on' : ''} ${n === latest ? 'cell-latest' : ''}`}>
                {n}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Header() {
  const history = useVisibleHistory()
  const jackpot = useBingo((s) => s.jackpot)
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-[2vw] pt-[2vh] transition-opacity duration-500 ${jackpot ? 'opacity-0' : ''}`}>
      <div className="title">
        <span className="text-[#ff5a6e]">Merry</span> <span className="text-[#7dffa0]">Christmas</span>{' '}
        <span className="text-[#ffd23f]">BINGO</span>
      </div>
      <div className="counter">
        <span className="counter-num">{history.length}</span>
        <span className="opacity-60"> / 75</span>
      </div>
    </div>
  )
}

function StartHint() {
  const phase = useBingo((s) => s.phase)
  const count = useBingo((s) => s.history.length)
  if (phase !== 'idle' || count > 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38vh] flex flex-col items-center gap-[2vh]">
      <div className="start-hint">PRESS SPACE TO START</div>
      <div className="text-[1.4vh] tracking-widest text-white/50">C キーで操作パネル / F でフルスクリーン</div>
    </div>
  )
}

function JackpotOverlay() {
  const jackpot = useBingo((s) => s.jackpot)
  const start = useBingo((s) => s.jackpotStart)
  if (!jackpot) return null
  return (
    <>
      <div key={start} className="blackout pointer-events-none absolute inset-0 bg-black" />
      <div key={`c${start}`} className="congrats pointer-events-none absolute inset-x-0 bottom-[10vh] text-center">
        CONGRATULATIONS!
      </div>
    </>
  )
}

function ResetModal() {
  const open = useBingo((s) => s.resetModal)
  if (!open) return null
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-3xl border-2 border-[#ffd23f]/60 bg-[#0b1430]/95 px-[4vw] py-[5vh] text-center shadow-2xl">
        <div className="mb-[2vh] text-[4vh] font-extrabold text-white">全履歴をリセットしますか？</div>
        <div className="mb-[4vh] text-[2vh] text-white/70">出た番号がすべて消去され、新しいゲームが始まります。</div>
        <div className="flex justify-center gap-[2vw] text-[2.4vh] font-bold">
          <button className="rounded-xl bg-[#e5243b] px-[2.5vw] py-[1.2vh] text-white" onClick={() => pressKey('Enter')}>
            リセット（Enter）
          </button>
          <button className="rounded-xl bg-white/15 px-[2.5vw] py-[1.2vh] text-white" onClick={() => pressKey('Escape')}>
            キャンセル（Esc）
          </button>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-white/80">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#ffd23f]" />
      <span className="w-10 text-right tabular-nums text-white/60">{Math.round(value * 100)}</span>
    </label>
  )
}

/** 裏方用コントロールパネル（C キーで開閉） */
function ControlPanel() {
  const open = useBingo((s) => s.panelOpen)
  const settings = useBingo((s) => s.settings)
  const update = useBingo((s) => s.updateSettings)
  const history = useBingo((s) => s.history)
  if (!open) return null
  const keys: [string, string][] = [
    ['Space', '抽選開始 / スキップ'],
    ['B', 'ビンゴ演出 ON/OFF'],
    ['H', '75マス表 表示切替'],
    ['M', 'ミュート切替'],
    ['F', 'フルスクリーン'],
    ['R', 'リセット'],
    ['C', 'このパネル'],
  ]
  return (
    <div className="pointer-events-auto absolute top-[2vh] right-[2vw] z-10 w-[380px] space-y-4 rounded-2xl border border-white/15 bg-[#081028]/90 p-5 text-sm text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-base font-bold">オペレーター パネル</div>
        <button className="rounded px-2 text-white/60 hover:bg-white/10" onClick={() => useBingo.getState().setPanelOpen(false)}>
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <Slider label="マスター" value={settings.masterVolume} onChange={(v) => update({ masterVolume: v })} />
        <Slider label="BGM" value={settings.bgmVolume} onChange={(v) => update({ bgmVolume: v })} />
        <Slider label="効果音" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
        <button className={`w-full rounded-lg py-1.5 font-bold ${settings.muted ? 'bg-[#e5243b]' : 'bg-white/10'}`} onClick={() => pressKey('KeyM')}>
          {settings.muted ? '🔇 ミュート中（M）' : '🔊 サウンド ON（M）'}
        </button>
      </div>
      <div>
        <div className="mb-1 text-white/80">演出速度</div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SPEED_TIMING) as Speed[]).map((sp) => (
            <button
              key={sp}
              className={`rounded-lg py-1.5 font-bold ${settings.speed === sp ? 'bg-[#ffd23f] text-black' : 'bg-white/10'}`}
              onClick={() => update({ speed: sp })}
            >
              {SPEED_TIMING[sp].label}
              <div className="text-[10px] font-normal opacity-70">{(SPEED_TIMING[sp].roll + SPEED_TIMING[sp].reveal).toFixed(1)}秒</div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="rounded-lg bg-[#18a957] py-1.5 font-bold" onClick={() => pressKey('Space')}>抽選</button>
        <button className="rounded-lg bg-[#ffb400] py-1.5 font-bold text-black" onClick={() => pressKey('KeyB')}>BINGO!</button>
        <button className="rounded-lg bg-[#e5243b] py-1.5 font-bold" onClick={() => pressKey('KeyR')}>リセット</button>
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <div className="mb-1 text-white/60">抽選順の履歴（{history.length}件）</div>
        <div className="max-h-24 overflow-y-auto text-xs leading-relaxed text-white/80 tabular-nums">
          {history.length ? history.map((n) => `${letterOf(n)}${n}`).join(' → ') : '—'}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/70">
        {keys.map(([k, d]) => (
          <div key={k} className="flex gap-2">
            <kbd className="min-w-12 rounded bg-white/15 px-1.5 text-center font-mono text-white">{k}</kbd>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Toast() {
  const toast = useBingo((s) => s.toast)
  if (!toast) return null
  return (
    <div className="absolute top-[12vh] left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/75 px-[3vw] py-[1.5vh] text-[2.6vh] font-bold text-white">
      {toast}
    </div>
  )
}

/** マウスを動かしていないときはカーソルを隠す（投影時に邪魔にならないように） */
function useAutoHideCursor() {
  useEffect(() => {
    let timer = 0
    const onMove = () => {
      document.body.style.cursor = ''
      clearTimeout(timer)
      timer = window.setTimeout(() => (document.body.style.cursor = 'none'), 2500)
    }
    window.addEventListener('mousemove', onMove)
    onMove()
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
}

export function Overlay() {
  useAutoHideCursor()
  return (
    <div className="pointer-events-none absolute inset-0 select-none [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
      <Header />
      <StartHint />
      <MainNumber />
      <HistoryBoard />
      <RecentChips />
      <JackpotOverlay />
      <ControlPanel />
      <ResetModal />
      <Toast />
    </div>
  )
}
