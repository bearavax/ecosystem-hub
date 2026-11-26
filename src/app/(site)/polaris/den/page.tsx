import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DecideButtons } from '../_components/wire-forms'
import { STANDING_LABEL, standingsFor } from '../_lib/rules'
import { listJoinRequests, loadPolarisContext } from '../_lib/queries'

async function SeatRequests({ hackathonId, projectId }: { hackathonId: string; projectId: string }) {
  const requests = await listJoinRequests(hackathonId, projectId)
  if (requests.length === 0) return <p className="mt-3 text-sm text-fg-muted">No pending requests to join.</p>
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {requests.map((person) => (
        <li key={person.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <span>{person.name} asked to join</span>
          <DecideButtons hackathonId={hackathonId} projectId={projectId} userId={person.userId} />
        </li>
      ))}
    </ul>
  )
}

export const metadata: Metadata = { title: 'My Den', robots: { index: false } }

export default async function DenPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  if (!ctx.user) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My team</h2>
        <p className="mt-2 text-sm text-fg-body">Register to start a den, or sign in if you already have one.</p>
        <Button asChild className="mt-4"><Link href="/sign-in?next=/events/polaris/join">Register</Link></Button>
      </section>
    )
  }
  if (!ctx.h.joined) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My team</h2>
        <p className="mt-2 text-sm text-fg-body">{ctx.h.registration === 'rejected' ? 'Registration was not accepted.' : 'You are signed in and not registered yet.'}</p>
        {ctx.h.registration !== 'rejected' && <Button asChild className="mt-4"><Link href="/events/polaris/join">Register</Link></Button>}
      </section>
    )
  }
  if (ctx.mine.length === 0) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My team</h2>
        <p className="mt-2 text-sm text-fg-body">You are registered. Submit an existing Hub project, or create a new one.</p>
        <Button asChild className="mt-4"><Link href="/polaris/enter">Submit project</Link></Button>
      </section>
    )
  }
  const now = new Date()
  return (
    <div className="space-y-4">
      <h2 className="text-xl text-fg-heading">My team</h2>
      {ctx.mine.map((m) => (
        <section key={m.id} className="rounded-md border border-line p-5">
          <h3 className="text-fg-heading">{m.project.currentVersion?.name}</h3>
          <ul className="mt-3 space-y-1 text-sm text-fg-body">
            {standingsFor(ctx.h.stages, m.entries, m.status, now).map((row) => {
              const stage = ctx.h.stages.find((s) => s.id === row.stageId)
              return <li key={row.stageId}>{stage?.name}: {STANDING_LABEL[row.standing]}</li>
            })}
          </ul>
          <Link href="/polaris/enter" className="mt-4 inline-flex min-h-11 items-center text-sm text-fg-heading underline-offset-2 hover:underline">Seal or update a submission</Link>
          {ctx.user && m.project.ownerId === ctx.user.id && <SeatRequests hackathonId={ctx.h.id} projectId={m.project.id} />}
        </section>
      ))}
    </div>
  )
}
