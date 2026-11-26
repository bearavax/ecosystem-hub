// Local FAKE Polaris hackathon. Refuses any DATABASE_URL that is not localhost.
// Does not call Luma, the member portal, or any other network service.
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { weightedTotal } from '@/app/(site)/events/_lib/hackathons/judging'

const at = (iso: string) => new Date(iso)
const TRACKS = [
  { id: 'polaris_track_gaming', name: 'Gaming', sponsor: 'Sponsor A', order: 0 },
  { id: 'polaris_track_social', name: 'Social & Creator', sponsor: 'Sponsor B', order: 1 },
  { id: 'polaris_track_ai', name: 'AI Consumer', sponsor: 'Sponsor C', order: 2 },
  { id: 'polaris_track_payments', name: 'Payments & Finance', sponsor: 'Sponsor D', order: 3 },
  { id: 'polaris_track_lifestyle', name: 'Lifestyle & Real-World', sponsor: 'Sponsor E', order: 4 },
  { id: 'polaris_track_open', name: 'Open Innovation', sponsor: 'Sponsor F', order: 5 },
] as const
const S1 = [
  { id: 'polaris_c_clarity', name: 'Clarity', weight: 1, description: 'FAKE. Is the idea understandable?', order: 0 },
  { id: 'polaris_c_build', name: 'Build', weight: 3, description: 'FAKE. Did they build something?', order: 1 },
  { id: 'polaris_c_demo', name: 'Demo', weight: 2, description: 'FAKE. Is there something to open?', order: 2 },
]
const S2 = [
  { id: 'polaris_c_progress', name: 'Progress', weight: 2, description: 'FAKE. What moved since the hackathon?', order: 0 },
  { id: 'polaris_c_users', name: 'Users', weight: 2, description: 'FAKE. Any real usage?', order: 1 },
  { id: 'polaris_c_plan', name: 'Plan', weight: 1, description: 'FAKE. What happens next?', order: 2 },
]
const S3 = [
  { id: 'polaris_c_product', name: 'Product', weight: 3, description: 'FAKE. Is it a product?', order: 0 },
  { id: 'polaris_c_pitch', name: 'Pitch', weight: 2, description: 'FAKE. Can they explain it?', order: 1 },
]

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Refusing to seed: DATABASE_URL is missing or not a URL')
  }
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to seed: database host is ${host}`)
}

function version(id: string, projectId: string, name: string, ownerId: string): Prisma.ProjectVersionCreateManyInput {
  return {
    id,
    projectId,
    number: 1,
    name,
    shortDescription: `FAKE. ${name} is seed data, not a real project.`,
    fullDescription: 'FAKE full description for the local Polaris test. Nothing here shipped.',
    techDescription: 'FAKE. No real stack.',
    techStack: ['TypeScript'],
    categories: ['Gaming'],
    maturity: 'prototype',
    country: 'US',
    githubRepos: ['https://example.test/fake-repo'],
    demoLinks: ['https://example.test/fake-demo'],
    videoUrl: 'https://example.test/fake-video',
    websiteUrl: 'https://example.test/fake-site',
    screenshots: [],
    sealedAt: at('2026-10-10T00:00:00Z'),
    note: 'Submitted to Polaris (FAKE seed)',
    createdById: ownerId,
  }
}

async function wipe() {
  const event = await prisma.event.findUnique({ where: { slug: 'polaris' }, select: { id: true, hackathon: { select: { id: true } } } })
  if (event?.hackathon) await prisma.hackathon.delete({ where: { id: event.hackathon.id } })
  if (event) await prisma.event.delete({ where: { id: event.id } })
  await prisma.project.updateMany({ where: { slug: { startsWith: 'polaris-' } }, data: { currentVersionId: null } })
  await prisma.project.deleteMany({ where: { slug: { startsWith: 'polaris-' } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: '@polaris.example.test' } } })
}

async function main() {
  assertLocalDatabase()
  await wipe()

  const organiserId = 'polaris_organiser'
  const judgeIds = ['polaris_judge_1', 'polaris_judge_2', 'polaris_judge_3'] as const
  const northId = 'polaris_north'
  const southId = 'polaris_south'
  const starId = 'polaris_star'
  const star2Id = 'polaris_star_2'
  const newId = 'polaris_new'
  const rejectedId = 'polaris_rejected'

  const staff = [
    { id: organiserId, name: 'Organiser', email: 'organiser@polaris.example.test' },
    { id: judgeIds[0], name: 'Judge 1', email: 'judge1@polaris.example.test' },
    { id: judgeIds[1], name: 'Judge 2', email: 'judge2@polaris.example.test' },
    { id: judgeIds[2], name: 'Judge 3', email: 'judge3@polaris.example.test' },
    { id: northId, name: 'Builder North', email: 'north@polaris.example.test', githubAccount: 'fake-north', wallets: ['0x0000000000000000000000000000000000000001'] },
    { id: southId, name: 'Builder South', email: 'south@polaris.example.test' },
    { id: starId, name: 'Builder Star', email: 'star@polaris.example.test' },
    { id: star2Id, name: 'Builder Star Two', email: 'star2@polaris.example.test' },
    { id: newId, name: 'Builder New', email: 'new@polaris.example.test' },
    { id: rejectedId, name: 'Builder Camp Rejected', email: 'rejected@polaris.example.test' },
  ]
  const bulk = Array.from({ length: 300 }, (_, i) => {
    const n = String(i + 1).padStart(3, '0')
    return { id: `polaris_u_${n}`, name: `Builder ${n}`, email: `igloo-${n}@polaris.example.test` }
  })
  await prisma.user.createMany({
    data: [...staff, ...bulk].map((u) => ({
      ...u,
      emailVerified: true,
      country: 'US',
      builderRoles: ['developer'],
    })),
  })

  await prisma.event.create({
    data: {
      id: 'polaris_event',
      lumaEventId: 'evt-fake-polaris',
      lumaUrl: 'https://example.test/fake-polaris-luma',
      slug: 'polaris',
      name: 'Polaris (FAKE)',
      descriptionMd: 'FAKE local test event. Not a Luma event. Do not refresh it from Luma.',
      startAt: at('2026-09-01T00:00:00Z'),
      endAt: at('2026-12-31T23:00:00Z'),
      timezone: 'UTC',
      isOnline: true,
      source: 'luma',
      status: 'published',
      hackathon: {
        create: {
          id: 'polaris_hackathon',
          tagline: 'FAKE local test. Not a real hackathon.',
          aboutMd: [
            'TOWNHALL|Workshops this week|Placeholder announcement. Time TBC.',
            'TOWNHALL|Check the current stage|Placeholder announcement. Time TBC.',
            '',
            'FAKE seed. Dates, sponsors, judges and prizes are placeholders. Every prize amount says proposed.',
          ].join('\n'),
          rulesMd: 'FAKE rules. One team per person. Stage 2 is open to teams that were not advanced. Stage 3 is not.',
          termsUrl: 'https://example.test/fake-polaris-terms',
          registrationOpensAt: at('2026-09-01T00:00:00Z'),
          registrationClosesAt: at('2026-12-20T00:00:00Z'),
          teamSizeMin: 1,
          teamSizeMax: 5,
          allowMultipleSubmissions: false,
          requireApproval: false,
          prizePool: '$95,000 proposed',
          timezone: 'UTC',
          status: 'published',
          resultsPublishedAt: at('2026-11-01T00:00:00Z'),
          tracks: { create: TRACKS.map((t) => ({ ...t, descriptionMd: `FAKE track. One sponsor slot: ${t.sponsor}.` })) },
          stages: {
            create: [
              {
                id: 'polaris_stage_hackathon', order: 0, name: 'Hackathon',
                descriptionMd: 'FAKE stage 1. Judging is closed in this seed.',
                opensAt: at('2026-09-01T00:00:00Z'), closesAt: at('2026-10-15T00:00:00Z'), judgingClosedAt: at('2026-10-20T00:00:00Z'),
                reviewMode: 'all', advancedOnly: true, showCriteria: true, scaleMax: 10,
                criteria: { create: S1 },
              },
              {
                id: 'polaris_stage_accelerator', order: 1, name: 'Accelerator',
                descriptionMd: 'FAKE stage 2. Open to teams that were not advanced, and to new teams.',
                opensAt: at('2026-11-01T00:00:00Z'), closesAt: at('2026-12-15T00:00:00Z'),
                reviewMode: 'all', advancedOnly: false, showCriteria: true, scaleMax: 10,
                criteria: { create: S2 },
              },
              {
                id: 'polaris_stage_finale', order: 2, name: 'Finale',
                descriptionMd: 'FAKE stage 3. Only advanced teams.',
                opensAt: at('2026-12-16T00:00:00Z'), closesAt: at('2026-12-31T00:00:00Z'),
                reviewMode: 'all', advancedOnly: true, showCriteria: true, scaleMax: 10,
                criteria: { create: S3 },
              },
            ],
          },
          prizes: {
            create: [
              { id: 'polaris_prize_hack', placement: 1, placementTo: 20, title: 'Hackathon place', amount: '$1,500 proposed', description: '20 places. Proposed.', order: 0 },
              { id: 'polaris_prize_accel', placement: 1, placementTo: 15, title: 'Accelerator place', amount: '$5,000 proposed', description: '15 places. Proposed. Teams not advanced from stage 1 can enter. Repeat winners allowed.', order: 1 },
              { id: 'polaris_prize_overall', placement: 1, title: 'Finale 1st', amount: '$45,000 proposed', description: 'Proposed. 50% up front. 8 finalists, 5 grand winners.', order: 2 },
              { id: 'polaris_prize_f2', placement: 1, title: 'Finale 2nd', amount: '$25,000 proposed', description: 'Proposed. 50% up front.', order: 3 },
              { id: 'polaris_prize_f3', placement: 1, title: 'Finale 3rd', amount: '$15,000 proposed', description: 'Proposed. 50% up front.', order: 4 },
              { id: 'polaris_prize_f4', placement: 1, title: 'Finale 4th', amount: '$5,000 proposed', description: 'Proposed. 50% up front.', order: 5 },
              { id: 'polaris_prize_f5', placement: 1, title: 'Finale 5th', amount: '$5,000 proposed', description: 'Proposed. 50% up front.', order: 6 },
            ],
          },
          organizers: { create: { id: 'polaris_org', email: 'organiser@polaris.example.test', userId: organiserId, termsAcceptedAt: at('2026-09-01T00:00:00Z') } },
          judges: {
            create: [
              { id: 'polaris_j1', email: 'judge1@polaris.example.test', userId: judgeIds[0], trackIds: [], termsAcceptedAt: at('2026-09-01T00:00:00Z') },
              { id: 'polaris_j2', email: 'judge2@polaris.example.test', userId: judgeIds[1], trackIds: [], termsAcceptedAt: at('2026-09-01T00:00:00Z') },
              { id: 'polaris_j3', email: 'judge3@polaris.example.test', userId: judgeIds[2], trackIds: ['polaris_track_payments'], termsAcceptedAt: at('2026-09-01T00:00:00Z') },
            ],
          },
          fields: {
            create: [
              { id: 'polaris_field_hear', label: 'FAKE: how did you hear about this?', type: 'short_text', required: false, options: [], order: 0 },
              { id: 'polaris_field_pitch', stageId: 'polaris_stage_hackathon', label: 'FAKE one-line pitch', type: 'short_text', required: false, options: [], order: 0 },
            ],
          },
        },
      },
    },
  })

  type Team = { key: string; ownerId: string; name: string; memberIds: string[]; trackId: string; advanced: boolean; stage2: boolean }
  const stories: Team[] = [
    { key: 'north', ownerId: northId, name: 'Igloo North', memberIds: [northId], trackId: 'polaris_track_open', advanced: true, stage2: true },
    { key: 'south', ownerId: southId, name: 'Igloo South', memberIds: [southId], trackId: 'polaris_track_open', advanced: false, stage2: true },
    { key: 'star', ownerId: starId, name: 'Igloo Star', memberIds: [starId, star2Id], trackId: 'polaris_track_open', advanced: true, stage2: true },
  ]
  const teams: Team[] = [
    ...stories,
    ...bulk.map((u, i) => ({
      key: String(i + 1).padStart(3, '0'),
      ownerId: u.id,
      name: `Igloo ${String(i + 1).padStart(3, '0')}`,
      memberIds: [u.id],
      trackId: TRACKS[i % TRACKS.length]!.id,
      advanced: i < 150,
      stage2: false,
    })),
  ]

  await prisma.project.createMany({
    data: teams.map((t) => ({ id: `polaris_p_${t.key}`, slug: `polaris-${t.key}`, ownerId: t.ownerId })),
  })
  await prisma.projectVersion.createMany({
    data: teams.map((t) => version(`polaris_v_${t.key}`, `polaris_p_${t.key}`, t.name, t.ownerId)),
  })
  await prisma.$executeRaw`
    UPDATE "projects" p SET "currentVersionId" = v.id
    FROM "project_versions" v
    WHERE v."projectId" = p.id AND p.slug LIKE 'polaris-%'
  `
  await prisma.projectMember.createMany({
    data: teams.flatMap((t) => t.memberIds.map((userId) => ({
      projectId: `polaris_p_${t.key}`,
      userId,
      role: userId === t.ownerId ? 'owner' : 'writer',
    }))),
  })

  const participants = [
    ...teams.flatMap((t) => t.memberIds),
    newId,
    rejectedId,
  ]
  await prisma.participant.createMany({
    data: [...new Set(participants)].map((userId) => ({
      hackathonId: 'polaris_hackathon',
      userId,
      status: userId === rejectedId ? 'rejected' : 'active',
      termsAcceptedAt: at('2026-09-02T00:00:00Z'),
      answers: {},
    })),
  })

  await prisma.submission.createMany({
    data: teams.map((t) => ({
      id: `polaris_sub_${t.key}`,
      hackathonId: 'polaris_hackathon',
      projectId: `polaris_p_${t.key}`,
      trackIds: [t.trackId],
      status: 'active',
      createdById: t.ownerId,
    })),
  })

  const entries: Prisma.StageEntryCreateManyInput[] = []
  for (const t of teams) {
    entries.push({
      id: `polaris_e_${t.key}_s1`,
      submissionId: `polaris_sub_${t.key}`,
      stageId: 'polaris_stage_hackathon',
      projectVersionId: `polaris_v_${t.key}`,
      answers: { polaris_field_pitch: 'FAKE pitch' },
      teamSnapshot: t.memberIds.map((userId) => ({ userId, name: snapshotName(userId, staff, bulk) })),
      preexistingIdea: false,
      builtDuringEvent: 'FAKE. Built during the test window.',
      submittedAt: at('2026-10-10T00:00:00Z'),
      advancedAt: t.advanced ? at('2026-10-21T00:00:00Z') : null,
      advancedById: t.advanced ? organiserId : null,
    })
    if (t.stage2) {
      entries.push({
        id: `polaris_e_${t.key}_s2`,
        submissionId: `polaris_sub_${t.key}`,
        stageId: 'polaris_stage_accelerator',
        projectVersionId: `polaris_v_${t.key}`,
        answers: {},
        teamSnapshot: t.memberIds.map((userId) => ({ userId, name: snapshotName(userId, staff, bulk) })),
        submittedAt: at('2026-11-20T00:00:00Z'),
      })
    }
  }
  await prisma.stageEntry.createMany({ data: entries })

  const scorecard: Record<string, Record<string, number>> = {
    star: { polaris_c_clarity: 9, polaris_c_build: 9, polaris_c_demo: 8 },
    north: { polaris_c_clarity: 7, polaris_c_build: 7, polaris_c_demo: 6 },
    south: { polaris_c_clarity: 4, polaris_c_build: 3, polaris_c_demo: 5 },
  }
  for (const [judgeKey, delta] of [['polaris_j1', 0], ['polaris_j2', -1]] as const) {
    for (const key of ['star', 'north', 'south'] as const) {
      const scores = Object.fromEntries(Object.entries(scorecard[key]!).map(([id, n]) => [id, Math.max(0, n + delta)]))
      const total = weightedTotal(scores, S1, 10)
      if (total == null) throw new Error('score')
      const assignmentId = `polaris_as_${judgeKey}_${key}`
      await prisma.judgeAssignment.create({
        data: {
          id: assignmentId,
          judgeId: judgeKey,
          entryId: `polaris_e_${key}_s1`,
          createdById: organiserId,
          review: {
            create: {
              scores,
              total,
              comment: `FAKE feedback from ${judgeKey === 'polaris_j1' ? 'Judge 1' : 'Judge 2'}.`,
              submittedAt: at('2026-10-18T00:00:00Z'),
            },
          },
        },
      })
    }
  }

  await prisma.award.create({
    data: { id: 'polaris_award_star', prizeId: 'polaris_prize_overall', placement: 1, submissionId: 'polaris_sub_star' },
  })

  const sessionUsers = [
    ['organiser', organiserId],
    ['judge', judgeIds[0]],
    ['north', northId],
    ['south', southId],
    ['star', starId],
    ['new', newId],
    ['rejected', rejectedId],
  ] as const
  const sessions = sessionUsers.map(([role, userId]) => ({ role, userId, token: randomBytes(24).toString('hex') }))
  await prisma.session.createMany({
    data: sessions.map((s) => ({
      id: `polaris_session_${s.role}`,
      token: s.token,
      userId: s.userId,
      expiresAt: at('2026-12-31T00:00:00Z'),
    })),
  })
  mkdirSync('.local', { recursive: true })
  writeFileSync('.local/polaris-sessions.json', JSON.stringify({
    hackathonId: 'polaris_hackathon',
    sessions: sessions.map((s) => ({ role: s.role, token: s.token })),
  }, null, 2))

  const counts = await prisma.submission.count({ where: { hackathonId: 'polaris_hackathon' } })
  console.info(`Seeded FAKE Polaris: ${counts} submissions, hackathon polaris_hackathon, event slug polaris`)
}

function snapshotName(userId: string, staff: { id: string; name: string }[], bulk: { id: string; name: string }[]) {
  return staff.find((u) => u.id === userId)?.name ?? bulk.find((u) => u.id === userId)?.name ?? userId
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
