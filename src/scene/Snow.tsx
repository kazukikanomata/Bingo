import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getDotTexture } from './common'

const COUNT = 3000
const AREA = { x: 44, y: 22, z: 34 }

/** GPU 側で落下計算する雪パーティクル（CPU 負荷ほぼゼロ） */
export function Snow() {
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * AREA.x
      pos[i * 3 + 1] = Math.random() * AREA.y
      pos[i * 3 + 2] = (Math.random() - 0.5) * AREA.z
      seed[i * 2] = Math.random()
      seed[i * 2 + 1] = Math.random()
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 2))
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: getDotTexture() },
        uHeight: { value: AREA.y },
        uSize: { value: 70 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 seed;
        uniform float uTime;
        uniform float uHeight;
        uniform float uSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float speed = 0.35 + seed.x * 0.6;
          p.y = mod(p.y - uTime * speed, uHeight);
          p.x += sin(uTime * (0.3 + seed.y * 0.5) + seed.x * 6.28) * 0.6;
          p.z += cos(uTime * (0.25 + seed.x * 0.4) + seed.y * 6.28) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = (0.4 + seed.y * 0.8);
          gl_PointSize = min(uSize * size / -mv.z, 22.0);
          vAlpha = 0.55 + seed.x * 0.45;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        void main() {
          vec4 c = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(1.0), c.a * vAlpha);
        }
      `,
    })
    return { geometry, material }
  }, [])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
