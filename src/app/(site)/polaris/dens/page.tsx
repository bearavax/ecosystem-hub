import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { pageParam, textParam } from '@/lib/params'
import { RequestJoinButton } from '../_components/wire-forms'
import { DENS_PAGE_SIZE, STANDING_LABEL, hasOpenSeat, standingsFor } from '../_lib/rules'
import { readAnswers } from '../_lib/process'
import { listDens, loadPolarisContext } from '../_lib/queries'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Polaris teams' }

export default async function DensPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const sp = await searchParams
  const q = textParam(sp.q)?.toLowerCase()
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
  const me = ctx.user ? await prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId: ctx.h.id, userId: ctx.user.id } } }) : null
  const mine = new Set(readAnswers(me?.answers).joinRequests.map((r) => r.projectId))
  const href = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams()
    const next = { q: textParam(sp.q), track: trackId, standing: standingOk === 'any' ? undefined : standingOk, open: openOnly ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(next)) if (v) query.set(k, v)
    const s = query.toString()
    return s ? `/polaris/dens?${s}` : '/polaris/dens'
  }
  const rows = q ? dens.rows.filter((row) => (row.project.currentVersion?.name ?? '').toLowerCase().includes(q)) : dens.rows
  return (
    <section className="space-y-4">
      <h2 className="text-lg text-fg-heading">Teams and projects</h2>
      <p className="text-sm text-fg-body">Discovery tracks are for finding a team and a mentor. They are not separate prize pools. Dates TBC.</p>
      <form method="get" className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={textParam(sp.q) ?? ''} placeholder="Search team name" className="h-11 rounded-md border border-line bg-transparent px-3" />
        <select name="track" defaultValue={trackId ?? ''} className="h-11 rounded-md border border-line bg-transparent px-2">
          <option value="">All tracks</option>
          {ctx.h.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="standing" defaultValue={standingOk} className="h-11 rounded-md border border-line bg-transparent px-2">
          <option value="any">Any stage standing</option>
          <option value="submitted">Submitted</option>
          <option value="not_advanced">Not advanced</option>
          <option value="in_review">In review</option>
        </select>
        <label className="inline-flex h-11 items-center gap-2"><input type="checkbox" name="open" value="1" defaultChecked={openOnly} /> Open seats</label>
        <button type="submit" className="h-11 rounded-md border border-line px-3">Filter</button>
      </form>
      <ul className="space-y-3">
        {rows.map((row) => {
          const writers = row.project.members.length
          const open = hasOpenSeat(writers, ctx.h.teamSizeMax)
          const projectId = row.project.id
          const onTeam = ctx.user ? row.project.members.some((m) => m.userId === ctx.user?.id) : false
          const standing = standingsFor(ctx.h.stages, row.entries, 'active', now)[0]
          return (
            <li key={row.id} className="rounded-md border border-line p-3 text-sm">
              <p className="text-fg-heading">{row.project.currentVersion?.name ?? 'Untitled'}</p>
              <p className="text-fg-muted">{row.trackIds.map((id) => ctx.h.tracks.find((t) => t.id === id)?.name).filter(Boolean).join(', ') || 'No track yet'}</p>
              <p className="text-fg-body">{writers} of {ctx.h.teamSizeMax ?? 'any'} seats filled. {standing ? STANDING_LABEL[standing.standing] : 'No submission'}.</p>
              {ctx.user && !onTeam && open && !mine.has(projectId) && <div className="mt-2"><RequestJoinButton hackathonId={ctx.h.id} projectId={projectId} /></div>}
              {mine.has(projectId) && <p className="mt-2 text-fg-muted">Request pending. The team owner can approve or decline it from My Team.</p>}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-fg-muted">Page {page} of {Math.max(1, Math.ceil(dens.total / DENS_PAGE_SIZE))}. {dens.total} teams.</p>
        <div className="flex gap-2">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="inline-flex h-11 items-center rounded-md border border-line px-3">Previous</Link>}
          {dens.hasMore && <Link href={href({ page: String(page + 1) })} className="inline-flex h-11 items-center rounded-md border border-line px-3">Next</Link>}
        </div>
      </div>
    </section>
  )
}
