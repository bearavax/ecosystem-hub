'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { TEAM_ROLES } from '@/app/(app)/projects/_lib/rules'
import { assertManage } from '@/app/(site)/events/_lib/hackathons/manage'
import { weightedTotal } from '@/app/(site)/events/_lib/hackathons/judging'
import { action, ActionError, ForbiddenError } from '@/lib/action'
import { recordAudit } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { activeStageWindows, addJoinRequest, canDecideSeat, canInvite, canRequestSeat, readAnswers, removeJoinRequest, writeAnswers } from './process'

const id = z.string().min(1)

function refresh() {
  revalidatePath('/polaris', 'layout')
}

function answersJson(raw: unknown, next: ReturnType<typeof readAnswers>): Prisma.InputJsonValue {
  return writeAnswers(raw, next) as Prisma.InputJsonValue
}

export const saveMatchingProfile = action({
  schema: z.object({
    hackathonId: id,
    openToTeam: z.boolean(),
    timezone: z.string().trim().max(80),
    bio: z.string().trim().max(250),
    skills: z.array(z.string().trim().min(1).max(40)).max(20),
  }),
  permission: 'user',
}, async ({ hackathonId, openToTeam, timezone, bio, skills }, user) => {
  const participant = await prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId, userId: user.id } } })
  if (!participant || participant.status !== 'active') throw new ActionError('Register for Polaris before you set teammate matching')
  const next = { ...readAnswers(participant.answers), openToTeam, timezone }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { bio, skills } }),
    prisma.participant.update({ where: { id: participant.id }, data: { answers: answersJson(participant.answers, next) } }),
  ])
  await recordAudit({ actorId: user.id, action: 'polaris.matching.save', entityType: 'Participant', entityId: participant.id, after: { openToTeam, timezone, skills } })
  refresh()
})

export const requestToJoin = action({
  schema: z.object({ hackathonId: id, projectId: id }),
  permission: 'user',
}, async ({ hackathonId, projectId }, user) => {
  const [participant, project] = await Promise.all([
    prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId, userId: user.id } } }),
    prisma.project.findUnique({ where: { id: projectId }, include: { members: { where: { role: { in: TEAM_ROLES } } }, submissions: { where: { hackathonId, status: 'active' }, select: { id: true } } } }),
  ])
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { teamSizeMax: true } })
  if (!project || project.submissions.length === 0) throw new ActionError('Team not found')
  const answers = readAnswers(participant?.answers)
  const error = canRequestSeat({
    joined: participant?.status === 'active',
    isSelf: project.members.some((m) => m.userId === user.id),
    alreadyMember: project.members.some((m) => m.userId === user.id),
    alreadyRequested: answers.joinRequests.some((r) => r.projectId === projectId),
    teamFull: hackathon?.teamSizeMax != null && project.members.length >= hackathon.teamSizeMax,
  })
  if (error || !participant) throw new ActionError(error ?? 'Register for Polaris before you ask for a seat')
  await prisma.participant.update({ where: { id: participant.id }, data: { answers: answersJson(participant.answers, addJoinRequest(answers, projectId)) } })
  await recordAudit({ actorId: user.id, action: 'polaris.seat.request', entityType: 'Project', entityId: projectId })
  refresh()
})

export const decideJoin = action({
  schema: z.object({ hackathonId: id, projectId: id, userId: id, accept: z.boolean() }),
  permission: 'user',
}, async ({ hackathonId, projectId, userId, accept }, user) => {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: { where: { role: { in: TEAM_ROLES } } } } })
  if (!project) throw new ActionError('Team not found')
  if (project.ownerId !== user.id) throw new ForbiddenError('Only the team owner can decide')
  const participant = await prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId, userId } } })
  const answers = readAnswers(participant?.answers)
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { teamSizeMax: true } })
  const error = canDecideSeat({
    isOwner: true,
    requested: answers.joinRequests.some((r) => r.projectId === projectId),
    teamFull: hackathon?.teamSizeMax != null && project.members.length >= hackathon.teamSizeMax,
    accept,
  })
  if (error || !participant) throw new ActionError(error ?? 'That person has not asked to join')
  if (accept && project.members.some((m) => m.userId === userId)) throw new ActionError('That person is already on the team')
  await prisma.$transaction([
    prisma.participant.update({ where: { id: participant.id }, data: { answers: answersJson(participant.answers, removeJoinRequest(answers, projectId)) } }),
    ...(accept ? [prisma.projectMember.create({ data: { projectId, userId, role: 'writer' } })] : []),
  ])
  await recordAudit({ actorId: user.id, action: accept ? 'polaris.seat.approve' : 'polaris.seat.decline', entityType: 'Project', entityId: projectId, after: { userId } })
  refresh()
})

