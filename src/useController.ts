import { useEffect, useRef } from 'react'
import { SPEED_TIMING, useBingo } from './store/useBingo'
import { sound } from './audio/sound'

/** Tauri のデスクトップアプリとして動作中か */
const isTauri = () => '__TAURI_INTERNALS__' in window

/**
 * 抽選の進行（rolling → reveal → shown）、効果音のタイミング、
 * キーボードショートカットをまとめて管理する。
 */
export function useController() {
  const timers = useRef<number[]>([])
  const burstDone = useRef(true)

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  const later = (sec: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, sec * 1000))
  }

  // 音量設定を同期
  const settings = useBingo((s) => s.settings)
  useEffect(() => {
    sound.setVolumes({
      master: settings.masterVolume,
      bgm: settings.bgmVolume,
      sfx: settings.sfxVolume,
      muted: settings.muted,
    })
  }, [settings])

  useEffect(() => {
    const st = useBingo.getState

    const burst = () => {
      if (burstDone.current) return
      burstDone.current = true
      st().fireBurst()
      sound.fanfare()
      sound.cracker()
      sound.cracker(0.15)
      sound.bells()
    }

    const toShown = () => {
      clearTimers()
      burst()
      st().setPhase('shown')
    }

    const toReveal = () => {
      clearTimers()
      const { reveal } = SPEED_TIMING[st().settings.speed]
      st().setPhase('reveal')
      sound.stopDrumRoll(true)
      later(reveal * 0.62, burst)
      later(reveal, toShown)
    }

    const startDraw = () => {
      const n = st().drawNext()
      if (n === null) {
        st().setToast('全75個の番号が出ました！ R キーでリセットできます')
        later(3, () => st().setToast(null))
        return
      }
      clearTimers()
      burstDone.current = false
      const { roll } = SPEED_TIMING[st().settings.speed]
      sound.startDrumRoll()
      later(roll, toReveal)
    }

    const onSpace = () => {
      const { phase } = st()
      if (phase === 'idle' || phase === 'shown') startDraw()
      else if (phase === 'rolling') toReveal() // スキップ：即時確定へ
      else if (phase === 'reveal') toShown()
    }

    const toggleJackpot = () => {
      const on = !st().jackpot
      st().setJackpot(on)
      if (on) sound.bingo()
    }

    const toggleFullscreen = async () => {
      // Tauri アプリ内ではウィンドウ自体をフルスクリーン化（macOS の WebView では requestFullscreen が使えないため）
      if (isTauri()) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        await win.setFullscreen(!(await win.isFullscreen()))
        return
      }
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    }

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // コントロールパネルのスライダー操作中は矢印キー等だけ譲る（ショートカットは常に有効）
      if (target?.tagName === 'INPUT' && /^(Arrow|Home|End|Page)/.test(e.code)) return
      sound.unlock()
      if (!st().settings.muted) sound.startBgm()

      const s = st()
      // リセット確認モーダル表示中
      if (s.resetModal) {
        if (e.code === 'Enter' || e.code === 'KeyY') {
          e.preventDefault()
          clearTimers()
          sound.stopDrumRoll(false)
          s.resetGame()
          s.setToast('リセットしました。第2ゲームを開始できます')
          later(2.5, () => st().setToast(null))
        } else if (e.code === 'Escape' || e.code === 'KeyN') {
          e.preventDefault()
          s.setResetModal(false)
        }
        return
      }
      if (e.repeat) return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur?.()
          if (s.jackpot) s.setJackpot(false)
          else onSpace()
          break
        case 'KeyB':
          toggleJackpot()
          break
        case 'KeyH':
          s.updateSettings({ showBoard: !s.settings.showBoard })
          break
        case 'KeyM': {
          const muted = !s.settings.muted
          s.updateSettings({ muted })
          if (muted) sound.stopBgm()
          else sound.startBgm()
          break
        }
        case 'KeyF':
          void toggleFullscreen()
          break
        case 'KeyR':
          s.setResetModal(true)
          break
        case 'KeyC':
          s.setPanelOpen(!s.panelOpen)
          break
        case 'Escape':
          if (s.jackpot) s.setJackpot(false)
          else if (s.panelOpen) s.setPanelOpen(false)
          break
      }
    }

    const onPointer = () => {
      sound.unlock()
      if (!st().settings.muted) sound.startBgm()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
      clearTimers()
    }
  }, [])
}

/** コントロールパネルのボタンからキー操作と同じ処理を呼ぶためのヘルパー */
export function pressKey(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
}
