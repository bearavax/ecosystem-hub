import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { getMySubmissions, getPublicHackathon } from '@/app/(site)/events/_lib/hackathons/queries'
import { getPublicEvent } from '@/app/(site)/events/_lib/queries'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { userSearchWhere } from '@/lib/user-search'
import { DENS_PAGE_SIZE, POLARIS_PAGE_SIZE, POLARIS_SLUG, type EntryFilter, type ReviewQuery, type StandingFilter, entryFilter } from './rules'

function entriesWhere(filter: EntryFilter): Prisma.StageEntryListRelationFilter | undefined {
  switch (filter.kind) {
    case 'any':
      return undefined
    case 'missing':
      return { none: { stageId: filter.stageId } }
    case 'submitted':
      return { some: { stageId: filter.stageId } }
    case 'advanced':
      return { some: { stageId: filter.stageId, advancedAt: { not: null } } }
    case 'not_advanced':
      return { some: { stageId: filter.stageId, advancedAt: null } }
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

function submissionWhere(hackathonId: string, q: ReviewQuery): Prisma.SubmissionWhereInput {
  const entries = entriesWhere(entryFilter(q.stageId, q.standing))
  return {
    hackathonId,
    ...(q.status !== 'any' ? { status: q.status } : {}),
    ...(q.trackId ? { trackIds: { has: q.trackId } } : {}),
    ...(entries ? { entries } : {}),
    ...(q.q
      ? {
          project: {
            OR: [{ currentVersion: { name: { contains: q.q, mode: 'insensitive' } } }, { members: { some: { user: userSearchWhere(q.q) } } }],
          },
        }
      : {}),
  }
}

const submissionSelect = {
  id: true,
  status: true,
  trackIds: true,
  createdAt: true,
  project: {
    select: {
      slug: true,
      currentVersion: { select: { name: true } },
      members: { where: { role: { in: ['owner', 'writer'] } }, select: { role: true, user: { select: { name: true } } } },
    },
  },
  entries: { select: { id: true, stageId: true, advancedAt: true } },
} satisfies Prisma.SubmissionSelect

export type PolarisSubmissionRow = Prisma.SubmissionGetPayload<{ select: typeof submissionSelect }>

/** One SQL page of submissions. The page size is fixed so a few hundred teams stay a short query. */
export async function listPolarisSubmissions(hackathonId: string, q: ReviewQuery) {
  const where = submissionWhere(hackathonId, q)
  const [rows, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (q.page - 1) * POLARIS_PAGE_SIZE,
      take: POLARIS_PAGE_SIZE + 1,
      select: submissionSelect,
    }),
    prisma.submission.count({ where }),
  ])
  return { rows: rows.slice(0, POLARIS_PAGE_SIZE), hasMore: rows.length > POLARIS_PAGE_SIZE, total }
}

