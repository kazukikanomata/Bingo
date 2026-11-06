import * as THREE from 'three'

/** シーン内の主要な座標 */
export const BOX_POS = new THREE.Vector3(0, 0, 4.4)
export const HERO_FINAL = new THREE.Vector3(0, 3.3, 7.8)
export const JACKPOT_POS = new THREE.Vector3(0, 40, 0)

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
/** フレームレート非依存の指数減衰補間係数 */
export const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)

let dotTex: THREE.Texture | null = null
/** パーティクル用の柔らかい丸テクスチャ（Canvas 生成なので外部ファイル不要） */
export function getDotTexture() {
  if (dotTex) return dotTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  dotTex = new THREE.CanvasTexture(c)
  return dotTex
}

const BINGO_COLORS = ['#1e6bff', '#e5243b', '#f2f2f2', '#18a957', '#ffb400']

/** 抽選オーナメント表面のテクスチャ（球の正面 u=0.25 と背面 u=0.75 に番号を描く） */
export function makeNumberTexture(n: number | null) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#fff7e0')
  grad.addColorStop(1, '#ffe9b0')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 512)
  // 赤いストライプ（オーナメント風）
  g.fillStyle = '#c4122f'
  g.fillRect(0, 40, 1024, 26)
  g.fillRect(0, 446, 1024, 26)
  g.fillStyle = '#d4a017'
  g.fillRect(0, 74, 1024, 8)
  g.fillRect(0, 430, 1024, 8)
  if (n !== null) {
    const letter = 'BINGO'[Math.floor((n - 1) / 15)]
    const col = BINGO_COLORS[Math.floor((n - 1) / 15)]
    for (const cx of [256, 768]) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.ellipse(cx, 256, 170, 150, 0, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 10
      g.strokeStyle = col
      g.stroke()
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = col
      g.font = '800 64px Poppins, Impact, sans-serif'
      g.fillText(letter, cx, 150)
      g.fillStyle = '#7a0b1c'
      g.font = '900 190px Poppins, Impact, sans-serif'
      g.fillText(String(n), cx, 290)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
