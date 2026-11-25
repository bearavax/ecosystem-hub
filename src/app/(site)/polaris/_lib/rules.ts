import { stageState, type StageState } from '@/app/(site)/events/_lib/hackathons/rules'
import { pageParam, textParam } from '@/lib/params'

/** Event slug of the local Polaris test hackathon. All of its rows are normal Hub models. */
export const POLARIS_SLUG = 'polaris'

export const POLARIS_PAGE_SIZE = 25

export const STANDING_FILTERS = ['any', 'missing', 'submitted', 'advanced', 'not_advanced'] as const
export type StandingFilter = (typeof STANDING_FILTERS)[number]

export const STATUS_FILTERS = ['any', 'active', 'withdrawn', 'disqualified'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/** What a team’s entry means right now. There is no separate "rejected" column: after judging closes, not advanced is the rejection. */
export type Standing =
  | 'upcoming'
  | 'can_submit'
  | 'not_eligible'
  | 'submitted'
  | 'in_review'
  | 'advanced'
  | 'not_advanced'
  | 'missed'
  | 'withdrawn'
  | 'disqualified'

export const STANDING_LABEL: Record<Standing, string> = {
  upcoming: 'Not open yet',
  can_submit: 'Open, not submitted',
  not_eligible: 'Not eligible',
  submitted: 'Submitted',
  in_review: 'Submitted, in review',
  advanced: 'Advanced',
  not_advanced: 'Not advanced',
  missed: 'No submission',
  withdrawn: 'Withdrawn',
  disqualified: 'Disqualified',
}

type StandingInput = {
  submissionStatus: string | null
  phase: StageState
  isFirst: boolean
  advancedOnly: boolean
  previousAdvanced: boolean
  hasEntry: boolean
  thisAdvanced: boolean
}

export function stageStanding(input: StandingInput): Standing {
  if (input.submissionStatus === 'withdrawn') return 'withdrawn'
  if (input.submissionStatus === 'disqualified') return 'disqualified'
  if (input.hasEntry && input.thisAdvanced) return 'advanced'
  if (input.hasEntry && input.phase === 'closed') return 'not_advanced'
  if (input.hasEntry && input.phase === 'judging') return 'in_review'
  if (input.hasEntry) return 'submitted'
  if (input.phase === 'upcoming') return 'upcoming'
  if (input.phase === 'open') return input.isFirst || !input.advancedOnly || input.previousAdvanced ? 'can_submit' : 'not_eligible'
  return 'missed'
}

type StageForStanding = {
  id: string
  advancedOnly: boolean
  opensAt: Date
  closesAt: Date
  judgingClosedAt: Date | null
}

/** One standing per stage, in stage order. */
export function standingsFor(
  stages: StageForStanding[],
  entries: { stageId: string; advancedAt: Date | null }[],
  submissionStatus: string | null,
  now: Date,
): { stageId: string; standing: Standing }[] {
  return stages.map((stage, i) => {
    const prev = stages[i - 1]
    const entry = entries.find((e) => e.stageId === stage.id)
    return {
      stageId: stage.id,
      standing: stageStanding({
        submissionStatus,
        phase: stageState(stage, now),
        isFirst: i === 0,
        advancedOnly: stage.advancedOnly,
        previousAdvanced: !!prev && entries.some((e) => e.stageId === prev.id && e.advancedAt),
        hasEntry: !!entry,
        thisAdvanced: !!entry?.advancedAt,
      }),
    }
  })
}

export type ReviewQuery = {
  q?: string
  trackId?: string
  stageId?: string
  standing: StandingFilter
  status: StatusFilter
  page: number
}

type ReviewParams = {
  q?: string | string[]
  track?: string | string[]
  stage?: string | string[]
  standing?: string | string[]
  status?: string | string[]
  page?: string | string[]
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

/** Query string for the review queue. Unknown tracks, stages and enums are ignored. Standing applies only with a known stage. */
export function parseReviewQuery(sp: ReviewParams, known: { trackIds: string[]; stageIds: string[] }): ReviewQuery {
  const track = textParam(sp.track)
  const stage = textParam(sp.stage)
  const trackId = track && known.trackIds.includes(track) ? track : undefined
  const stageId = stage && known.stageIds.includes(stage) ? stage : undefined
  return {
    q: textParam(sp.q),
    trackId,
    stageId,
    standing: stageId ? (oneOf(textParam(sp.standing), STANDING_FILTERS) ?? 'any') : 'any',
    status: oneOf(textParam(sp.status), STATUS_FILTERS) ?? 'any',
    page: pageParam(sp.page),
  }
}

export type EntryFilter =
  | { kind: 'any' }
  | { kind: 'missing'; stageId: string }
  | { kind: 'submitted'; stageId: string }
  | { kind: 'advanced'; stageId: string }
  | { kind: 'not_advanced'; stageId: string }

export function entryFilter(stageId: string | undefined, standing: StandingFilter): EntryFilter {
  if (!stageId || standing === 'any') return { kind: 'any' }
  switch (standing) {
    case 'missing':
    case 'submitted':
    case 'advanced':
    case 'not_advanced':
      return { kind: standing, stageId }
    default: {
      const _exhaustive: never = standing
      return _exhaustive
    }
  }
}
