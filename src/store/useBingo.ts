import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Phase = 'idle' | 'rolling' | 'reveal' | 'shown'
export type Speed = 'quick' | 'normal' | 'slow'

/** 演出速度ごとの所要時間（秒）。roll = ルーレット、reveal = 飛び出し〜静止 */
export const SPEED_TIMING: Record<Speed, { roll: number; reveal: number; label: string }> = {
  quick: { roll: 2.2, reveal: 1.6, label: '巻き進行' },
  normal: { roll: 4.5, reveal: 2.2, label: '標準' },
  slow: { roll: 6.0, reveal: 2.6, label: 'じっくり' },
}

export interface Settings {
  masterVolume: number
  bgmVolume: number
  sfxVolume: number
  muted: boolean
  speed: Speed
  showBoard: boolean
}

interface BingoState {
  history: number[]
  phase: Phase
  /** 現フェーズの開始時刻 (performance.now) — 3D 側の進行計算に使う */
  phaseStart: number
  /** 紙吹雪・スパークを発火させるたびに増える */
  burstId: number
  /** 最新番号を観客に公開済みか（演出中はネタバレ防止で履歴表示から除外） */
  revealed: boolean
  jackpot: boolean
  jackpotStart: number
  resetModal: boolean
  panelOpen: boolean
  toast: string | null
  settings: Settings

  /** 次の番号を抽選して履歴に記録し、rolling フェーズに入る（全消化なら null） */
  drawNext: () => number | null
  setPhase: (p: Phase) => void
  fireBurst: () => void
  setJackpot: (on: boolean) => void
  setResetModal: (on: boolean) => void
  setPanelOpen: (on: boolean) => void
  setToast: (msg: string | null) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetGame: () => void
}

export const letterOf = (n: number) => 'BINGO'[Math.floor((n - 1) / 15)]

/** 暗号学的乱数で 0..max-1 を偏りなく返す */
function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % max
}

export const useBingo = create<BingoState>()(
  persist(
    (set, get) => ({
      history: [],
      phase: 'idle',
      phaseStart: 0,
      burstId: 0,
      revealed: true,
      jackpot: false,
      jackpotStart: 0,
      resetModal: false,
      panelOpen: false,
      toast: null,
      settings: {
        masterVolume: 0.8,
        bgmVolume: 0.35,
        sfxVolume: 0.9,
        muted: false,
        speed: 'normal',
        showBoard: true,
      },

      drawNext: () => {
        const { history } = get()
        const drawn = new Set(history)
        const remaining: number[] = []
        for (let i = 1; i <= 75; i++) if (!drawn.has(i)) remaining.push(i)
        if (remaining.length === 0) return null
        const n = remaining[randomInt(remaining.length)]
        // 演出開始の時点で確定・保存しておく（演出中のリロードでも番号が失われない）
        // 履歴追加と「演出開始（未公開）」を同時に反映し、一瞬でも番号が先に見えないようにする
        set({ history: [...history, n], phase: 'rolling', phaseStart: performance.now(), revealed: false })
        return n
      },
      setPhase: (phase) =>
        set(phase === 'rolling' ? { phase, phaseStart: performance.now(), revealed: false } : { phase, phaseStart: performance.now() }),
      fireBurst: () => set((s) => ({ burstId: s.burstId + 1, revealed: true })),
      setJackpot: (jackpot) => set({ jackpot, jackpotStart: performance.now() }),
      setResetModal: (resetModal) => set({ resetModal }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setToast: (toast) => set({ toast }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetGame: () =>
        set({ history: [], phase: 'idle', phaseStart: performance.now(), jackpot: false, resetModal: false, revealed: true }),
    }),
    {
      name: 'xmas-bingo-3d-v1',
      partialize: (s) => ({ history: s.history, settings: s.settings }),
    },
  ),
)

// localStorage からの復元は同期的に完了している。履歴があれば「最新番号を表示中」から再開する
if (useBingo.getState().history.length > 0) {
  useBingo.setState({ phase: 'shown', phaseStart: -1e7 })
}

export const currentNumber = (s: { history: number[] }) =>
  s.history.length ? s.history[s.history.length - 1] : null

/** 観客に公開済みの履歴（抽選演出中は最新番号を除外） */
export const useVisibleHistory = () => {
  const history = useBingo((s) => s.history)
  const revealed = useBingo((s) => s.revealed)
  return revealed ? history : history.slice(0, -1)
}
