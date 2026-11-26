import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { pageParam, textParam } from '@/lib/params'
import { IglooEmblem } from '../_components/igloo-emblem'
import { IglooHover } from '../_components/igloo-hover'
import { DENS_PAGE_SIZE, STANDING_LABEL, hasOpenSeat, standingsFor, type Standing } from '../_lib/rules'
import { listDens, loadPolarisContext, type DenRow } from '../_lib/queries'

export const metadata: Metadata = { title: 'Polaris dens' }

function pillClass(standing: Standing | 'stage2') {
  if (standing === 'submitted' || standing === 'advanced') return 'bg-emerald-500/15 text-emerald-300'
  if (standing === 'can_submit' || standing === 'stage2') return 'bg-sky-400/15 text-sky-300'
  if (standing === 'in_review') return 'bg-slate-400/20 text-slate-200'
  if (standing === 'not_advanced') return 'bg-rose-500/15 text-rose-300'
  return 'bg-surface-2 text-fg-muted'
}

function badge(hStages: { id: string; advancedOnly: boolean; opensAt: Date; closesAt: Date; judgingClosedAt: Date | null }[], row: DenRow, now: Date) {
  const rows = standingsFor(hStages, row.entries, 'active', now)
  const first = rows[0]
  const second = rows[1]
  if (first?.standing === 'not_advanced' && second?.standing === 'can_submit') return 'Not advanced · Stage 2 open'
  return first ? STANDING_LABEL[first.standing] : 'No submission'
}

const trackAccent: Record<string, string> = {
  polaris_track_gaming: 'border-emerald-300/50',
  polaris_track_social: 'border-cyan-300/50',
  polaris_track_ai: 'border-amber-300/50',
  polaris_track_payments: 'border-violet-300/50',
  polaris_track_lifestyle: 'border-rose-300/50',
  polaris_track_open: 'border-sky-300/50',
}

export default async function DensPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const sp = await searchParams
  const track = textParam(sp.track)
  const trackId = track && ctx.h.tracks.some((t) => t.id === track) ? track : undefined
  const standing = textParam(sp.standing)
  const standingOk = standing === 'submitted' || standing === 'in_review' || standing === 'not_advanced' ? standing : 'any'
  const now = new Date()
  const stageForFilter = standingOk === 'not_advanced' || standingOk === 'submitted' ? ctx.h.stages[0]?.id : standingOk === 'in_review' ? ctx.h.stages.find((s) => stageState(s, now) === 'judging')?.id : undefined
  const standingForQuery = standingOk === 'submitted' || standingOk === 'not_advanced' ? standingOk : standingOk === 'in_review' && stageForFilter ? 'submitted' : 'any'
  const openOnly = textParam(sp.open) === '1'
  const page = pageParam(sp.page)
  const dens = await listDens(ctx.h.id, { page, pageSize: DENS_PAGE_SIZE, trackId, stageId: stageForFilter, standing: standingForQuery, openOnly, teamMax: ctx.h.teamSizeMax })
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { track: trackId, standing: standingOk === 'any' ? undefined : standingOk, open: openOnly ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/polaris/dens?${s}` : '/polaris/dens'
  }
  const chip = (on: boolean) => (on ? 'shrink-0 rounded-full bg-sky-400/20 px-3 py-1 text-sky-100' : 'shrink-0 rounded-full border border-white/15 px-3 py-1 text-fg-muted')
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg text-white">Tundra · Newest dens</h2>
        <p className="text-xs text-sky-100/80">{dens.total} dens</p>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs">
        <Link href={href({ track: undefined })} className={chip(!trackId)}>All tracks</Link>
        {ctx.h.tracks.map((t) => (
          <Link key={t.id} href={href({ track: t.id })} className={chip(trackId === t.id)}>{t.name}</Link>
        ))}
        <Link href={href({ open: openOnly ? undefined : '1' })} className={chip(openOnly)}>Open seats</Link>
      </div>
      <ul className="mt-4 space-y-2">
        {dens.rows.map((row, index) => {
          const open = hasOpenSeat(row.project.members.length, ctx.h.teamSizeMax)
          const label = badge(ctx.h.stages, row, now)
          const kind: Standing | 'stage2' = label.startsWith('Not advanced · Stage 2') ? 'stage2' : (standingsFor(ctx.h.stages, row.entries, 'active', now)[0]?.standing ?? 'missed')
          const tone = kind === 'stage2' || kind === 'not_advanced' ? 'rose' : open ? 'amber' : 'ice'
          const accent = trackAccent[row.trackIds[0] ?? ''] ?? 'border-sky-300/40'
          return (
            <li key={row.id}>
              <IglooHover index={index % 6}>
                <article className={`rounded-xl border border-white/10 border-t-2 bg-[#071324]/55 p-3 ${accent}`}>
                  <div className="flex items-center justify-between gap-2">
                    <IglooEmblem tone={tone} />
                    {open && <Link href="/polaris/lodge" className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] text-emerald-100">+ Open seat</Link>}
                  </div>
                  <h3 className="mt-2 text-sm text-white">{row.project.currentVersion?.name ?? 'Untitled'}</h3>
                  <p className="text-xs text-sky-100/70">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${pillClass(kind)}`}>{label}</span>
                </article>
              </IglooHover>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sky-100/80">Page {page} of {Math.max(1, Math.ceil(dens.total / DENS_PAGE_SIZE))}</p>
        <div className="flex gap-2">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="inline-flex h-11 items-center rounded-lg border border-white/15 px-3 text-sm text-sky-50">Previous</Link>}
          {dens.hasMore && <Link href={href({ page: String(page + 1) })} className="inline-flex h-11 items-center rounded-lg border border-white/15 px-3 text-sm text-sky-50">Next →</Link>}
        </div>
      </div>
    </section>
  )
}
