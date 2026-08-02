import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'

export type ResonancePhase = 'idle' | 'listening' | 'thinking' | 'council' | 'speaking'

type OrionResonanceCoreProps = {
  phase: ResonancePhase
  audioLevelRef: RefObject<number>
}

const palette = {
  idle: { primary: 0x75d7c0, secondary: 0x2d6968, star: 0x8eb8b4 },
  listening: { primary: 0x55edc3, secondary: 0x54a8bb, star: 0xb7fff0 },
  thinking: { primary: 0x7a9cff, secondary: 0xa47be8, star: 0xc8d2ff },
  council: { primary: 0xe5d7ff, secondary: 0x75d7c0, star: 0xffe5c7 },
  speaking: { primary: 0xf1bc83, secondary: 0xe27b68, star: 0xffe1b8 },
} satisfies Record<ResonancePhase, { primary: number; secondary: number; star: number }>

const councilColors = [0xb595f2, 0x72c2df, 0x7dcbb5, 0xe8aa77]
const trailLength = 54

function orbitPoint(target: THREE.Vector3, radius: number, angle: number, depth: number) {
  target.set(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    Math.sin(angle * 2 + depth) * 0.16,
  )
}

export default function OrionResonanceCore({ phase, audioLevelRef }: OrionResonanceCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef(phase)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    } catch {
      canvas.dataset.webgl = 'unavailable'
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.22

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30)
    camera.position.set(0, 0.05, 7.6)

    const instrument = new THREE.Group()
    instrument.rotation.x = -0.12
    scene.add(instrument)

    const ambient = new THREE.AmbientLight(0x9dc8c2, 0.9)
    const key = new THREE.PointLight(0xb5fff0, 16, 15, 2)
    key.position.set(2.7, 2.2, 4)
    const rim = new THREE.PointLight(0x728dff, 11, 12, 2)
    rim.position.set(-3, -1.7, 2)
    scene.add(ambient, key, rim)

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: palette.idle.primary,
      emissive: palette.idle.secondary,
      emissiveIntensity: 1.15,
      metalness: 0.28,
      roughness: 0.24,
      transparent: true,
      opacity: 0.94,
      flatShading: true,
    })
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.03, 4), coreMaterial)
    instrument.add(core)

    const innerMaterial = new THREE.MeshBasicMaterial({ color: palette.idle.primary, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending })
    const innerCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.73, 2), innerMaterial)
    instrument.add(innerCore)

    const shellMaterial = new THREE.MeshBasicMaterial({ color: palette.idle.star, wireframe: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending })
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.34, 2), shellMaterial)
    instrument.add(shell)

    const rings = [
      { radius: 1.72, tilt: [1.18, 0.1, 0.2] },
      { radius: 2.12, tilt: [0.72, 0.28, -0.38] },
      { radius: 2.52, tilt: [1.44, -0.12, 0.58] },
    ].map(({ radius, tilt }, index) => {
      const material = new THREE.MeshBasicMaterial({ color: index === 1 ? palette.idle.secondary : palette.idle.primary, transparent: true, opacity: 0.22 - index * 0.035, blending: THREE.AdditiveBlending })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 1 ? 0.012 : 0.008, 6, 160), material)
      ring.rotation.set(tilt[0], tilt[1], tilt[2])
      instrument.add(ring)
      return { ring, material }
    })

    const starCount = reducedMotion ? 90 : 230
    const starPositions = new Float32Array(starCount * 3)
    for (let index = 0; index < starCount; index += 1) {
      const radius = 2.8 + Math.random() * 2.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[index * 3 + 2] = (radius * Math.cos(phi)) * 0.48
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMaterial = new THREE.PointsMaterial({ color: palette.idle.star, size: 0.025, transparent: true, opacity: 0.45, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const stars = new THREE.Points(starGeometry, starMaterial)
    instrument.add(stars)

    const tempPosition = new THREE.Vector3()
    const comets = councilColors.map((color, index) => {
      const orbit = new THREE.Group()
      orbit.rotation.set(0.62 + index * 0.27, index * 0.38, index % 2 ? -0.3 : 0.24)
      instrument.add(orbit)

      const bodyMaterial = new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending })
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.055 + index * 0.006, 12, 12), bodyMaterial)
      orbit.add(body)

      const positions = new Float32Array(trailLength * 3)
      const colors = new Float32Array(trailLength * 3)
      const baseColor = new THREE.Color(color)
      for (let point = 0; point < trailLength; point += 1) {
        const intensity = Math.pow(1 - point / trailLength, 1.8)
        colors[point * 3] = baseColor.r * intensity
        colors[point * 3 + 1] = baseColor.g * intensity
        colors[point * 3 + 2] = baseColor.b * intensity
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
      const trail = new THREE.Line(geometry, material)
      orbit.add(trail)
      return { orbit, body, bodyMaterial, positions, geometry, material, radius: 1.62 + index * 0.31, offset: index * Math.PI * 0.5 }
    })

    const targetPrimary = new THREE.Color(palette.idle.primary)
    const targetSecondary = new THREE.Color(palette.idle.secondary)
    const targetStar = new THREE.Color(palette.idle.star)
    let frame = 0
    let visible = true
    let previous = performance.now()

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    }, { threshold: 0.05 })
    intersectionObserver.observe(canvas)

    const render = (now: number) => {
      frame = window.requestAnimationFrame(render)
      if (!visible || document.hidden) return
      if (reducedMotion && now - previous < 100) return
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      const time = now / 1000
      const currentPhase = phaseRef.current
      const colors = palette[currentPhase]
      const rawLevel = Math.min(Math.max(audioLevelRef.current ?? 0, 0), 1)
      const speakingPulse = currentPhase === 'speaking' ? 0.28 + Math.abs(Math.sin(time * 7.2) * Math.cos(time * 4.1)) * 0.52 : 0
      const energy = Math.max(rawLevel, speakingPulse)
      const thinkingShift = currentPhase === 'thinking' ? (Math.sin(time * 0.75) + 1) * 0.5 : 0

      targetPrimary.setHex(colors.primary)
      targetSecondary.setHex(colors.secondary)
      targetStar.setHex(colors.star)
      if (currentPhase === 'thinking') {
        targetPrimary.lerp(new THREE.Color(0xb06bea), thinkingShift * 0.42)
        targetSecondary.lerp(new THREE.Color(0x4fcad1), (1 - thinkingShift) * 0.36)
      }

      coreMaterial.color.lerp(targetPrimary, 0.055)
      coreMaterial.emissive.lerp(targetSecondary, 0.05)
      innerMaterial.color.lerp(targetPrimary, 0.065)
      shellMaterial.color.lerp(targetStar, 0.04)
      starMaterial.color.lerp(targetStar, 0.035)
      key.color.lerp(targetPrimary, 0.035)
      rim.color.lerp(targetSecondary, 0.035)

      const baseScale = currentPhase === 'idle' ? 0.95 : 1
      const pulse = baseScale + energy * 0.18 + Math.sin(time * 1.8) * (currentPhase === 'idle' ? 0.012 : 0.022)
      core.scale.setScalar(pulse)
      innerCore.scale.setScalar(1 + energy * 0.3)
      coreMaterial.emissiveIntensity = 0.9 + energy * 2.8 + (currentPhase === 'thinking' ? 0.45 : 0)
      innerMaterial.opacity = 0.18 + energy * 0.46
      shellMaterial.opacity = 0.12 + energy * 0.2 + (currentPhase === 'thinking' || currentPhase === 'council' ? 0.14 : 0)

      const speed = currentPhase === 'thinking' ? 1.55 : currentPhase === 'council' ? 1.2 : currentPhase === 'speaking' ? 0.78 : currentPhase === 'listening' ? 0.62 + energy : 0.22
      core.rotation.y += delta * (0.14 + speed * 0.18)
      core.rotation.x -= delta * 0.08
      innerCore.rotation.y -= delta * (0.22 + speed * 0.2)
      shell.rotation.x += delta * speed * 0.13
      shell.rotation.z -= delta * speed * 0.16
      rings.forEach(({ ring, material }, index) => {
        ring.rotation.z += delta * speed * (index % 2 ? -0.17 : 0.13) * (index + 1)
        material.color.lerp(index === 1 ? targetSecondary : targetPrimary, 0.04)
        material.opacity = 0.11 + energy * 0.16 + (currentPhase === 'thinking' ? index * 0.045 : 0)
      })
      stars.rotation.z += delta * 0.025
      stars.rotation.y -= delta * 0.018
      starMaterial.opacity = 0.3 + energy * 0.34 + (currentPhase === 'council' ? 0.2 : 0)

      comets.forEach((comet, index) => {
        const angle = time * (0.34 + speed * 0.19 + index * 0.025) + comet.offset
        orbitPoint(comet.body.position, comet.radius, angle, index)
        for (let point = 0; point < trailLength; point += 1) {
          const trailAngle = angle - point * (0.026 + speed * 0.005)
          orbitPoint(tempPosition, comet.radius, trailAngle, index)
          comet.positions[point * 3] = tempPosition.x
          comet.positions[point * 3 + 1] = tempPosition.y
          comet.positions[point * 3 + 2] = tempPosition.z
        }
        comet.geometry.attributes.position.needsUpdate = true
        const councilColor = new THREE.Color(councilColors[index])
        const unifiedColor = currentPhase === 'council' ? councilColor : targetPrimary
        comet.bodyMaterial.color.lerp(unifiedColor, 0.05)
        comet.material.opacity = currentPhase === 'idle' ? 0.36 : 0.58 + energy * 0.34
        comet.body.scale.setScalar(1 + energy * 1.6)
      })

      instrument.rotation.y = Math.sin(time * 0.23) * 0.12
      instrument.rotation.x = -0.12 + Math.cos(time * 0.19) * 0.045
      renderer.render(scene, camera)
      canvas.dataset.rendered = 'true'
    }
    frame = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      core.geometry.dispose()
      coreMaterial.dispose()
      innerCore.geometry.dispose()
      innerMaterial.dispose()
      shell.geometry.dispose()
      shellMaterial.dispose()
      rings.forEach(({ ring, material }) => { ring.geometry.dispose(); material.dispose() })
      starGeometry.dispose()
      starMaterial.dispose()
      comets.forEach((comet) => {
        comet.body.geometry.dispose()
        comet.bodyMaterial.dispose()
        comet.geometry.dispose()
        comet.material.dispose()
      })
      renderer.dispose()
    }
  }, [audioLevelRef])

  return <canvas ref={canvasRef} className="resonance-canvas" aria-hidden="true" />
}
