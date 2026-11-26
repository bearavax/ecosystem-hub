import type { Metadata } from 'next'
import Link from 'next/link'
import { Flag, PawPrint } from 'lucide-react'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { PageHeader } from '@/components/layout/page-header'
import { DENS_PAGE_SIZE, STANDING_LABEL, formatPurse, hasOpenSeat, stagePurse, standingsFor, townHallLines, type Standing } from './_lib/rules'
import { IglooEmblem } from './_components/igloo-emblem'
import { listAround, listDens, loadPolarisContext, type DenRow } from './_lib/queries'
import { pageParam, textParam } from '@/lib/params'

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

  const chip = (on: boolean) => (on ? 'shrink-0 rounded-full bg-sky-400/20 px-3 py-1 text-sky-100' : 'shrink-0 rounded-full border border-sky-400/20 px-3 py-1 text-fg-muted')
  const story = [
    { name: 'Tundra', blurb: 'Hackathon' },
    { name: 'Mountains', blurb: 'Accelerator' },
    { name: 'Stars', blurb: 'Finale' },
  ] as const
  const rings = ['bg-emerald-400/20 text-emerald-100 ring-emerald-300/70', 'bg-cyan-400/20 text-cyan-100 ring-cyan-300/70', 'bg-amber-400/20 text-amber-100 ring-amber-300/70', 'bg-violet-400/20 text-violet-100 ring-violet-300/70', 'bg-rose-400/20 text-rose-100 ring-rose-300/70', 'bg-sky-400/20 text-sky-100 ring-sky-300/70']
  const trackAccent: Record<string, string> = {
    polaris_track_gaming: 'border-emerald-300/50',
    polaris_track_social: 'border-cyan-300/50',
    polaris_track_ai: 'border-amber-300/50',
    polaris_track_payments: 'border-violet-300/50',
    polaris_track_lifestyle: 'border-rose-300/50',
    polaris_track_open: 'border-sky-300/50',
  }
  return (
    <div className="space-y-8">
      <section id="journey" className="scroll-mt-24">
        <h2 className="text-lg text-fg-heading">Three stages</h2>
        <ol className="mt-3 grid gap-3 lg:grid-cols-3">
          {ctx.h.stages.map((stage, i) => {
            const purse = stagePurse(ctx.h.prizes, stage.name)
            const state = stageState(stage, now)
            const live = state === 'open'
            const meta = i === 2 ? `${purse.awards} grand winners` : `${purse.awards} awards`
            return (
              <li key={stage.id}>
                <Link href="/polaris/stages" className={`block h-full rounded-xl border p-4 backdrop-blur-md ${live ? 'border-sky-300/50 bg-sky-400/10 shadow-[0_0_32px_rgba(56,189,248,0.18)]' : 'border-white/10 bg-[#071324]/78'}`}>
                  <p className="text-[11px] text-sky-200">0{i + 1} · {story[i]?.name} ({story[i]?.blurb})</p>
                  <p className="mt-2 text-lg text-white">{formatPurse(purse.total)} · {meta}</p>
                  <p className={`mt-2 text-sm ${live ? 'text-sky-100' : 'text-fg-muted'}`}>{live ? 'Open now' : state === 'upcoming' ? 'Upcoming' : 'Closed'}</p>
                  {live && <p className="mt-1 text-xs text-sky-100/80">Stage 1 teams welcome. Repeat winners allowed.</p>}
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['1', 'Join or start a Den', '/polaris/den'],
          ['2', 'Find teammates in the Lodge', '/polaris/lodge'],
          ['3', 'Submit for Stage 2', '/polaris/enter'],
        ].map(([n, label, href]) => (
          <Link key={n} href={href} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#071324]/78 px-4 py-3 text-sm text-fg-heading backdrop-blur-md hover:border-sky-300/40">
            <span className="grid size-8 place-items-center rounded-full bg-sky-400/20 text-sky-100">{n}</span>
            {label}
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-[#071324]/78 p-4 backdrop-blur-md">
          <h2 className="text-lg text-fg-heading">Town hall</h2>
          <div className="mt-3">
            {notes.length === 0 && <p className="text-sm text-fg-muted">No announcements in the seed.</p>}
            {notes.map((n) => (
              <div key={n.title} className="border-t border-white/10 py-2 first:border-t-0 first:pt-0">
                <p className="text-sm text-fg-heading">{n.title}</p>
                <p className="text-xs text-fg-muted">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-white/10 bg-[#071324]/78 p-4 backdrop-blur-md">
          <h2 className="text-lg text-fg-heading">Who&apos;s around</h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {around.map((p, i) => {
              const writers = p.user.projectMembers.map((m) => m.project.members.length)
              const open = writers.some((n) => hasOpenSeat(n, ctx.h.teamSizeMax))
              return (
                <li key={p.user.name} className="flex min-w-[9rem] items-center gap-2">
                  <span className={`relative grid size-9 place-items-center rounded-full text-xs ring-2 ${rings[i % rings.length]}`} aria-hidden>
                    {p.user.name.slice(0, 1)}
                    {open && <Flag className="absolute -right-1 -top-1 size-3 text-emerald-200" />}
                  </span>
                  <span>
                    <span className="block text-sm text-fg-heading">{p.user.name}</span>
                    <span className="text-[11px] text-sky-200">{open ? 'Open to team' : 'Around now'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

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
            const tone = kind === 'stage2' || kind === 'not_advanced' ? 'rose' : open ? 'amber' : 'ice'
            const accent = trackAccent[row.trackIds[0] ?? ''] ?? 'border-sky-300/40'
            return (
              <li key={row.id} className={`rounded-xl border border-white/10 border-t-2 bg-[#071324]/78 p-4 backdrop-blur-md motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 ${accent}`}>
                <div className="flex items-start justify-between gap-2">
                  <IglooEmblem tone={tone} />
                  {open && <Link href="/polaris/lodge" className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] text-emerald-100">+ Open seat</Link>}
                </div>
                <h3 className="mt-3 text-fg-heading">{row.project.currentVersion?.name ?? 'Untitled'}</h3>
                <p className="text-sm text-fg-muted">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</p>
                <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] tracking-wide ${pillClass(kind)}`}>{label}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">Page {page} of {Math.max(1, Math.ceil(dens.total / DENS_PAGE_SIZE))}</p>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="inline-flex h-11 items-center rounded-lg border border-white/15 bg-[#071324]/78 px-4 text-sm text-sky-50 backdrop-blur-md">Previous</Link>}
            {dens.hasMore && <Link href={href({ page: String(page + 1) })} className="inline-flex h-11 items-center rounded-lg border border-white/15 bg-[#071324]/78 px-4 text-sm text-sky-50 backdrop-blur-md">Next →</Link>}
          </div>
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
