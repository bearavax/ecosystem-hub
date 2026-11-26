import type { Metadata } from 'next'
import Link from 'next/link'
import { pageParam, textParam } from '@/lib/params'
import { DENS_PAGE_SIZE, standingsFor, STANDING_LABEL } from '../_lib/rules'
import { listDens, loadPolarisContext, type DenRow } from '../_lib/queries'

export const metadata: Metadata = { title: 'Polaris lodge' }

function badge(stages: Parameters<typeof standingsFor>[0], row: DenRow, now: Date) {
  const rows = standingsFor(stages, row.entries, 'active', now)
  const first = rows[0]
  const second = rows[1]
  if (first?.standing === 'not_advanced' && second?.standing === 'can_submit') return 'Not advanced · Stage 2 open'
  return first ? STANDING_LABEL[first.standing] : 'No submission'
}

export default async function LodgePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const sp = await searchParams
  const track = textParam(sp.track)
  const trackId = track && ctx.h.tracks.some((t) => t.id === track) ? track : undefined
  const page = pageParam(sp.page)
  const now = new Date()
  const dens = await listDens(ctx.h.id, { page, pageSize: DENS_PAGE_SIZE, trackId, standing: 'any', openOnly: true, teamMax: ctx.h.teamSizeMax })
  const q = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const next = { track: trackId, ...extra }
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    const s = params.toString()
    return s ? `/polaris/lodge?${s}` : '/polaris/lodge'
  }
  return (
    <section>
      <div className="relative mb-4 h-28 overflow-hidden rounded-xl border border-sky-400/25">
        {/* eslint-disable-next-line @next/next/no-img-element -- local polaris still */}
        <img src="/polaris/premium-2-overview.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0A0F]/85 to-[#0B0A0F]/30" />
        <h2 className="absolute bottom-3 left-4 text-xl text-white">Lodge</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">Dens with an open seat: the writing team is under the size cap ({ctx.h.teamSizeMax ?? 'no cap'}). Open to team is that same signal. {dens.total} dens.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={q({ track: undefined })} className={!trackId ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>All tracks</Link>
        {ctx.h.tracks.map((t) => (
          <Link key={t.id} href={q({ track: t.id })} className={trackId === t.id ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>{t.name}</Link>
        ))}
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {dens.rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line p-4">
            <p className="text-xs text-info">Open to team</p>
            <h3 className="mt-1 text-fg-heading">{row.project.currentVersion?.name}</h3>
            <p className="text-sm text-fg-muted">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')} · {row.project.members.length} of {ctx.h.teamSizeMax ?? '∞'}</p>
            <p className="mt-2 text-xs text-fg-body">{badge(ctx.h.stages, row, now)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link href={q({ page: String(page - 1) })} className="underline-offset-2 hover:underline">Previous</Link>}
        {dens.hasMore && <Link href={q({ page: String(page + 1) })} className="underline-offset-2 hover:underline">Next</Link>}
      </div>
    </section>
  )
}
