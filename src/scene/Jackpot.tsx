import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Center, Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useBingo } from '../store/useBingo'
import { sound } from '../audio/sound'
import { JACKPOT_POS, clamp01, easeOutBack, getDotTexture } from './common'
import fontData from '../assets/fonts/helvetiker_bold.typeface.json'

const SHELLS = 8
const PER_SHELL = 260
const FW_COUNT = SHELLS * PER_SHELL
const BUBBLES = 500
const PALETTE: [number, number, number][] = [
  [3.2, 2.3, 0.7], // ゴールド
  [3.0, 2.8, 2.2], // シャンパンホワイト
  [3.2, 1.6, 0.4], // アンバー
  [3.0, 1.9, 1.6], // ロゼ
]

/** ジャックポット（BINGO 達成）演出：金色の花火、シャンパンの泡、立体ネオンの BINGO!! ロゴ */
export function Jackpot() {
  const root = useRef<THREE.Group>(null)
  const logo = useRef<THREE.Group>(null)
  const logoMat = useRef<THREE.MeshStandardMaterial>(null)
  const tubeMat = useRef<THREE.MeshBasicMaterial>(null)

  const fw = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FW_COUNT * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(FW_COUNT * 3), 3))
    return {
      geo,
      vel: new Float32Array(FW_COUNT * 3),
      born: new Float32Array(SHELLS).fill(-100),
      base: Array.from({ length: SHELLS }, () => PALETTE[0]),
      next: 0,
      nextTime: 0,
    }
  }, [])

  const bubbles = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(BUBBLES * 3)
    const seed = new Float32Array(BUBBLES)
    for (let i = 0; i < BUBBLES; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = Math.random() * 20 - 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geo, seed }
  }, [])

  const launch = (time: number, idx: number) => {
    fw.born[idx] = time
    const base = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    fw.base[idx] = base
    const cx = (Math.random() - 0.5) * 26
    const cy = 2 + Math.random() * 7
    const cz = -6 - Math.random() * 6
    const pos = fw.geo.getAttribute('position') as THREE.BufferAttribute
    const speed = 5 + Math.random() * 3
    for (let k = 0; k < PER_SHELL; k++) {
      const i = idx * PER_SHELL + k
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const sp = speed * (0.85 + Math.random() * 0.15)
      fw.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
      fw.vel[i * 3 + 1] = Math.cos(ph) * sp
      fw.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
      pos.setXYZ(i, cx, cy, cz)
    }
  }

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const { jackpot, jackpotStart } = useBingo.getState()
    if (!root.current) return
    root.current.visible = jackpot
    if (!jackpot) return
    const time = clock.elapsedTime
    const el = (performance.now() - jackpotStart) / 1000

    // ロゴ：暗転明けにバウンドしながら登場 → ゆらゆら＆ネオン明滅
    if (logo.current && logoMat.current && tubeMat.current) {
      const k = clamp01((el - 0.5) / 0.9)
      const s = Math.max(0.0001, easeOutBack(k))
      logo.current.scale.setScalar(s)
      logo.current.rotation.y = Math.sin(time * 0.8) * 0.25
      logo.current.rotation.x = Math.sin(time * 0.6) * 0.06
      const flicker = el < 1.6 ? (Math.sin(el * 60) > 0 ? 1 : 0.3) : 1
      logoMat.current.emissiveIntensity = (1.6 + Math.sin(time * 4) * 0.5) * flicker
      tubeMat.current.color.setRGB(4 * flicker, 2.6 * flicker, 0.8 * flicker)
    }

    // 花火：一定間隔で次々打ち上げ
    if (el > 0.6 && time > fw.nextTime) {
      launch(time, fw.next)
      fw.next = (fw.next + 1) % SHELLS
      fw.nextTime = time + 0.3 + Math.random() * 0.4
      sound.firework()
    }
    const pos = fw.geo.getAttribute('position') as THREE.BufferAttribute
    const col = fw.geo.getAttribute('color') as THREE.BufferAttribute
    const drag = Math.exp(-1.6 * dt)
    for (let sh = 0; sh < SHELLS; sh++) {
      const age = time - fw.born[sh]
      const life = clamp01(1 - age / 2.4)
      const base = fw.base[sh]
      for (let k = 0; k < PER_SHELL; k++) {
        const i = sh * PER_SHELL + k
        if (life <= 0) {
          col.setXYZ(i, 0, 0, 0)
          continue
        }
        fw.vel[i * 3] *= drag
        fw.vel[i * 3 + 1] = fw.vel[i * 3 + 1] * drag - 2.2 * dt
        fw.vel[i * 3 + 2] *= drag
        pos.setXYZ(i, pos.getX(i) + fw.vel[i * 3] * dt, pos.getY(i) + fw.vel[i * 3 + 1] * dt, pos.getZ(i) + fw.vel[i * 3 + 2] * dt)
        const tw = life < 0.5 ? (Math.sin(time * 30 + k) > 0 ? 1 : 0.2) : 1
        const f = life ** 1.3 * tw
        col.setXYZ(i, base[0] * f, base[1] * f, base[2] * f)
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true

    // シャンパンの泡：下から上へゆらゆら
    const bp = bubbles.geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < BUBBLES; i++) {
      const sd = bubbles.seed[i]
      let y = bp.getY(i) + (1.2 + sd * 2.5) * dt
      if (y > 10) y = -10
      bp.setY(i, y)
      bp.setX(i, bp.getX(i) + Math.sin(time * 2 + sd * 20) * 0.01)
    }
    bp.needsUpdate = true
  })

  return (
    <group ref={root} position={JACKPOT_POS} visible={false}>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 3, 6]} color="#ffd27a" intensity={60} distance={30} />
      <pointLight position={[-8, -2, 4]} color="#ff9a3c" intensity={30} distance={30} />
      <group ref={logo}>
        <Center>
          <Text3D
            font={fontData as never}
            size={2.4}
            height={0.7}
            curveSegments={6}
            bevelEnabled
            bevelThickness={0.08}
            bevelSize={0.05}
            bevelSegments={3}
            letterSpacing={0.08}
          >
            BINGO!!
            <meshStandardMaterial ref={logoMat} color="#ffcc33" emissive="#ff9d00" metalness={0.9} roughness={0.25} toneMapped={false} />
          </Text3D>
        </Center>
        {/* ネオン管風の縁取り（少し大きく後ろに配置した発光ワイヤー） */}
        <Center position={[0, 0, -0.5]}>
          <Text3D font={fontData as never} size={2.4} height={0.05} curveSegments={6} letterSpacing={0.08}>
            BINGO!!
            <meshBasicMaterial ref={tubeMat} wireframe toneMapped={false} />
          </Text3D>
        </Center>
      </group>
      <points geometry={fw.geo} frustumCulled={false}>
        <pointsMaterial map={getDotTexture()} size={0.28} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
      <points geometry={bubbles.geo} frustumCulled={false}>
        <pointsMaterial map={getDotTexture()} size={0.18} color={new THREE.Color(1.6, 1.4, 0.8)} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  )
}
