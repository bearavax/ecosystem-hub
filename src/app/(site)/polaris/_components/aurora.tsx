import Link from 'next/link'
import { StageStateBadge } from '@/components/stage-state-badge'
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
  if (open) return { href: '/polaris/enter', label: 'Submit project' }
  return { label: 'You are registered' }
}

export function Aurora({ h, user, mine }: { h: PublicHackathon; user: CurrentUser | null; mine: Mine }) {
  const now = new Date()
  const action = actionFor(h, user, mine, now)
  const current = h.stages.find((s) => stageState(s, now) === 'open') ?? h.stages.find((s) => stageState(s, now) === 'upcoming') ?? h.stages.at(-1)
  const index = current ? h.stages.findIndex((s) => s.id === current.id) : -1
  const mineStanding = user && mine[0] ? standingsFor(h.stages, mine[0].entries, mine[0].status, now) : null
  return (
    <header className="rounded-xl border border-info/30 bg-[linear-gradient(100deg,rgba(37,99,235,0.16),transparent_55%)] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl text-fg-heading sm:text-3xl">Polaris</h1>
          {h.tagline && <p className="mt-1 max-w-xl text-sm text-fg-body">{h.tagline}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-line px-2 py-1 text-fg-muted">Dates TBC</span>
            {current && (
              <span className="inline-flex items-center gap-2 rounded-full border border-line px-2 py-1 text-fg-heading">
                Stage {index + 1}: {current.name}
                <StageStateBadge state={stageState(current, now)} />
              </span>
            )}
            {mineStanding && <span className="rounded-full border border-line px-2 py-1 text-fg-muted">Your standing: {STANDING_LABEL[mineStanding.find((r) => r.standing === 'can_submit' || r.standing === 'submitted' || r.standing === 'in_review')?.standing ?? mineStanding[0]!.standing]}</span>}
          </div>
        </div>
        {action.href ? <Button asChild><Link href={action.href}>{action.label}</Link></Button> : <p className="text-sm text-fg-body">{action.label}</p>}
      </div>
    </header>
  )
}
