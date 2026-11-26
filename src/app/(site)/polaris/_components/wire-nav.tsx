'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  ['/polaris', 'Overview', true],
  ['/polaris/dens', 'Teams & Projects', false],
  ['/polaris/lodge', 'Teammates', false],
  ['/polaris/stages', 'Stages & Prizes', false],
  ['/polaris/den', 'My Team', false],
  ['/polaris/enter', 'Submit', false],
  ['/polaris/review', 'Organiser Queue', false],
] as const

export function WireNav() {
  const path = usePathname()
  return (
    <nav aria-label="Polaris" className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
      {LINKS.map(([href, label, exact]) => {
        const on = exact ? path === href : path === href || path.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={cn('inline-flex min-h-11 items-center rounded-md border px-3 text-sm', on ? 'border-line bg-surface-2 text-fg-heading' : 'border-transparent text-fg-body hover:border-line')}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
