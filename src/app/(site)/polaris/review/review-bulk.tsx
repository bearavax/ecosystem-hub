'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setAdvanced } from '@/app/(site)/events/_lib/hackathons/judging-actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useActionToast } from '@/hooks/use-action-toast'
import { STANDING_LABEL, type Standing } from '../_lib/rules'

export type ReviewTableRow = {
  id: string
  name: string
  projectHref: string
  manageHref: string
  team: string
  tracks: string
  status: string
  stages: { stageId: string; standing: Standing }[]
  entryId: string | null
}

export function ReviewTable({
  hackathonId,
  stageId,
  stageName,
  canAdvance,
  stageHeaders,
  rows,
}: {
  hackathonId: string
  stageId: string | null
  stageName: string | null
  canAdvance: boolean
  stageHeaders: { id: string; name: string }[]
  rows: ReviewTableRow[]
}) {
  const [picked, setPicked] = useState<string[]>([])
  const { pending, run } = useActionToast()
  const selectable = rows.flatMap((r) => (r.entryId ? [r.entryId] : []))
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const advance = (advanced: boolean) =>
    run(async () => {
      if (!stageId) return { ok: false, error: 'Pick a stage first' }
      const res = await setAdvanced({ hackathonId, stageId, entryIds: picked, advanced })
      if (res.ok) setPicked([])
      return res
    }, advanced ? 'Teams advanced' : 'Advance cleared')

  return (
    <div>
      {canAdvance && stageId && stageName && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending || picked.length === 0} onClick={() => advance(true)}>
            Advance selected ({picked.length})
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending || picked.length === 0} onClick={() => advance(false)}>
            Clear advance
          </Button>
          <span className="text-sm text-fg-muted">Applies to {stageName} on this page. Teams are emailed when they advance.</span>
        </div>
      )}
      <div className="overflow-x-auto border border-line">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line text-fg-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                {canAdvance && (
                  <Checkbox
                    checked={selectable.length > 0 && picked.length === selectable.length}
                    onCheckedChange={(c) => setPicked(c === true ? selectable : [])}
                    aria-label="Select all on this page"
                  />
                )}
              </th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Tracks</th>
              {stageHeaders.map((s) => (
                <th key={s.id} className="px-3 py-2 font-medium whitespace-nowrap">{s.name}</th>
              ))}
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5 + stageHeaders.length} className="px-3 py-8 text-fg-muted">No teams match these filters.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2">
                  {canAdvance && r.entryId && (
                    <Checkbox checked={picked.includes(r.entryId)} onCheckedChange={() => { const id = r.entryId; if (id) toggle(id) }} aria-label={`Select ${r.name}`} />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={r.manageHref} className="text-fg-heading underline-offset-2 hover:underline">{r.name}</Link>
                  <div><Link href={r.projectHref} className="text-xs text-fg-muted underline-offset-2 hover:underline">Hub project</Link></div>
                </td>
                <td className="px-3 py-2 text-fg-body">{r.team}</td>
                <td className="px-3 py-2 text-fg-body">{r.tracks}</td>
                {r.stages.map((s) => (
                  <td key={s.stageId} className="px-3 py-2 whitespace-nowrap text-fg-body">{STANDING_LABEL[s.standing]}</td>
                ))}
                <td className="px-3 py-2 text-fg-body">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
