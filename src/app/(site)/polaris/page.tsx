import type { Metadata } from 'next'
import Link from 'next/link'
import { Flag, PawPrint } from 'lucide-react'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { PageHeader } from '@/components/layout/page-header'
import { DENS_PAGE_SIZE, STANDING_LABEL, hasOpenSeat, standingsFor, townHallLines, type Standing } from './_lib/rules'
import { listAround, listDens, loadPolarisContext, type DenRow } from './_lib/queries'
import { pageParam, textParam } from '@/lib/params'

function Igloo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7 text-sky-300" aria-hidden>
      <path fill="currentColor" d="M6 20c0-6 4.5-11 10-11s10 5 10 11v2H6v-2z" opacity=".9" />
      <path fill="currentColor" d="M14 22h4v4h-4z" />
      <path stroke="currentColor" strokeWidth="1" d="M8 18h16M11 14h10" opacity=".7" />
    </svg>
  )
}

function pillClass(standing: Standing | 'stage2') {
  if (standing === 'submitted' || standing === 'advanced') return 'bg-emerald-500/15 text-emerald-300'
  if (standing === 'can_submit' || standing === 'stage2') return 'bg-sky-400/15 text-sky-300'
  if (standing === 'in_review') return 'bg-slate-400/20 text-slate-200'
  if (standing === 'not_advanced') return 'bg-rose-500/15 text-rose-300'
  return 'bg-surface-2 text-fg-muted'
}

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
  const [dens, around, snapshot] = await Promise.all([
    listDens(ctx.h.id, { page, pageSize: DENS_PAGE_SIZE, trackId, stageId: stageForFilter, standing: standingForQuery, openOnly, teamMax: ctx.h.teamSizeMax }),
    listAround(ctx.h.id),
    listDens(ctx.h.id, { page: 1, pageSize: 5, standing: 'any', openOnly: false, teamMax: ctx.h.teamSizeMax }),
  ])
  const notes = townHallLines(ctx.h.aboutMd)
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { track: trackId, standing: standingOk === 'any' ? undefined : standingOk, open: openOnly ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/polaris?${s}` : '/polaris'
  }

  const chip = (on: boolean) => (on ? 'shrink-0 rounded-full bg-sky-400/20 px-3 py-1 text-sky-100' : 'shrink-0 rounded-full border border-sky-400/20 px-3 py-1 text-fg-muted')
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-lg text-fg-heading">Town hall</h2>
          <span className="rounded-full border border-sky-400/30 px-2 py-0.5 text-[10px] tracking-[0.12em] text-sky-300">Town hall</span>
        </div>
        <div className="rounded-xl border border-sky-300/15 bg-[#0F2137]/80 shadow-[inset_0_1px_0_rgba(186,230,253,0.16)]">
          {notes.length === 0 && <p className="px-4 py-3 text-sm text-fg-muted">No announcements in the seed.</p>}
          {notes.map((n, i) => (
            <div key={n.title} className={i === 0 ? 'px-4 py-3' : 'border-t border-line px-4 py-3'}>
              <p className="text-sm text-fg-heading">{n.title}</p>
              <p className="text-xs text-fg-muted">{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg text-fg-heading">Who&apos;s around</h2>
        <ul className="mt-3 flex gap-4 overflow-x-auto pb-1">
          {around.map((p) => {
            const writers = p.user.projectMembers.map((m) => m.project.members.length)
            const open = writers.some((n) => hasOpenSeat(n, ctx.h.teamSizeMax))
            return (
              <li key={p.user.name} className="flex shrink-0 items-center gap-2">
                <span className="relative grid size-9 place-items-center rounded-full border border-sky-400/30 bg-surface-2 text-xs text-fg-heading" aria-hidden>
                  {p.user.name.slice(0, 1)}
                  {open && <Flag className="absolute -right-1 -top-1 size-3 text-sky-300" />}
                </span>
                <span>
                  <span className="block text-sm text-fg-heading">{p.user.name}</span>
                  <span className="text-[11px] text-sky-300/80">{open ? 'Open to team' : 'Around now'}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg text-fg-heading">Tundra · Newest dens</h2>
          <p className="text-xs text-fg-muted">{dens.total} dens · {DENS_PAGE_SIZE} per page</p>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs">
          <Link href={href({ track: undefined })} className={chip(!trackId)}>All tracks</Link>
          {ctx.h.tracks.map((t) => (
            <Link key={t.id} href={href({ track: t.id })} className={chip(trackId === t.id)}>{t.name}</Link>
          ))}
          <Link href={href({ open: openOnly ? undefined : '1' })} className={chip(openOnly)}>Open seats</Link>
          {(['submitted', 'in_review', 'not_advanced'] as const).map((key) => (
            <Link key={key} href={href({ standing: standingOk === key ? undefined : key })} className={chip(standingOk === key)}>
              {key === 'not_advanced' ? 'Not advanced · Stage 2 open' : STANDING_LABEL[key]}
            </Link>
          ))}
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dens.rows.map((row) => {
            const open = hasOpenSeat(row.project.members.length, ctx.h.teamSizeMax)
            const label = badge(ctx.h.stages, row, now)
            const kind: Standing | 'stage2' = label.startsWith('Not advanced · Stage 2') ? 'stage2' : (standingsFor(ctx.h.stages, row.entries, 'active', now)[0]?.standing ?? 'missed')
            return (
              <li key={row.id} className="rounded-xl border border-sky-300/15 bg-[#0F2137]/80 p-4 shadow-[inset_0_1px_0_rgba(186,230,253,0.18)] motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_18px_36px_rgba(4,12,28,0.45),inset_0_1px_0_rgba(186,230,253,0.35)]">
                <div className="flex items-start justify-between gap-2">
                  <Igloo />
                  {open && <span className="text-[10px] tracking-[0.12em] text-sky-300">Open seat</span>}
                </div>
                <h3 className="mt-3 text-fg-heading">{row.project.currentVersion?.name ?? 'Untitled'}</h3>
                <p className="text-sm text-fg-muted">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</p>
                <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] tracking-wide ${pillClass(kind)}`}>{label}</span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-fg-muted">Tracks are categories, not separate prize pools.</p>
        <div className="mt-3 flex gap-3 text-sm">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="text-fg-heading underline-offset-2 hover:underline">Previous</Link>}
          {dens.hasMore && <Link href={href({ page: String(page + 1) })} className="text-fg-heading underline-offset-2 hover:underline">Next</Link>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg text-fg-heading">Review queue</h2>
          <Link href="/polaris/review" className="text-xs text-sky-300 underline-offset-2 hover:underline">Full queue, 25 per page</Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-sky-300/15 bg-[#0F2137]/80 shadow-[inset_0_1px_0_rgba(186,230,253,0.16)]">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-fg-muted"><tr><th className="px-3 py-2 font-medium">Den</th><th className="px-3 py-2 font-medium">Track</th><th className="px-3 py-2 font-medium">Stage</th><th className="px-3 py-2 font-medium">Standing</th><th className="px-3 py-2 font-medium">Note</th></tr></thead>
            <tbody>
              {snapshot.rows.map((row) => {
                const label = badge(ctx.h.stages, row, now)
                const kind: Standing | 'stage2' = label.startsWith('Not advanced · Stage 2') ? 'stage2' : (standingsFor(ctx.h.stages, row.entries, 'active', now)[0]?.standing ?? 'missed')
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2 text-fg-heading">{row.project.currentVersion?.name}</td>
                    <td className="px-3 py-2 text-fg-body">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</td>
                    <td className="px-3 py-2 text-fg-body">{ctx.h.stages[0]?.name ?? 'Stage 1'}</td>
                    <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] tracking-wide ${pillClass(kind)}`}>{label}</span></td>
                    <td className="px-3 py-2 text-xs text-fg-muted">{label.includes('Stage 2') ? 'Eligible for Stage 2' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sky-300/20 pt-5">
        <div className="flex items-center gap-3">
          <PawPrint className="size-5 shrink-0 text-amber-200" aria-hidden />
          <div>
            <p className="text-sm text-sky-50">Polar Bears International</p>
            <p className="text-xs text-sky-100/70">Conservation motif, not a sponsor slot.</p>
          </div>
        </div>
        <p className="text-[11px] text-sky-100/50">Local seed. Not an announced event.</p>
      </footer>
    </div>
  )
}
