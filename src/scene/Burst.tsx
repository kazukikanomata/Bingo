import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBingo } from '../store/useBingo'
import { HERO_FINAL, getDotTexture } from './common'

const CONFETTI = 600
const SPARKS = 900
const CONFETTI_COLORS = ['#e5243b', '#ffd23f', '#18a957', '#ffffff', '#2a6cff', '#ff7af0', '#f2c230']

/** 確定時に四方へ飛び散る紙吹雪と光のスパーク */
export function Burst() {
  const confetti = useRef<THREE.InstancedMesh>(null)
  const sparksGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    return g
  }, [])
  const sparksMat = useRef<THREE.PointsMaterial>(null)

  const state = useMemo(
    () => ({
      start: -1e9,
      cPos: new Float32Array(CONFETTI * 3),
      cVel: new Float32Array(CONFETTI * 3),
      cRot: new Float32Array(CONFETTI * 3),
      cSpin: new Float32Array(CONFETTI * 3),
      sVel: new Float32Array(SPARKS * 3),
      sBase: new Float32Array(SPARKS * 3),
    }),
    [],
  )
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const lastBurst = useRef(useBingo.getState().burstId)

  useEffect(() => {
    const m = confetti.current
    if (!m) return
    const c = new THREE.Color()
    for (let i = 0; i < CONFETTI; i++) {
      c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length])
      m.setColorAt(i, c)
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  const spawn = () => {
    state.start = performance.now()
    const o = HERO_FINAL
    for (let i = 0; i < CONFETTI; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const sp = 5 + Math.random() * 9
      state.cPos.set([o.x + Math.cos(th) * 0.8, o.y, o.z - 0.5], i * 3)
      state.cVel.set([Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + 2, Math.sin(ph) * Math.sin(th) * sp * 0.6], i * 3)
      state.cRot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
      state.cSpin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3)
    }
    const col = sparksGeo.getAttribute('color') as THREE.BufferAttribute
    const pos = sparksGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < SPARKS; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const sp = 6 + Math.random() * 16
      state.sVel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp * 0.5], i * 3)
      pos.setXYZ(i, o.x, o.y, o.z - 0.3)
      const gold = Math.random()
      state.sBase.set(gold > 0.3 ? [3.0, 2.2, 0.8] : [2.6, 2.6, 2.8], i * 3)
    }
    col.needsUpdate = true
    pos.needsUpdate = true
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const { burstId } = useBingo.getState()
    if (burstId !== lastBurst.current) {
      lastBurst.current = burstId
      spawn()
    }
    const age = (performance.now() - state.start) / 1000
    const m = confetti.current
    if (!m || !sparksMat.current) return
    const active = age < 6
    m.visible = active
    sparksMat.current.visible = age < 2
    if (!active) return

    // 紙吹雪：空気抵抗でふわっと減速し、ヒラヒラ落ちる
    const drag = Math.exp(-2.2 * dt)
    for (let i = 0; i < CONFETTI; i++) {
      const j = i * 3
      state.cVel[j] *= drag
      state.cVel[j + 1] = state.cVel[j + 1] * drag - 3.2 * dt
      state.cVel[j + 2] *= drag
      state.cVel[j + 1] = Math.max(state.cVel[j + 1], -1.6)
      state.cPos[j] += (state.cVel[j] + Math.sin(age * 3 + i) * 0.4) * dt
      state.cPos[j + 1] += state.cVel[j + 1] * dt
      state.cPos[j + 2] += state.cVel[j + 2] * dt
      state.cRot[j] += state.cSpin[j] * dt
      state.cRot[j + 1] += state.cSpin[j + 1] * dt
      state.cRot[j + 2] += state.cSpin[j + 2] * dt
      tmp.position.set(state.cPos[j], state.cPos[j + 1], state.cPos[j + 2])
      tmp.rotation.set(state.cRot[j], state.cRot[j + 1], state.cRot[j + 2])
      tmp.scale.setScalar(age > 5 ? Math.max(0.001, 6 - age) : 1)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true

    // スパーク：強い減速＋フェードアウト
    if (age < 2) {
      const pos = sparksGeo.getAttribute('position') as THREE.BufferAttribute
      const col = sparksGeo.getAttribute('color') as THREE.BufferAttribute
      const sd = Math.exp(-3 * dt)
      const fade = Math.max(0, 1 - age / 1.6) ** 1.5
      for (let i = 0; i < SPARKS; i++) {
        const j = i * 3
        state.sVel[j] *= sd
        state.sVel[j + 1] = state.sVel[j + 1] * sd - 2 * dt
        state.sVel[j + 2] *= sd
        pos.setXYZ(i, pos.getX(i) + state.sVel[j] * dt, pos.getY(i) + state.sVel[j + 1] * dt, pos.getZ(i) + state.sVel[j + 2] * dt)
        const tw = 0.6 + 0.4 * Math.sin(age * 40 + i)
        col.setXYZ(i, state.sBase[j] * fade * tw, state.sBase[j + 1] * fade * tw, state.sBase[j + 2] * fade * tw)
      }
      pos.needsUpdate = true
      col.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh ref={confetti} args={[undefined, undefined, CONFETTI]} frustumCulled={false} visible={false}>
        <planeGeometry args={[0.16, 0.09]} />
        <meshStandardMaterial side={THREE.DoubleSide} roughness={0.4} metalness={0.3} emissive="#222222" />
      </instancedMesh>
      <points geometry={sparksGeo} frustumCulled={false}>
        <pointsMaterial
          ref={sparksMat}
          map={getDotTexture()}
          size={0.22}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          visible={false}
        />
      </points>
    </group>
  )
}