export const inviteToTeam = action({
  schema: z.object({ hackathonId: id, projectId: id, userId: id }),
  permission: 'user',
}, async ({ hackathonId, projectId, userId }, user) => {
  const [project, person, participant, hackathon] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { members: { where: { role: { in: TEAM_ROLES } } } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } }),
    prisma.participant.findUnique({ where: { hackathonId_userId: { hackathonId, userId } } }),
    prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { teamSizeMax: true } }),
  ])
  if (!project || !person) throw new ActionError('Could not invite that builder')
  const error = canInvite({
    isOwner: project.ownerId === user.id,
    openToTeam: readAnswers(participant?.answers).openToTeam,
    alreadyMember: project.members.some((m) => m.userId === userId),
    teamFull: hackathon?.teamSizeMax != null && project.members.length >= hackathon.teamSizeMax,
  })
  if (error) throw error === 'Only the team owner can invite' ? new ForbiddenError(error) : new ActionError(error)
  const email = person.email.toLowerCase()
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await prisma.$transaction([
    prisma.projectInvite.updateMany({ where: { projectId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.projectInvite.create({ data: { projectId, email, role: 'writer', tokenHash, invitedById: user.id, expiresAt: new Date(Date.now() + 14 * 86_400_000) } }),
  ])
  await recordAudit({ actorId: user.id, action: 'polaris.team.invite', entityType: 'Project', entityId: projectId, after: { userId } })
  refresh()
})

export const setActiveStage = action({
  schema: z.object({ hackathonId: id, index: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
  permission: 'user',
}, async ({ hackathonId, index }, user) => {
  await assertManage(hackathonId, user)
  const stages = await prisma.hackathonStage.findMany({ where: { hackathonId }, orderBy: { order: 'asc' } })
  if (stages.length < 3) throw new ActionError('Polaris needs three stages')
  const now = new Date()
  const windows = activeStageWindows(index, now)
  await prisma.$transaction(stages.slice(0, 3).map((stage, i) => prisma.hackathonStage.update({ where: { id: stage.id }, data: windows[i]! })))
  await recordAudit({ actorId: user.id, action: 'polaris.stage.activate', entityType: 'Hackathon', entityId: hackathonId, after: { index } })
  refresh()
})

export const scoreEntry = action({
  schema: z.object({
    hackathonId: id,
    entryId: id,
    scores: z.record(z.string(), z.number().min(0).max(10)),
  }),
  permission: 'user',
}, async ({ hackathonId, entryId, scores }, user) => {
  await assertManage(hackathonId, user)
  const entry = await prisma.stageEntry.findFirst({
    where: { id: entryId, submission: { hackathonId, status: 'active' } },
    include: { stage: { include: { criteria: true } }, submission: { include: { project: { include: { members: { select: { userId: true } } } } } } },
  })
  if (!entry) throw new ActionError('Submission not found')
  if (entry.stage.judgingClosedAt) throw new ActionError('Judging is closed for this stage')
  if (entry.submission.project.members.some((m) => m.userId === user.id)) throw new ActionError('You are on this team and cannot score it')
  const clean = Object.fromEntries(entry.stage.criteria.filter((c) => c.id in scores).map((c) => [c.id, scores[c.id]!]))
  const total = weightedTotal(clean, entry.stage.criteria, entry.stage.scaleMax)
  if (total == null) throw new ActionError('Score every criterion from 0 to 10')
  const judge = await prisma.hackathonJudge.upsert({
    where: { hackathonId_email: { hackathonId, email: user.email.toLowerCase() } },
    create: { hackathonId, email: user.email.toLowerCase(), userId: user.id, trackIds: [], termsAcceptedAt: new Date() },
    update: { userId: user.id, termsAcceptedAt: new Date() },
  })
  const assignment = await prisma.judgeAssignment.upsert({
    where: { judgeId_entryId: { judgeId: judge.id, entryId } },
    create: { judgeId: judge.id, entryId, createdById: user.id },
    update: {},
  })
  await prisma.review.upsert({
    where: { assignmentId: assignment.id },
    create: { assignmentId: assignment.id, scores: clean, total, submittedAt: new Date() },
    update: { scores: clean, total, submittedAt: new Date(), conflictDeclared: false },
  })
  await recordAudit({ actorId: user.id, action: 'polaris.review.score', entityType: 'StageEntry', entityId: entryId, after: { total } })
  refresh()
})
