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
import { SectionTabs } from './section-tabs'

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

  const tabs: { id: string; label: string; panel: ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      panel: (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-fg-muted">Team size</dt><dd className="text-fg-heading">{h.teamSizeMin}{h.teamSizeMax ? ` to ${h.teamSizeMax}` : '+'}</dd></div>
            <div><dt className="text-fg-muted">Registered</dt><dd className="text-fg-heading">{h._count.participants}</dd></div>
            <div><dt className="text-fg-muted">Submissions</dt><dd className="text-fg-heading">{h._count.submissions}</dd></div>
          </dl>
          <p className="text-sm text-fg-body">Register, then submit a Hub project. A new project is stored as a normal project.</p>
          {h.aboutMd && (
            <details className="text-sm">
              <summary className="cursor-pointer text-fg-heading">About</summary>
              <div className="mt-3 max-w-2xl"><Markdown>{h.aboutMd}</Markdown></div>
            </details>
          )}
        </div>
      ),
    },
    {
      id: 'tracks',
      label: 'Tracks',
      panel: (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {h.tracks.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-4">
              <p className="text-fg-heading">{t.name}</p>
              <p className="mt-1 text-sm text-fg-muted">{t.sponsor ?? 'No sponsor'}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'prizes',
      label: 'Prizes',
      panel: (
        <div className="space-y-3">
          {h.prizePool && <p className="text-sm text-fg-muted">Prize pool: <span className="text-fg-heading">{h.prizePool}</span></p>}
          <table className="w-full text-left text-sm">
            <thead className="text-fg-muted"><tr><th className="py-1 font-medium">Prize</th><th className="py-1 font-medium">Track</th><th className="py-1 font-medium">Amount</th></tr></thead>
            <tbody>
              {listed.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 text-fg-heading">{p.title}</td>
                  <td className="py-2 text-fg-body">{p.trackId ? h.tracks.find((t) => t.id === p.trackId)?.name : 'Overall'}</td>
                  <td className="py-2 text-fg-body">{p.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {winners.length > 0 && (
            <ul className="text-sm text-fg-body">
              {winners.map((w) => <li key={w.title + w.name}>{w.title}: {w.name}</li>)}
            </ul>
          )}
        </div>
      ),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      panel: (
        <div className="space-y-2">
          {h.stages.map((s, i) => {
            const state = stageState(s, now)
            const total = s.criteria.reduce((sum, c) => sum + c.weight, 0) || 1
            return (
              <details key={s.id} open={state === 'open'} className="rounded-lg border border-line px-3 py-2">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="text-fg-heading">{s.name}</span>
                  <span className="text-fg-muted">{formatShortDate(s.opensAt, h.timezone)} to {formatShortDate(s.closesAt, h.timezone)}</span>
                  <StageStateBadge state={state} />
                </summary>
                <div className="mt-3">
                  {i > 0 && <p className="mb-2 text-xs text-fg-muted">{s.advancedOnly ? 'Advanced teams only.' : 'Teams that were not advanced can still enter.'}</p>}
                  {s.showCriteria && s.criteria.length > 0 && (
                    <table className="w-full max-w-lg text-left text-sm">
                      <thead className="text-fg-muted"><tr><th className="py-1 font-medium">Criterion</th><th className="py-1 font-medium">Weight</th><th className="py-1 text-right font-medium">Share</th></tr></thead>
                      <tbody>
                        {s.criteria.map((c) => (
                          <tr key={c.id} className="border-t border-line">
                            <td className="py-1.5 text-fg-heading">{c.name}{c.description && <span className="mt-0.5 block text-xs font-normal text-fg-muted">{c.description}</span>}</td>
                            <td className="py-1.5 text-fg-body">{c.weight}</td>
                            <td className="py-1.5 text-right text-fg-body">{Math.round((c.weight / total) * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      ),
    },
    {
      id: 'judges',
      label: 'Judges',
      panel: h.judges.length === 0 ? <p className="text-sm text-fg-muted">No judges yet.</p> : (
        <ul className="flex flex-wrap gap-4">
          {h.judges.map((j) => {
            const name = j.user?.name ?? 'Invited judge'
            return (
              <li key={j.id} className="flex w-28 flex-col items-center text-center">
                <span className="grid size-10 place-items-center rounded-full border border-info/40 bg-surface-2 text-xs text-info" aria-hidden>{initials(name)}</span>
                <span className="mt-2 text-sm text-fg-heading">{name}</span>
              </li>
            )
          })}
        </ul>
      ),
    },
  ]
  if (resources.length) {
    tabs.push({
      id: 'resources',
      label: 'Resources',
      panel: (
        <ul className="grid gap-2 sm:grid-cols-2">
          {resources.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer" className="block rounded-lg border border-line px-3 py-2 hover:border-info/40">
                <span className="text-sm text-fg-heading">{l.label}</span>
                {l.body && <span className="mt-0.5 block text-xs text-fg-muted">{l.body}</span>}
              </a>
            </li>
          ))}
        </ul>
      ),
    })
  }
  if (h.rulesMd) {
    tabs.push({
      id: 'rules',
      label: 'Rules',
      panel: <div className="max-w-2xl text-sm"><Markdown>{h.rulesMd}</Markdown></div>,
    })
  }

  return (
    <div className="container-page py-6">
      <header>
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
          {action.href ? <Button asChild size="lg"><Link href={action.href}>{action.label}</Link></Button> : <p className="text-sm text-fg-body">{action.label}</p>}
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
        <div className="mt-5 grid gap-4 border-t border-info/30 pt-3 sm:grid-cols-[9rem_1fr_9rem]">
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
      <div className="mt-4">
        <SectionTabs tabs={tabs} />
      </div>
    </div>
  )
}