/** People on more than one active submission (owner or writer). Zero when each person is on one team. */
export async function countSharedMembers(hackathonId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT pm."userId"
      FROM "hackathon_submissions" s
      JOIN "project_members" pm ON pm."projectId" = s."projectId"
      WHERE s."hackathonId" = ${hackathonId}
        AND s.status = 'active'
        AND pm.role IN ('owner', 'writer')
      GROUP BY pm."userId"
      HAVING COUNT(DISTINCT s.id) > 1
    ) d
  `
  return Number(rows[0]?.n ?? 0)
}

export const loadPolarisContext = cache(async () => {
  const event = await getPublicEvent(POLARIS_SLUG)
  if (!event) return null
  const user = await getCurrentUser()
  const h = await getPublicHackathon(event.id, user?.id ?? null)
  if (!h) return null
  const mine = user ? await getMySubmissions(h.id, user.id) : []
  return { event, h, user, mine }
})

const denSelect = {
  id: true,
  trackIds: true,
  project: {
    select: {
      id: true,
      currentVersion: { select: { name: true } },
      members: { where: { role: { in: ['owner', 'writer'] } }, select: { id: true, userId: true } },
    },
  },
  entries: { select: { stageId: true, advancedAt: true } },
} satisfies Prisma.SubmissionSelect

export type DenRow = Prisma.SubmissionGetPayload<{ select: typeof denSelect }>

function standingSql(filter: EntryFilter): Prisma.Sql {
  switch (filter.kind) {
    case 'any':
      return Prisma.empty
    case 'missing':
      return Prisma.sql`AND NOT EXISTS (SELECT 1 FROM hackathon_stage_entries e WHERE e."submissionId" = s.id AND e."stageId" = ${filter.stageId})`
    case 'submitted':
      return Prisma.sql`AND EXISTS (SELECT 1 FROM hackathon_stage_entries e WHERE e."submissionId" = s.id AND e."stageId" = ${filter.stageId})`
    case 'advanced':
      return Prisma.sql`AND EXISTS (SELECT 1 FROM hackathon_stage_entries e WHERE e."submissionId" = s.id AND e."stageId" = ${filter.stageId} AND e."advancedAt" IS NOT NULL)`
    case 'not_advanced':
      return Prisma.sql`AND EXISTS (SELECT 1 FROM hackathon_stage_entries e WHERE e."submissionId" = s.id AND e."stageId" = ${filter.stageId} AND e."advancedAt" IS NULL)`
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

/** Newest dens, paged in SQL. Open seats are teams under the hackathon size cap. */
export async function listDens(hackathonId: string, opts: { page: number; pageSize?: number; trackId?: string; stageId?: string; standing: StandingFilter; openOnly: boolean; teamMax: number | null }) {
  const pageSize = opts.pageSize ?? DENS_PAGE_SIZE
  const trackSql = opts.trackId ? Prisma.sql`AND ${opts.trackId} = ANY(s."trackIds")` : Prisma.empty
  const openSql = opts.openOnly && opts.teamMax != null
    ? Prisma.sql`AND (SELECT COUNT(*) FROM project_members pm WHERE pm."projectId" = s."projectId" AND pm.role IN ('owner', 'writer')) < ${opts.teamMax}`
    : Prisma.empty
  const extra = standingSql(entryFilter(opts.stageId, opts.standing))
  const skip = (opts.page - 1) * pageSize
  const [ids, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id FROM hackathon_submissions s
      WHERE s."hackathonId" = ${hackathonId} AND s.status = 'active'
      ${trackSql} ${openSql} ${extra}
      ORDER BY s."createdAt" DESC, s.id DESC
      OFFSET ${skip} LIMIT ${pageSize + 1}
    `,
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM hackathon_submissions s
      WHERE s."hackathonId" = ${hackathonId} AND s.status = 'active'
      ${trackSql} ${openSql} ${extra}
    `,
  ])
  const pageIds = ids.slice(0, pageSize).map((r) => r.id)
  const found = pageIds.length ? await prisma.submission.findMany({ where: { id: { in: pageIds } }, select: denSelect }) : []
  const order = new Map(pageIds.map((id, i) => [id, i]))
  found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return { rows: found, hasMore: ids.length > pageSize, total: Number(totalRows[0]?.n ?? 0) }
}

export function countDens(hackathonId: string) {
  return prisma.submission.count({ where: { hackathonId, status: 'active' } })
}

export async function polarisCounts(hackathonId: string, teamMax: number | null) {
  const [teams, submissions, builders, openRows] = await Promise.all([
    prisma.submission.count({ where: { hackathonId, status: 'active' } }),
    prisma.stageEntry.count({ where: { submission: { hackathonId, status: 'active' } } }),
    prisma.participant.count({ where: { hackathonId, status: 'active' } }),
    teamMax == null
      ? Promise.resolve([{ n: 0 }])
      : prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n FROM hackathon_submissions s
          WHERE s."hackathonId" = ${hackathonId} AND s.status = 'active'
          AND (SELECT COUNT(*) FROM project_members pm WHERE pm."projectId" = s."projectId" AND pm.role IN ('owner', 'writer')) < ${teamMax}
        `,
  ])
  return { teams, submissions, builders, openSeats: Number(openRows[0]?.n ?? 0) }
}

export async function listJoinRequests(hackathonId: string, projectId: string) {
  const people = await prisma.participant.findMany({
    where: { hackathonId, status: 'active' },
    select: { userId: true, answers: true, user: { select: { name: true, email: true } } },
  })
  return people.flatMap((person) => {
    const answers = person.answers
    const requests = answers && typeof answers === 'object' && !Array.isArray(answers) && Array.isArray((answers as { joinRequests?: unknown }).joinRequests)
      ? (answers as { joinRequests: { projectId?: string }[] }).joinRequests
      : []
    return requests.some((r) => r.projectId === projectId) ? [{ userId: person.userId, name: person.user.name, email: person.user.email }] : []
  })
}

export async function listOpenBuilders(hackathonId: string) {
  const people = await prisma.participant.findMany({
    where: { hackathonId, status: 'active' },
    select: { userId: true, answers: true, user: { select: { name: true, bio: true, skills: true } } },
  })
  return people.flatMap((person) => {
    const answers = person.answers
    const open = answers && typeof answers === 'object' && !Array.isArray(answers) && (answers as { openToTeam?: unknown }).openToTeam === true
    if (!open) return []
    const timezone = (answers as { timezone?: unknown }).timezone
    return [{ userId: person.userId, name: person.user.name, bio: person.user.bio, skills: person.user.skills, timezone: typeof timezone === 'string' ? timezone : '' }]
  })
}

export async function listAround(hackathonId: string) {
  return prisma.participant.findMany({
    where: { hackathonId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: {
      user: {
        select: {
          name: true,
          projectMembers: {
            where: { role: { in: ['owner', 'writer'] } },
            select: { project: { select: { members: { where: { role: { in: ['owner', 'writer'] } }, select: { id: true } } } } },
          },
        },
      },
    },
  })
}
