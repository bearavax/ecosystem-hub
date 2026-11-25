'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionTabs({ tabs }: { tabs: { id: string; label: string; panel: ReactNode }[] }) {
  const [id, setId] = useState(tabs[0]?.id ?? '')
  const current = tabs.find((t) => t.id === id) ?? tabs[0]
  if (!current) return null
  return (
    <div>
      <div role="tablist" aria-label="Hackathon sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const on = t.id === current.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              onClick={() => setId(t.id)}
              className={cn('min-h-11 shrink-0 border-b-2 px-3 text-sm', on ? 'border-info text-fg-heading' : 'border-transparent text-fg-muted hover:text-fg-heading')}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="py-5">
        {current.panel}
      </div>
    </div>
  )
}
