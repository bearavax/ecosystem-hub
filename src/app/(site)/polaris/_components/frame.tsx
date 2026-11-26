'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Home, List, Mountain, PawPrint, Send, Star, Tent, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/polaris', label: 'Live', icon: Home, exact: true },
  { href: '/polaris/den', label: 'My Den', icon: User, exact: false },
  { href: '/polaris/enter', label: 'Submit', icon: Send, exact: false },
  { href: '/polaris/stages', label: 'Stages', icon: Mountain, exact: false },
  { href: '/polaris/lodge', label: 'Lodge', icon: Tent, exact: false },
  { href: '/polaris/stars', label: 'Stars', icon: Star, exact: false },
  { href: '/polaris/review', label: 'Review queue', icon: List, exact: false },
] as const

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname()
  return (
    <nav aria-label="Polaris" className="flex flex-1 flex-col gap-1">
      {ITEMS.map((item) => {
        const on = item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={on ? 'page' : undefined}
            className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm', on ? 'bg-info/15 text-fg-heading' : 'text-fg-muted hover:bg-surface-2 hover:text-fg-heading')}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Motif() {
  return (
    <p className="mt-6 flex items-start gap-2 border-t border-line px-3 pt-4 text-xs text-fg-muted">
      <PawPrint className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      <span>Polar Bears International. Conservation motif, not a sponsor slot.</span>
    </p>
  )
}

export function PolarisFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1280px] items-start gap-6 px-4 py-4">
      <aside className="sticky top-20 hidden h-[calc(100dvh-6rem)] w-60 shrink-0 flex-col py-2 md:flex">
        <NavList />
        <Motif />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col bg-surface-0 p-4">
            <button type="button" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted" onClick={() => setOpen(false)}>
              <X className="size-4" aria-hidden /> Close
            </button>
            <NavList onNavigate={() => setOpen(false)} />
            <Motif />
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <button type="button" className="mb-3 inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-fg-heading md:hidden" onClick={() => setOpen(true)}>
          Polaris menu
        </button>
        {header}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
