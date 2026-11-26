import type { Metadata } from 'next'
import { loadPolarisContext } from '../_lib/queries'

export const metadata: Metadata = { title: 'Polaris stars' }

export default async function StarsPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const winners = ctx.h.resultsPublishedAt
    ? ctx.h.prizes.flatMap((p) => p.awards.filter((a) => a.submission.status === 'active' && a.submission.entries[0]).map((a) => ({ title: p.title, name: a.submission.entries[0]!.projectVersion.name, amount: p.amount })))
    : []
  return (
    <section>
      <h2 className="text-2xl text-amber-100">Stars</h2>
      <p className="mt-2 max-w-2xl text-sm text-fg-body">The Hub stores one <code className="text-fg-heading">resultsPublishedAt</code> flag for the whole hackathon, not a winners archive per stage. A per-stage archive would be a Polaris addition. This page only shows awards already on the hackathon.</p>
      {winners.length === 0 ? <p className="mt-6 text-sm text-fg-muted">No published winners.</p> : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {winners.map((w) => (
            <li key={w.title + w.name} className="rounded-xl border border-line p-4">
              <p className="text-fg-heading">{w.name}</p>
              <p className="text-sm text-fg-muted">{w.title}{w.amount ? ` · ${w.amount}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
