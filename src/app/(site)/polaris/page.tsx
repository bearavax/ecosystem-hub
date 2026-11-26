import type { Metadata } from 'next'
import Link from 'next/link'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { polarisAction } from './_components/aurora'
import { formatPurse, stagePurse } from './_lib/rules'
import { loadPolarisContext } from './_lib/queries'

export const metadata: Metadata = { title: 'Polaris' }

const STORY = [
  { name: 'Tundra', blurb: 'Hackathon' },
  { name: 'Mountains', blurb: 'Accelerator' },
  { name: 'Stars', blurb: 'Finale' },
] as const

export default async function PolarisLivePage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return <p className="text-sm text-fg-body">Run pnpm seed:polaris against local Postgres.</p>
  const now = new Date()
  const action = polarisAction(ctx.h, ctx.user, ctx.mine, now)
  return (
    <div className="space-y-5 text-white">
      <p className="text-[11px] text-sky-100">Avalanche C-Chain · Global builder journey · Dates TBC</p>
      <h1 className="text-5xl tracking-[-0.03em]">Polaris</h1>
      <p className="text-sm text-sky-50/90">A three-stage global builder journey from Tundra camp to Mountains to Stars.</p>
      <div className="flex flex-wrap items-center gap-2">
        {action.href ? (
          <Link href={action.href} className="inline-flex h-11 items-center rounded-lg bg-gradient-to-b from-white to-sky-100 px-5 text-sm text-[#07111F]">{action.label}</Link>
        ) : <p className="text-sm text-sky-50">{action.label}</p>}
        <Link href="/polaris/stages?stage=1" className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/10 px-4 text-sm text-sky-50">Explore stages →</Link>
      </div>
      <ol className="space-y-2">
        {ctx.h.stages.map((stage, i) => {
          const purse = stagePurse(ctx.h.prizes, stage.name)
          const state = stageState(stage, now)
          const live = state === 'open'
          return (
            <li key={stage.id}>
              <Link href={`/polaris/stages?stage=${i}`} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${live ? 'border-sky-300/50 bg-sky-400/15' : 'border-white/10 bg-white/5'}`}>
                <span>0{i + 1} · {STORY[i]?.name} · {formatPurse(purse.total)}</span>
                <span className="text-xs text-sky-100">{live ? 'Open' : state === 'upcoming' ? 'Upcoming' : 'Closed'}</span>
              </Link>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-sky-100/80">Quick jump</p>
        <Link href="/polaris/den" className="text-sm text-white underline-offset-2 hover:underline">Join a Den</Link>
        <Link href="/polaris/lodge" className="text-sm text-white underline-offset-2 hover:underline">Find teammates</Link>
        <Link href="/polaris/enter" className="text-sm text-white underline-offset-2 hover:underline">Submit</Link>
      </div>
    </div>
  )
}
