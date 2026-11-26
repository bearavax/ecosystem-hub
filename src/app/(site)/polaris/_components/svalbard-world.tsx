'use client'

import { useEffect, useRef, useState } from 'react'
import { publishIgloos, type IglooTone, type IglooUrls } from './igloo-store'

type ThreeNS = typeof import('three')

function sampleHeight(data: Uint8ClampedArray, u: number, v: number) {
  const x = Math.min(255, Math.max(0, Math.floor(u * 255)))
  const y = Math.min(255, Math.max(0, Math.floor(v * 255)))
  return data[(y * 256 + x) * 4]! / 255
}

async function loadHeights() {
  const img = new Image()
  img.src = '/polaris/svalbard-heightmap-256.png'
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('heightmap')
  ctx.drawImage(img, 0, 0, 256, 256)
  return ctx.getImageData(0, 0, 256, 256).data
}

function makeIgloo(THREE: ThreeNS, tint: number) {
  const group = new THREE.Group()
  const ice = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.32, metalness: 0.06 })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), ice)
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.46, 14, 1, true), ice)
  tunnel.rotation.x = Math.PI / 2
  tunnel.position.set(0, 0.2, 0.58)
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.4, roughness: 0.4 }),
  )
  mouth.position.set(0, 0.2, 0.62)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.012, 6, 36),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.4, roughness: 0.35 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.02
  const lamp = new THREE.PointLight(0xf59e0b, 0.55, 3.4)
  lamp.position.set(0, 0.28, 0.7)
  group.add(dome, tunnel, mouth, ring, lamp)
  return group
}

function buildTerrain(THREE: ThreeNS, heights: Uint8ClampedArray, size: number, segments: number, lift: number) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  const pos = geo.attributes.position!
  const colors = new Float32Array(pos.count * 3)
  const snow = [0.8, 0.89, 0.97]
  const rock = [0.06, 0.09, 0.15]
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / size + 0.5
    const v = pos.getY(i) / size + 0.5
    const h = sampleHeight(heights, u, v)
    const shaped = Math.pow(h, 1.2) * lift
    pos.setZ(i, shaped)
    const dx = sampleHeight(heights, u + 0.008, v) - sampleHeight(heights, u - 0.008, v)
    const dy = sampleHeight(heights, u, v + 0.008) - sampleHeight(heights, u, v - 0.008)
    const slope = Math.min(1, Math.hypot(dx, dy) * 9)
    const cover = Math.max(0, 1 - slope) * (0.25 + h * 0.75)
    colors[i * 3] = rock[0]! + (snow[0]! - rock[0]!) * cover
    colors[i * 3 + 1] = rock[1]! + (snow[1]! - rock[1]!) * cover
    colors[i * 3 + 2] = rock[2]! + (snow[2]! - rock[2]!) * cover
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function worldHeight(heights: Uint8ClampedArray, x: number, z: number, size: number, lift: number) {
  const u = x / size + 0.5
  const v = 0.5 - z / size
  return Math.pow(sampleHeight(heights, u, v), 1.2) * lift
}

let baked = false

function bakeIgloos(THREE: ThreeNS, renderer: import('three').WebGLRenderer) {
  if (baked) return
  baked = true
  const size = 128
  const target = new THREE.WebGLRenderTarget(size, size)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x1a2838, 1.1))
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
  cam.position.set(1.5, 1.15, 2.2)
  cam.lookAt(0, 0.35, 0)
  const tones: { key: IglooTone; tint: number }[] = [
    { key: 'ice', tint: 0xe7f4ff },
    { key: 'amber', tint: 0xf3e2c4 },
    { key: 'rose', tint: 0xf0d0d4 },
  ]
  const urls = {} as IglooUrls
  const flip = document.createElement('canvas')
  flip.width = size
  flip.height = size
  const fctx = flip.getContext('2d')!
  const pixels = new Uint8Array(size * size * 4)
  for (const tone of tones) {
    const igloo = makeIgloo(THREE, tone.tint)
    scene.add(igloo)
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.render(scene, cam)
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
    const image = fctx.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
    }
    fctx.putImageData(image, 0, 0)
    urls[tone.key] = flip.toDataURL('image/png')
    scene.remove(igloo)
  }
  renderer.setRenderTarget(null)
  renderer.setClearColor(0x060e1b, 1)
  target.dispose()
  publishIgloos(urls)
}

