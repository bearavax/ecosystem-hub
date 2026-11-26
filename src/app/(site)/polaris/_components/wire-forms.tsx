'use client'

import { decideJoin, inviteToTeam, requestToJoin, saveMatchingProfile, scoreEntry, setActiveStage } from '../_lib/actions'
import { useActionToast } from '@/hooks/use-action-toast'

export function MatchingForm({ hackathonId, openToTeam, timezone, bio, skills }: { hackathonId: string; openToTeam: boolean; timezone: string; bio: string; skills: string }) {
  const { pending, run } = useActionToast()
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault()
      const data = new FormData(e.currentTarget)
      void run(() => saveMatchingProfile({
        hackathonId,
        openToTeam: data.get('openToTeam') === 'on',
        timezone: String(data.get('timezone') ?? ''),
        bio: String(data.get('bio') ?? ''),
        skills: String(data.get('skills') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      }), 'Matching profile saved')
    }}>
      <label className="flex min-h-11 items-center gap-2 text-sm text-fg-body">
        <input type="checkbox" name="openToTeam" defaultChecked={openToTeam} />
        I am open to joining a team
      </label>
      <label className="block text-sm text-fg-muted">Timezone (IANA, for example UTC)
        <input name="timezone" defaultValue={timezone} className="mt-1 h-11 w-full rounded-md border border-line bg-transparent px-3 text-fg-heading" />
      </label>
      <label className="block text-sm text-fg-muted">Skills, comma separated
        <input name="skills" defaultValue={skills} className="mt-1 h-11 w-full rounded-md border border-line bg-transparent px-3 text-fg-heading" />
      </label>
      <label className="block text-sm text-fg-muted">Bio
        <textarea name="bio" defaultValue={bio} rows={3} className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-2 text-fg-heading" />
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm text-fg-heading">Save</button>
    </form>
  )
}

export function RequestJoinButton({ hackathonId, projectId }: { hackathonId: string; projectId: string }) {
  const { pending, run } = useActionToast()
  return <button type="button" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm text-fg-heading" onClick={() => void run(() => requestToJoin({ hackathonId, projectId }), 'Request sent')}>Request to join</button>
}

export function DecideButtons({ hackathonId, projectId, userId }: { hackathonId: string; projectId: string; userId: string }) {
  const { pending, run } = useActionToast()
  return (
    <span className="flex gap-2">
      <button type="button" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm" onClick={() => void run(() => decideJoin({ hackathonId, projectId, userId, accept: true }), 'Approved')}>Approve</button>
      <button type="button" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm" onClick={() => void run(() => decideJoin({ hackathonId, projectId, userId, accept: false }), 'Declined')}>Decline</button>
    </span>
  )
}

export function InviteButton({ hackathonId, projectId, userId }: { hackathonId: string; projectId: string; userId: string }) {
  const { pending, run } = useActionToast()
  return <button type="button" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm text-fg-heading" onClick={() => void run(() => inviteToTeam({ hackathonId, projectId, userId }), 'Invite created')}>Invite to team</button>
}

export function StageSwitch({ hackathonId }: { hackathonId: string }) {
  const { pending, run } = useActionToast()
  return (
    <div className="flex flex-wrap gap-2">
      {(['Stage 1: Hackathon', 'Stage 2: Accelerator', 'Stage 3: Finale'] as const).map((label, index) => (
        <button key={label} type="button" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm text-fg-heading" onClick={() => void run(() => setActiveStage({ hackathonId, index: index as 0 | 1 | 2 }), `${label} is now the open stage`)}>{label}</button>
      ))}
    </div>
  )
}

export function ScoreForm({ hackathonId, entryId, criteria }: { hackathonId: string; entryId: string; criteria: { id: string; name: string; weight: number }[] }) {
  const { pending, run } = useActionToast()
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault()
      const data = new FormData(e.currentTarget)
      const scores = Object.fromEntries(criteria.map((c) => [c.id, Number(data.get(c.id))]))
      void run(() => scoreEntry({ hackathonId, entryId, scores }), 'Scores saved')
    }}>
      {criteria.map((c) => (
        <label key={c.id} className="text-xs text-fg-muted">{c.name} ({c.weight})
          <input name={c.id} type="number" min={0} max={10} required className="mt-1 block h-11 w-20 rounded-md border border-line bg-transparent px-2 text-fg-heading" />
        </label>
      ))}
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-md border border-line px-3 text-sm text-fg-heading">Save scores</button>
    </form>
  )
}
