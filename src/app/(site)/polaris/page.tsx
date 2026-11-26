import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { PageHeader } from '@/components/layout/page-header'
import { DENS_PAGE_SIZE, STANDING_LABEL, hasOpenSeat, standingsFor, townHallLines } from './_lib/rules'
import { listAround, listDens, loadPolarisContext, type DenRow } from './_lib/queries'
import { pageParam, textParam } from '@/lib/params'

export const metadata: Metadata = { title: 'Polaris' }

function badge(hStages: { id: string; advancedOnly: boolean; opensAt: Date; closesAt: Date; judgingClosedAt: Date | null }[], row: DenRow, now: Date) {
  const rows = standingsFor(hStages, row.entries, 'active', now)
  const first = rows[0]
  const second = rows[1]
  if (first?.standing === 'not_advanced' && second?.standing === 'can_submit') return 'Not advanced · Stage 2 open'
  if (first?.standing === 'not_advanced' && second && !['upcoming', 'missed', 'not_eligible'].includes(second.standing)) return `Not advanced · ${STANDING_LABEL[second.standing]}`
  return first ? STANDING_LABEL[first.standing] : 'No submission'
}

export default async function PolarisLivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPolarisContext()
  if (!ctx) {
    return (
      <div>
        <PageHeader title="Polaris" description="The local test hackathon is not in this database yet." />
        <p className="text-fg-body">Run <code className="text-fg-heading">pnpm seed:polaris</code> against local Postgres.</p>
      </div>
    )
  }
  const sp = await searchParams
  const track = textParam(sp.track)
  const trackId = track && ctx.h.tracks.some((t) => t.id === track) ? track : undefined
  const standing = textParam(sp.standing)
  const standingOk = standing === 'submitted' || standing === 'in_review' || standing === 'not_advanced' ? standing : 'any'
  const stageForFilter = standingOk === 'not_advanced' || standingOk === 'submitted' ? ctx.h.stages[0]?.id : standingOk === 'in_review' ? ctx.h.stages.find((s) => stageState(s, new Date()) === 'judging')?.id : undefined
  const standingForQuery = standingOk === 'submitted' || standingOk === 'not_advanced' ? standingOk : standingOk === 'in_review' && stageForFilter ? 'submitted' : 'any'
  const openOnly = textParam(sp.open) === '1'
  const page = pageParam(sp.page)
  const now = new Date()
  const [dens, around] = await Promise.all([
    listDens(ctx.h.id, { page, pageSize: DENS_PAGE_SIZE, trackId, stageId: stageForFilter, standing: standingForQuery, openOnly, teamMax: ctx.h.teamSizeMax }),
    listAround(ctx.h.id),
  ])
  const notes = townHallLines(ctx.h.aboutMd)
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { track: trackId, standing: standingOk === 'any' ? undefined : standingOk, open: openOnly ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/polaris?${s}` : '/polaris'
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl text-fg-heading">Town hall</h2>
        <ul className="mt-4 space-y-3">
          {notes.length === 0 && <li className="text-sm text-fg-muted">No announcements in the seed.</li>}
          {notes.map((n) => (
            <li key={n.title} className="rounded-xl border border-line px-4 py-3">
              <p className="text-fg-heading">{n.title}</p>
              <p className="text-sm text-fg-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl text-fg-heading">Who&apos;s around</h2>
        <ul className="mt-4 flex flex-wrap gap-4">
          {around.map((p) => {
            const writers = p.user.projectMembers.map((m) => m.project.members.length)
            const open = writers.some((n) => hasOpenSeat(n, ctx.h.teamSizeMax))
            return (
              <li key={p.user.name} className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-xs text-fg-heading" aria-hidden>{p.user.name.slice(0, 1)}</span>
                <span>
                  <span className="block text-sm text-fg-heading">{p.user.name}</span>
                  <span className="text-xs text-fg-muted">{open ? 'Open to team' : 'Around now'}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl text-fg-heading">Newest dens</h2>
          <p className="text-sm text-fg-muted">{dens.total} dens · {DENS_PAGE_SIZE} per page</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href={href({ track: undefined })} className={!trackId ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>All tracks</Link>
          {ctx.h.tracks.map((t) => (
            <Link key={t.id} href={href({ track: t.id })} className={trackId === t.id ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>{t.name}</Link>
          ))}
          <Link href={href({ open: openOnly ? undefined : '1' })} className={openOnly ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>Open seats</Link>
          {(['submitted', 'in_review', 'not_advanced'] as const).map((key) => (
            <Link key={key} href={href({ standing: standingOk === key ? undefined : key })} className={standingOk === key ? 'rounded-full bg-info/15 px-3 py-1 text-fg-heading' : 'rounded-full border border-line px-3 py-1 text-fg-muted'}>
              {key === 'not_advanced' ? 'Not advanced · Stage 2 open' : STANDING_LABEL[key]}
            </Link>
          ))}
        </div>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dens.rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-line p-4">
              <p className="text-xs text-fg-muted">Open seat: {hasOpenSeat(row.project.members.length, ctx.h.teamSizeMax) ? 'yes' : 'no'}</p>
              <h3 className="mt-2 text-fg-heading">{row.project.currentVersion?.name ?? 'Untitled'}</h3>
              <p className="text-sm text-fg-muted">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</p>
              <p className="mt-3 text-xs text-fg-body">{badge(ctx.h.stages, row, now)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-fg-muted">Tracks are categories, not separate prize pools. A team can pick one or more on its first submission.</p>
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="text-fg-heading underline-offset-2 hover:underline">Previous</Link>}
          {dens.hasMore && <Link href={href({ page: String(page + 1) })} className="text-fg-heading underline-offset-2 hover:underline">Next</Link>}
          <Link href="/polaris/lodge" className="text-fg-muted underline-offset-2 hover:underline">Lodge</Link>
        </div>
      </section>
    </div>
  )
}
