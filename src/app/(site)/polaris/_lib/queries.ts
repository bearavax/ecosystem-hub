import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { userSearchWhere } from '@/lib/user-search'
import { POLARIS_PAGE_SIZE, type EntryFilter, type ReviewQuery, entryFilter } from './rules'

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
