'use client'

import { useEffect, useRef, useState } from 'react'
import { polarisHover, polarisShot, polarisStage, pushPins } from './camera-store'
import { publishIgloos, type IglooTone, type IglooUrls } from './igloo-store'

type ThreeNS = typeof import('three')

function sampleHeight(data: Uint8ClampedArray, u: number, v: number) {
  const x = Math.min(254.999, Math.max(0, u * 255))
  const y = Math.min(254.999, Math.max(0, v * 255))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const at = (ix: number, iy: number) => data[(iy * 256 + ix) * 4]! / 255
  const a = at(x0, y0)
  const b = at(x0 + 1, y0)
  const c = at(x0, y0 + 1)
  const d = at(x0 + 1, y0 + 1)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

function ridged(u: number, v: number) {
  let amp = 1
  let freq = 3.2
  let sum = 0
  let norm = 0
  for (let octave = 0; octave < 4; octave++) {
    const n = valueNoise(u * freq + octave * 3.7, v * freq + octave * 1.9)
    const ridge = 1 - Math.abs(n * 2 - 1)
    sum += ridge * ridge * amp
    norm += amp
    amp *= 0.48
    freq *= 2.05
  }
  return sum / norm
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

function fade(t: number) {
  return t * t * (3 - 2 * t)
}

function hash2(ix: number, iy: number) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = fade(x - x0)
  const ty = fade(y - y0)
  const a = hash2(x0, y0)
  const b = hash2(x0 + 1, y0)
  const c = hash2(x0, y0 + 1)
  const d = hash2(x0 + 1, y0 + 1)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

function lin(THREE: ThreeNS, hex: number) {
  const color = new THREE.Color(hex)
  return [color.r, color.g, color.b] as const
}

function glowTexture(THREE: ThreeNS, paint: (ctx: CanvasRenderingContext2D, size: number) => void, size = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('texture')
  paint(ctx, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function paintStar(ctx: CanvasRenderingContext2D, size: number) {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.12, 'rgba(236,246,255,0.9)')
  g.addColorStop(0.38, 'rgba(186,214,255,0.16)')
  g.addColorStop(1, 'rgba(186,214,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
}

function paintFlare(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c)
  halo.addColorStop(0, 'rgba(255,252,246,1)')
  halo.addColorStop(0.06, 'rgba(255,246,230,0.95)')
  halo.addColorStop(0.18, 'rgba(255,220,170,0.22)')
  halo.addColorStop(0.46, 'rgba(255,196,130,0.05)')
  halo.addColorStop(1, 'rgba(255,196,130,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.translate(c, c)
  for (const rot of [0, Math.PI / 2]) {
    ctx.save()
    ctx.rotate(rot)
    const arm = ctx.createLinearGradient(-c, 0, c, 0)
    arm.addColorStop(0, 'rgba(255,246,230,0)')
    arm.addColorStop(0.38, 'rgba(255,246,230,0.02)')
    arm.addColorStop(0.5, 'rgba(255,252,246,0.8)')
    arm.addColorStop(0.62, 'rgba(255,246,230,0.02)')
    arm.addColorStop(1, 'rgba(255,246,230,0)')
    ctx.fillStyle = arm
    ctx.fillRect(-c, -size * 0.018, size, size * 0.036)
    ctx.restore()
  }
  ctx.restore()
}

const AURORA_VERT = `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin(p.x * 0.22 + uTime * 0.25) * 1.4 + sin(p.x * 0.09 - uTime * 0.12) * 0.7;
    p.z += wave * smoothstep(0.05, 0.9, uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const AURORA_FRAG = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uShift;
  void main() {
    float x = vUv.x;
    float y = vUv.y + sin(x * 5.0 + uTime * 0.18 + uShift) * 0.03;
    float rays = 0.62 + 0.38 * sin(x * 36.0 + uTime * 0.15 + uShift);
    float side = smoothstep(0.0, 0.16, x) * (1.0 - smoothstep(0.84, 1.0, x));
    float body = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.62, 0.98, y));
    float alpha = side * body * rays * 0.55;
    vec3 emerald = vec3(0.204, 0.827, 0.600);
    vec3 cyan = vec3(0.220, 0.741, 0.973);
    vec3 violet = vec3(0.506, 0.549, 0.973);
    vec3 col = mix(emerald, cyan, smoothstep(0.12, 0.55, x));
    col = mix(col, violet, smoothstep(0.5, 0.95, x) * 0.7);
    gl_FragColor = vec4(col, alpha);
  }
`

const TWINKLE_VERT = `
  attribute float phase;
  uniform float uTime;
  varying float vTwinkle;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 1.7;
    vTwinkle = 0.28 + 0.72 * (0.5 + 0.5 * sin(uTime * 1.6 + phase));
  }
`

const TWINKLE_FRAG = `
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.08, d) * vTwinkle;
    gl_FragColor = vec4(0.94, 0.97, 1.0, alpha);
  }
`

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const SKY_FRAG = `
  varying vec3 vDir;
  void main() {
    float h = clamp(normalize(vDir).y * 0.85 + 0.08, 0.0, 1.0);
    vec3 zenith = vec3(0.012, 0.031, 0.071);
    vec3 horizon = vec3(0.035, 0.094, 0.176);
    gl_FragColor = vec4(mix(horizon, zenith, smoothstep(0.0, 0.78, h)), 1.0);
  }
`

const WATER_VERT = `
  varying vec3 vWorld;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const WATER_FRAG = `
  varying vec3 vWorld;
  varying vec3 vView;
  void main() {
    vec3 viewDir = normalize(vView);
    float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
    vec3 deep = vec3(0.012, 0.028, 0.05);
    vec3 moon = vec3(0.55, 0.72, 0.9);
    vec3 aurora = vec3(0.1, 0.55, 0.48);
    vec3 col = deep + moon * fresnel * 0.28 + aurora * fresnel * 0.12;
    float fade = exp(-0.02 * length(vWorld.xz));
    col = mix(vec3(0.02, 0.05, 0.1), col, fade);
    gl_FragColor = vec4(col, 0.94);
  }
`

function makeIgloo(THREE: ThreeNS, tint: number, lampDistance = 1.05) {
  const group = new THREE.Group()
  const snow = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.58, metalness: 0.02 })
  const course = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.46, metalness: 0.02 })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2), snow)
  group.add(dome)
  for (let i = 1; i <= 3; i++) {
    const y = 0.14 + i * 0.14
    const radius = Math.sqrt(Math.max(0.04, 0.72 * 0.72 - y * y))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 4, 36), course)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    group.add(ring)
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 20, Math.PI), snow)
  arch.position.set(0, 0.2, 0.66)
  group.add(arch)
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16, 1, true, 0, Math.PI), snow)
  tunnel.rotation.x = Math.PI / 2
  tunnel.rotation.z = Math.PI
  tunnel.position.set(0, 0.2, 0.48)
  group.add(tunnel)
  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 18),
    new THREE.MeshStandardMaterial({ color: 0xd5e4f6, roughness: 0.72, metalness: 0.02 }),
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.set(0, 0.012, 0.86)
  group.add(apron)
  const hearth = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffb454, emissive: 0xffb454, emissiveIntensity: 0.22, roughness: 0.55 }),
  )
  hearth.position.set(0, 0.14, 0.28)
  group.add(hearth)
  const lamp = new THREE.PointLight(0xffb454, 0.55, lampDistance)
  lamp.position.set(0, 0.18, 0.78)
  lamp.userData.hearth = true
  lamp.userData.base = 0.55
  group.add(lamp)
  return group
}

function buildTerrain(THREE: ThreeNS, heights: Uint8ClampedArray, size: number, segments: number, lift: number) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  const pos = geo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / size + 0.5
    const v = pos.getY(i) / size + 0.5
    const h = sampleHeight(heights, u, v)
    const base = Math.pow(h, 1.08) * lift
    const crest = (ridged(u * 1.8, v * 1.8) - 0.42) * lift * 0.055 * (0.2 + h)
    const edge = Math.min(u, v, 1 - u, 1 - v)
    const t = Math.min(1, Math.max(0, edge / 0.24))
    const falloff = t * t * (3 - 2 * t)
    pos.setZ(i, (base + crest) * falloff)
  }
  geo.computeVertexNormals()
  const normals = geo.attributes.normal!
  const moon = new THREE.Vector3(18, 26, -16).normalize()
  const moonLocal = new THREE.Vector3(moon.x, -moon.z, moon.y).normalize()
  const colors = new Float32Array(pos.count * 3)
  const rockLo = lin(THREE, 0x08101d)
  const rockHi = lin(THREE, 0x132033)
  const snowShade = lin(THREE, 0x7ba3cc)
  const snowLit = lin(THREE, 0xd8eeff)
  const n = new THREE.Vector3()
  const span = 2 / 256
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / size + 0.5
    const v = pos.getY(i) / size + 0.5
    const dx = sampleHeight(heights, u + span, v) - sampleHeight(heights, u - span, v)
    const dy = sampleHeight(heights, u, v + span) - sampleHeight(heights, u, v - span)
    const grad = Math.hypot(dx, dy) * 32
    n.set(normals.getX(i), normals.getY(i), normals.getZ(i)).normalize()
    const light = Math.min(1, Math.max(0, n.dot(moonLocal)))
    const snowCover = 1 - Math.min(1, Math.max(0, (grad - 0.28) / 0.7))
    const grain = valueNoise(u * 18, v * 18)
    const rock = rockLo.map((channel, k) => channel + (rockHi[k]! - channel) * (0.35 + grain * 0.65) * (0.45 + light * 0.55))
    const crest = Math.min(1, Math.max(0, (light - 0.12) / 0.5))
    const snow = snowShade.map((channel, k) => channel + (snowLit[k]! - channel) * crest)
    colors[i * 3] = rock[0]! + (snow[0]! - rock[0]!) * snowCover
    colors[i * 3 + 1] = rock[1]! + (snow[1]! - rock[1]!) * snowCover
    colors[i * 3 + 2] = rock[2]! + (snow[2]! - rock[2]!) * snowCover
  }
  normals.needsUpdate = true
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.03, flatShading: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function worldHeight(heights: Uint8ClampedArray, x: number, z: number, size: number, lift: number) {
  const u = x / size + 0.5
  const v = 0.5 - z / size
  return Math.pow(sampleHeight(heights, u, v), 1.08) * lift
}

let baked = false

function bakeIgloos(THREE: ThreeNS, renderer: import('three').WebGLRenderer) {
  if (baked) return
  baked = true
  const size = 192
  const target = new THREE.WebGLRenderTarget(size, size)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x102033, 1.2))
  const moon = new THREE.DirectionalLight(0xf7fbff, 2.2)
  moon.position.set(3, 6, 4)
  scene.add(moon)
  const rim = new THREE.DirectionalLight(0x7dd3fc, 1.8)
  rim.position.set(-5, 2, -2)
  scene.add(rim)
  const vignette = glowTexture(THREE, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.48)
    g.addColorStop(0, '#16304e')
    g.addColorStop(0.62, '#0c1a2e')
    g.addColorStop(1, '#07101c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    ctx.fill()
  }, 256)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ map: vignette, transparent: true }))
  disc.position.set(0, 0.34, -0.2)
  scene.add(disc)
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20)
  cam.position.set(0.35, 0.78, 2.35)
  cam.lookAt(0, 0.32, 0.25)
  const tones: { key: IglooTone; tint: number }[] = [
    { key: 'ice', tint: 0xeaf4ff },
    { key: 'amber', tint: 0xf6e6cc },
    { key: 'rose', tint: 0xf3d5d8 },
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
    igloo.traverse((child) => {
      const mesh = child as import('three').Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose?.()
    })
  }
  renderer.setRenderTarget(null)
  renderer.setClearColor(0x030812, 1)
  vignette.dispose()
  target.dispose()
  publishIgloos(urls)
}

function mount(THREE: ThreeNS, host: HTMLElement, mode: 'world' | 'peak', reduce: boolean) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x030812, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x050d1a, mode === 'peak' ? 0.02 : 0.011)
  scene.add(new THREE.HemisphereLight(0x16304e, 0x05080e, 0.1))
  const moon = new THREE.DirectionalLight(0xd6e8ff, mode === 'peak' ? 2.8 : 2.9)
  moon.position.set(22, 30, -16)
  scene.add(moon)
  const fill = new THREE.DirectionalLight(0x6d8eae, 0.2)
  fill.position.set(-14, 6, 20)
  scene.add(fill)

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(96, 24, 16),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }),
  )
  scene.add(sky)

  const starTex = glowTexture(THREE, paintStar, 64)
  const starLayers: import('three').Points[] = []
  const starSpecs = [
    { count: 300, size: 1.2, opacity: 0.62 },
    { count: 90, size: 2.1, opacity: 0.85 },
    { count: 24, size: 3.2, opacity: 1 },
  ]
  for (const spec of starSpecs) {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(spec.count * 3)
    for (let i = 0; i < spec.count; i++) {
      const phi = Math.acos(0.2 + Math.random() * 0.8)
      const theta = Math.random() * Math.PI * 2
      const radius = 62 + Math.random() * 10
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = radius * Math.cos(phi) + 4
      pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: starTex,
      color: 0xf4f8ff,
      size: spec.size,
      transparent: true,
      opacity: spec.opacity,
      depthWrite: false,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }))
    scene.add(points)
    starLayers.push(points)
  }

  const twinkleCount = 300
  const twinkleGeo = new THREE.BufferGeometry()
  const twinklePos = new Float32Array(twinkleCount * 3)
  const twinklePhase = new Float32Array(twinkleCount)
  for (let i = 0; i < twinkleCount; i++) {
    const phi = Math.acos(0.35 + Math.random() * 0.65)
    const theta = Math.random() * Math.PI * 2
    const radius = 58 + Math.random() * 8
    twinklePos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    twinklePos[i * 3 + 1] = radius * Math.cos(phi) + 6
    twinklePos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    twinklePhase[i] = Math.random() * Math.PI * 2
  }
  twinkleGeo.setAttribute('position', new THREE.BufferAttribute(twinklePos, 3))
  twinkleGeo.setAttribute('phase', new THREE.BufferAttribute(twinklePhase, 1))
  const twinkleMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: TWINKLE_VERT,
    fragmentShader: TWINKLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
  scene.add(new THREE.Points(twinkleGeo, twinkleMat))

  const auroraMats: import('three').ShaderMaterial[] = []
  const ribbon = mode === 'peak'
    ? { x: 0, y: 8.2, z: -12, w: 28, h: 7, shift: 0.4, tilt: -0.55 }
    : { x: -2, y: 12.4, z: -16, w: 48, h: 9, shift: 0.2, tilt: -0.5 }
  const ribbonMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShift: { value: ribbon.shift } },
    vertexShader: AURORA_VERT,
    fragmentShader: AURORA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  })
  const ribbonMesh = new THREE.Mesh(new THREE.PlaneGeometry(ribbon.w, ribbon.h, 48, 10), ribbonMat)
  ribbonMesh.position.set(ribbon.x, ribbon.y, ribbon.z)
  ribbonMesh.rotation.z = ribbon.tilt
  scene.add(ribbonMesh)
  auroraMats.push(ribbonMat)

  const flareTex = glowTexture(THREE, paintFlare, 160)
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }))
  flare.scale.setScalar(mode === 'peak' ? 1.35 : 1.7)
  flare.position.set(-2, mode === 'peak' ? 9 : 18, -12)
  scene.add(flare)

  const size = mode === 'peak' ? 80 : 80
  const lift = mode === 'peak' ? 11 : 11
  const camera = new THREE.PerspectiveCamera(mode === 'peak' ? 22 : 46, 1, 0.1, 260)
  const look = new THREE.Vector3()
  if (mode === 'peak') {
    camera.position.set(18, 7, 14)
    look.set(-4, 1.5, -16)
  } else {
    camera.position.set(22, 7.5, 16)
    look.set(-2, -2, -12)
  }
  camera.lookAt(look)

  let raf = 0
  let t = 0
  let mx = 0
  let my = 0
  const resize = () => {
    const box = host.getBoundingClientRect()
    const w = Math.max(1, box.width)
    const h = Math.max(1, box.height)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  const goal = new THREE.Vector3()
  const gaze = new THREE.Vector3()
  const hearths: import('three').PointLight[] = []
  const pinVec = new THREE.Vector3()
  const anchors: { id: string; at: import('three').Vector3 }[] = []
  const fly = (key: string) => {
    const stage = polarisStage()
    const shots: Record<string, [[number, number, number], [number, number, number]]> = {
      overview: [[22, 7.5, 16], [-2, -2, -12]],
      dens: [[18, 6.4, 2], [12, 5.1, -8]],
      den: [[18, 6.4, 2], [12, 5.1, -8]],
      lodge: [[15, 6, 6], [11, 5.2, -5]],
      stars: [[2, 18, 4], [-4, 26, -16]],
      submit: [[8, 8.2, -2], [3, 8, -16]],
      review: [[22, 7.5, 16], [-2, -2, -12]],
      'stages-0': [[16, 6.6, 1], [12, 5.4, -9]],
      'stages-1': [[6, 9.2, -2], [2, 8.4, -18]],
      'stages-2': [[0, 12.4, -12], [-2, 13, -24]],
    }
    const picked = key === 'stages' ? shots[`stages-${stage}`]! : shots[key] ?? shots.overview!
    goal.set(...picked[0])
    gaze.set(...picked[1])
  }
  fly('overview')
  camera.position.copy(goal)
  look.copy(gaze)
  const snowCount = 420
  const snowGeo = new THREE.BufferGeometry()
  const snowPos = new Float32Array(snowCount * 3)
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 46 + 6
    snowPos[i * 3 + 1] = Math.random() * 16
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 46 - 4
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.5, depthWrite: false }))
  if (mode === 'world') scene.add(snow)
  const draw = () => {
    if (mode === 'world') {
      fly(polarisShot())
      const step = reduce ? 1 : 0.045
      camera.position.lerp(goal, step)
      look.lerp(gaze, step)
      if (!reduce) {
        camera.position.x += Math.sin(t * 0.1) * 0.12 + mx * 0.18
        camera.position.y += my * 0.08
      }
      camera.lookAt(look)
      if (!reduce) {
        const pos = snowGeo.attributes.position!
        for (let i = 0; i < snowCount; i++) {
          const y = pos.getY(i) - 0.015
          pos.setY(i, y < 0 ? 16 : y)
        }
        pos.needsUpdate = true
      }
      const box = renderer.domElement.getBoundingClientRect()
      pushPins(anchors.map((anchor) => {
        pinVec.copy(anchor.at).project(camera)
        return {
          id: anchor.id,
          x: (pinVec.x * 0.5 + 0.5) * box.width,
          y: (-pinVec.y * 0.5 + 0.5) * box.height,
          visible: pinVec.z < 1,
        }
      }))
    }
    hearths.forEach((light, index) => {
      const flick = reduce ? 1 : 0.82 + Math.sin(t * 7 + index) * 0.18
      const hot = polarisHover() === index ? 2.6 : 1
      light.intensity = Number(light.userData.base) * flick * hot
    })
    if (!reduce) {
      twinkleMat.uniforms.uTime!.value = t
      for (const mat of auroraMats) mat.uniforms.uTime!.value = t
    }
    renderer.render(scene, camera)
  }

  const boot = loadHeights().then((map) => {
    const terrain = buildTerrain(THREE, map, size, mode === 'peak' ? 120 : 160, lift)
    scene.add(terrain)
    let peak = { x: 0, y: 0, z: -8 }
    for (let iy = 0; iy < 64; iy++) {
      for (let ix = 0; ix < 64; ix++) {
        const u = ix / 63
        const v = iy / 63
        const y = Math.pow(sampleHeight(map, u, v), 1.08) * lift
        if (y > peak.y) peak = { x: (u - 0.5) * size, y, z: -(v - 0.5) * size }
      }
    }
    if (mode === 'peak') flare.position.set(peak.x + 0.4, peak.y + 1.5, peak.z + 0.6)
    else flare.position.set(-4, 13, -20)
    const star = flare.position
    const constellation = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        star.clone().add(new THREE.Vector3(-2.2, 0.7, -0.4)),
        star.clone().add(new THREE.Vector3(-0.7, 0.25, -0.1)),
        star.clone(),
        star.clone().add(new THREE.Vector3(1.1, 0.85, 0.2)),
        star.clone().add(new THREE.Vector3(2.1, 0.15, -0.3)),
      ]),
      new THREE.LineBasicMaterial({ color: 0xc5dcff, transparent: true, opacity: 0.38, fog: false }),
    )
    scene.add(constellation)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.4, size * 1.4),
      new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.y = 1.15
    scene.add(water)
    if (mode === 'world') {
      const spots: [number, number][] = [[14, -9.8], [9.1, -1.4], [10.5, -5.6], [11.2, -7.7], [13.3, -7.7], [12.6, -13.3]]
      spots.forEach(([x, z], index) => {
        const y = worldHeight(map, x, z, size, lift) + 0.06
        const igloo = makeIgloo(THREE, 0xf7fbff, 0.42)
        igloo.position.set(x, y, z)
        igloo.rotation.y = Math.atan2(18 - x, 2 - z)
        igloo.scale.setScalar(0.85)
        igloo.traverse((child) => {
          const light = child as import('three').PointLight
          if (light.isPointLight && light.userData.hearth) {
            light.userData.index = index
            hearths.push(light)
          }
        })
        scene.add(igloo)
        if (index === 2) anchors.push({ id: 'lodge', at: igloo.position })
      })
      const trail = [[12, -8], [4, -16], [-2, -24]].map(([x, z]) => new THREE.Vector3(x, worldHeight(map, x, z, size, lift) + 1.1, z))
      trail.forEach((at, index) => {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 16),
          new THREE.MeshBasicMaterial({ color: index === 1 ? 0xfbbf24 : 0x7dd3fc }),
        )
        beacon.position.copy(at)
        scene.add(beacon)
        scene.add(new THREE.PointLight(index === 1 ? 0xf59e0b : 0x38bdf8, 0.6, 6).translateX(at.x).translateY(at.y).translateZ(at.z))
      })
      const ribbonTrail = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trail), 48, 0.06, 8, false),
        new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.7 }),
      )
      scene.add(ribbonTrail)
      anchors.push(
        { id: 'camp', at: new THREE.Vector3(12, worldHeight(map, 12, -8, size, lift) + 2.2, -8) },
        { id: 'mountains', at: trail[1]!.clone().setY(trail[1]!.y + 1.2) },
        { id: 'purse', at: trail[2]!.clone().setY(trail[2]!.y + 1.6) },
      )
      bakeIgloos(THREE, renderer)
    }
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
  if (reduce) void boot.then(draw)
  else raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMove)
    starTex.dispose()
    flareTex.dispose()
    scene.traverse((child) => {
      const mesh = child as import('three').Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((item) => item.dispose())
      else mat?.dispose?.()
    })
    renderer.dispose()
    renderer.domElement.remove()
    void starLayers
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
      try { cancel = mount(THREE, el, 'peak', reduce) } catch { /* the page gradient shows through */ }
    }).catch(() => {})
    return () => { gone = true; cancel() }
  }, [])
  return <div ref={host} className="absolute inset-0" />
}
