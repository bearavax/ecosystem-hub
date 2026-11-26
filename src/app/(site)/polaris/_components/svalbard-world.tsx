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
    float y = vUv.y + sin(x * 7.0 + uTime * 0.22 + uShift) * 0.035;
    float bands = sin(x * 22.0 + uShift + sin(y * 4.0 + uTime * 0.15) * 0.8);
    float curtains = smoothstep(0.55, 0.92, bands);
    float body = smoothstep(0.08, 0.34, y) * (1.0 - smoothstep(0.52, 0.9, y));
    float side = smoothstep(0.0, 0.22, x) * (1.0 - smoothstep(0.78, 1.0, x));
    float alpha = body * side * curtains * 0.32;
    vec3 emerald = vec3(0.180, 0.902, 0.659);
    vec3 cyan = vec3(0.220, 0.741, 0.973);
    vec3 violet = vec3(0.506, 0.549, 0.973);
    float band = 0.5 + 0.5 * sin(x * 5.0 + uShift);
    vec3 col = mix(emerald, cyan, band);
    col = mix(col, violet, smoothstep(0.4, 0.85, y) * 0.5);
    gl_FragColor = vec4(col, alpha);
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
    const ridge = valueNoise(u * 24, v * 24)
    const grit = valueNoise(u * 61 + 3.2, v * 61)
    pos.setZ(i, Math.pow(h, 1.15) * lift + (ridge - 0.5) * 0.48 + (grit - 0.5) * 0.14)
  }
  geo.computeVertexNormals()
  const normals = geo.attributes.normal!
  const moon = new THREE.Vector3(18, 26, -16).normalize()
  const moonLocal = new THREE.Vector3(moon.x, -moon.z, moon.y).normalize()
  const colors = new Float32Array(pos.count * 3)
  const rockLo = lin(THREE, 0x0b1422)
  const rockHi = lin(THREE, 0x182436)
  const snowShade = lin(THREE, 0x6c92b8)
  const snowLit = lin(THREE, 0xe7f2ff)
  const n = new THREE.Vector3()
  const span = 2 / 256
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / size + 0.5
    const v = pos.getY(i) / size + 0.5
    const dx = sampleHeight(heights, u + span, v) - sampleHeight(heights, u - span, v)
    const dy = sampleHeight(heights, u, v + span) - sampleHeight(heights, u, v - span)
    const grad = Math.hypot(dx, dy) * 32
    n.set(normals.getX(i), normals.getY(i), normals.getZ(i))
    const grit = (valueNoise(u * 40, v * 40) - 0.5) * 0.22
    n.x += grit
    n.y += grit * 0.35
    n.normalize()
    normals.setXYZ(i, n.x, n.y, n.z)
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
  return Math.pow(sampleHeight(heights, u, v), 1.15) * lift
}

let baked = false

function bakeIgloos(THREE: ThreeNS, renderer: import('three').WebGLRenderer) {
  if (baked) return
  baked = true
  const size = 192
  const target = new THREE.WebGLRenderTarget(size, size)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1b2e48)
  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x24344c, 1.45))
  const moon = new THREE.DirectionalLight(0xf7fbff, 2.5)
  moon.position.set(4, 6, 3)
  scene.add(moon)
  const rim = new THREE.DirectionalLight(0x8ecfff, 1.15)
  rim.position.set(-4, 2, -3)
  scene.add(rim)
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
    renderer.setClearColor(0x1b2e48, 1)
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
  scene.fog = new THREE.FogExp2(0x050d1a, mode === 'peak' ? 0.042 : 0.016)
  scene.add(new THREE.HemisphereLight(0x16304e, 0x05080e, 0.16))
  const moon = new THREE.DirectionalLight(0xd6e8ff, mode === 'peak' ? 2.6 : 2.35)
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
    { count: 190, size: 1.35, opacity: 0.7 },
    { count: 64, size: 2.4, opacity: 0.9 },
    { count: 22, size: 3.8, opacity: 1 },
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

  const auroraMats: import('three').ShaderMaterial[] = []
  const curtains = mode === 'peak'
    ? [{ x: 1.5, y: 7.6, z: -9, w: 12, h: 4.5, shift: 0.6 }]
    : [
        { x: 5.5, y: 12.2, z: -1, w: 11, h: 5.5, shift: 0.4 },
        { x: 8, y: 11.4, z: -6, w: 8, h: 4.2, shift: 1.8 },
      ]
  for (const curtain of curtains) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uShift: { value: curtain.shift } },
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(curtain.w, curtain.h, 24, 8), mat)
    mesh.position.set(curtain.x, curtain.y, curtain.z)
    scene.add(mesh)
    auroraMats.push(mat)
  }

  const flareTex = glowTexture(THREE, paintFlare, 160)
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }))
  flare.scale.setScalar(mode === 'peak' ? 1.15 : 0.95)
  flare.position.set(-2, mode === 'peak' ? 9 : 18, -12)
  scene.add(flare)

  const size = mode === 'peak' ? 28 : 56
  const lift = mode === 'peak' ? 8 : 14
  const camera = new THREE.PerspectiveCamera(mode === 'peak' ? 24 : 31, 1, 0.1, 220)
  const look = new THREE.Vector3()
  if (mode === 'peak') {
    camera.position.set(7.2, 4.6, 12.5)
    look.set(-1.4, 4.4, -7.5)
  } else {
    camera.position.set(6, 10, 22)
    look.set(-3, 4.2, -10)
  }
  camera.lookAt(look)

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
    const sway = reduce ? 0 : Math.sin(t * 0.1) * (mode === 'peak' ? 0.08 : 0.16)
    camera.position.x = base.x + sway + mx * 0.12
    camera.position.y = base.y + my * 0.08
    camera.lookAt(look)
    if (!reduce) {
      for (const mat of auroraMats) mat.uniforms.uTime!.value = t
    }
    renderer.render(scene, camera)
  }

  const boot = loadHeights().then((map) => {
    const terrain = buildTerrain(THREE, map, size, mode === 'peak' ? 80 : 128, lift)
    scene.add(terrain)
    let peak = { x: 0, y: 0, z: -8 }
    for (let iy = 0; iy < 64; iy++) {
      for (let ix = 0; ix < 64; ix++) {
        const u = ix / 63
        const v = iy / 63
        const y = Math.pow(sampleHeight(map, u, v), 1.15) * lift
        if (y > peak.y) peak = { x: (u - 0.5) * size, y, z: -(v - 0.5) * size }
      }
    }
    if (mode === 'peak') flare.position.set(peak.x + 0.5, peak.y + 0.72, peak.z + 0.3)
    else flare.position.set(4.8, 11.2, 1.6)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.4, size * 1.4),
      new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.y = 0.35
    scene.add(water)
    if (mode === 'world') {
      const spots: [number, number][] = [[1.6, -11.4], [2.6, -11.6], [3.4, -12.2], [2.2, -12.6], [3.9, -11.2]]
      for (const [x, z] of spots) {
        const y = worldHeight(map, x, z, size, lift) + 0.2
        const igloo = makeIgloo(THREE, 0xf7fbff, 0.26)
        igloo.position.set(x, y, z)
        igloo.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z)
        igloo.scale.setScalar(0.5)
        scene.add(igloo)
      }
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
