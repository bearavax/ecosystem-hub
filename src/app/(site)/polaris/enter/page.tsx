import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listMyProjects } from '@/app/(app)/projects/_lib/queries'
import { missingForSubmission, TEAM_ROLES } from '@/app/(app)/projects/_lib/rules'
import { SubmitForm } from '@/app/(site)/events/[slug]/submit/submit-form'
import { getMySubmissions, getPublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { advancedStageIds, pickOpenStage, stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { getPublicEvent } from '@/app/(site)/events/_lib/queries'
import { PageHeader } from '@/components/layout/page-header'
import { COUNTRIES } from '@/lib/countries'
import { formatEventRange } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/guards'
import { POLARIS_SLUG, STANDING_LABEL, standingsFor } from '../_lib/rules'

export const metadata: Metadata = { title: 'Enter Polaris', robots: { index: false } }

export default async function PolarisEnterPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireUser()
  const { project: picked } = await searchParams
  const event = await getPublicEvent(POLARIS_SLUG)
  if (!event) notFound()
  const h = await getPublicHackathon(event.id, user.id)
  if (!h) notFound()
  const now = new Date()
  const [myProjects, mines, me] = await Promise.all([
    listMyProjects(user.id, TEAM_ROLES),
    getMySubmissions(h.id, user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { country: true } }),
  ])

  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader title="Enter Polaris" description="Submit a Hub project to the open stage. An existing project and a new project are both stored as normal projects.">
        <Link href="/polaris" className="text-sm text-fg-muted underline-offset-2 hover:text-fg-heading hover:underline">Back to Polaris</Link>
      </PageHeader>

      {!h.joined && (
        <p className="mb-8 border border-line p-4 text-fg-body">
          Register before you submit. Your profile needs a name, a country and a role.{' '}
          <Link href={`/events/${event.slug}/join`} className="text-fg-heading underline-offset-2 hover:underline">Register</Link>
        </p>
      )}

      {mines.map((m) => {
        const rows = standingsFor(h.stages, m.entries, m.status, now)
        return (
          <section key={m.id} className="mb-8 border border-line p-4">
            <h2 className="text-lg text-fg-heading">{m.project.currentVersion?.name}</h2>
            <ul className="mt-2 space-y-1 text-sm text-fg-body">
              {rows.map((row) => {
                const stage = h.stages.find((s) => s.id === row.stageId)
                return <li key={row.stageId}>{stage?.name}: {STANDING_LABEL[row.standing]}</li>
              })}
            </ul>
          </section>
        )
      })}

      {h.joined && <SubmitBlock h={h} eventSlug={event.slug} now={now} myProjects={myProjects} mines={mines} picked={picked} country={me?.country ?? null} />}
    </div>
  )
}

async function SubmitBlock({
  h,
  eventSlug,
  now,
  myProjects,
  mines,
  picked,
  country,
}: {
  h: NonNullable<Awaited<ReturnType<typeof getPublicHackathon>>>
  eventSlug: string
  now: Date
  myProjects: Awaited<ReturnType<typeof listMyProjects>>
  mines: Awaited<ReturnType<typeof getMySubmissions>>
  picked?: string
  country: string | null
}) {
  const idx = pickOpenStage(h.stages, now, advancedStageIds(mines))
  const stage = h.stages[idx]
  if (!stage || stageState(stage, now) !== 'open') {
    return <p className="text-fg-muted">No stage is open for you right now.</p>
  }
  const advanced = idx > 0 && stage.advancedOnly ? mines.filter((m) => m.entries.find((e) => e.stageId === h.stages[idx - 1]!.id)?.advancedAt) : null
  if (advanced && !advanced.length) {
    return <p className="text-fg-body">Only teams advanced from {h.stages[idx - 1]!.name} can submit to {stage.name}.</p>
  }
  const only = advanced ?? (!h.allowMultipleSubmissions && mines.length ? mines.slice(0, 1) : null)
  const submittedTo = (id: string) => mines.find((m) => m.projectId === id)?.entries.find((e) => e.stageId === stage.id)?.projectVersion.number ?? null
  const projects = (only ? myProjects.filter((p) => only.some((m) => m.projectId === p.id)) : myProjects).toSorted((a, b) => Number(!!submittedTo(b.id)) - Number(!!submittedTo(a.id)))
  const projectId = projects.find((p) => p.id === picked)?.id ?? projects[0]?.id ?? ''
  const mine = mines.find((m) => m.projectId === projectId)
  const entry = mine?.entries.find((e) => e.stageId === stage.id)
  const fields = await prisma.formField.findMany({ where: { stageId: stage.id }, orderBy: { order: 'asc' } })
  return (
    <section className="border border-line p-4">
      <h2 className="text-lg text-fg-heading">Submit to {stage.name}</h2>
      <p className="mt-1 text-sm text-fg-muted">Open until {formatEventRange(stage.closesAt, null, h.timezone)}.</p>
      <div className="mt-6">
        <SubmitForm
          key={projectId}
          submitPath="/polaris/enter"
          successHref="/polaris"
          hackathonId={h.id}
          stageId={stage.id}
          projects={projects.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.currentVersion?.name ?? '',
            tagline: p.currentVersion?.shortDescription ?? '',
            imageUrl: p.currentVersion?.logoUrl ?? p.currentVersion?.coverUrl ?? null,
            maturity: p.currentVersion?.maturity ?? null,
            versionNumber: p.currentVersion?.number ?? 0,
            sealed: !!p.currentVersion?.sealedAt,
            members: p._count.members,
            submittedVersion: submittedTo(p.id),
            missing: p.currentVersion ? missingForSubmission(p.currentVersion) : [],
          }))}
          projectId={projectId}
          canCreate={!only}
          tracks={h.tracks}
          chooseTracks={idx === 0 || !mine}
          initialTrackIds={mine?.trackIds ?? []}
          fields={fields}
          initialAnswers={(entry?.answers as Record<string, unknown>) ?? {}}
          initialPreexisting={entry?.preexistingIdea ?? false}
          initialBuilt={entry?.builtDuringEvent ?? ''}
          submittedVersion={entry?.projectVersion.number ?? null}
          countries={COUNTRIES}
          defaultCountry={country}
        />
      </div>
      <p className="mt-4 text-sm text-fg-muted">Same submit action as <Link href={`/events/${eventSlug}/submit`} className="underline-offset-2 hover:underline">/events/{eventSlug}/submit</Link>.</p>
    </section>
  )
}
