'use client'

import { useEffect, useRef } from 'react'

/** Lightweight starfield and a slow drift over the still. No library. Stops when motion is reduced. */
export function HeroScene() {
  const wrap = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = wrap.current
    const photo = img.current
    const sky = canvas.current
    if (!root || !photo || !sky) return
    const ctx = sky.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.72,
      r: Math.random() * 1.1 + 0.3,
      p: Math.random() * Math.PI * 2,
    }))
    let mx = 0
    let my = 0
    let raf = 0
    let t = 0
    const resize = () => {
      const box = root.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sky.width = Math.max(1, Math.floor(box.width * dpr))
      sky.height = Math.max(1, Math.floor(box.height * dpr))
    }
    const place = () => {
      const drift = reduce ? 0 : Math.sin(t * 0.35) * 6
      photo.style.transform = `scale(1.08) translate3d(${mx * -14 + drift}px, ${my * -8}px, 0)`
    }
    const draw = () => {
      const w = sky.width
      const h = sky.height
      ctx.clearRect(0, 0, w, h)
      const band = ctx.createLinearGradient(0, h * 0.05, w, h * 0.55)
      const glow = reduce ? 0.12 : 0.1 + Math.sin(t) * 0.04
      band.addColorStop(0, 'rgba(56,189,248,0)')
      band.addColorStop(0.45, `rgba(94,234,212,${glow})`)
      band.addColorStop(1, 'rgba(56,189,248,0)')
      ctx.fillStyle = band
      ctx.fillRect(0, 0, w, h * 0.6)
      for (const s of stars) {
        const tw = reduce ? 0.75 : 0.4 + Math.sin(t * 1.6 + s.p) * 0.45
        ctx.fillStyle = `rgba(255,255,255,${tw})`
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const frame = () => {
      t += 0.016
      place()
      draw()
      raf = requestAnimationFrame(frame)
    }
    const onMove = (e: MouseEvent) => {
      const box = root.getBoundingClientRect()
      mx = (e.clientX - box.left) / box.width - 0.5
      my = (e.clientY - box.top) / box.height - 0.5
    }
    resize()
    draw()
    place()
    window.addEventListener('resize', resize)
    if (!reduce) {
      root.addEventListener('mousemove', onMove)
      raf = requestAnimationFrame(frame)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      root.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- local polaris still */}
      <img ref={img} src="/polaris/snow-1-hero.jpg" alt="" className="h-full w-full object-cover object-[center_42%] will-change-transform" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07111F]/92 via-[#07111F]/72 to-[#07111F]/25" />
    </div>
  )
}
