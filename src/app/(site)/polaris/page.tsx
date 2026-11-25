import type { Metadata } from 'next'
import { getMySubmissions, getPublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { getPublicEvent } from '@/app/(site)/events/_lib/queries'
import { PageHeader } from '@/components/layout/page-header'
import { getCurrentUser } from '@/lib/session'
import { PolarisPublic } from './_components/public-view'
import { POLARIS_SLUG } from './_lib/rules'

export const metadata: Metadata = { title: 'Polaris' }

export default async function PolarisPage() {
  const user = await getCurrentUser()
  const event = await getPublicEvent(POLARIS_SLUG)
  const h = event ? await getPublicHackathon(event.id, user?.id ?? null) : null
  if (!event || !h) {
    return (
      <div className="container-page py-12">
        <PageHeader title="Polaris" description="The local test hackathon is not in this database yet." />
        <p className="max-w-xl text-fg-body">From the repo root, with Postgres running and `.env` pointing at it, run <code className="text-fg-heading">pnpm seed:polaris</code>.</p>
      </div>
    )
  }
  const mine = user ? await getMySubmissions(h.id, user.id) : []
  return <PolarisPublic event={event} h={h} user={user} mine={mine} />
}
