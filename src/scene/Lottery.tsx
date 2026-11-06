import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPEED_TIMING, currentNumber, useBingo } from '../store/useBingo'
import { BOX_POS, HERO_FINAL, clamp01, damp, easeOutBack, easeOutCubic, getDotTexture, makeNumberTexture } from './common'

const BOX_W = 1.7
const BOX_H = 1.4
const LID_H = 0.32

/** 抽選用の大きなプレゼント箱：ルーレット中にカタカタ揺れ、確定時にフタが吹き飛ぶ */
export function LotteryBox() {
  const body = useRef<THREE.Group>(null)
  const lid = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const beam = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const { phase, phaseStart, settings } = useBingo.getState()
    const timing = SPEED_TIMING[settings.speed]
    const el = (performance.now() - phaseStart) / 1000
    const t = clock.elapsedTime
    if (!body.current || !lid.current || !light.current || !beam.current) return
    const beamMat = beam.current.material as THREE.MeshBasicMaterial

    body.current.rotation.set(0, 0, 0)
    body.current.position.set(0, 0, 0)
    lid.current.position.set(0, BOX_H, 0)
    lid.current.rotation.set(0, 0, 0)
    light.current.intensity = 0
    beamMat.opacity = 0

    if (phase === 'rolling') {
      const p = clamp01(el / timing.roll)
      const amp = 0.03 + 0.14 * p
      body.current.rotation.z = Math.sin(t * 38) * amp * 0.6
      body.current.rotation.x = Math.cos(t * 31) * amp * 0.4
      body.current.position.y = Math.abs(Math.sin(t * 24)) * amp * 0.7
      lid.current.position.y = BOX_H + Math.abs(Math.sin(t * 45)) * amp * 0.9
      lid.current.rotation.z = Math.sin(t * 52) * amp * 0.8
      light.current.intensity = (3 + 12 * p) * (0.7 + 0.3 * Math.sin(t * 60))
    } else if (phase === 'reveal' || phase === 'shown') {
      const lt = phase === 'shown' ? 1 : clamp01(el / 0.8)
      const e = easeOutCubic(lt)
      // 放物線を描いて横に落ちる
      lid.current.position.set(e * 2.0, BOX_H + Math.sin(lt * Math.PI) * 3.2 - BOX_H * e, e * 1.0)
      lid.current.rotation.set(e * Math.PI * 2, e * 0.5, 0)
      const glow = phase === 'shown' ? 0.15 : Math.exp(-el * 1.6)
      light.current.intensity = 4 + 40 * glow
      beamMat.opacity = 0.05 + 0.5 * glow
    }
  })

  return (
    <group position={BOX_POS}>
      <group ref={body}>
        <mesh position={[0, BOX_H / 2, 0]} castShadow>
          <boxGeometry args={[BOX_W, BOX_H, BOX_W]} />
          <meshStandardMaterial color="#b80f2a" roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh position={[0, BOX_H / 2, 0]}>
          <boxGeometry args={[0.3, BOX_H + 0.01, BOX_W + 0.01]} />
          <meshStandardMaterial color="#f2c230" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, BOX_H / 2, 0]}>
          <boxGeometry args={[BOX_W + 0.01, BOX_H + 0.01, 0.3]} />
          <meshStandardMaterial color="#f2c230" metalness={0.8} roughness={0.25} />
        </mesh>
        <group ref={lid}>
          <mesh position={[0, LID_H / 2, 0]}>
            <boxGeometry args={[BOX_W + 0.14, LID_H, BOX_W + 0.14]} />
            <meshStandardMaterial color="#d0142f" roughness={0.35} />
          </mesh>
          <mesh position={[0, LID_H / 2, 0]}>
            <boxGeometry args={[0.32, LID_H + 0.02, BOX_W + 0.16]} />
            <meshStandardMaterial color="#f2c230" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, LID_H / 2, 0]}>
            <boxGeometry args={[BOX_W + 0.16, LID_H + 0.02, 0.32]} />
            <meshStandardMaterial color="#f2c230" metalness={0.8} roughness={0.25} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.28, LID_H + 0.2, 0]} rotation={[0, 0, s * 0.5]}>
              <torusGeometry args={[0.28, 0.09, 10, 24]} />
              <meshStandardMaterial color="#f2c230" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
        </group>
      </group>
      <pointLight ref={light} position={[0, BOX_H + 0.6, 0.3]} color="#ffd27a" distance={10} />
      <mesh ref={beam} position={[0, BOX_H + 3, 0]}>
        <cylinderGeometry args={[1.6, 0.7, 6, 32, 1, true]} />
        <meshBasicMaterial color="#ffe08a" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const ORN_COUNT = 30
const ORN_COLORS = ['#e5243b', '#ffcc33', '#d8dde8', '#2a6cff', '#19a35a', '#ff6ad5']

