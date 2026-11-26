import { stageState, type StageState } from '@/app/(site)/events/_lib/hackathons/rules'

/** Published Polaris rubric. Weights sum to 100. Scores stay on the stage's Criterion rows. */
export const POLARIS_RUBRIC = [
  { name: 'Problem', weight: 30 },
  { name: 'Solution', weight: 25 },
  { name: 'Build', weight: 20 },
  { name: 'Demo', weight: 15 },
  { name: 'Team', weight: 10 },
] as const

/** Prize money only. Operations money is separate and is not an award. */
export const POLARIS_PRIZES = {
  stage1: { places: 20, each: 1500, total: 30_000 },
  stage2: { places: 15, each: 5000, total: 75_000 },
  stage3: { amounts: [45_000, 25_000, 15_000, 5_000, 5_000], total: 95_000 },
  awards: 40,
  prizeTotal: 200_000,
  ops: 50_000,
} as const

export type JoinRequest = { projectId: string }

export type PolarisAnswers = {
  openToTeam: boolean
  timezone: string
  joinRequests: JoinRequest[]
}

const EMPTY: PolarisAnswers = { openToTeam: false, timezone: '', joinRequests: [] }

export function readAnswers(raw: unknown): PolarisAnswers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY, joinRequests: [] }
  const row = raw as Record<string, unknown>
  const requests = Array.isArray(row.joinRequests) ? row.joinRequests : []
  return {
    openToTeam: row.openToTeam === true,
    timezone: typeof row.timezone === 'string' ? row.timezone : '',
    joinRequests: requests.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const projectId = (item as { projectId?: unknown }).projectId
      return typeof projectId === 'string' && projectId ? [{ projectId }] : []
    }),
  }
}

/** Keep every other registration answer, then write the Polaris fields. */
export function writeAnswers(raw: unknown, next: PolarisAnswers): Record<string, unknown> {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
  return { ...base, openToTeam: next.openToTeam, timezone: next.timezone, joinRequests: next.joinRequests }
}

export function canRequestSeat(input: { isSelf: boolean; alreadyMember: boolean; alreadyRequested: boolean; teamFull: boolean; joined: boolean }): string | null {
  if (!input.joined) return 'Register for Polaris before you ask for a seat'
  if (input.isSelf) return 'You are already on this team'
  if (input.alreadyMember) return 'You are already on this team'
  if (input.alreadyRequested) return 'You already asked to join this team'
  if (input.teamFull) return 'This team is full'
  return null
}

export function addJoinRequest(answers: PolarisAnswers, projectId: string): PolarisAnswers {
  if (answers.joinRequests.some((r) => r.projectId === projectId)) return answers
  return { ...answers, joinRequests: [...answers.joinRequests, { projectId }] }
}

export function removeJoinRequest(answers: PolarisAnswers, projectId: string): PolarisAnswers {
  return { ...answers, joinRequests: answers.joinRequests.filter((r) => r.projectId !== projectId) }
}

export function canDecideSeat(input: { isOwner: boolean; requested: boolean; teamFull: boolean; accept: boolean }): string | null {
  if (!input.isOwner) return 'Only the team owner can decide'
  if (!input.requested) return 'That person has not asked to join'
  if (input.accept && input.teamFull) return 'This team is full'
  return null
}

export function canInvite(input: { isOwner: boolean; openToTeam: boolean; alreadyMember: boolean; teamFull: boolean }): string | null {
  if (!input.isOwner) return 'Only the team owner can invite'
  if (!input.openToTeam) return 'That builder is not open to a team'
  if (input.alreadyMember) return 'That person is already on the team'
  if (input.teamFull) return 'This team is full'
  return null
}

const DAY = 86_400_000

/** Windows so exactly one stage is open, earlier stages are closed, later stages are upcoming. */
export function activeStageWindows(index: 0 | 1 | 2, now: Date): { opensAt: Date; closesAt: Date; judgingClosedAt: Date | null }[] {
  return [0, 1, 2].map((i) => {
    if (i < index) return { opensAt: new Date(now.getTime() - 40 * DAY), closesAt: new Date(now.getTime() - 5 * DAY), judgingClosedAt: new Date(now.getTime() - DAY) }
    if (i === index) return { opensAt: new Date(now.getTime() - DAY), closesAt: new Date(now.getTime() + 30 * DAY), judgingClosedAt: null }
    return { opensAt: new Date(now.getTime() + (20 + i) * DAY), closesAt: new Date(now.getTime() + (50 + i) * DAY), judgingClosedAt: null }
  })
}

export function activeStageName(states: StageState[]): string | null {
  const i = states.findIndex((s) => s === 'open')
  return i === -1 ? null : ['Stage 1: Hackathon', 'Stage 2: Accelerator', 'Stage 3: Finale'][i] ?? null
}

export function whatToDoNow(openName: string | null): string {
  if (!openName) return 'No stage is open. Wait for the organiser to open the next stage. Dates TBC.'
  if (openName.startsWith('Stage 1')) return 'Register, form a team, link a project, and seal a Stage 1 submission.'
  if (openName.startsWith('Stage 2')) return 'Stage 2 is open to Stage 1 winners and to teams that were not advanced. Repeat winners are allowed. Seal a Stage 2 submission.'
  return 'Stage 3 is for teams advanced from Stage 2 only. Seal a finale submission if your team was advanced.'
}

export function stageStatesAt(index: 0 | 1 | 2, now: Date): StageState[] {
  return activeStageWindows(index, now).map((w) => stageState(w, now))
}
