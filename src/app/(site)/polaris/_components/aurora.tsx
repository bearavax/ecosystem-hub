import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  if (open) return { href: '/polaris/enter', label: 'Submit' }
  return { label: 'You are registered' }
}

export function Aurora({ h, user, mine }: { h: PublicHackathon; user: CurrentUser | null; mine: Mine }) {
  const now = new Date()
  const action = actionFor(h, user, mine, now)
  const current = h.stages.find((s) => stageState(s, now) === 'open') ?? h.stages.find((s) => stageState(s, now) === 'upcoming') ?? h.stages.at(-1)
  const index = current ? h.stages.findIndex((s) => s.id === current.id) : -1
  const state = current ? stageState(current, now) : null
  const mineStanding = user && mine[0] ? standingsFor(h.stages, mine[0].entries, mine[0].status, now) : null
  const yours = mineStanding?.find((r) => r.standing === 'can_submit' || r.standing === 'submitted' || r.standing === 'in_review') ?? mineStanding?.[0]
  return (
    <header className="relative overflow-hidden rounded-xl border border-sky-400/25">
      {/* eslint-disable-next-line @next/next/no-img-element -- local polaris still */}
      <img src="/polaris/snow-1-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_40%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B0A0F]/92 via-[#0B0A0F]/78 to-[#0c1924]/60" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl text-white sm:text-2xl">Polaris</h1>
          {current && state && (
            <span className="rounded-full border border-sky-400/40 bg-sky-400/15 px-2.5 py-1 text-xs text-sky-100">
              Stage {index + 1}: {current.name} · {state === 'open' ? 'Open' : state === 'judging' ? 'Judging' : state === 'upcoming' ? 'Upcoming' : 'Closed'}
            </span>
          )}
          {yours && <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-xs text-sky-100">Your standing: {STANDING_LABEL[yours.standing]}</span>}
          <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-xs text-sky-100/80">Dates TBC</span>
        </div>
        {action.href ? <Button asChild><Link href={action.href}>{action.label}</Link></Button> : <p className="text-sm text-sky-100">{action.label}</p>}
      </div>
    </header>
  )
}
