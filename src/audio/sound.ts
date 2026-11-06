/**
 * Web Audio API による効果音・BGM のリアルタイム合成エンジン。
 * 音声ファイルを一切使わないため、外部ネットワークもファイル読み込みも不要で、
 * 再生遅延がほぼゼロ（Howler.js によるプリロードの代替）。
 *
 * 差し替えたい場合は public/sounds/ に音声ファイルを置き、各 play* 関数の中で
 * HTMLAudioElement を鳴らすように置き換えればよい。
 */

type Bus = { gain: GainNode }

class SoundEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: Bus
  private bgm!: Bus
  private comp!: DynamicsCompressorNode
  private noise!: AudioBuffer
  private roll: { gain: GainNode; timer: number } | null = null
  private bgmTimer: number | null = null
  private bgmNextTime = 0
  private bgmStep = 0
  private vol = { master: 0.8, bgm: 0.35, sfx: 0.9, muted: false }

  /** ユーザー操作（キー押下）をきっかけに AudioContext を起動する */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext()
      this.ctx = ctx
      this.comp = ctx.createDynamicsCompressor()
      this.comp.threshold.value = -10
      this.comp.ratio.value = 4
      this.master = ctx.createGain()
      this.master.connect(this.comp).connect(ctx.destination)
      this.sfx = { gain: ctx.createGain() }
      this.bgm = { gain: ctx.createGain() }
      this.sfx.gain.connect(this.master)
      this.bgm.gain.connect(this.master)
      const len = ctx.sampleRate * 2
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.applyVolumes()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  get ready() {
    return !!this.ctx
  }

  setVolumes(v: { master: number; bgm: number; sfx: number; muted: boolean }) {
    this.vol = v
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05)
    this.bgm.gain.gain.setTargetAtTime(this.vol.bgm * 0.5, t, 0.05)
    this.sfx.gain.gain.setTargetAtTime(this.vol.sfx, t, 0.05)
  }

  // ---------- 低レベル部品 ----------

  private tone(
    dest: AudioNode,
    freq: number,
    start: number,
    dur: number,
    opt: { type?: OscillatorType; gain?: number; attack?: number; cutoff?: number; detune?: number } = {},
  ) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = opt.type ?? 'sine'
    osc.frequency.value = freq
    if (opt.detune) osc.detune.value = opt.detune
    const g = ctx.createGain()
    const peak = opt.gain ?? 0.2
    const atk = opt.attack ?? 0.01
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    let node: AudioNode = osc
    if (opt.cutoff) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(opt.cutoff * 2, start)
      f.frequency.exponentialRampToValueAtTime(opt.cutoff, start + dur)
      osc.connect(f)
      node = f
    }
    node.connect(g).connect(dest)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }

  private noiseHit(
    dest: AudioNode,
    start: number,
    dur: number,
    opt: { type?: BiquadFilterType; freq?: number; q?: number; gain?: number } = {},
  ) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = opt.type ?? 'bandpass'
    f.frequency.value = opt.freq ?? 2000
    f.Q.value = opt.q ?? 1
    const g = ctx.createGain()
    g.gain.setValueAtTime(opt.gain ?? 0.3, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(f).connect(g).connect(dest)
    src.start(start, Math.random())
    src.stop(start + dur + 0.05)
  }

  private bell(dest: AudioNode, freq: number, start: number, gain = 0.15, dur = 2.2) {
    // 金属的な非整数倍音でベルを合成
    const partials: [number, number][] = [
      [1, 1],
      [2.76, 0.5],
      [5.4, 0.3],
      [8.93, 0.15],
    ]
    for (const [ratio, amp] of partials) {
      this.tone(dest, freq * ratio, start, dur / ratio ** 0.4, { gain: gain * amp, attack: 0.003 })
    }
  }

  private now() {
    return this.ctx!.currentTime
  }

  // ---------- 効果音 ----------

  /** ドラムロール開始。stopDrumRoll() まで鳴り続け、徐々にクレッシェンド */
  startDrumRoll() {
    if (!this.ctx) return
    this.stopDrumRoll(false)
    const ctx = this.ctx
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 6)
    gain.connect(this.sfx.gain)
    let next = ctx.currentTime + 0.02
    const schedule = () => {
      while (next < ctx.currentTime + 0.15) {
        this.noiseHit(gain, next, 0.07, { freq: 1800 + Math.random() * 400, q: 0.8, gain: 0.35 + Math.random() * 0.1 })
        this.tone(gain, 180, next, 0.05, { type: 'triangle', gain: 0.12 })
        next += 0.042
      }
    }
    schedule()
    const timer = window.setInterval(schedule, 40)
    this.roll = { gain, timer }
  }

  stopDrumRoll(withHit = true) {
    if (!this.ctx || !this.roll) return
    const { gain, timer } = this.roll
    clearInterval(timer)
    const t = this.now()
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.05)
    setTimeout(() => gain.disconnect(), 400)
    this.roll = null
    if (withHit) this.crash()
  }

  /** シンバル＋バスドラ */
  crash() {
    if (!this.ctx) return
    const t = this.now()
    this.noiseHit(this.sfx.gain, t, 1.8, { type: 'highpass', freq: 5000, q: 0.5, gain: 0.5 })
    this.noiseHit(this.sfx.gain, t, 0.6, { type: 'bandpass', freq: 9000, q: 2, gain: 0.3 })
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    g.gain.setValueAtTime(0.9, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    osc.connect(g).connect(this.sfx.gain)
    osc.start(t)
    osc.stop(t + 0.6)
  }

  /** 決定ファンファーレ（ブラス風の和音） */
  fanfare() {
    if (!this.ctx) return
    const t = this.now()
    const brass = (freqs: number[], s: number, d: number, g = 0.07) => {
      for (const f of freqs) {
        this.tone(this.sfx.gain, f, t + s, d, { type: 'sawtooth', gain: g, attack: 0.03, cutoff: 2200, detune: -6 })
        this.tone(this.sfx.gain, f, t + s, d, { type: 'sawtooth', gain: g, attack: 0.03, cutoff: 2200, detune: 6 })
      }
    }
    const C = [523.25, 659.25, 783.99]
    const F = [698.46, 880.0, 1046.5]
    const G = [783.99, 987.77, 1174.66]
    const C2 = [1046.5, 1318.51, 1567.98]
    brass(C, 0, 0.16)
    brass(C, 0.17, 0.16)
    brass(C, 0.34, 0.16)
    brass(F, 0.52, 0.32)
    brass(G, 0.86, 0.32)
    brass(C2, 1.2, 1.4, 0.08)
    this.noiseHit(this.sfx.gain, t + 1.2, 1.5, { type: 'highpass', freq: 6000, gain: 0.25 })
  }

  /** ベル（クリスマス感のあるチャイム） */
  bells() {
    if (!this.ctx) return
    const t = this.now()
    const notes = [1318.51, 1567.98, 2093.0, 1567.98, 2637.02]
    notes.forEach((f, i) => this.bell(this.sfx.gain, f, t + i * 0.09, 0.08, 2.5))
  }

  /** クラッカー（パン！＋紙が舞う音） */
  cracker(delay = 0) {
    if (!this.ctx) return
    const t = this.now() + delay
    this.noiseHit(this.sfx.gain, t, 0.12, { type: 'bandpass', freq: 1200, q: 0.7, gain: 1.0 })
    this.noiseHit(this.sfx.gain, t, 0.25, { type: 'highpass', freq: 3000, gain: 0.5 })
    this.noiseHit(this.sfx.gain, t + 0.05, 0.8, { type: 'highpass', freq: 7000, gain: 0.12 })
  }

  /** BINGO 確定音：上昇アルペジオ → 大和音 → クラッカー連発 */
  bingo() {
    if (!this.ctx) return
    const t = this.now()
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
    arp.forEach((f, i) =>
      this.tone(this.sfx.gain, f, t + i * 0.07, 0.4, { type: 'square', gain: 0.05, cutoff: 3000 }),
    )
    const chord = [261.63, 523.25, 659.25, 783.99, 1046.5]
    for (const f of chord) {
      this.tone(this.sfx.gain, f, t + 0.55, 2.5, { type: 'sawtooth', gain: 0.06, attack: 0.02, cutoff: 2500, detune: -8 })
      this.tone(this.sfx.gain, f, t + 0.55, 2.5, { type: 'sawtooth', gain: 0.06, attack: 0.02, cutoff: 2500, detune: 8 })
    }
    setTimeout(() => this.crash(), 550)
    ;[0.6, 0.85, 1.1, 1.5, 1.9].forEach((d) => this.cracker(d))
    ;[2093.0, 2637.02, 3135.96].forEach((f, i) => this.bell(this.sfx.gain, f, t + 0.6 + i * 0.12, 0.07))
  }

  /** 花火の破裂音（ジャックポット中に繰り返し） */
  firework() {
    if (!this.ctx) return
    const t = this.now()
    this.noiseHit(this.sfx.gain, t, 0.5, { type: 'lowpass', freq: 600, gain: 0.6 })
    this.noiseHit(this.sfx.gain, t + 0.08, 1.2, { type: 'highpass', freq: 5000, gain: 0.08 })
  }

  // ---------- BGM（オリジナルの穏やかなクリスマス風ループ） ----------

  startBgm() {
    if (!this.ctx || this.bgmTimer !== null) return
    this.bgmNextTime = this.ctx.currentTime + 0.1
    this.bgmStep = 0
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 100)
  }

  stopBgm() {
    if (this.bgmTimer !== null) clearInterval(this.bgmTimer)
    this.bgmTimer = null
  }

  private scheduleBgm() {
    const ctx = this.ctx!
    const beat = 60 / 96 / 2 // 8分音符
    // Cmaj7 → Am7 → Fmaj7 → G7sus
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 261.63, 293.66, 349.23],
    ]
    const melody = [
      783.99, 0, 659.25, 0, 783.99, 880.0, 783.99, 0,
      659.25, 0, 523.25, 0, 587.33, 659.25, 0, 0,
      698.46, 0, 659.25, 0, 587.33, 523.25, 0, 0,
      587.33, 0, 659.25, 0, 587.33, 0, 0, 0,
    ]
    while (this.bgmNextTime < ctx.currentTime + 0.3) {
      const s = this.bgmStep % 32
      const t = this.bgmNextTime
      const chord = chords[Math.floor(s / 8)]
      if (s % 8 === 0) {
        for (const f of chord) this.tone(this.bgm.gain, f, t, beat * 8, { type: 'triangle', gain: 0.05, attack: 0.3 })
        this.tone(this.bgm.gain, chord[0] / 2, t, beat * 4, { type: 'sine', gain: 0.12, attack: 0.02 })
      }
      if (s % 8 === 4) this.tone(this.bgm.gain, chord[0] / 2, t, beat * 4, { type: 'sine', gain: 0.1, attack: 0.02 })
      // スレイベル風のシャカシャカ
      this.noiseHit(this.bgm.gain, t, 0.08, { type: 'highpass', freq: 8000, gain: s % 2 === 0 ? 0.08 : 0.04 })
      const m = melody[s]
      if (m) this.bell(this.bgm.gain, m, t, 0.06, 1.2)
      this.bgmNextTime += beat
      this.bgmStep++
    }
  }
}

export const sound = new SoundEngine()
