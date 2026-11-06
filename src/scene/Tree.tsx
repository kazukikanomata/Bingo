import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LIGHT_COUNT = 180
const LIGHT_COLORS = ['#ff3b3b', '#ffd23f', '#3bb7ff', '#5cff7a', '#ff7af0', '#ffffff']

/** ツリーの外周半径（高さ h での円錐の包絡線） */
const envelope = (h: number) => Math.max(0.2, 3.2 * (1 - (h - 0.6) / 6.2))

function makeStarGeometry() {
  const shape = new THREE.Shape()
  const spikes = 5
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.62 : 0.26
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 })
  geo.center()
  return geo
}

export function Tree() {
  const lightsRef = useRef<THREE.InstancedMesh>(null)
  const starRef = useRef<THREE.Mesh>(null)

  const { lightData, starGeo, baubles } = useMemo(() => {
    // 螺旋状のイルミネーション
    const lightData = Array.from({ length: LIGHT_COUNT }, (_, i) => {
      const t = i / LIGHT_COUNT
      const h = 0.8 + t * 5.6
      const a = t * Math.PI * 2 * 7
      const r = envelope(h) * 0.98
      return {
        pos: new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r),
        color: new THREE.Color(LIGHT_COLORS[i % LIGHT_COLORS.length]),
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.5,
      }
    })
    // ツリーに吊るした小さなオーナメント
    const cols = ['#d4142a', '#e8b923', '#c0c8d8', '#1b4fd6', '#b0102a']
    const baubles = Array.from({ length: 34 }, (_, i) => {
      const h = 1.0 + Math.random() * 5.0
      const a = Math.random() * Math.PI * 2
      const r = envelope(h) * 0.92
      return { pos: [Math.cos(a) * r, h, Math.sin(a) * r] as [number, number, number], color: cols[i % cols.length], size: 0.12 + Math.random() * 0.1 }
    })
    return { lightData, starGeo: makeStarGeometry(), baubles }
  }, [])

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const initialized = useRef(false)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const mesh = lightsRef.current
    if (mesh) {
      if (!initialized.current) {
        lightData.forEach((l, i) => {
          tmp.position.copy(l.pos)
          tmp.updateMatrix()
          mesh.setMatrixAt(i, tmp.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
        initialized.current = true
      }
      lightData.forEach((l, i) => {
        // HDR カラー（>1）にしてブルームで光らせる
        const k = 1.2 + 2.6 * (0.5 + 0.5 * Math.sin(t * l.speed + l.phase))
        tmpColor.copy(l.color).multiplyScalar(k)
        mesh.setColorAt(i, tmpColor)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    if (starRef.current) {
      starRef.current.rotation.y = t * 0.8
      const s = 1 + Math.sin(t * 3) * 0.06
      starRef.current.scale.setScalar(s)
    }
  })

  return (
    <group>
      {/* 幹 */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 1.0, 12]} />
        <meshStandardMaterial color="#5a3a1e" roughness={0.9} />
      </mesh>
      {/* 葉（円錐を重ねる） */}
      {[
        [3.3, 2.6, 2.0],
        [2.7, 2.3, 3.2],
        [2.0, 2.0, 4.3],
        [1.3, 1.7, 5.3],
        [0.7, 1.2, 6.1],
      ].map(([r, h, y], i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <coneGeometry args={[r, h, 28, 1]} />
          <meshStandardMaterial color={i % 2 ? '#0f5a32' : '#0c4d2b'} roughness={0.8} flatShading />
        </mesh>
      ))}
      {/* 雪の積もり */}
      {[
        [3.0, 0.9],
        [2.45, 2.1],
        [1.8, 3.25],
        [1.15, 4.4],
      ].map(([r, y], i) => (
        <mesh key={i} position={[0, y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.75, r + 0.05, 28]} />
          <meshStandardMaterial color="#e8f0ff" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* イルミネーション */}
      <instancedMesh ref={lightsRef} args={[undefined, undefined, LIGHT_COUNT]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* オーナメント */}
      {baubles.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <sphereGeometry args={[b.size, 16, 16]} />
          <meshStandardMaterial color={b.color} metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
      {/* 頂上の星 */}
      <mesh ref={starRef} geometry={starGeo} position={[0, 7.05, 0]}>
        <meshStandardMaterial color="#ffd54a" emissive="#ffb300" emissiveIntensity={3} toneMapped={false} metalness={0.6} roughness={0.3} />
      </mesh>
      <pointLight position={[0, 7, 0.6]} color="#ffcf6b" intensity={8} distance={8} />
      <pointLight position={[0, 3, 2.5]} color="#ff9a3c" intensity={6} distance={9} />
    </group>
  )
}

const PRESENTS: { pos: [number, number, number]; size: [number, number, number]; color: string; ribbon: string; rot: number }[] = [
  { pos: [-2.6, 0, 1.6], size: [1.1, 0.9, 1.1], color: '#1e56c8', ribbon: '#f5d142', rot: 0.4 },
  { pos: [2.7, 0, 1.4], size: [1.2, 1.0, 1.0], color: '#1f8a4c', ribbon: '#e5243b', rot: -0.3 },
  { pos: [-3.6, 0, -0.6], size: [0.9, 0.7, 0.9], color: '#d8d8e8', ribbon: '#c4122f', rot: 0.9 },
  { pos: [3.7, 0, -0.4], size: [0.8, 1.2, 0.8], color: '#8a1fc4', ribbon: '#ffd54a', rot: 0.2 },
  { pos: [-1.6, 0, 2.6], size: [0.7, 0.55, 0.7], color: '#e5a023', ribbon: '#ffffff', rot: -0.5 },
  { pos: [1.8, 0, 2.9], size: [0.75, 0.6, 0.75], color: '#c4122f', ribbon: '#f5f5f5', rot: 0.7 },
]

export function GiftBox({
  size,
  color,
  ribbon,
}: {
  size: [number, number, number]
  color: string
  ribbon: string
}) {
  const [w, h, d] = size
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w * 0.18, h + 0.01, d + 0.01]} />
        <meshStandardMaterial color={ribbon} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.01, h + 0.01, d * 0.18]} />
        <meshStandardMaterial color={ribbon} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, h + 0.08, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <torusGeometry args={[w * 0.15, w * 0.05, 8, 16]} />
        <meshStandardMaterial color={ribbon} metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  )
}

export function Presents() {
  return (
    <group>
      {PRESENTS.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rot, 0]}>
          <GiftBox size={p.size} color={p.color} ribbon={p.ribbon} />
        </group>
      ))}
    </group>
  )
}

export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color="#cfdcf5" roughness={1} />
      </mesh>
      {/* 遠景の雪山シルエット */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        const r = 34 + (i % 3) * 4
        const h = 6 + ((i * 7) % 5) * 2
        return (
          <mesh key={i} position={[Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r]}>
            <coneGeometry args={[7 + (i % 4), h, 6]} />
            <meshStandardMaterial color="#1a2546" roughness={1} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}
