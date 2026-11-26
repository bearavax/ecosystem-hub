import { test } from 'vitest'
import assert from 'node:assert/strict'
import { canSubmitToStage } from '@/app/(site)/events/_lib/hackathons/submissions'
import { stageState } from '@/app/(site)/events/_lib/hackathons/rules'
import {
  POLARIS_PRIZES,
  POLARIS_RUBRIC,
  activeStageName,
  activeStageWindows,
  addJoinRequest,
  canDecideSeat,
  canInvite,
  canRequestSeat,
  readAnswers,
  removeJoinRequest,
  stageStatesAt,
  whatToDoNow,
  writeAnswers,
} from '@/app/(site)/polaris/_lib/process'

const NOW = new Date('2026-11-26T12:00:00Z')

test('published prize ladder is $200,000 across 40 awards and ops is not prize money', () => {
  assert.equal(POLARIS_RUBRIC.reduce((sum, row) => sum + row.weight, 0), 100)
  assert.deepEqual(POLARIS_RUBRIC.map((row) => row.weight), [30, 25, 20, 15, 10])
  assert.equal(POLARIS_PRIZES.stage1.places * POLARIS_PRIZES.stage1.each, 30_000)
  assert.equal(POLARIS_PRIZES.stage2.places * POLARIS_PRIZES.stage2.each, 75_000)
  assert.equal(POLARIS_PRIZES.stage3.amounts.reduce((sum, n) => sum + n, 0), 95_000)
  assert.equal(POLARIS_PRIZES.stage1.total + POLARIS_PRIZES.stage2.total + POLARIS_PRIZES.stage3.total, 200_000)
  assert.equal(POLARIS_PRIZES.awards, 40)
  assert.equal(POLARIS_PRIZES.ops, 50_000)
  assert.notEqual(POLARIS_PRIZES.prizeTotal, POLARIS_PRIZES.prizeTotal + POLARIS_PRIZES.ops)
})

test('seat request, decline, and approve stay on the registration answers', () => {
  assert.equal(canRequestSeat({ joined: false, isSelf: false, alreadyMember: false, alreadyRequested: false, teamFull: false }), 'Register for Polaris before you ask for a seat')
  assert.equal(canRequestSeat({ joined: true, isSelf: false, alreadyMember: false, alreadyRequested: false, teamFull: true }), 'This team is full')
  let answers = readAnswers({ hear: 'friend' })
  answers = addJoinRequest(answers, 'team-a')
  answers = addJoinRequest(answers, 'team-a')
  assert.deepEqual(answers.joinRequests, [{ projectId: 'team-a' }])
  const saved = writeAnswers({ hear: 'friend' }, answers)
  assert.equal(saved.hear, 'friend')
  assert.equal(canDecideSeat({ isOwner: false, requested: true, teamFull: false, accept: true }), 'Only the team owner can decide')
  assert.equal(canDecideSeat({ isOwner: true, requested: true, teamFull: true, accept: true }), 'This team is full')
  assert.equal(canDecideSeat({ isOwner: true, requested: true, teamFull: true, accept: false }), null)
  answers = removeJoinRequest(answers, 'team-a')
  assert.deepEqual(answers.joinRequests, [])
})

test('only an owner can invite a builder who opted in and still has a seat', () => {
  assert.equal(canInvite({ isOwner: true, openToTeam: true, alreadyMember: false, teamFull: false }), null)
  assert.equal(canInvite({ isOwner: true, openToTeam: false, alreadyMember: false, teamFull: false }), 'That builder is not open to a team')
  assert.equal(canInvite({ isOwner: false, openToTeam: true, alreadyMember: false, teamFull: false }), 'Only the team owner can invite')
})

test('switching the open stage closes the earlier ones and leaves later ones upcoming', () => {
  assert.deepEqual(stageStatesAt(0, NOW), ['open', 'upcoming', 'upcoming'])
  assert.deepEqual(stageStatesAt(1, NOW), ['closed', 'open', 'upcoming'])
  assert.deepEqual(stageStatesAt(2, NOW), ['closed', 'closed', 'open'])
  assert.equal(activeStageName(stageStatesAt(1, NOW)), 'Stage 2: Accelerator')
  assert.match(whatToDoNow('Stage 2: Accelerator'), /not advanced/)
  const windows = activeStageWindows(1, NOW)
  assert.equal(stageState(windows[0]!, NOW), 'closed')
  assert.equal(windows[1]!.judgingClosedAt, null)
})

test('stage 2 stays open to a team that was not advanced, and stage 3 does not', () => {
  const stages = [
    { id: 's1', advancedOnly: true, judgingClosedAt: new Date('2026-10-20T00:00:00Z'), opensAt: new Date('2026-09-01T00:00:00Z'), closesAt: new Date('2026-10-15T00:00:00Z') },
    { id: 's2', advancedOnly: false, judgingClosedAt: null, opensAt: new Date('2026-11-01T00:00:00Z'), closesAt: new Date('2026-12-15T00:00:00Z') },
    { id: 's3', advancedOnly: true, judgingClosedAt: null, opensAt: new Date('2026-11-01T00:00:00Z'), closesAt: new Date('2026-12-31T00:00:00Z') },
  ]
  const base = {
    isFirstStage: false,
    advancedFromPrevious: false,
    submissionStatus: 'active' as string | null,
    team: ['u1'],
    activeParticipants: new Set(['u1']),
    teamSizeMin: 1,
    teamSizeMax: 5,
    submitterId: 'u1',
    now: NOW,
  }
  assert.equal(canSubmitToStage({ ...base, stage: stages[1]! }).ok, true)
  assert.equal(canSubmitToStage({ ...base, stage: stages[2]! }).ok, false)
  assert.equal(canSubmitToStage({ ...base, stage: stages[2]!, advancedFromPrevious: true }).ok, true)
})