/** ツリーの周りを浮遊するオーナメント。ルーレット中は箱の周りで渦を巻いて飛び交う */
export function FloatingOrnaments() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mix = useRef(0)
  const data = useMemo(
    () =>
      Array.from({ length: ORN_COUNT }, (_, i) => ({
        r: 4.2 + Math.random() * 3.5,
        h: 1.2 + Math.random() * 6,
        a0: Math.random() * Math.PI * 2,
        sp: (0.08 + Math.random() * 0.15) * (i % 2 ? 1 : -1),
        bob: Math.random() * Math.PI * 2,
        size: 0.18 + Math.random() * 0.16,
        vr: 1.2 + Math.random() * 1.6,
        vh: 0.6 + Math.random() * 3.4,
        vs: 3 + Math.random() * 4,
        color: new THREE.Color(ORN_COLORS[i % ORN_COLORS.length]),
      })),
    [],
  )
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!mesh.current) return
    data.forEach((d, i) => mesh.current!.setColorAt(i, d.color))
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [data])

  useFrame(({ clock }, dt) => {
    const { phase, phaseStart, settings } = useBingo.getState()
    const t = clock.elapsedTime
    const rolling = phase === 'rolling'
    const p = rolling ? clamp01((performance.now() - phaseStart) / 1000 / SPEED_TIMING[settings.speed].roll) : 0
    mix.current += ((rolling ? 1 : 0) - mix.current) * damp(rolling ? 3.5 : 1.8, dt)
    const m = mix.current
    if (!mesh.current) return
    data.forEach((d, i) => {
      const ang = d.a0 + t * d.sp
      a.set(Math.cos(ang) * d.r, d.h + Math.sin(t * 0.8 + d.bob) * 0.25, Math.sin(ang) * d.r)
      const va = d.a0 + t * d.vs * (0.6 + p * 0.8)
      const vr = d.vr * (1 - p * 0.35)
      b.set(
        BOX_POS.x + Math.cos(va) * vr,
        BOX_POS.y + d.vh + Math.sin(t * 7 + d.bob) * 0.5,
        BOX_POS.z + Math.sin(va) * vr,
      )
      tmp.position.lerpVectors(a, b, m)
      tmp.rotation.set(t * 0.5 + d.bob, t * (0.4 + m * 6), 0)
      tmp.scale.setScalar(d.size)
      tmp.updateMatrix()
      mesh.current!.setMatrixAt(i, tmp.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ORN_COUNT]} castShadow>
      <sphereGeometry args={[1, 20, 20]} />
      <meshStandardMaterial metalness={0.85} roughness={0.18} />
    </instancedMesh>
  )
}

/** 当選番号のオーナメント：箱から飛び出してカメラ正面で回転・静止する */
export function HeroOrnament() {
  const group = useRef<THREE.Group>(null)
  const ball = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Sprite>(null)
  const scale = useRef(0)
  const burstTime = useRef(-1e9)
  const lastBurst = useRef(useBingo.getState().burstId)
  const number = useBingo(currentNumber)

  const texture = useMemo(() => makeNumberTexture(number), [number])
  useEffect(() => () => texture.dispose(), [texture])

  const start = useMemo(() => new THREE.Vector3(BOX_POS.x, BOX_POS.y + BOX_H, BOX_POS.z), [])
  const ctrl = useMemo(() => new THREE.Vector3(0, 7.5, 5.5), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const { phase, phaseStart, settings, burstId } = useBingo.getState()
    const now = performance.now()
    if (burstId !== lastBurst.current) {
      lastBurst.current = burstId
      burstTime.current = now
    }
    const g = group.current
    const m = ball.current
    if (!g || !m || !halo.current) return
    const R = SPEED_TIMING[settings.speed].reveal
    const t = clock.elapsedTime

    if (phase === 'reveal') {
      const k = clamp01((now - phaseStart) / (R * 1000 * 0.7))
      const e = easeOutCubic(k)
      // 2次ベジェ曲線で箱 → 頭上 → カメラ正面へ
      const u = 1 - e
      tmp.copy(start).multiplyScalar(u * u)
      tmp.addScaledVector(ctrl, 2 * u * e)
      tmp.addScaledVector(HERO_FINAL, e * e)
      g.position.copy(tmp)
      m.rotation.set((1 - e) * Math.PI * 2, (1 - e) * Math.PI * 8, 0)
      scale.current = 0.2 + 0.8 * easeOutBack(clamp01(k * 1.1))
    } else if (phase === 'shown') {
      g.position.set(HERO_FINAL.x, HERO_FINAL.y + Math.sin(t * 1.2) * 0.06, HERO_FINAL.z)
      m.rotation.x += (0 - m.rotation.x) * damp(6, dt)
      m.rotation.y += (Math.sin(t * 0.7) * 0.1 - m.rotation.y) * damp(6, dt)
      scale.current += (1 - scale.current) * damp(6, dt)
    } else if (phase === 'rolling') {
      // 次の番号のテクスチャに切り替わるため即座に隠す（ネタバレ防止）
      scale.current = 0
    } else {
      scale.current += (0 - scale.current) * damp(10, dt)
    }

    g.scale.setScalar(Math.max(scale.current, 0.0001))
    g.visible = scale.current > 0.01
    const glow = Math.exp(-(now - burstTime.current) / 700)
    const mat = m.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.25 + glow * 1.8
    const hm = halo.current.material as THREE.SpriteMaterial
    hm.opacity = 0.35 + glow * 0.65
    halo.current.scale.setScalar(5.2 + glow * 3 + Math.sin(t * 2) * 0.2)
  })

  return (
    <group ref={group} visible={false}>
      <sprite ref={halo} position={[0, 0, -0.6]}>
        <spriteMaterial map={getDotTexture()} color={new THREE.Color(2.2, 1.6, 0.6)} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <mesh ref={ball}>
        <sphereGeometry args={[1.5, 64, 48]} />
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" metalness={0.25} roughness={0.28} />
        {/* 吊り下げ金具 */}
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.3, 24]} />
        <meshStandardMaterial color="#e8b923" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <torusGeometry args={[0.16, 0.05, 10, 24]} />
        <meshStandardMaterial color="#e8b923" metalness={1} roughness={0.25} />
      </mesh>
      </mesh>
    </group>
  )
}
