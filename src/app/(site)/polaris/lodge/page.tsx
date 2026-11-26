import type { Metadata } from 'next'
import { MatchingForm, InviteButton } from '../_components/wire-forms'
import { readAnswers } from '../_lib/process'
import { listOpenBuilders, loadPolarisContext } from '../_lib/queries'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Polaris teammates' }

export default async function LodgePage() {
  const ctx = await loadPolarisContext()
  if (!ctx) return null
  const profile = ctx.user ? await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { bio: true, skills: true } }) : null
  const me = ctx.user ? await prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId: ctx.h.id, userId: ctx.user.id } } }) : null
  const answers = readAnswers(me?.answers)
  const people = await listOpenBuilders(ctx.h.id)
  const owned = ctx.user ? await prisma.project.findMany({ where: { ownerId: ctx.user.id, submissions: { some: { hackathonId: ctx.h.id, status: 'active' } } }, select: { id: true, currentVersion: { select: { name: true } } } }) : []
  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line p-4">
        <h2 className="text-lg text-fg-heading">Teammates</h2>
        <p className="mt-2 text-sm text-fg-body">Opt in if you want a team. Skills and bio are your Hub profile. Timezone is stored on your Polaris registration. Dates TBC.</p>
        {ctx.user && me?.status === 'active' ? (
          <div className="mt-4">
            <MatchingForm hackathonId={ctx.h.id} openToTeam={answers.openToTeam} timezone={answers.timezone} bio={profile?.bio ?? ''} skills={profile?.skills.join(', ') ?? ''} />
          </div>
        ) : <p className="mt-3 text-sm text-fg-muted">Register before you can opt in.</p>}
      </section>
      <section>
        <h2 className="text-lg text-fg-heading">Builders open to a team</h2>
        <ul className="mt-3 space-y-3">
          {people.length === 0 && <li className="text-sm text-fg-muted">Nobody is open to a team yet.</li>}
          {people.map((person) => (
            <li key={person.userId} className="rounded-md border border-line p-3 text-sm">
              <p className="text-fg-heading">{person.name}</p>
              <p className="text-fg-muted">{person.timezone || 'Timezone not set'}</p>
              <p className="text-fg-body">{person.skills.join(', ') || 'No skills listed'}</p>
              <p className="text-fg-body">{person.bio || 'No bio'}</p>
              {owned[0] && person.userId !== ctx.user?.id && (
                <div className="mt-2"><InviteButton hackathonId={ctx.h.id} projectId={owned[0].id} userId={person.userId} /></div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-fg-muted">An invite is a normal project invite. The builder accepts it from their Hub projects page. The token is not shown here.</p>
      </section>
    </div>
  )
}
