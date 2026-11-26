import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { polarisAction } from './_components/aurora'
import { POLARIS_PRIZES, whatToDoNow } from './_lib/process'
import { loadPolarisContext, polarisCounts } from './_lib/queries'

export const metadata: Metadata = { title: 'Polaris' }

const NAMES = ['Stage 1: Hackathon', 'Stage 2: Accelerator', 'Stage 3: Finale'] as const

export default async function PolarisOverviewPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return <p className="text-sm text-fg-body">Run pnpm seed:polaris against local Postgres.</p>
  const now = new Date()
  const counts = await polarisCounts(ctx.h.id, ctx.h.teamSizeMax)
  const openIndex = ctx.h.stages.findIndex((s) => stageState(s, now) === 'open')
  const openName = openIndex === -1 ? null : NAMES[openIndex] ?? ctx.h.stages[openIndex]?.name ?? null
  const action = polarisAction(ctx.h, ctx.user, ctx.mine, now)
  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line p-4">
        <h2 className="text-lg text-fg-heading">Status and check-in</h2>
        <p className="mt-2 text-sm text-fg-body">Active stage: {openName ?? 'None open'}. Dates TBC.</p>
        <p className="mt-2 text-sm text-fg-body">{whatToDoNow(openName)}</p>
        <p className="mt-2 text-sm text-fg-body">You: {action.label}.</p>
        {action.href && <Link href={action.href} className="mt-3 inline-flex h-11 items-center rounded-md border border-line px-4 text-sm text-fg-heading">{action.label}</Link>}
      </section>
      <section className="rounded-md border border-line p-4">
        <h2 className="text-lg text-fg-heading">Live counts</h2>
        <ul className="mt-2 space-y-1 text-sm text-fg-body">
          <li>{counts.builders} registered builders</li>
          <li>{counts.teams} teams</li>
          <li>{counts.openSeats} teams with an open seat</li>
          <li>{counts.submissions} sealed stage submissions</li>
        </ul>
      </section>
      <section className="rounded-md border border-line p-4">
        <h2 className="text-lg text-fg-heading">Workflows</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li><Link className="text-fg-heading underline" href="/polaris/dens">Teams and projects</Link> - search teams, request a seat</li>
          <li><Link className="text-fg-heading underline" href="/polaris/lodge">Teammates</Link> - opt in and invite someone</li>
          <li><Link className="text-fg-heading underline" href="/polaris/stages">Stages and prizes</Link> - ${POLARIS_PRIZES.prizeTotal.toLocaleString('en-US')} proposed across {POLARIS_PRIZES.awards} awards</li>
          <li><Link className="text-fg-heading underline" href="/polaris/den">My team</Link> and <Link className="text-fg-heading underline" href="/polaris/enter">Submit</Link></li>
          <li><Link className="text-fg-heading underline" href="/polaris/review">Organiser queue</Link></li>
        </ul>
      </section>
    </div>
  )
}