function mount(THREE: ThreeNS, host: HTMLElement, mode: 'world' | 'peak', reduce: boolean) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x060e1b, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x060e1b, mode === 'peak' ? 18 : 55, mode === 'peak' ? 52 : 120)
  scene.add(new THREE.HemisphereLight(0xc5daf0, 0x0b1624, 0.72))
  const moon = new THREE.DirectionalLight(0xd7e8ff, 1.15)
  moon.position.set(-18, 28, 12)
  scene.add(moon)

  const size = mode === 'peak' ? 28 : 56
  const lift = mode === 'peak' ? 8 : 14
  let terrain: import('three').Mesh | null = null
  let heights: Uint8ClampedArray | null = null
  const extras: import('three').Object3D[] = []
  const camera = new THREE.PerspectiveCamera(mode === 'peak' ? 28 : 32, 1, 0.1, 180)
  const look = new THREE.Vector3()
  if (mode === 'peak') {
    camera.position.set(8, 5.6, 9)
    look.set(-2, 3.4, -7)
  } else {
    camera.position.set(8, 11, 18)
    look.set(-1, 7, -14)
  }
  camera.lookAt(look)

  const starGeo = new THREE.BufferGeometry()
  const starPos = new Float32Array(180 * 3)
  for (let i = 0; i < 180; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 80
    starPos[i * 3 + 1] = 8 + Math.random() * 18
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 80
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.055, transparent: true, opacity: 0.8 }))
  scene.add(stars)

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(mode === 'peak' ? 18 : 42, mode === 'peak' ? 2.2 : 3.2, 48, 1),
    new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  )
  ribbon.position.set(-1, mode === 'peak' ? 9.4 : 16.5, mode === 'peak' ? -8 : -13)
  scene.add(ribbon)
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(mode === 'peak' ? 0.16 : 0.22, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
  )
  beacon.position.set(-2, mode === 'peak' ? 9 : 16, -8)
  scene.add(beacon)
  const beaconLight = new THREE.PointLight(0xf59e0b, mode === 'peak' ? 1.4 : 0.9, mode === 'peak' ? 6 : 10)
  beaconLight.position.copy(beacon.position)
  scene.add(beaconLight)

  let raf = 0
  let t = 0
  let mx = 0
  let my = 0
  const base = camera.position.clone()
  const resize = () => {
    const box = host.getBoundingClientRect()
    const w = Math.max(1, box.width)
    const h = Math.max(1, box.height)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  const draw = () => {
    const sway = reduce ? 0 : Math.sin(t * 0.12) * (mode === 'peak' ? 0.15 : 0.35)
    camera.position.x = base.x + sway + mx * 0.25
    camera.position.y = base.y + my * 0.15
    camera.lookAt(look)
    const pos = ribbon.geometry.attributes.position!
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      pos.setZ(i, Math.sin(x * 0.35 + t) * 0.45)
    }
    pos.needsUpdate = true
    renderer.render(scene, camera)
  }

  const boot = loadHeights().then((map) => {
    heights = map
    terrain = buildTerrain(THREE, map, size, mode === 'peak' ? 64 : 128, lift)
    scene.add(terrain)
    let peak = { x: 0, y: 0, z: 0 }
    for (let iy = 0; iy < 64; iy++) {
      for (let ix = 0; ix < 64; ix++) {
        const u = ix / 63
        const v = iy / 63
        const y = Math.pow(sampleHeight(map, u, v), 1.2) * lift
        if (y > peak.y) peak = { x: (u - 0.5) * size, y, z: -(v - 0.5) * size }
      }
    }
    beacon.position.set(peak.x, peak.y + (mode === 'peak' ? 1.35 : 1.4), peak.z)
    beaconLight.position.copy(beacon.position)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x071525, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.8 }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.y = lift * 0.02
    scene.add(water)
    extras.push(water)
    const spots = mode === 'peak'
      ? [[1.2, -4]]
      : [[0, -14], [-0.7, -11.5], [2.8, -14], [0, -9], [1.4, -12], [4.2, -11.5]]
    spots.forEach(([x, z]) => {
      const y = worldHeight(map, x!, z!, size, lift)
      const igloo = makeIgloo(THREE, 0xeef6ff)
      igloo.position.set(x!, y, z!)
      igloo.lookAt(camera.position.x, y, camera.position.z)
      igloo.scale.setScalar(mode === 'peak' ? 0.42 : 1.15)
      scene.add(igloo)
      extras.push(igloo)
    })
    if (mode === 'world') bakeIgloos(THREE, renderer)
    draw()
  })

  resize()
  const onResize = () => resize()
  const onMove = (e: MouseEvent) => {
    mx = e.clientX / window.innerWidth - 0.5
    my = e.clientY / window.innerHeight - 0.5
  }
  const observer = new ResizeObserver(() => resize())
  observer.observe(host)
  window.addEventListener('resize', onResize)
  if (!reduce) window.addEventListener('mousemove', onMove)
  const loop = () => {
    t += 0.016
    draw()
    raf = requestAnimationFrame(loop)
  }
  if (reduce) boot.then(draw)
  else raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMove)
    scene.traverse((child) => {
      const mesh = child as import('three').Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose?.()
    })
    renderer.dispose()
    renderer.domElement.remove()
    void terrain
    void extras
    void heights
  }
}

export function SvalbardBackdrop() {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancel = () => {}
    let gone = false
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    import('three').then((mod) => {
      if (gone) return
      const THREE = 'WebGLRenderer' in mod ? mod : (mod as { default?: ThreeNS }).default ?? mod
      try {
        cancel = mount(THREE, el, 'world', reduce)
      } catch {
        if (!gone) setFailed(true)
      }
    }).catch(() => {
      if (!gone) setFailed(true)
    })
    return () => { gone = true; cancel() }
  }, [])
  if (failed) return null
  return <div ref={host} className="h-full w-full" />
}

export function SvalbardPeak() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancel = () => {}
    let gone = false
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    import('three').then((THREE) => {
      if (gone) return
      try { cancel = mount(THREE, el, 'peak', reduce) } catch { /* gradient shows through */ }
    }).catch(() => {})
    return () => { gone = true; cancel() }
  }, [])
  return <div ref={host} className="absolute inset-0" />
}
