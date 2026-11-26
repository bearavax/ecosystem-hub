import { test } from 'vitest'
import assert from 'node:assert/strict'
import { canSubmitToStage } from '@/app/(site)/events/_lib/hackathons/submissions'
import { weightedTotal } from '@/app/(site)/events/_lib/hackathons/judging'
import { entryFilter, formatPurse, hasOpenSeat, parseReviewQuery, stagePurse, stageStanding, standingsFor, townHallLines, STANDING_LABEL } from '@/app/(site)/polaris/_lib/rules'

const d = (s: string) => new Date(s)
const NOW = d('2026-11-25T12:00:00Z')

const stages = [
  { id: 'hackathon', advancedOnly: true, judgingClosedAt: d('2026-10-20T00:00:00Z'), opensAt: d('2026-09-01T00:00:00Z'), closesAt: d('2026-10-15T00:00:00Z') },
  { id: 'accelerator', advancedOnly: false, judgingClosedAt: null, opensAt: d('2026-11-01T00:00:00Z'), closesAt: d('2026-12-15T00:00:00Z') },
  { id: 'finale', advancedOnly: true, judgingClosedAt: null, opensAt: d('2026-12-16T00:00:00Z'), closesAt: d('2026-12-31T00:00:00Z') },
]

const submitCtx = (over: Partial<Parameters<typeof canSubmitToStage>[0]> = {}) => ({
  stage: stages[1]!,
  isFirstStage: false,
  advancedFromPrevious: false,
  submissionStatus: 'active' as string | null,
  team: ['u1'],
  activeParticipants: new Set(['u1']),
  teamSizeMin: 1,
  teamSizeMax: 5,
  submitterId: 'u1',
  now: NOW,
  ...over,
})

test('stage 1 rejection still allows stage 2 when that stage is open to every team', () => {
  const rejected = standingsFor(stages, [{ stageId: 'hackathon', advancedAt: null }], 'active', NOW)
  assert.deepEqual(rejected.map((r) => r.standing), ['not_advanced', 'can_submit', 'upcoming'])
  assert.equal(STANDING_LABEL.not_advanced, 'Not advanced')
  assert.equal(canSubmitToStage(submitCtx()).ok, true)

  const submitted = standingsFor(stages, [
    { stageId: 'hackathon', advancedAt: null },
    { stageId: 'accelerator', advancedAt: null },
  ], 'active', NOW)
  assert.equal(submitted[1]!.standing, 'submitted')
})

test('an advanced-only finale stays closed to a team that was not advanced', () => {
  const atFinale = d('2026-12-20T00:00:00Z')
  const openFinale = stages.map((s) => (s.id === 'accelerator' ? { ...s, judgingClosedAt: d('2026-12-16T00:00:00Z') } : s))
  const rows = standingsFor(openFinale, [
    { stageId: 'hackathon', advancedAt: d('2026-10-20T00:00:00Z') },
    { stageId: 'accelerator', advancedAt: null },
  ], 'active', atFinale)
  assert.deepEqual(rows.map((r) => r.standing), ['advanced', 'not_advanced', 'not_eligible'])
  assert.equal(canSubmitToStage(submitCtx({
    stage: openFinale[2]!,
    isFirstStage: false,
    advancedFromPrevious: false,
    now: atFinale,
  })).ok, false)
})

test('the same raw scores weigh differently on each stage', () => {
  const hackathon = [
    { id: 'clarity', weight: 1 },
    { id: 'build', weight: 3 },
    { id: 'demo', weight: 2 },
  ]
  const accelerator = [
    { id: 'progress', weight: 2 },
    { id: 'users', weight: 2 },
    { id: 'plan', weight: 1 },
  ]
  // 8*1 + 6*3 + 10*2 = 46, weights 6, 46/6/10*100 = 76.666… → 76.67
  assert.equal(weightedTotal({ clarity: 8, build: 6, demo: 10 }, hackathon, 10), 76.67)
  // 8*2 + 6*2 + 10*1 = 38, weights 5, 38/5/10*100 = 76
  assert.equal(weightedTotal({ progress: 8, users: 6, plan: 10 }, accelerator, 10), 76)
  assert.equal(weightedTotal({ clarity: 8 }, hackathon, 10), null)
  assert.equal(stageStanding({
    submissionStatus: 'active', phase: 'judging', isFirst: true, advancedOnly: true, previousAdvanced: false, hasEntry: true, thisAdvanced: false,
  }), 'in_review')
})

test('review filters ignore unknown ids and a standing with no stage', () => {
  const known = { trackIds: ['open'], stageIds: ['hackathon'] }
  const q = parseReviewQuery({ q: ' igloo ', track: 'nope', stage: 'hackathon', standing: 'not_advanced', status: 'active', page: '2' }, known)
  assert.deepEqual(q, { q: 'igloo', trackId: undefined, stageId: 'hackathon', standing: 'not_advanced', status: 'active', page: 2 })
  assert.equal(parseReviewQuery({ standing: 'advanced' }, known).standing, 'any')
  assert.deepEqual(entryFilter('hackathon', 'not_advanced'), { kind: 'not_advanced', stageId: 'hackathon' })
  assert.deepEqual(entryFilter(undefined, 'missing'), { kind: 'any' })
  assert.deepEqual(entryFilter('hackathon', 'any'), { kind: 'any' })
})

test('stage purses add the seeded proposed places, including a placement range', () => {
  const prizes = [
    { title: 'Hackathon place', amount: '$1,500 proposed', placement: 1, placementTo: 20 },
    { title: 'Accelerator place', amount: '$5,000 proposed', placement: 1, placementTo: 15 },
    { title: 'Finale 1st', amount: '$45,000 proposed', placement: 1, placementTo: null },
    { title: 'Finale 2nd', amount: '$25,000 proposed', placement: 1, placementTo: null },
    { title: 'Finale 3rd', amount: '$15,000 proposed', placement: 1, placementTo: null },
    { title: 'Finale 4th', amount: '$5,000 proposed', placement: 1, placementTo: null },
    { title: 'Finale 5th', amount: '$5,000 proposed', placement: 1, placementTo: null },
  ]
  assert.deepEqual(stagePurse(prizes, 'Hackathon'), { total: 30000, awards: 20 })
  assert.deepEqual(stagePurse(prizes, 'Accelerator'), { total: 75000, awards: 15 })
  assert.deepEqual(stagePurse(prizes, 'Finale'), { total: 95000, awards: 5 })
  assert.equal(formatPurse(30000), '$30K proposed')
  assert.equal(stagePurse(prizes, 'Hackathon').total + stagePurse(prizes, 'Accelerator').total + stagePurse(prizes, 'Finale').total, 200000)
})

test('town hall lines come only from marked seed text, and open seats follow the team cap', () => {
  assert.deepEqual(townHallLines('TOWNHALL|Workshops|Time TBC.\nHello\nTOWNHALL|Stage note|Placeholder.'), [
    { title: 'Workshops', body: 'Time TBC.' },
    { title: 'Stage note', body: 'Placeholder.' },
  ])
  assert.equal(hasOpenSeat(1, 5), true)
  assert.equal(hasOpenSeat(5, 5), false)
})
