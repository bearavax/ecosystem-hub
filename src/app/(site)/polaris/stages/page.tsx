import type { Metadata } from 'next'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { StageStateBadge } from '@/components/stage-state-badge'
import { formatEventRange } from '@/lib/dates'
import { loadPolarisContext } from '../_lib/queries'

export const metadata: Metadata = { title: 'Polaris stages' }

export default async function StagesPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const now = new Date()
  const { h } = ctx
  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-xl text-fg-heading">Mountains</h2>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">Three stages. Prize text is proposed. Seed windows are not announced dates. Prize pool {h.prizePool}.</p>
        <ol className="mt-6 grid gap-4">
          {h.stages.map((s, i) => {
            const prizes = h.prizes.filter((p) => p.title.toLowerCase().startsWith(s.name.toLowerCase()))
            const total = s.criteria.reduce((sum, c) => sum + c.weight, 0) || 1
            return (
              <li key={s.id} className="rounded-xl border border-line p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg text-fg-heading">Stage {i + 1}: {s.name}</h3>
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
                  <table className="mt-4 w-full max-w-lg text-left text-sm">
                    <thead className="text-fg-muted"><tr><th className="py-1 font-medium">Criterion</th><th className="py-1 text-right font-medium">Weight</th></tr></thead>
                    <tbody>
                      {s.criteria.map((c) => (
                        <tr key={c.id} className="border-t border-line">
                          <td className="py-2 text-fg-heading">{c.name}</td>
                          <td className="py-2 text-right text-fg-body">{c.weight} · {Math.round((c.weight / total) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
