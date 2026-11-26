import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { STANDING_LABEL, standingsFor } from '../_lib/rules'
import { loadPolarisContext } from '../_lib/queries'

export const metadata: Metadata = { title: 'My Den', robots: { index: false } }

export default async function DenPage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  if (!ctx.user) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My Den</h2>
        <p className="mt-2 text-sm text-fg-body">Register to start a den, or sign in if you already have one.</p>
        <Button asChild className="mt-4"><Link href="/sign-in?next=/events/polaris/join">Register</Link></Button>
      </section>
    )
  }
  if (!ctx.h.joined) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My Den</h2>
        <p className="mt-2 text-sm text-fg-body">{ctx.h.registration === 'rejected' ? 'Registration was not accepted.' : 'You are signed in and not registered yet.'}</p>
        {ctx.h.registration !== 'rejected' && <Button asChild className="mt-4"><Link href="/events/polaris/join">Register</Link></Button>}
      </section>
    )
  }
  if (ctx.mine.length === 0) {
    return (
      <section className="rounded-xl border border-line p-6">
        <h2 className="text-xl text-fg-heading">My Den</h2>
        <p className="mt-2 text-sm text-fg-body">You are registered. Submit an existing Hub project, or create a new one.</p>
        <Button asChild className="mt-4"><Link href="/polaris/enter">Submit project</Link></Button>
      </section>
    )
  }
  const now = new Date()
  return (
    <div className="space-y-4">
      <h2 className="text-xl text-fg-heading">My Den</h2>
      {ctx.mine.map((m) => (
        <section key={m.id} className="rounded-xl border border-line p-5">
          <h3 className="text-fg-heading">{m.project.currentVersion?.name}</h3>
          <ul className="mt-3 space-y-1 text-sm text-fg-body">
            {standingsFor(ctx.h.stages, m.entries, m.status, now).map((row) => {
              const stage = ctx.h.stages.find((s) => s.id === row.stageId)
              return <li key={row.stageId}>{stage?.name}: {STANDING_LABEL[row.standing]}</li>
            })}
          </ul>
          <Link href="/polaris/enter" className="mt-4 inline-flex min-h-11 items-center text-sm text-fg-heading underline-offset-2 hover:underline">Update submission</Link>
        </section>
      ))}
    </div>
  )
}
