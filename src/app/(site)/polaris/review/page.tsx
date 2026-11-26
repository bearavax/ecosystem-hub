import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getManagedHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { PageHeader } from '@/components/layout/page-header'
import { Pager } from '@/components/layout/pager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/guards'
import { POLARIS_PAGE_SIZE, POLARIS_SLUG, STANDING_FILTERS, STATUS_FILTERS, parseReviewQuery, standingsFor } from '../_lib/rules'
import { countSharedMembers, listPolarisSubmissions } from '../_lib/queries'
import { ReviewTable } from './review-bulk'

export const metadata: Metadata = { title: 'Polaris review', robots: { index: false } }

const STANDING_LABEL: Record<(typeof STANDING_FILTERS)[number], string> = {
  any: 'Any standing',
  missing: 'No submission',
  submitted: 'Has a submission',
  advanced: 'Advanced',
  not_advanced: 'Not advanced',
}

export default async function PolarisReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser()
  const event = await prisma.event.findUnique({ where: { slug: POLARIS_SLUG }, select: { hackathon: { select: { id: true } } } })
  const hackathonId = event?.hackathon?.id
  if (!hackathonId) notFound()
  const h = await getManagedHackathon(hackathonId, user)
  if (!h) notFound()
  const sp = await searchParams
  const q = parseReviewQuery(sp, { trackIds: h.tracks.map((t) => t.id), stageIds: h.stages.map((s) => s.id) })
  const [page, shared] = await Promise.all([listPolarisSubmissions(h.id, q), countSharedMembers(h.id)])
  const now = new Date()
  const stage = h.stages.find((s) => s.id === q.stageId)
  const next = stage ? h.stages[h.stages.findIndex((s) => s.id === stage.id) + 1] : undefined
  const canAdvance = !!stage?.judgingClosedAt && !!next
  const trackName = (id: string) => h.tracks.find((t) => t.id === id)?.name ?? id
  const rows = page.rows.map((s) => {
    const standings = standingsFor(h.stages, s.entries, s.status, now)
    return {
      id: s.id,
      name: s.project.currentVersion?.name ?? 'Untitled',
      projectHref: `/projects/${s.project.slug}`,
      manageHref: `/manage/hackathons/${h.id}/submissions/${s.id}`,
      team: s.project.members.map((m) => m.user.name).join(', '),
      tracks: s.trackIds.map(trackName).join(', '),
      status: s.status,
      stages: standings.map((row) => ({ stageId: row.stageId, standing: row.standing })),
      entryId: stage ? (s.entries.find((e) => e.stageId === stage.id)?.id ?? null) : null,
    }
  })
  const pagerParams = { q: q.q, track: q.trackId, stage: q.stageId, standing: q.standing === 'any' ? undefined : q.standing, status: q.status === 'any' ? undefined : q.status }

  return (
    <div>
      <PageHeader title="Polaris review" description={`${page.total} ${page.total === 1 ? 'submission' : 'submissions'} in this hackathon. ${POLARIS_PAGE_SIZE} per page, filtered in the database. This list is for organisers.`}>
        <Button asChild variant="outline"><Link href="/polaris">Polaris</Link></Button>
        <Button asChild variant="outline"><Link href={`/manage/hackathons/${h.id}/judging`}>Judging console</Link></Button>
      </PageHeader>
      {shared > 0 && <p className="mb-4 border border-line p-3 text-sm text-fg-body">{shared} {shared === 1 ? 'person is' : 'people are'} on more than one active submission.</p>}
      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block text-sm text-fg-muted lg:col-span-2">Search
          <Input name="q" defaultValue={q.q} placeholder="Project or person" className="mt-1 h-11" />
        </label>
        <label className="block text-sm text-fg-muted">Track
          <NativeSelect name="track" defaultValue={q.trackId ?? ''} className="mt-1">
            <option value="">All tracks</option>
            {h.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </label>
        <label className="block text-sm text-fg-muted">Stage
          <NativeSelect name="stage" defaultValue={q.stageId ?? ''} className="mt-1">
            <option value="">All stages</option>
            {h.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </label>
        <label className="block text-sm text-fg-muted">Standing
          <NativeSelect name="standing" defaultValue={q.standing} className="mt-1">
            {STANDING_FILTERS.map((key) => <option key={key} value={key}>{STANDING_LABEL[key]}</option>)}
          </NativeSelect>
        </label>
        <label className="block text-sm text-fg-muted">Status
          <NativeSelect name="status" defaultValue={q.status} className="mt-1">
            {STATUS_FILTERS.map((key) => <option key={key} value={key}>{key === 'any' ? 'Any status' : key}</option>)}
          </NativeSelect>
        </label>
        <div className="sm:col-span-2 lg:col-span-6"><Button type="submit" size="sm">Filter</Button></div>
      </form>
      <p className="mb-3 text-sm text-fg-muted">Page {q.page}. {page.total} {page.total === 1 ? 'match' : 'matches'}. Standing filters need a stage. Advance is available after that stage’s judging is closed and a later stage exists.</p>
      <ReviewTable hackathonId={h.id} stageId={stage?.id ?? null} stageName={stage?.name ?? null} canAdvance={canAdvance} stageHeaders={h.stages.map((s) => ({ id: s.id, name: s.name }))} rows={rows} />
      <Pager page={q.page} hasMore={page.hasMore} params={pagerParams} />
    </div>
  )
}
