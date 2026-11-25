import Link from 'next/link'
import type { ReactNode } from 'react'
import { Markdown } from '@/components/markdown'
import { StageStateBadge } from '@/components/stage-state-badge'
import { Button } from '@/components/ui/button'
import { BUILDER_HUB_LINKS } from '@/lib/builder-hub'
import { formatEventRange, formatShortDate } from '@/lib/dates'
import { readLinks } from '@/lib/link-schemas'
import type { CurrentUser } from '@/lib/session'
import { can } from '@/lib/permissions'
import { getEventHackathonRoles, getMySubmissions, type PublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { advancedStageIds, canManageHackathon, pickOpenStage, stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { STANDING_LABEL, standingsFor } from '../_lib/rules'

type Mine = Awaited<ReturnType<typeof getMySubmissions>>
type EventBits = {
  id: string
  slug: string
  name: string
  startAt: Date
  endAt: Date | null
  timezone: string
  isOnline: boolean
  city: string | null
  country: string | null
}

const NAV = [
  ['schedule', 'Schedule'],
  ['tracks', 'Tracks'],
  ['prizes', 'Prizes'],
  ['submit', 'Submit'],
  ['criteria', 'Criteria'],
  ['judges', 'Judges'],
  ['sponsors', 'Sponsors'],
  ['resources', 'Resources'],
  ['rules', 'Rules'],
  ['faq', 'FAQ'],
] as const

function primaryAction(event: EventBits, h: PublicHackathon, user: CurrentUser | null, mine: Mine, now: Date): { href?: string; label: string } {
  const open = h.stages[pickOpenStage(h.stages, now, advancedStageIds(mine))]
  if (!user) return { href: `/sign-in?next=/events/${event.slug}/join`, label: 'Register' }
  if (!h.joined) {
    if (h.registration === 'pending') return { label: 'Registration pending' }
    if (h.registration === 'rejected') return { label: 'Registration was not accepted' }
    if (h.registrationClosesAt && now >= h.registrationClosesAt) return { label: 'Registration is closed' }
    if (h.maxParticipants != null && h._count.participants >= h.maxParticipants) return { label: 'This hackathon is full' }
    return { href: `/events/${event.slug}/join`, label: 'Register' }
  }
  if (open) return { href: '/polaris/enter', label: 'Enter' }
  return { label: 'You are registered' }
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[1]![0] : '')).toUpperCase()
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-line py-14">
      <h2 className="text-2xl text-fg-heading">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export async function PolarisPublic({ event, h, user, mine }: { event: EventBits; h: PublicHackathon; user: CurrentUser | null; mine: Mine }) {
  const now = new Date()
  const action = primaryAction(event, h, user, mine, now)
  const roles = user ? await getEventHackathonRoles(event.id, user.id) : null
  const manage = !!user && (can(user, 'hackathons.manage') || canManageHackathon(user, roles?.organizers ?? []))
  const judge = !!roles?.judges.length
  const current = h.stages.find((s) => stageState(s, now) === 'open') ?? h.stages.find((s) => stageState(s, now) === 'upcoming') ?? h.stages.at(-1)
  const where = event.isOnline ? 'Online' : [event.city, event.country].filter(Boolean).join(', ')
  const winners = h.resultsPublishedAt
    ? h.prizes.flatMap((p) => p.awards.filter((a) => a.submission.status === 'active' && a.submission.entries[0]).map((a) => ({ title: p.title, name: a.submission.entries[0]!.projectVersion.name })))
    : []
  const resources = [
    ...readLinks(h.resourceLinks).map((l) => ({ href: l.url, label: l.label, body: '' })),
    ...(h.showBuilderHubLinks ? BUILDER_HUB_LINKS.map((l) => ({ href: l.href, label: l.label, body: l.body })) : []),
  ]
  const listed = h.prizes.filter((p) => p.amount)
  const cta = action.href
    ? <Button asChild size="lg"><Link href={action.href}>{action.label}</Link></Button>
    : <p className="text-sm text-fg-body">{action.label}</p>

  return (
    <div className="container-page pb-8">
      <header className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl text-fg-heading sm:text-4xl">{event.name}</h1>
            {h.tagline && <p className="mt-1 max-w-xl text-fg-body">{h.tagline}</p>}
            <p className="mt-2 text-sm text-fg-muted">
              {formatEventRange(event.startAt, event.endAt, event.timezone)}
              {where ? ` · ${where}` : ''}
              {h.registrationClosesAt ? ` · Register until ${formatShortDate(h.registrationClosesAt, h.timezone)}` : ''}
            </p>
            {current && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fg-body">
                <span>Now: {current.name}</span>
                <StageStateBadge state={stageState(current, now)} />
                <span className="text-fg-muted">closes {formatShortDate(current.closesAt, h.timezone)}</span>
              </p>
            )}
          </div>
          {cta}
        </div>
        {user && mine.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-fg-body">
            {mine.map((m) => (
              <li key={m.id}>
                {m.project.currentVersion?.name}
                {standingsFor(h.stages, m.entries, m.status, now).map((row) => {
                  const stage = h.stages.find((s) => s.id === row.stageId)
                  return <span key={row.stageId}> · {stage?.name}: {STANDING_LABEL[row.standing]}</span>
                })}
              </li>
            ))}
          </ul>
        )}
        {(manage || judge) && (
          <p className="mt-2 flex gap-4 text-sm">
            {manage && <Link href="/polaris/review" className="text-fg-muted underline-offset-2 hover:text-fg-heading hover:underline">Review queue</Link>}
            {manage && <Link href={`/manage/hackathons/${h.id}`} className="text-fg-muted underline-offset-2 hover:text-fg-heading hover:underline">Manage</Link>}
            {judge && <Link href={`/judge/${h.id}`} className="text-fg-muted underline-offset-2 hover:text-fg-heading hover:underline">Judge</Link>}
          </p>
        )}
        <div className="mt-6 grid gap-4 border-t border-info/30 pt-3 sm:grid-cols-[9rem_1fr_9rem]">
          <div>
            <p className="text-xs text-info">Tundra</p>
            <p className="mt-1 text-sm text-fg-heading">Register</p>
            <p className="text-xs text-fg-muted">{h.registrationClosesAt ? `until ${formatShortDate(h.registrationClosesAt, h.timezone)}` : 'Open'}</p>
          </div>
          <div>
            <p className="text-xs text-info">Mountains</p>
            <ol className="mt-1 grid gap-2 sm:grid-cols-3">
              {h.stages.map((s) => {
                const state = stageState(s, now)
                return (
                  <li key={s.id}>
                    <p className={state === 'open' ? 'text-sm text-fg-heading' : 'text-sm text-fg-muted'}>{s.name}</p>
                    <p className="text-xs text-fg-muted">{formatShortDate(s.closesAt, h.timezone)}</p>
                  </li>
                )
              })}
            </ol>
          </div>
          <div>
            <p className="text-xs text-info">Stars</p>
            <p className="mt-1 text-sm text-fg-heading">{winners[0]?.name ?? 'Winners'}</p>
            <p className="text-xs text-fg-muted">{winners.length ? winners[0]!.title : 'After results'}</p>
          </div>
        </div>
      </header>

      <nav aria-label="On this page" className="sticky top-16 z-30 -mx-4 border-y border-line bg-surface-0/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-11 items-center px-3 text-sm whitespace-nowrap text-fg-muted hover:text-fg-heading">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="schedule" title="Schedule">
        <div className="grid gap-8 lg:grid-cols-[12rem_1fr_12rem]">
          <div>
            <p className="text-xs text-info">Tundra</p>
            <p className="mt-2 text-fg-heading">Registration</p>
            <p className="mt-1 text-sm text-fg-muted">{h.registrationOpensAt && h.registrationClosesAt ? formatEventRange(h.registrationOpensAt, h.registrationClosesAt, h.timezone) : 'Open'}</p>
            <p className="mt-2 text-sm text-fg-body">Teams of {h.teamSizeMin}{h.teamSizeMax ? ` to ${h.teamSizeMax}` : ' or more'}.</p>
          </div>
          <div>
            <p className="text-xs text-info">Mountains</p>
            <ol className="mt-3 grid gap-3">
              {h.stages.map((s, i) => (
                <li key={s.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-fg-heading">{i + 1}. {s.name}</h3>
                    <StageStateBadge state={stageState(s, now)} />
                  </div>
                  <p className="mt-2 text-sm text-fg-muted">{formatEventRange(s.opensAt, s.closesAt, h.timezone)}</p>
                  {i > 0 && <p className="mt-2 text-sm text-fg-body">{s.advancedOnly ? 'Advanced teams only.' : 'Open to teams that were not advanced.'}</p>}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs text-info">Stars</p>
            <p className="mt-2 text-fg-heading">{winners.length ? 'Published' : 'Not published'}</p>
            <ul className="mt-2 space-y-1 text-sm text-fg-body">
              {winners.length === 0 && <li>Winners show here after results are published.</li>}
              {winners.map((w) => <li key={w.title + w.name}>{w.name}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="tracks" title="Tracks">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {h.tracks.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-5">
              <h3 className="text-lg text-fg-heading">{t.name}</h3>
              <p className="mt-2 text-sm text-fg-muted">{t.sponsor ?? 'No sponsor yet'}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="prizes" title="Prizes">
        {h.prizePool && <p className="mb-4 text-sm text-fg-muted">Prize pool <span className="text-fg-heading">{h.prizePool}</span></p>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {listed.map((p) => (
            <li key={p.id} className="rounded-xl border border-line p-5">
              <p className="text-2xl text-fg-heading">{p.amount}</p>
              <h3 className="mt-2 text-fg-heading">{p.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{p.trackId ? h.tracks.find((t) => t.id === p.trackId)?.name : 'Overall'}</p>
            </li>
          ))}
        </ul>
        {winners.length > 0 && (
          <ul className="mt-6 space-y-1 text-sm text-fg-body">
            {winners.map((w) => <li key={w.title + w.name}>{w.title}: {w.name}</li>)}
          </ul>
        )}
      </Section>

      <Section id="submit" title="How to submit">
        <ol className="grid gap-4 md:grid-cols-3">
          <li className="rounded-xl border border-line p-5">
            <p className="text-xs text-fg-muted">1</p>
            <h3 className="mt-2 text-fg-heading">Register</h3>
            <p className="mt-2 text-sm text-fg-body">Your profile needs a name, a country, and a role. {h._count.participants} people are registered.</p>
          </li>
          <li className="rounded-xl border border-line p-5">
            <p className="text-xs text-fg-muted">2</p>
            <h3 className="mt-2 text-fg-heading">Form the team</h3>
            <p className="mt-2 text-sm text-fg-body">The team is the Hub project. Owner and writers count. Everyone on the team must be registered.</p>
          </li>
          <li className="rounded-xl border border-line p-5">
            <p className="text-xs text-fg-muted">3</p>
            <h3 className="mt-2 text-fg-heading">Submit the project</h3>
            <p className="mt-2 text-sm text-fg-body">Use a project you already have, or create one. Both are normal Hub projects. {h._count.submissions} submitted.</p>
          </li>
        </ol>
      </Section>

      <Section id="criteria" title="Judging criteria">
        <div className="grid gap-4 lg:grid-cols-3">
          {h.stages.map((s) => {
            const total = s.criteria.reduce((sum, c) => sum + c.weight, 0) || 1
            return (
              <article key={s.id} className="rounded-xl border border-line p-5">
                <h3 className="text-fg-heading">{s.name}</h3>
                <p className="mt-1 text-xs text-fg-muted">Scored 0 to {s.scaleMax}</p>
                {s.showCriteria && s.criteria.length > 0 ? (
                  <table className="mt-3 w-full text-left text-sm">
                    <thead className="text-fg-muted"><tr><th className="py-1 font-medium">Criterion</th><th className="py-1 text-right font-medium">Weight</th></tr></thead>
                    <tbody>
                      {s.criteria.map((c) => (
                        <tr key={c.id} className="border-t border-line">
                          <td className="py-2 text-fg-heading">{c.name}<span className="mt-0.5 block text-xs font-normal text-fg-muted">{Math.round((c.weight / total) * 100)}%{c.description ? ` · ${c.description}` : ''}</span></td>
                          <td className="py-2 text-right text-fg-body">{c.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="mt-3 text-sm text-fg-muted">Criteria are hidden for this stage.</p>}
              </article>
            )
          })}
        </div>
      </Section>

      <Section id="judges" title="Judges">
        {h.judges.length === 0 ? <p className="text-sm text-fg-muted">No judges yet.</p> : (
          <ul className="flex flex-wrap gap-6">
            {h.judges.map((j) => {
              const name = j.user?.name ?? 'Invited judge'
              return (
                <li key={j.id} className="flex w-28 flex-col items-center text-center">
                  <span className="grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-sm text-fg-heading" aria-hidden>{initials(name)}</span>
                  <span className="mt-2 text-sm text-fg-heading">{name}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section id="sponsors" title="Sponsors">
        <p className="mb-4 text-sm text-fg-muted">Each track has one sponsor slot. These names are placeholders.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {h.tracks.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-5">
              <p className="text-xs text-fg-muted">{t.name}</p>
              <p className="mt-2 text-lg text-fg-heading">{t.sponsor ?? 'Empty slot'}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="resources" title="Resources">
        {resources.length === 0 ? <p className="text-sm text-fg-muted">No links yet.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {resources.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="block rounded-xl border border-line p-4 hover:border-line">
                  <span className="text-fg-heading">{l.label}</span>
                  {l.body && <span className="mt-1 block text-sm text-fg-muted">{l.body}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="rules" title="Rules">
        {h.rulesMd ? <div className="max-w-2xl"><Markdown>{h.rulesMd}</Markdown></div> : <p className="text-sm text-fg-muted">No rules text yet.</p>}
      </Section>

      <Section id="faq" title="FAQ">
        <p className="text-sm text-fg-muted">Placeholder. This hackathon has no FAQ field, so no questions are listed.</p>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-14">
        <p className="text-lg text-fg-heading">{event.name}</p>
        {cta}
      </div>
    </div>
  )
}
