import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { StageStateBadge } from '@/components/stage-state-badge'
import { formatEventRange } from '@/lib/dates'
import { POLARIS_PRIZES, POLARIS_RUBRIC } from '../_lib/process'
import { formatPurse, stagePurse } from '../_lib/rules'
import { loadPolarisContext } from '../_lib/queries'

export const metadata: Metadata = { title: 'Polaris stages' }

export default async function StagesPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const now = new Date()
  const { h } = ctx
  const purses = h.stages.map((stage) => ({ name: stage.name, ...stagePurse(h.prizes, stage.name) }))
  const pool = purses.reduce((sum, purse) => sum + purse.total, 0)
  const awards = purses.reduce((sum, purse) => sum + purse.awards, 0)
  return (
    <div className="space-y-6">
      <section>
        <div className="max-w-3xl space-y-2 text-sm text-fg-body">
          <p>${POLARIS_PRIZES.prizeTotal.toLocaleString('en-US')} proposed across {POLARIS_PRIZES.awards} awards. Saved prize rows add up to ${pool.toLocaleString('en-US')} proposed across {awards} awards ({purses.map((purse) => `${formatPurse(purse.total).replace(' proposed', '')} ${purse.name}`).join(' · ')}).</p>
          <p>Stage 1 Hackathon: {POLARIS_PRIZES.stage1.places} × ${POLARIS_PRIZES.stage1.each.toLocaleString('en-US')} = ${POLARIS_PRIZES.stage1.total.toLocaleString('en-US')} proposed.</p>
          <p>Stage 2 Accelerator: {POLARIS_PRIZES.stage2.places} × ${POLARIS_PRIZES.stage2.each.toLocaleString('en-US')} = ${POLARIS_PRIZES.stage2.total.toLocaleString('en-US')} proposed. Teams that were not advanced from Stage 1 can enter. Repeat winners are allowed.</p>
          <p>Stage 3 Finale: 5 grand winners = ${POLARIS_PRIZES.stage3.total.toLocaleString('en-US')} proposed (${POLARIS_PRIZES.stage3.amounts.map((n) => `$${n.toLocaleString('en-US')}`).join(' / ')}). Only teams advanced from Stage 2.</p>
          <p>${POLARIS_PRIZES.ops.toLocaleString('en-US')} proposed ops. This is operations money, not prize money, and it is not one of the {POLARIS_PRIZES.awards} awards.</p>
          <p>Dates TBC. Six discovery tracks are for mentoring and discovery only. They are not separate prize pools. Judges TBC.</p>
          <p>Rubric weights: {POLARIS_RUBRIC.map((c) => `${c.name} ${c.weight}`).join(', ')}.</p>
        </div>
        <ol className="mt-6 grid gap-4">
          {h.stages.map((s, i) => {
            const prizes = h.prizes.filter((p) => p.title.toLowerCase().startsWith(s.name.toLowerCase()))
            const total = s.criteria.reduce((sum, c) => sum + c.weight, 0) || 1
            return (
              <li key={s.id} className="rounded-xl border border-sky-300/15 bg-[#0F2137]/80 p-5 shadow-[inset_0_1px_0_rgba(186,230,253,0.18)] motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg text-fg-heading"><Link href={`/polaris/stages?stage=${i}`} className="underline-offset-2 hover:underline">Stage {i + 1}: {s.name}</Link></h3>
                  <StageStateBadge state={stageState(s, now)} />
                </div>
                <p className="mt-2 text-sm text-fg-muted">Seed window {formatEventRange(s.opensAt, s.closesAt, h.timezone)}</p>
                {i > 0 && <p className="mt-2 text-sm text-fg-body">{s.advancedOnly ? 'Advanced teams only.' : 'Teams not advanced from the previous stage can still enter. Repeat winners are allowed.'}</p>}
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {prizes.map((p) => (
                    <li key={p.id} className="rounded-lg border border-line px-3 py-3">
                      <p className="text-fg-heading">{p.amount}</p>
                      <p className="text-sm text-fg-muted">{p.title}</p>
                      {p.description && <p className="mt-1 text-xs text-fg-muted">{p.description}</p>}
                    </li>
                  ))}
                </ul>
                {s.showCriteria && s.criteria.length > 0 && (
                  <ul className="mt-4 max-w-lg space-y-3 text-sm">
                    {s.criteria.map((c) => {
                      const pct = Math.round((c.weight / total) * 100)
                      return (
                        <li key={c.id}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-fg-heading">{c.name}</span>
                            <span className="text-fg-body">{c.weight} · {pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.85)]" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>
      <section>
        <h2 className="text-xl text-fg-heading">Tracks</h2>
        <p className="mt-2 text-sm text-fg-muted">Discovery and mentoring categories, not separate prize pools. One sponsor placeholder per track.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {h.tracks.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-4">
              <p className="text-fg-heading">{t.name}</p>
              <p className="mt-1 text-sm text-fg-muted">{t.sponsor ?? 'Empty slot'}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl text-fg-heading">Judges</h2>
        <ul className="mt-4 flex flex-wrap gap-6">
          {h.judges.map((j) => (
            <li key={j.id} className="text-sm text-fg-heading">{j.user?.name ?? 'Invited judge'}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
