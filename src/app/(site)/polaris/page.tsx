import type { Metadata } from 'next'
import Link from 'next/link'
import { getEventHackathonRoles, getMySubmissions, getPublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { canManageHackathon, stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { getPublicEvent } from '@/app/(site)/events/_lib/queries'
import { PageHeader } from '@/components/layout/page-header'
import { StageStateBadge } from '@/components/stage-state-badge'
import { Button } from '@/components/ui/button'
import { formatEventRange } from '@/lib/dates'
import { getCurrentUser } from '@/lib/session'
import { can } from '@/lib/permissions'
import { POLARIS_SLUG, STANDING_LABEL, standingsFor } from './_lib/rules'

export const metadata: Metadata = { title: 'Polaris' }

export default async function PolarisPage() {
  const user = await getCurrentUser()
  const event = await getPublicEvent(POLARIS_SLUG)
  const h = event ? await getPublicHackathon(event.id, user?.id ?? null) : null
  if (!event || !h) {
    return (
      <div className="container-page py-12">
        <PageHeader title="Polaris" description="The local test hackathon is not in this database yet." />
        <p className="max-w-xl text-fg-body">From the repo root, with Postgres running and `.env` pointing at it, run <code className="text-fg-heading">pnpm seed:polaris</code>. That writes a fake hackathon into the Hub tables. It does not call Luma, the member portal, or production.</p>
      </div>
    )
  }
  const [mine, roles] = user
    ? await Promise.all([getMySubmissions(h.id, user.id), getEventHackathonRoles(event.id, user.id)])
    : [[], null]
  const manage = !!user && (can(user, 'hackathons.manage') || canManageHackathon(user, roles?.organizers ?? []))
  const now = new Date()
  const judges = h.judges
  const published = h.resultsPublishedAt
    ? h.prizes.flatMap((p) => p.awards.filter((a) => a.submission.status === 'active' && a.submission.entries[0]).map((a) => ({ prize: p, award: a })))
    : []

  return (
    <div className="container-page py-12">
      <PageHeader title="Polaris" description="FAKE local test. Tundra is where a team registers. Mountains are the stages. Stars are the published winners. Prize text says proposed. Sponsors are placeholders.">
        <Button asChild><Link href="/polaris/enter">Enter</Link></Button>
        <Button asChild variant="outline"><Link href={`/events/${event.slug}`}>Hackathon page</Link></Button>
        {manage && <Button asChild variant="outline"><Link href="/polaris/review">Review queue</Link></Button>}
      </PageHeader>

      <section className="mb-12 border border-line p-5">
        <h2 className="text-2xl text-fg-heading">Tundra</h2>
        <p className="mt-2 max-w-2xl text-fg-body">Register, then submit a Hub project. The project can already exist, or you can create one on the enter page. Teammates are the project’s owner and writers. Everyone on the team has to be registered.</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-fg-muted">Registration</dt><dd className="text-fg-heading">{h.registrationOpensAt && h.registrationClosesAt ? formatEventRange(h.registrationOpensAt, h.registrationClosesAt, h.timezone) : 'Open'}</dd></div>
          <div><dt className="text-fg-muted">Team size</dt><dd className="text-fg-heading">{h.teamSizeMin}{h.teamSizeMax ? ` to ${h.teamSizeMax}` : '+'}</dd></div>
          <div><dt className="text-fg-muted">Registered</dt><dd className="text-fg-heading">{h._count.participants}</dd></div>
          <div><dt className="text-fg-muted">Active submissions</dt><dd className="text-fg-heading">{h._count.submissions}</dd></div>
        </dl>
        <p className="mt-4 text-sm"><Link href={user ? `/events/${event.slug}/join` : `/sign-in?next=/events/${event.slug}/join`} className="text-fg-heading underline-offset-2 hover:underline">Register</Link></p>
      </section>

      {user && mine.length > 0 && (
        <section className="mb-12 border border-line p-5">
          <h2 className="text-xl text-fg-heading">Your igloo</h2>
          <ul className="mt-4 space-y-4">
            {mine.map((m) => {
              const rows = standingsFor(h.stages, m.entries, m.status, now)
              return (
                <li key={m.id}>
                  <p className="text-fg-heading">{m.project.currentVersion?.name}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rows.map((row) => {
                      const stage = h.stages.find((s) => s.id === row.stageId)
                      return <li key={row.stageId} className="text-fg-body">{stage?.name}: {STANDING_LABEL[row.standing]}</li>
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mb-12 border border-line p-5">
        <h2 className="text-2xl text-fg-heading">Mountains</h2>
        <p className="mt-2 max-w-2xl text-fg-body">Each stage has its own dates and its own criteria. A later stage can require an advance, or stay open to teams that were not advanced.</p>
        <ol className="mt-4 space-y-6">
          {h.stages.map((s, i) => {
            const total = s.criteria.reduce((sum, c) => sum + c.weight, 0) || 1
            return (
              <li key={s.id} className="border-t border-line pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg text-fg-heading">{i + 1}. {s.name}</h3>
                  <StageStateBadge state={stageState(s, now)} />
                </div>
                <p className="mt-1 text-sm text-fg-muted">{formatEventRange(s.opensAt, s.closesAt, h.timezone)}</p>
                {i > 0 && (
                  <p className="mt-2 text-sm text-fg-body">{s.advancedOnly ? 'Only teams advanced from the previous stage can submit.' : 'Teams that were not advanced can still submit. A new team can also enter here without a previous submission.'}</p>
                )}
                {s.showCriteria && s.criteria.length > 0 && (
                  <ul className="mt-3 max-w-xl space-y-2 text-sm">
                    {s.criteria.map((c) => (
                      <li key={c.id}>
                        <span className="text-fg-heading">{c.name}</span>
                        <span className="text-fg-muted"> · weight {c.weight} ({Math.round((c.weight / total) * 100)}%)</span>
                        {c.description && <span className="block text-fg-muted">{c.description}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mb-12 border border-line p-5">
        <h2 className="text-2xl text-fg-heading">Tracks</h2>
        <p className="mt-2 max-w-2xl text-fg-body">Each track stores one sponsor name. A second sponsor for the same track is not a field in the Hub. The names below are placeholders.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {h.tracks.map((t) => (
            <li key={t.id} className="border border-line p-3">
              <p className="text-fg-heading">{t.name}</p>
              <p className="text-sm text-fg-muted">{t.sponsor ? `Sponsor slot: ${t.sponsor}` : 'No sponsor'}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12 border border-line p-5">
        <h2 className="text-2xl text-fg-heading">Judges</h2>
        {judges.length === 0 ? <p className="mt-2 text-fg-muted">No judges yet.</p> : (
          <ul className="mt-3 space-y-1 text-fg-body">
            {judges.map((j) => <li key={j.id}>{j.user?.name ?? 'Invited judge'}</li>)}
          </ul>
        )}
      </section>

      <section className="mb-12 border border-line p-5">
        <h2 className="text-2xl text-fg-heading">Stars</h2>
        <p className="mt-2 max-w-2xl text-fg-body">Winners are Hub awards. They show here after results are published. Amounts on this test say proposed.</p>
        {h.prizePool && <p className="mt-3 text-fg-heading">Prize pool: {h.prizePool}</p>}
        <ul className="mt-3 space-y-1 text-sm text-fg-body">
          {h.prizes.filter((p) => p.amount).map((p) => (
            <li key={p.id}>{p.title}{p.trackId ? ` (${h.tracks.find((t) => t.id === p.trackId)?.name})` : ''}: {p.amount}</li>
          ))}
        </ul>
        {published.length === 0 ? <p className="mt-4 text-sm text-fg-muted">No published winners yet.</p> : (
          <ul className="mt-4 space-y-2">
            {published.map(({ prize, award }) => (
              <li key={award.id} className="text-fg-heading">{prize.title}: {award.submission.entries[0]!.projectVersion.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
