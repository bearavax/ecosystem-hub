'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Home, List, Mountain, Send, Star, Tent, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAIN = [
  { href: '/polaris', label: 'Live', icon: Home, exact: true },
  { href: '/polaris/den', label: 'My Den', icon: User, exact: false },
  { href: '/polaris/enter', label: 'Submit', icon: Send, exact: false },
  { href: '/polaris/stages', label: 'Stages', icon: Mountain, exact: false },
  { href: '/polaris/lodge', label: 'Lodge', icon: Tent, exact: false },
  { href: '/polaris/stars', label: 'Stars', icon: Star, exact: false },
] as const

function Item({ href, label, icon: Icon, on, onNavigate }: { href: string; label: string; icon: typeof Home; on: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={on ? 'page' : undefined}
      className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm', on ? 'bg-sky-400/20 text-sky-100' : 'text-fg-muted hover:bg-surface-2 hover:text-fg-heading')}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname()
  const on = (href: string, exact: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`))
  const review = on('/polaris/review', false)
  return (
    <nav aria-label="Polaris" className="flex flex-col gap-1">
      {MAIN.map((item) => (
        <Item key={item.href} {...item} on={on(item.href, item.exact)} onNavigate={onNavigate} />
      ))}
      <p className="mb-1 mt-4 border-t border-sky-400/20 px-3 pt-3 text-[10px] tracking-[0.14em] text-fg-faint">Organiser</p>
      <Link
        href="/polaris/review"
        onClick={onNavigate}
        aria-current={review ? 'page' : undefined}
        className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm', review ? 'bg-sky-400/20 text-sky-100' : 'text-fg-muted hover:bg-surface-2 hover:text-fg-heading')}
      >
        <List className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">Review queue</span>
        <span className="rounded-full border border-sky-400/30 px-1.5 py-0.5 text-[10px] text-sky-300">25 / page</span>
      </Link>
    </nav>
  )
}

export function PolarisFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-4">
      {header}
      <div className="mt-4 flex items-start gap-6">
        <aside className="sticky top-20 hidden w-60 shrink-0 rounded-xl border border-sky-300/15 bg-[#0F2137]/80 p-3 shadow-[inset_0_1px_0_rgba(186,230,253,0.2)] motion-safe:[transform:perspective(900px)_rotateY(3deg)] motion-safe:transition motion-safe:hover:[transform:perspective(900px)_rotateY(0deg)] md:block">
          <NavList />
        </aside>
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-sky-300/15 bg-[#0F2137] p-4">
              <button type="button" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted" onClick={() => setOpen(false)}>
                <X className="size-4" aria-hidden /> Close
              </button>
              <NavList onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <button type="button" className="mb-3 inline-flex min-h-11 items-center rounded-lg border border-sky-400/30 px-3 text-sm text-fg-heading md:hidden" onClick={() => setOpen(true)}>
            Polaris menu
          </button>
          {children}
        </div>
      </div>
    </div>
  )
}
