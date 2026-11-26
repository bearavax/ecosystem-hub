'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, List, Mountain, Send, Star, Tent, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bindPins, setPolarisShot, type PolarisShot } from './camera-store'
import { SvalbardBackdrop } from './svalbard-world'

const DOCK: { href: string; label: string; icon: typeof Home; shot: PolarisShot; exact?: boolean }[] = [
  { href: '/polaris', label: 'Overview', icon: Home, shot: 'overview', exact: true },
  { href: '/polaris/dens', label: 'Dens', icon: Users, shot: 'dens' },
  { href: '/polaris/stages', label: 'Stages', icon: Mountain, shot: 'stages' },
  { href: '/polaris/lodge', label: 'Lodge', icon: Tent, shot: 'lodge' },
  { href: '/polaris/stars', label: 'Stars', icon: Star, shot: 'stars' },
  { href: '/polaris/enter', label: 'Submit', icon: Send, shot: 'submit' },
]

function shotFor(path: string): PolarisShot {
  if (path.startsWith('/polaris/stages')) return 'stages'
  if (path.startsWith('/polaris/dens')) return 'dens'
  if (path.startsWith('/polaris/den')) return 'den'
  if (path.startsWith('/polaris/lodge')) return 'lodge'
  if (path.startsWith('/polaris/stars')) return 'stars'
  if (path.startsWith('/polaris/enter')) return 'submit'
  if (path.startsWith('/polaris/review')) return 'review'
  return 'overview'
}

const PINS = [
  { id: 'camp', href: '/polaris/dens', label: 'Tundra Camp' },
  { id: 'mountains', href: '/polaris/stages?stage=1', label: 'Mountains · Stage 2 Open' },
  { id: 'purse', href: '/polaris/stages?stage=2', label: 'Polaris · $200K proposed' },
  { id: 'lodge', href: '/polaris/lodge', label: 'Lodge · Open seats' },
] as const

export function PolarisExperience({ densTotal, children }: { densTotal: number; children: ReactNode }) {
  const path = usePathname()
  const params = useSearchParams()
  const pins = useRef<Record<string, HTMLAnchorElement | null>>({})
  useEffect(() => {
    const stage = Number(params.get('stage'))
    setPolarisShot(shotFor(path), Number.isFinite(stage) ? stage : 1)
  }, [path, params])
  useEffect(() => bindPins((next) => {
    for (const pin of next) {
      const el = pins.current[pin.id]
      if (!el) continue
      el.style.transform = `translate3d(${pin.x}px, ${pin.y}px, 0) translate(-50%, -120%)`
      el.style.opacity = pin.visible ? '1' : '0'
    }
  }), [])
  const on = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`))
  return (
    <div className="relative min-h-[calc(100dvh-4rem)]">
      <div className="fixed inset-x-0 top-16 bottom-0 z-0">
        <SvalbardBackdrop />
        {PINS.map((pin) => (
          <Link
            key={pin.id}
            href={pin.href}
            ref={(el) => { pins.current[pin.id] = el }}
            className="absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border border-white/20 bg-[#071324]/75 px-3 py-1.5 text-xs text-sky-50 opacity-0 backdrop-blur-md"
          >
            {pin.id === 'camp' ? `Tundra Camp · ${densTotal} dens` : pin.label}
          </Link>
        ))}
      </div>
      <div className="relative z-10">
        <aside className="max-h-[46vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#071324]/72 p-4 backdrop-blur-md md:absolute md:left-5 md:top-5 md:max-h-[calc(100dvh-9rem)] md:w-[420px]">
          {children}
        </aside>
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
          <nav className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-[#071324]/80 p-1.5 backdrop-blur-md" aria-label="Polaris">
            {DOCK.map((item) => {
              const Icon = item.icon
              const active = on(item.href, item.exact)
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm', active ? 'bg-sky-400/25 text-sky-50' : 'text-fg-muted hover:text-fg-heading')}>
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              )
            })}
            <Link href="/polaris/review" aria-current={on('/polaris/review') ? 'page' : undefined} className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm', on('/polaris/review') ? 'bg-sky-400/25 text-sky-50' : 'text-fg-faint hover:text-fg-heading')}>
              <List className="size-4" aria-hidden />
              Review
            </Link>
          </nav>
        </div>
      </div>
    </div>
  )
}
