import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import type { BloomEffect, ChromaticAberrationEffect } from 'postprocessing'
import * as THREE from 'three'
import { SPEED_TIMING, useBingo } from '../store/useBingo'
import { BOX_POS, HERO_FINAL, JACKPOT_POS, clamp01, damp } from './common'
import { Ground, Presents, Tree } from './Tree'
import { Snow } from './Snow'
import { FloatingOrnaments, HeroOrnament, LotteryBox } from './Lottery'
import { Burst } from './Burst'
import { Jackpot } from './Jackpot'

const BG_NIGHT = new THREE.Color('#070d24')
const BG_BLACK = new THREE.Color('#000000')

/** フェーズごとの目標カメラ位置へ指数減衰で追従させるカメラワーク */
function CameraRig({ bloom, chroma }: { bloom: React.RefObject<BloomEffect | null>; chroma: React.RefObject<ChromaticAberrationEffect | null> }) {
  const { camera, scene } = useThree()
  const look = useRef(new THREE.Vector3(0, 3, 0))
  const targetPos = useMemo(() => new THREE.Vector3(), [])
  const targetLook = useMemo(() => new THREE.Vector3(), [])
  const lastJackpot = useRef(false)
  const lastBurst = useRef(useBingo.getState().burstId)
  const burstAt = useRef(-1e9)
  const fog = useMemo(() => new THREE.Fog('#0a1230', 22, 60), [])
  const bg = useMemo(() => BG_NIGHT.clone(), [])
  const dim = useRef(0)

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const { phase, phaseStart, settings, jackpot, burstId } = useBingo.getState()
    const t = clock.elapsedTime
    const now = performance.now()
    const el = (now - phaseStart) / 1000
    let k = 1.6

    if (burstId !== lastBurst.current) {
      lastBurst.current = burstId
      burstAt.current = now
    }

    if (jackpot) {
      targetPos.set(JACKPOT_POS.x + Math.sin(t * 0.3) * 1.5, JACKPOT_POS.y + 0.5, JACKPOT_POS.z + 15)
      targetLook.copy(JACKPOT_POS)
      if (!lastJackpot.current) {
        // 暗転中にカメラを瞬間移動
        camera.position.copy(targetPos)
        look.current.copy(targetLook)
      }
      k = 2
    } else if (phase === 'rolling') {
      // 箱に急接近し、徐々に手ブレを強める
      const p = clamp01(el / SPEED_TIMING[settings.speed].roll)
      const shake = 0.02 + p * 0.09
      targetPos.set(BOX_POS.x + Math.sin(t * 0.9) * 0.6 + Math.sin(t * 31) * shake, 2.9 + Math.cos(t * 27) * shake, BOX_POS.z + 5.2 - p * 0.9)
      targetLook.set(BOX_POS.x, 1.4, BOX_POS.z)
      k = 3.2
    } else if (phase === 'reveal' || phase === 'shown') {
      targetPos.set(HERO_FINAL.x + Math.sin(t * 0.25) * 0.3, HERO_FINAL.y, HERO_FINAL.z + 5.6)
      targetLook.set(HERO_FINAL.x, HERO_FINAL.y, 0)
      k = phase === 'reveal' ? 2.4 : 1.5
    } else {
      // 待機中：ツリー全体をゆっくり回り込む
      const a = Math.sin(t * 0.12) * 0.35
      targetPos.set(Math.sin(a) * 15, 3.8 + Math.sin(t * 0.2) * 0.4, Math.cos(a) * 15)
      targetLook.set(0, 3.2, 0)
      k = 1.2
    }
    lastJackpot.current = jackpot

    const f = damp(k, dt)
    camera.position.lerp(targetPos, f)
    look.current.lerp(targetLook, f)
    camera.lookAt(look.current)

    // 背景と霧：ジャックポット時は暗転
    dim.current += ((jackpot ? 1 : 0) - dim.current) * damp(4, dt)
    bg.copy(BG_NIGHT).lerp(BG_BLACK, dim.current)
    scene.background = bg
    scene.fog = jackpot ? null : fog

    // ブルーム強度：確定の瞬間に跳ね上げる
    const glow = Math.exp(-(now - burstAt.current) / 900)
    if (bloom.current) bloom.current.intensity = (jackpot ? 1.6 : 1.0) + glow * 1.8
    if (chroma.current) {
      const ca = phase === 'rolling' ? 0.0006 + clamp01(el / 6) * 0.002 : glow * 0.004
      chroma.current.offset.set(ca, ca * 0.6)
    }
  })
  return null
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#6c84c9', '#1b2340', 0.9]} />
      <directionalLight position={[-8, 14, 10]} intensity={1.4} color="#bcd0ff" />
      <spotLight position={[0, 10, 12]} angle={0.45} penumbra={0.6} intensity={120} color="#fff1d6" distance={30} target-position={[0, 1, 3]} />
    </>
  )
}

export function Stage() {
  const bloom = useRef<BloomEffect>(null)
  const chroma = useRef<ChromaticAberrationEffect>(null)
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 45, near: 0.1, far: 200, position: [0, 4, 15] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <CameraRig bloom={bloom} chroma={chroma} />
      <Lights />
      <Stars radius={90} depth={40} count={2500} factor={4} saturation={0} fade speed={0.6} />
      <Ground />
      <Tree />
      <Presents />
      <LotteryBox />
      <FloatingOrnaments />
      <HeroOrnament />
      <Burst />
      <Snow />
      <Jackpot />
      <EffectComposer multisampling={4}>
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={1} radius={0.75} />
        <ChromaticAberration ref={chroma} offset={new THREE.Vector2(0, 0)} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  )
}
