import Link from 'next/link'
import type { CurrentUser } from '@/lib/session'
import type { getMySubmissions, PublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { advancedStageIds, pickOpenStage, stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { STANDING_LABEL, standingsFor } from '../_lib/rules'

type Mine = Awaited<ReturnType<typeof getMySubmissions>>

function actionFor(h: PublicHackathon, user: CurrentUser | null, mine: Mine, now: Date): { href?: string; label: string } {
  const open = h.stages[pickOpenStage(h.stages, now, advancedStageIds(mine))]
  if (!user) return { href: '/sign-in?next=/events/polaris/join', label: 'Register' }
  if (!h.joined) {
    if (h.registration === 'pending') return { label: 'Registration pending' }
    if (h.registration === 'rejected') return { label: 'Registration was not accepted' }
    return { href: '/events/polaris/join', label: 'Register' }
  }
  if (open) return { href: '/polaris/enter', label: 'Submit project' }
  return { label: 'You are registered' }
}

const stateLabel = { open: 'Open for submissions', judging: 'Judging', upcoming: 'Upcoming', closed: 'Closed' } as const

export function Aurora({ h, user, mine }: { h: PublicHackathon; user: CurrentUser | null; mine: Mine }) {
  const now = new Date()
  const action = actionFor(h, user, mine, now)
  const current = h.stages.find((s) => stageState(s, now) === 'open') ?? h.stages.find((s) => stageState(s, now) === 'upcoming') ?? h.stages.at(-1)
  const index = current ? h.stages.findIndex((s) => s.id === current.id) : -1
  const state = current ? stageState(current, now) : null
  const mineStanding = user && mine[0] ? standingsFor(h.stages, mine[0].entries, mine[0].status, now) : null
  const yours = mineStanding?.find((r) => r.standing === 'can_submit' || r.standing === 'submitted' || r.standing === 'in_review') ?? mineStanding?.[0]
  return (
    <header className="relative min-h-[320px] md:h-[320px] md:min-h-0">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(3,8,18,0.84)_0%,rgba(3,8,18,0.42)_32%,rgba(3,8,18,0.08)_56%,transparent_74%)]" />
      <div className="relative flex h-full flex-col justify-end px-6 pb-6 pt-8 sm:px-8 sm:pb-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-300/30 bg-[#07111F]/40 px-2.5 py-1 text-[11px] text-sky-100">Avalanche C-Chain · Global builder journey</span>
          <span className="rounded-full border border-white/15 bg-[#07111F]/40 px-2.5 py-1 text-[11px] text-sky-100/80">Dates TBC</span>
        </div>
        <h1 className="mt-3 text-5xl tracking-[-0.03em] text-white sm:text-6xl">Polaris</h1>
        <p className="mt-2 max-w-xl text-sm text-sky-50/90 sm:text-base">A three-stage global builder journey from Tundra camp to Mountains to Stars.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {current && state && (
            <span className="rounded-full border border-sky-300/40 bg-sky-400/15 px-3 py-1 text-xs text-sky-50">
              Stage {index + 1}: {current.name} · {stateLabel[state]}
            </span>
          )}
          {yours && <span className="rounded-full border border-amber-200/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">Your standing: {STANDING_LABEL[yours.standing]}</span>}
          {action.href ? (
            <Link href={action.href} className="inline-flex h-11 items-center rounded-lg bg-gradient-to-b from-white to-sky-100 px-5 text-sm text-[#07111F] shadow-[0_0_28px_rgba(56,189,248,0.45)]">{action.label}</Link>
          ) : <p className="text-sm text-sky-50">{action.label}</p>}
          <Link href="/polaris/stages" className="inline-flex h-11 items-center text-sm text-amber-200 hover:text-amber-100">Explore stages</Link>
        </div>
      </div>
    </header>
  )
}
